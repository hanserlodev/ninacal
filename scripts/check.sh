#!/usr/bin/env bash
# Cheap checks that run locally and in CI. No dependencies beyond bash + python3.
set -euo pipefail

cd "$(dirname "$0")/.."

fail=0
ok() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }

echo "Files"
required=(
  "README.md"
  "LICENSE"
  "CONTRIBUTING.md"
  "CODE_OF_CONDUCT.md"
  "SECURITY.md"
  "CHANGELOG.md"
  "docs/methodology.md"
  "docs/data-dictionary.md"
  "docs/limitations.md"
  "docs/ARCHITECTURE.md"
  "data/schemas/processed-year.schema.json"
  "data/schemas/calibration.schema.json"
  "data/samples/mock.json"
  "data/v2/manifest.json"
  "apps/web/package.json"
)
for file in "${required[@]}"; do
  if [ -s "$file" ]; then ok "$file"; else bad "missing or empty: $file"; fi
done

echo "JSON and data contract"
if python3 scripts/validate_data.py; then
  ok "data files"
else
  bad "data files"
fi

if python3 scripts/validate_v2_data.py; then
  ok "v2 data contract"
else
  bad "v2 data contract"
fi

echo "Line endings and whitespace"
while IFS= read -r file; do
  if grep -q $'\r' "$file"; then bad "CRLF found: $file"; fi
done < <(git ls-files -- '*.md' '*.json' '*.yml' '*.yaml' '*.ts' '*.tsx' '*.css' '*.sh' 'Makefile' 2>/dev/null || true)

while IFS= read -r match; do
  bad "trailing whitespace: $match"
done < <(grep -rnI --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=out \
  --exclude-dir=build --exclude-dir=__pycache__ --exclude='*.sqlite' \
  --include='*.json' --include='*.ts' --include='*.tsx' --include='*.css' --include='*.yml' \
  --include='*.yaml' --include='*.sh' --include='Makefile' ' $' . 2>/dev/null | grep -v '^./package-lock.json' || true)

echo
if [ "$fail" -ne 0 ]; then
  echo "FAILED"
  exit 1
fi
echo "All checks passed."
