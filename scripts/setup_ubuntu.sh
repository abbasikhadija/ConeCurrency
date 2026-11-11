#!/usr/bin/env bash
# Install the distribution packages, then build and verify the merged backend.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Linux ]] || ! command -v apt-get >/dev/null; then
    echo 'Run this script inside Ubuntu (native, VM, or WSL Ubuntu).' >&2
    exit 1
fi
installer=()
if [[ "$EUID" -ne 0 ]]; then installer=(sudo); fi
"${installer[@]}" apt-get update
"${installer[@]}" apt-get install -y build-essential git python3 python3-matplotlib netcat-openbsd strace gdb
make all test
echo 'Ready. Start with: bash scripts/start.sh concurrent'
