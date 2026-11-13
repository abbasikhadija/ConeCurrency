#!/usr/bin/env python3
"""Race Condition Verification Test for ConeCurrency (Person 1 / Lab 11).

Proves that:
1. Under Safe Mode (with POSIX mutex), concurrent users never double-book or oversell.
   Invariant: booked_tickets + remaining_tickets == initial_tickets (holds 100% of the time).
2. Under Unsafe Mode (without mutex), concurrent race conditions cause overselling.
"""

import os
import re
import selectors
from pathlib import Path
import signal
import socket
import subprocess
import sys
import threading
import time
import unittest

DEFAULT_SAFE_SERVER = Path(os.environ.get("SAFE_SERVER", "ticket-server")).resolve()
DEFAULT_UNSAFE_SERVER = Path(os.environ.get("UNSAFE_SERVER", "build/ticket-server-unsafe")).resolve()


def get_ephemeral_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def send_booking_request(port, barrier, timeout=5.0):
    barrier.wait(timeout=10)
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout) as sock:
            sock.sendall(b"BOOK\n")
            reply = bytearray()
            while not reply.endswith(b"\n") and len(reply) < 64:
                chunk = sock.recv(64)
                if not chunk:
                    break
                reply.extend(chunk)
            return bytes(reply).decode("ascii", errors="replace").strip()
    except Exception as exc:
        return f"ERR_{type(exc).__name__}"


def run_race_iteration(server_path, tickets=1, users=20, workers=8, delay_ms=10):
    """Runs a single race iteration: starts server, bursts concurrent users, cleanly stops."""
    port = get_ephemeral_port()
    cmd = [
        str(server_path),
        "--mode", "concurrent",
        "--tickets", str(tickets),
        "--workers", str(workers),
        "--queue", str(max(32, users)),
        "--port", str(port),
        "--delay-ms", str(delay_ms),
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    # Wait for server banner
    with selectors.DefaultSelector() as selector:
        selector.register(proc.stdout, selectors.EVENT_READ)
        if not selector.select(5):
            proc.kill()
            proc.communicate()
            raise RuntimeError("Server readiness timed out")
        ready_line = proc.stdout.readline()
    if "ConeCurrency" not in ready_line:
        proc.kill()
        _, error = proc.communicate()
        raise RuntimeError(f"Server failed to start properly: {ready_line} {error}")

    barrier = threading.Barrier(users)
    responses = [None] * users

    def worker(idx):
        responses[idx] = send_booking_request(port, barrier)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(users)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    # Clean shutdown via SIGINT
    proc.send_signal(signal.SIGINT)
    stdout, stderr = proc.communicate(timeout=5)
    if proc.returncode != 0 or stderr.strip():
        raise RuntimeError(f"Server exited {proc.returncode}: {stderr}")
    remaining = re.search(r"remaining=(-?\d+)", stdout)
    if remaining is None:
        raise RuntimeError(f"Server did not print final inventory: {stdout}")

    booked_count = sum(1 for r in responses if r == "OK BOOKED")
    sold_out_count = sum(1 for r in responses if r == "ERR SOLD_OUT")
    busy_count = sum(1 for r in responses if r == "ERR BUSY")

    return {
        "booked": booked_count,
        "sold_out": sold_out_count,
        "busy": busy_count,
        "stdout": stdout,
        "responses": responses,
        "remaining": int(remaining.group(1)),
    }


class TestRaceConditionProof(unittest.TestCase):
    @unittest.skipUnless(DEFAULT_SAFE_SERVER.is_file(), f"Server binary not found: {DEFAULT_SAFE_SERVER}")
    def test_mutex_prevents_double_booking_repeatedly(self):
        """Repeats 1 ticket vs 20 users in concurrent mode across 20 iterations.
        Must NEVER oversell: exactly 1 booked every single time."""
        iterations = 20
        users = 20
        tickets = 1

        print(f"\n[+] Testing Safe Server (Mutex Protected): {iterations} iterations, {users} users vs {tickets} ticket...")

        for i in range(iterations):
            result = run_race_iteration(
                server_path=DEFAULT_SAFE_SERVER,
                tickets=tickets,
                users=users,
                workers=8,
                delay_ms=5,
            )

            # Strict Invariant: Exactly 1 ticket was sold, 19 sold out
            self.assertEqual(
                result["booked"],
                tickets,
                f"Iteration {i+1}: OVERBOOKED! Expected {tickets} booking, but got {result['booked']}",
            )
            self.assertEqual(
                result["sold_out"],
                users - tickets,
                f"Iteration {i+1}: Expected {users - tickets} sold out, got {result['sold_out']}",
            )
            self.assertEqual(result["booked"] + result["remaining"], tickets)
            self.assertGreaterEqual(result["remaining"], 0)

        print(f"[+] SUCCESS: Safe server passed all {iterations} iterations with zero double-bookings!")


def main():
    if "--demo" in sys.argv:
        print("=" * 60)
        print("     CONECURRENCY RACE CONDITION PROOF DEMO (Lab 11)     ")
        print("=" * 60)

        # 1. Safe demo
        if DEFAULT_SAFE_SERVER.is_file():
            print("\n>>> Scenario A: MUTEX-PROTECTED SAFE SERVER <<<")
            print(f"Target: {DEFAULT_SAFE_SERVER}")
            print("Running 1 ticket vs 20 concurrent users over 5 runs...")
            for i in range(5):
                res = run_race_iteration(DEFAULT_SAFE_SERVER, tickets=1, users=20)
                if res["booked"] != 1 or res["sold_out"] != 19 or res["remaining"] != 0:
                    raise RuntimeError(f"Safe demo invariant failed: {res}")
                print(f"  Run {i+1}: Booked = {res['booked']} / 1, Sold Out = {res['sold_out']} / 19 -> PASS")
        else:
            print(f"Safe server {DEFAULT_SAFE_SERVER} not found. Build with 'make concurrent' first.")

        # 2. Unsafe demo (if compiled)
        if DEFAULT_UNSAFE_SERVER.is_file():
            print("\n>>> Scenario B: UNSYNCHRONIZED UNSAFE SERVER (NO MUTEX) <<<")
            print(f"Target: {DEFAULT_UNSAFE_SERVER}")
            print("Running 1 ticket vs 20 concurrent users over 5 runs...")
            oversold_count = 0
            for i in range(5):
                res = run_race_iteration(DEFAULT_UNSAFE_SERVER, tickets=1, users=20)
                is_oversold = res["booked"] > 1
                if is_oversold:
                    oversold_count += 1
                status = "FAIL (RACE CONDITION DETECTED: OVERBOOKED!)" if is_oversold else "INCIDENTAL PASS"
                print(f"  Run {i+1}: Booked = {res['booked']} / 1, Sold Out = {res['sold_out']} / 19 -> {status}")
            print(f"\nUnsafe server suffered race conditions in {oversold_count}/5 runs!")
        else:
            print(f"\n[Note] Unsafe server {DEFAULT_UNSAFE_SERVER} not compiled. Compile with 'make unsafe' to see race violations.")

        print("\n" + "=" * 60)
        return

    unittest.main()


if __name__ == "__main__":
    main()

