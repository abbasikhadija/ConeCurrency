#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -eq 1 ]]; then
    [[ "$1" =~ ^[0-9]+$ ]] || { echo 'Usage: system_calls.sh [PID]' >&2; exit 2; }
    ls -l "/proc/$1/fd"
else
    echo "In another terminal: printf 'BOOK\\n' | nc -N 127.0.0.1 8080"
    exec strace -f -e trace=socket,setsockopt,bind,listen,accept,read,write,close \
        ./ticket-server --mode sequential --tickets 10 --delay-ms 20
fi
