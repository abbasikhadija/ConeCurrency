#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-concurrent}"
if [[ $# -gt 0 ]]; then shift; fi
case "$mode" in
    sequential|concurrent) ;;
    *) echo "Usage: bash scripts/start.sh [sequential|concurrent] [server flags...]" >&2; exit 2 ;;
esac
make all
exec ./ticket-server --mode "$mode" "$@"
