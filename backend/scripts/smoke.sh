#!/usr/bin/env bash
# Quick contract checks against a running server (default 127.0.0.1:8080).
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"

curl -fsS "$BASE/health" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["status"]=="ok"; assert d["countries"]>=12, d; print("health ok", d["countries"], "countries")'
curl -fsS "$BASE/api/countries" | python3 -c 'import json,sys; d=json.load(sys.stdin); codes={c["code"] for c in d}; assert {"PE","US","BR","AU"} <= codes, codes; assert all("bbox" in c for c in d); print("countries ok", len(codes))'
curl -fsS "$BASE/api/region?country=BR&bbox=-73.85,-11.05,-66.65,-7.35&start=2024&end=2024" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["cells"] > 0
assert d["cell_year_p98"] >= 1
months={m["month"]:m for m in d["months"]}
assert months[9]["low"] is not None and months[9]["high"] is not None, months[9]
print("region ok", d["cells"], "cells")'
curl -fsS "$BASE/api/grid/BR?year=2024" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["month"]==0 and d["columns"]==["cell","lat","lon","harm"]
assert len(d["rows"]) > 0
print("grid ok", len(d["rows"]), "rows")'
curl -fsS "$BASE/api/series/BR/BR-BA?level=years" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["id"]=="BR-BA" and len(d["rows"])==23
print("series ok", len(d["rows"]), "years")'
curl -fsS -o /dev/null "$BASE/data/boundaries/bra_adm1_simplified.geojson"
echo "boundaries ok"
echo "smoke passed"
