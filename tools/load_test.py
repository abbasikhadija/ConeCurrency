#!/usr/bin/env python3
"""Multi-threaded concurrent load tester for ConeCurrency.

Simulates simultaneous client requests using threading.Barrier to ensure
all threads fire at the exact same moment to stress concurrency and trigger races.
"""

import argparse
import csv
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
    return parser.parse_args()


def client_worker(user_id, host, port, timeout, barrier, results):
    """Worker simulating one user sending BOOK\\n after barrier release."""
    status = "ERROR"
    latency_ms = 0.0

    try:
        # Pre-connect to align socket connection and synchronize firing
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            barrier.wait(timeout=30)  # Wait for all users to be ready

            start = time.perf_counter()
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
        latency_ms = 0.0
        status = f"FAIL ({type(exc).__name__})"
    except threading.BrokenBarrierError:
        status = "BARRIER_TIMEOUT"

    results.append({
        "user_id": user_id,
        "status": status,
        "latency_ms": latency_ms,
        "timestamp": time.time(),
    })


def run_load_test(host, port, users, timeout, csv_path=None, quiet=False):
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
        if r["latency_ms"] > 0:
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
                p95 = sorted(latencies)[int(len(latencies) * 0.95)]
                print(f"  - 95th %%: {p95:.2f} ms")
        print("=" * 50 + "\n")

    if csv_path:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["user_id", "status", "latency_ms", "timestamp"])
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
    if summary["counts"].get("FAIL", 0) > 0:
        sys.exit(1)
    sys.exit(0)

