#!/usr/bin/env bash
# Apply the validated 78-country payload on the VPS.
#
#   sudo bash vps-apply-78.sh /tmp/ninacal-78-payload.tar.zst
#
# Backs up the running 12-country data, extracts the new bundle, restarts the
# API container and verifies it. Rolls back automatically on failure.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  exec sudo --preserve-env=APP_DIR bash "$0" "$@"
fi

PAYLOAD="${1:-/tmp/ninacal-78-payload.tar.zst}"
APP_DIR="${APP_DIR:-/opt/ninacal}"
STAMP="$(date +%Y%m%d-%H%M%S)"

ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

[ -f "$PAYLOAD" ] || die "payload not found: $PAYLOAD"
[ -d "$APP_DIR" ] || die "app dir not found: $APP_DIR"
command -v zstd >/dev/null || die "zstd is not installed (apt-get install -y zstd)"
command -v docker >/dev/null || die "docker is not installed"

cd "$APP_DIR"
FREE_KB=$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')
[ "$FREE_KB" -gt 8388608 ] || die "need at least 8 GB free in $APP_DIR (have $((FREE_KB/1024)) MB)"

echo "== payload"
ls -lh "$PAYLOAD"
if [ -f "${PAYLOAD}.sha256" ]; then
  # Compare hashes directly: the .sha256 file stores a bare filename, so
  # `sha256sum -c` would resolve it against the current directory.
  EXPECTED=$(awk 'NR==1 {print $1}' "${PAYLOAD}.sha256")
  ACTUAL=$(sha256sum "$PAYLOAD" | awk '{print $1}')
  if [ -z "$EXPECTED" ] || [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "expected: $EXPECTED" >&2
    echo "actual:   $ACTUAL" >&2
    die "checksum mismatch"
  fi
  ok "checksum $ACTUAL"
fi

echo "== backup"
if [ -d data/v2 ]; then
  mv data/v2 "data/v2.bak-$STAMP"
  ok "data/v2 -> data/v2.bak-$STAMP"
fi
if [ -f backend/data/ninacal.sqlite ]; then
  mv backend/data/ninacal.sqlite "backend/data/ninacal.sqlite.bak-$STAMP"
  ok "sqlite -> ninacal.sqlite.bak-$STAMP"
fi
mkdir -p data backend/data

rollback() {
  echo "== rollback"
  if [ -d "data/v2.bak-$STAMP" ]; then
    rm -rf data/v2
    mv "data/v2.bak-$STAMP" data/v2
    echo "restored data/v2"
  fi
  if [ -f "backend/data/ninacal.sqlite.bak-$STAMP" ]; then
    rm -f backend/data/ninacal.sqlite
    mv "backend/data/ninacal.sqlite.bak-$STAMP" backend/data/ninacal.sqlite
    echo "restored ninacal.sqlite"
  fi
  docker compose restart api >/dev/null 2>&1 || true
  die "deployment failed; previous data restored"
}
trap rollback ERR

echo "== extract"
tar -I zstd -xf "$PAYLOAD" -C "$APP_DIR"
[ -f data/v2/manifest.json ] || die "manifest missing after extract"
[ -f backend/data/ninacal.sqlite ] || die "sqlite missing after extract"
chown -R root:root data/v2 backend/data/ninacal.sqlite
ok "extracted"

echo "== restart"
docker compose restart api
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:8080/health >/dev/null || {
  echo "API is not healthy" >&2
  rollback
}
ok "health"

echo "== verify"
COUNTRIES=$(curl -fsS http://127.0.0.1:8080/api/countries | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$COUNTRIES" = "78" ] || {
  echo "expected 78 countries, got $COUNTRIES" >&2
  rollback
}
ok "countries: $COUNTRIES"

# Never pipe curl into head under `set -o pipefail`: head closes the pipe and
# curl exits 23 (SIGPIPE), which looks like a failure even when the API is fine.
check() {
  local label="$1" url="$2" out code
  out="$(mktemp)"
  code=$(curl -sS -o "$out" -w '%{http_code}' "$url" || echo 000)
  if [ "$code" != "200" ]; then
    echo "$label -> HTTP $code" >&2
    rm -f "$out"
    rollback
  fi
  printf '%s -> HTTP 200: ' "$label"
  head -c 120 "$out"
  echo
  rm -f "$out"
}

check "grid DE  " 'http://127.0.0.1:8080/api/grid/DE?year=2024'
check "grid BR  " 'http://127.0.0.1:8080/api/grid/BR?year=2024'
check "series DE" 'http://127.0.0.1:8080/api/series/DE'

trap - ERR
echo
ok "deployed"
du -sh data/v2 backend/data/ninacal.sqlite
docker compose ps || true
echo
echo "Backups kept at:"
echo "  $APP_DIR/data/v2.bak-$STAMP"
echo "  $APP_DIR/backend/data/ninacal.sqlite.bak-$STAMP"
echo "Remove them after the frontend verification."
