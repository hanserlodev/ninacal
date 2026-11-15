#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8080}"
THREADS="${THREADS:-4}"
exec ./build/ninacal-server --db data/ninacal.sqlite --data ../data/v2 --host "$HOST" --port "$PORT" --threads "$THREADS"
