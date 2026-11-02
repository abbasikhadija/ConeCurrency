#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Requires real P1/P3 modules. Never benchmark tests/p1_stub.c.
make concurrent
python3 tools/benchmark.py "$@"
