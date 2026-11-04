#!/usr/bin/env bash
# ==============================================================================
# scripts/demo.sh - Unified Demonstration Script for ConeCurrency
# Owner: Person 1 (AQ / Abdul Qudoos) - Concurrency & Synchronization
# Scenarios:
#   1) sequential  - Head-of-line blocking demonstration (single cashier)
#   2) concurrent  - Parallel worker thread pool speedup (multiple cashiers)
#   3) race        - 1 ticket vs 20 users race condition proof (Mutex protection)
#   4) overload    - Bounded queue load shedding (ERR BUSY rejection)
#   5) invalid     - Malformed request resilience (ERR BAD_REQUEST)
#   6) all         - Run all demonstration scenarios sequentially
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-8080}"
SERVER="./ticket-server"
LOG=""
PID=""

check_server_binary() {
    make all
}

wait_for_server() {
    local max_wait=30
    local count=0
    while ! grep -q '^ConeCurrency .* on 127.0.0.1:' "$LOG"; do
        if ! kill -0 "$PID" 2>/dev/null; then
            cat "$LOG" >&2
            return 1
        fi
        sleep 0.1
        count=$((count + 1))
        if [[ $count -ge $max_wait ]]; then
            echo "[!] Server failed to bind to port $PORT within 3 seconds"
            exit 1
        fi
    done
}

stop_server() {
    local pid="$1"
    if kill -0 "$pid" 2>/dev/null; then
        echo "[*] Gracefully stopping server (PID: $pid) with SIGINT..."
        kill -INT "$pid"
    fi
    wait "$pid"
    [[ -z "$LOG" ]] || { cat "$LOG"; rm -f "$LOG"; LOG=""; }
}

start_server() {
    LOG=$(mktemp)
    "$SERVER" "$@" >"$LOG" 2>&1 &
    PID=$!
    trap 'stop_server "$PID"' EXIT
    wait_for_server
}

demo_sequential() {
    echo ""
    echo "========================================================================"
    echo "  DEMO 1: SEQUENTIAL SERVER (Single Cashier / Head-of-Line Blocking)    "
    echo "========================================================================"
    echo "Starting sequential server with 5 tickets and 200ms delay per request..."
    start_server --mode sequential --tickets 5 --port "$PORT" --delay-ms 200

    echo "[*] Sending 3 booking requests sequentially..."
    time for i in 1 2 3; do
        printf "Request $i: "
        printf "BOOK\n" | nc -N 127.0.0.1 "$PORT"
    done

    stop_server $PID
    trap - EXIT
}

demo_concurrent() {
    echo ""
    echo "========================================================================"
    echo "  DEMO 2: CONCURRENT SERVER (4 Worker Threads / Parallel Speedup)       "
    echo "========================================================================"
    echo "Starting concurrent server with 4 workers and 200ms delay..."
    start_server --mode concurrent --tickets 20 --workers 4 --queue 32 --port "$PORT" --delay-ms 200

    echo "[*] Bursting 4 requests simultaneously (should complete in ~200ms instead of ~800ms)..."
    time {
        python3 tools/load_test.py --port "$PORT" --users 4 --expect-booked 4
    }

    stop_server $PID
    trap - EXIT
}

demo_race() {
    echo ""
    echo "========================================================================"
    echo "  DEMO 3: RACE CONDITION PROOF (1 Ticket vs 20 Concurrent Users)         "
    echo "========================================================================"
    echo "Starting concurrent server with exactly 1 ticket in inventory..."
    start_server --mode concurrent --tickets 1 --workers 8 --queue 32 --port "$PORT" --delay-ms 20

    echo "[*] Firing 20 concurrent requests using Python load tester..."
    python3 tools/load_test.py --port "$PORT" --users 20 --expect-booked 1 --expect-sold-out 19

    echo "[*] Notice: Exactly 1 user secured OK BOOKED, 19 received ERR SOLD_OUT."
    echo "[*] The POSIX mutex completely prevented double-booking / overselling!"

    stop_server $PID
    trap - EXIT
}

demo_overload() {
    echo ""
    echo "========================================================================"
    echo "  DEMO 4: OVERLOAD HANDLING & LOAD SHEDDING (Queue Limit Reached)       "
    echo "========================================================================"
    echo "Starting server with 1 worker, tiny queue of size 1, and 500ms delay..."
    start_server --mode concurrent --tickets 50 --workers 1 --queue 1 --port "$PORT" --delay-ms 500

    echo "[*] Flooding with 10 concurrent requests; excess must shed via ERR BUSY..."
    python3 tools/load_test.py --port "$PORT" --users 10 --expect-busy-min 1

    echo "[*] Notice: Worker serves active client, queue holds 1, remaining shed with ERR BUSY."

    stop_server $PID
    trap - EXIT
}

demo_invalid() {
    echo ""
    echo "========================================================================"
    echo "  DEMO 5: INVALID REQUEST HANDLING (Malformed & Lowercase Rejections)   "
    echo "========================================================================"
    start_server --mode concurrent --tickets 10 --workers 2 --queue 8 --port "$PORT" --delay-ms 0

    echo -n "Sending 'book\n' (lowercase): "
    reply=$(printf "book\n" | nc -N 127.0.0.1 "$PORT"); echo "$reply"; [[ "$reply" == 'ERR BAD_REQUEST' ]]

    echo -n "Sending 'HELLO\n' (garbage):   "
    reply=$(printf "HELLO\n" | nc -N 127.0.0.1 "$PORT"); echo "$reply"; [[ "$reply" == 'ERR BAD_REQUEST' ]]

    echo -n "Sending 'BOOK' (no newline):  "
    reply=$(printf "BOOK" | nc -N 127.0.0.1 "$PORT"); echo "$reply"; [[ "$reply" == 'ERR BAD_REQUEST' ]]

    echo -n "Sending valid 'BOOK\n':        "
    reply=$(printf "BOOK\n" | nc -N 127.0.0.1 "$PORT"); echo "$reply"; [[ "$reply" == 'OK BOOKED' ]]

    stop_server $PID
    trap - EXIT
}

# Main command dispatcher
check_server_binary
SCENARIO="${1:-all}"

case "$SCENARIO" in
    sequential) demo_sequential ;;
    concurrent) demo_concurrent ;;
    race)       demo_race ;;
    overload)   demo_overload ;;
    invalid)    demo_invalid ;;
    all)
        demo_sequential
        demo_concurrent
        demo_race
        demo_overload
        demo_invalid
        echo ""
        echo "========================================================================"
        echo "  ALL DEMONSTRATION SCENARIOS COMPLETED SUCCESSFULLY!                  "
        echo "========================================================================"
        ;;
    *)
        echo "Usage: $0 [sequential|concurrent|race|overload|invalid|all]"
        exit 1
        ;;
esac

