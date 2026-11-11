#!/usr/bin/env python3
"""Multi-threaded concurrent load tester for ConeCurrency.

Simulates simultaneous client requests using threading.Barrier to ensure
all threads fire at the exact same moment to stress concurrency and trigger races.
"""

import argparse
import csv
import math
import socket
import statistics
import sys
import threading
import time


def parse_args():
    parser = argparse.ArgumentParser(
        description="ConeCurrency Multi-User Concurrent Load Tester"
    )
    parser.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument("--users", type=int, default=20, help="Number of concurrent users (default: 20)")
    parser.add_argument("--timeout", type=float, default=5.0, help="Socket timeout in seconds (default: 5.0)")
    parser.add_argument("--csv", dest="csv_path", default=None, help="Optional CSV file to output raw results")
    parser.add_argument("--quiet", action="store_true", help="Print summary only")
    parser.add_argument("--expect-booked", type=int, help="Fail unless exactly this many orders book")
    parser.add_argument("--expect-sold-out", type=int, help="Fail unless exactly this many are sold out")
    parser.add_argument("--expect-busy-min", type=int, help="Fail unless at least this many are busy")
    args = parser.parse_args()
    if not 1 <= args.users <= 1000 or not 1 <= args.port <= 65535:
        parser.error("users must be 1..1000 and port must be 1..65535")
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("timeout must be a finite positive number")
    for name in ("expect_booked", "expect_sold_out", "expect_busy_min"):
        if getattr(args, name) is not None and getattr(args, name) < 0:
            parser.error("expected counts must be nonnegative")
    return args


def client_worker(user_id, host, port, timeout, barrier, results):
    """Worker simulating one user sending BOOK\\n after barrier release."""
    status = "ERROR"
    latency_ms = 0.0
    started_at = time.time()

    try:
        # Release before connecting: preconnected users can occupy all server
        # workers while the barrier waits for users stuck in the TCP backlog.
        barrier.wait(timeout=30)
        start = time.perf_counter()
        started_at = time.time()
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(b"BOOK\n")

            response = bytearray()
            while len(response) < 64:
                chunk = sock.recv(64)
                if not chunk:
                    break
                response.extend(chunk)
                if chunk.endswith(b"\n"):
                    break

            latency_ms = (time.perf_counter() - start) * 1000.0
            resp_str = bytes(response).decode("ascii", errors="replace").strip()
            if resp_str == "OK BOOKED":
                status = "BOOKED"
            elif resp_str == "ERR SOLD_OUT":
                status = "SOLD_OUT"
            elif resp_str == "ERR BUSY":
                status = "BUSY"
            elif resp_str == "ERR BAD_REQUEST":
                status = "BAD_REQUEST"
            else:
                status = f"UNKNOWN ({resp_str})"
    except (socket.timeout, OSError) as exc:
        latency_ms = (time.perf_counter() - start) * 1000.0
        status = f"FAIL ({type(exc).__name__})"
    except threading.BrokenBarrierError:
        status = "BARRIER_TIMEOUT"

    results.append({
        "user_id": user_id,
        "status": status,
        "latency_ms": latency_ms,
        "timestamp": time.time(),
        "started_at": started_at,
    })


def run_load_test(host, port, users, timeout, csv_path=None, quiet=False):
    if not 1 <= users <= 1000 or not 1 <= port <= 65535 or timeout <= 0 or not math.isfinite(timeout):
        raise ValueError("Expected users 1..1000, port 1..65535, finite positive timeout")
    barrier = threading.Barrier(users)
    results = []
    threads = []

    if not quiet:
        print(f"[*] Preparing {users} concurrent client threads for {host}:{port}...")

    wall_start = time.perf_counter()

    for i in range(users):
        t = threading.Thread(
            target=client_worker,
            args=(i + 1, host, port, timeout, barrier, results),
        )
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    wall_duration = time.perf_counter() - wall_start

    # Aggregate metrics
    status_counts = {}
    latencies = []
    for r in results:
        status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1
        if r["status"] in {"BOOKED", "SOLD_OUT", "BUSY", "BAD_REQUEST"}:
            latencies.append(r["latency_ms"])

    if not quiet:
        print("\n" + "=" * 50)
        print("          LOAD TEST EXECUTION SUMMARY          ")
        print("=" * 50)
        print(f"Total Users Simulated:  {users}")
        print(f"Wall Clock Time:        {wall_duration:.3f} s")
        print(f"Effective Throughput:   {users / wall_duration:.2f} req/s\n")
        print("Response Breakdown:")
        for status, count in sorted(status_counts.items()):
            pct = (count / users) * 100.0
            print(f"  - {status:15s}: {count:5d} ({pct:5.1f}%)")

        if latencies:
            print("\nLatency Metrics (successful round-trips):")
            print(f"  - Min:    {min(latencies):.2f} ms")
            print(f"  - Max:    {max(latencies):.2f} ms")
            print(f"  - Mean:   {statistics.mean(latencies):.2f} ms")
            print(f"  - Median: {statistics.median(latencies):.2f} ms")
            if len(latencies) >= 20:
                p95 = sorted(latencies)[math.ceil(len(latencies) * 0.95) - 1]
                print(f"  - 95th %%: {p95:.2f} ms")
        print("=" * 50 + "\n")

    if csv_path:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["user_id", "status", "latency_ms", "timestamp", "started_at"])
            writer.writeheader()
            writer.writerows(results)
        if not quiet:
            print(f"[*] Raw results saved to: {csv_path}")

    return {
        "users": users,
        "wall_duration": wall_duration,
        "counts": status_counts,
        "latencies": latencies,
        "results": results,
    }


if __name__ == "__main__":
    args = parse_args()
    summary = run_load_test(
        host=args.host,
        port=args.port,
        users=args.users,
        timeout=args.timeout,
        csv_path=args.csv_path,
        quiet=args.quiet,
    )
    valid = {"BOOKED", "SOLD_OUT", "BUSY", "BAD_REQUEST"}
    if any(status not in valid for status in summary["counts"]):
        sys.exit(1)
    for option, status in ((args.expect_booked, "BOOKED"), (args.expect_sold_out, "SOLD_OUT")):
        if option is not None and summary["counts"].get(status, 0) != option:
            print(f"Expected {option} {status}, got {summary['counts'].get(status, 0)}", file=sys.stderr)
            sys.exit(1)
    if args.expect_busy_min is not None and summary["counts"].get("BUSY", 0) < args.expect_busy_min:
        print("Expected more ERR BUSY responses", file=sys.stderr)
        sys.exit(1)
    sys.exit(0)

