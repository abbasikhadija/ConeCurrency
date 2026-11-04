"""P3 integration tests for concurrent mode.

These use real P1 booking/statistics with P2 networking and P3 workers.
P1's repeated race-condition test provides the complementary inventory check.

Build first:
  gcc -std=c11 -D_POSIX_C_SOURCE=200809L -Iinclude -Wall -Wextra -Werror -O2 -g \
      -DWITH_CONCURRENT src/main.c src/options.c src/network.c src/handler.c \
      src/sequential.c src/booking.c src/stats.c src/queue.c src/threadpool.c \
      src/concurrent.c -o build/p3-test-server -pthread
"""
import os
from pathlib import Path
import signal
import socket
import subprocess
import threading
import time
import unittest

SERVER = Path(os.environ.get("P3_TEST_SERVER", "build/p3-test-server")).resolve()
REPLIES = {b"OK BOOKED\n", b"ERR SOLD_OUT\n", b"ERR BUSY\n"}


@unittest.skipUnless(SERVER.is_file(), "Build build/p3-test-server first (see module docstring)")
class ConcurrentTests(unittest.TestCase):
    def start(self, workers=4, queue=32, tickets=100, delay=0):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            self.port = probe.getsockname()[1]
        self.process = subprocess.Popen(
            [str(SERVER), "--mode", "concurrent", "--port", str(self.port),
             "--workers", str(workers), "--queue", str(queue),
             "--tickets", str(tickets), "--delay-ms", str(delay)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.assertIn(b"ConeCurrency concurrent", self.process.stdout.readline())

    def tearDown(self):
        if getattr(self, "process", None) and self.process.poll() is None:
            self.process.send_signal(signal.SIGINT)
            self.process.communicate(timeout=5)

    def request(self, results=None):
        with socket.create_connection(("127.0.0.1", self.port), timeout=5) as client:
            client.sendall(b"BOOK\n")
            reply = bytearray()
            while not reply.endswith(b"\n"):
                chunk = client.recv(64)
                if not chunk:
                    break
                reply.extend(chunk)
        if results is not None:
            results.append(bytes(reply))
        return bytes(reply)

    def burst(self, users):
        results, barrier = [], threading.Barrier(users)

        def user():
            barrier.wait()
            try:
                self.request(results)
            except OSError as error:
                results.append(repr(error).encode())

        threads = [threading.Thread(target=user) for _ in range(users)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(10)
        return results

    def test_single_booking(self):
        self.start()
        self.assertEqual(self.request(), b"OK BOOKED\n")

    def test_worker_threads_exist(self):
        self.start(workers=4)
        # The ready line is printed just before the pool starts, so wait briefly.
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            tasks = os.listdir(f"/proc/{self.process.pid}/task")
            if len(tasks) == 1 + 4:
                break
            time.sleep(0.05)
        self.assertEqual(len(tasks), 1 + 4, "expected main thread + 4 workers")

    def test_parallel_workers_are_faster_than_one(self):
        # 8 users x 200 ms of fake work: 1 worker needs ~1.6 s, 4 workers ~0.4 s.
        self.start(workers=4, queue=16, delay=200)
        began = time.monotonic()
        results = self.burst(8)
        elapsed = time.monotonic() - began
        self.assertEqual(len(results), 8)
        self.assertTrue(all(r in REPLIES for r in results), results)
        self.assertLess(elapsed, 1.2, f"8 requests took {elapsed:.2f}s with 4 workers")

    def test_overload_replies_busy_and_survives(self):
        self.start(workers=1, queue=1, delay=500)
        results = self.burst(10)
        self.assertEqual(len(results), 10)
        self.assertTrue(all(r in REPLIES for r in results), results)
        self.assertIn(b"ERR BUSY\n", results)
        self.assertIn(b"OK BOOKED\n", results)
        self.assertEqual(self.request(), b"OK BOOKED\n")   # still alive afterwards

    def test_ctrl_c_with_active_clients_exits_cleanly(self):
        self.start(workers=2, queue=8, delay=3000)
        clients = [socket.create_connection(("127.0.0.1", self.port), timeout=5) for _ in range(4)]
        for client in clients:
            client.sendall(b"BOOK\n")
        time.sleep(0.3)
        began = time.monotonic()
        self.process.send_signal(signal.SIGINT)
        out, _ = self.process.communicate(timeout=5)
        for client in clients:
            client.close()
        self.assertEqual(self.process.returncode, 0)
        self.assertLess(time.monotonic() - began, 2.0, "shutdown should be prompt")
        self.assertIn(b"booked=", out)                      # stats printed after join


if __name__ == "__main__":
    unittest.main()
