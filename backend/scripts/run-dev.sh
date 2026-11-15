#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./build/ninacal-server --db data/ninacal.sqlite --data ../data/v2 --host 127.0.0.1 --port 8080
