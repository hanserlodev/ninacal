#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

generator=()
if command -v ninja >/dev/null 2>&1; then
  generator=(-G Ninja)
fi

cmake -S . -B build "${generator[@]}" -DCMAKE_BUILD_TYPE=Release
cmake --build build
python3 scripts/build_db.py
