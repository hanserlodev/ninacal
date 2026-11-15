#!/usr/bin/env bash
# End-to-end smoke test for the deployed NinaCal stack.
#   ./scripts/smoke.sh [API_BASE] [WEB_BASE]
set -euo pipefail

API="${1:-https://5.189.178.36.sslip.io}"
WEB="${2:-https://ninacal.earth}"
fail=0

ok() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }

echo "API $API"
health=$(curl --compressed -fsS --max-time 20 "$API/health" || true)
if printf '%s' "$health" | grep -q '"status":"ok"'; then ok "health"; else bad "health: $health"; fi

count=$(curl --compressed -fsS --max-time 30 "$API/api/countries" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
if [ "$count" = "78" ]; then ok "countries: $count"; else bad "countries: $count"; fi

for code in DE CHN ITA PRK BR; do
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$API/api/grid/$code?year=2024")
  if [ "$status" = "200" ]; then ok "grid $code"; else bad "grid $code: $status"; fi
done

br_json=$(curl --compressed -fsS --max-time 30 "$API/api/series/BR/BR?level=months" || true)
if printf '%s' "$br_json" | python3 -c '
import json, sys
rows = {(r["year"], r["month"]): r["source"] for r in json.load(sys.stdin)["rows"]}
assert rows[(2024, 5)] == "snpp_observed", rows[(2024, 5)]
assert rows[(2024, 7)] == "noaa20_estimated", rows[(2024, 7)]
assert rows[(2024, 9)] == "snpp_observed", rows[(2024, 9)]
' 2>/dev/null; then ok "BR 2024 sources"; else bad "BR 2024 sources"; fi

chn_json=$(curl --compressed -fsS --max-time 30 "$API/api/series/CHN" || true)
if printf '%s' "$chn_json" | python3 -c '
import json, sys
ids = {entry["id"] for entry in json.load(sys.stdin)}
assert "CHN-ADMIN" in ids
assert "CHN" in ids
' 2>/dev/null; then ok "CHN-ADMIN"; else bad "CHN-ADMIN"; fi

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$API/data/boundaries/deu_adm1_simplified.geojson")
if [ "$status" = "200" ]; then ok "boundary DE"; else bad "boundary DE: $status"; fi

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$API/api/region?country=BR&format=cells")
if [ "$status" = "400" ]; then ok "large CSV blocked"; else bad "large CSV: $status"; fi

echo "WEB $WEB"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$WEB/")
if [ "$status" = "200" ]; then ok "frontend"; else bad "frontend: $status"; fi

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$WEB/context/index.json")
if [ "$status" = "200" ]; then ok "context index"; else bad "context index: $status"; fi

echo
if [ "$fail" -ne 0 ]; then echo "SMOKE FAILED"; exit 1; fi
echo "SMOKE PASSED"
