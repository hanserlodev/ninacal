#!/usr/bin/env bash
# Stage the minimum data payload the VPS API needs and pack it for transfer.
#
# The API reads grids and aggregates from SQLite. The static /data tree is only
# needed for manifest + series + uncertainty (backend) and calibration/models +
# boundaries (frontend). The per-country years/ and cells.json files are only
# used by the static/demo provider, so they are left out: 1.9 GB -> ~0.4 GB.
#
#   ./deploy/package-data.sh [PIPELINE_DIR] [OUT_DIR]
#
# Defaults:
#   PIPELINE_DIR=../pipeline-work/ninacal-pipeline-v2.2
#   OUT_DIR=/tmp/opencode/ninacal-78-payload
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIPELINE="${1:-$ROOT/../pipeline-work/ninacal-pipeline-v2.2}"
OUT="${2:-/home/hans/Proyectos/nasa2026/ninacal-payload-78}"
SRC_DATA="${NINACAL_DATA:-$ROOT/data/v2}"
SRC_DB="${NINACAL_DB:-$ROOT/backend/data/ninacal.sqlite}"
if [ ! -f "$SRC_DB" ]; then
  SRC_DB="$PIPELINE/data/derived/v2/ninacal.sqlite"
fi
BOUNDARIES="$ROOT/data/v2/boundaries"

for path in "$SRC_DATA/manifest.json" "$SRC_DB"; do
  if [ ! -f "$path" ]; then
    echo "missing: $path" >&2
    exit 1
  fi
done

case "$OUT" in
  ""|"/"|"$HOME"|"$ROOT")
    echo "refusing to delete unsafe output path: '$OUT'" >&2
    exit 1
    ;;
esac
rm -rf "$OUT"
mkdir -p "$OUT/data/v2" "$OUT/backend/data"

echo "== manifest"
cp "$SRC_DATA/manifest.json" "$OUT/data/v2/manifest.json"

if [ -d "$SRC_DATA/context" ]; then
  echo "== planetary context"
  cp -r "$SRC_DATA/context" "$OUT/data/v2/context"
fi

echo "== per-country backend + frontend metadata"
count=0
for dir in "$SRC_DATA"/*/; do
  code="$(basename "$dir")"
  [ -d "$dir" ] || continue
  [ -f "$dir/series.json" ] || continue
  mkdir -p "$OUT/data/v2/$code"
  for file in series.json uncertainty.json calibration.json models.json; do
    [ -f "$dir/$file" ] && cp "$dir/$file" "$OUT/data/v2/$code/$file"
  done
  count=$((count + 1))
done
echo "   $count countries"

echo "== boundaries"
[ -d "$BOUNDARIES" ] || {
  echo "missing boundary directory: $BOUNDARIES" >&2
  exit 1
}
cp -r "$BOUNDARIES" "$OUT/data/v2/boundaries"

echo "== sqlite"
cp "$SRC_DB" "$OUT/backend/data/ninacal.sqlite"

echo "== sizes"
du -sh "$OUT/data/v2" "$OUT/backend/data/ninacal.sqlite" "$OUT"

echo
echo "Payload ready: $OUT"
echo "Transfer (run from this machine, needs SSH access to the VPS):"
echo "  rsync -avP --info=progress2 $OUT/ root@5.189.178.36:/opt/ninacal/"
echo
echo "On the VPS:"
echo "  cd /opt/ninacal && docker compose restart api && sleep 3"
echo "  curl -fsS http://127.0.0.1:8080/health"
echo "  curl -fsS http://127.0.0.1:8080/api/countries | head -c 200"
