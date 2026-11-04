"""Integration regressions using the real P1/P2/P3 production executable."""
from contextlib import contextmanager
import csv
from pathlib import Path
import re
import selectors
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "ticket-server"


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def request(port, message):
    with socket.create_connection(("127.0.0.1", port), timeout=5) as client:
        client.sendall(message)
        client.shutdown(socket.SHUT_WR)
        response = bytearray()
        while not response.endswith(b"\n"):
            chunk = client.recv(64)
            if not chunk:
                break
            response.extend(chunk)
        return bytes(response)


class IntegratedTests(unittest.TestCase):
    @contextmanager
    def server(self, mode, tickets=3, port=None, use_wrapper=False):
        self.assertTrue(SERVER.is_file(), "Run make all before integration tests")
        port = port or free_port()
        command = (["bash", str(ROOT / "scripts/start.sh"), mode] if use_wrapper else
                   [str(SERVER), "--mode", mode])
        process = subprocess.Popen(
            command + ["--tickets", str(tickets),
             "--workers", "4", "--queue", "256", "--delay-ms", "0", "--port", str(port)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
        stats = {}
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                deadline = time.monotonic() + 5
                while True:
                    self.assertTrue(selector.select(max(0, deadline - time.monotonic())),
                                    "Server readiness timeout")
                    line = process.stdout.readline()
                    self.assertTrue(line, "Server exited before readiness")
                    if f"ConeCurrency {mode}".encode() in line:
                        break
            yield port, stats
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
            try:
                out, err = process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
                self.fail("Server did not terminate cleanly")
            self.assertEqual(process.returncode, 0, err)
            self.assertEqual(err, b"", "No runtime/sanitizer diagnostics expected")
            stats.update({name.decode(): int(value) for name, value in
                          re.findall(rb"(booked|sold_out|busy|bad|remaining)=(\d+)", out)})
            self.assertIn("remaining", stats)
            self.assertEqual(stats["booked"] + stats["remaining"], tickets)

    def test_real_modes_malformed_depletion_and_accounting(self):
        for mode in ("sequential", "concurrent"):
            with self.subTest(mode=mode):
                with self.server(mode, tickets=1) as (port, stats):
                    self.assertEqual(request(port, b"book\n"), b"ERR BAD_REQUEST\n")
                    self.assertEqual(request(port, b"BOOK\n"), b"OK BOOKED\n")
                    self.assertEqual(request(port, b"BOOK\n"), b"ERR SOLD_OUT\n")
                self.assertEqual(stats, dict(booked=1, sold_out=1, busy=0, bad=1, remaining=0))

    def test_p1_load_tester_connects_to_both_modes_and_writes_csv(self):
        for mode in ("sequential", "concurrent"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "results.csv"
                with self.server(mode) as (port, stats):
                    result = subprocess.run(
                        [sys.executable, "tools/load_test.py", "--port", str(port), "--users", "20",
                         "--csv", str(output), "--quiet", "--expect-booked", "3", "--expect-sold-out", "17"],
                        cwd=ROOT, capture_output=True, text=True, timeout=15)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                with output.open(newline="") as stream:
                    rows = list(csv.DictReader(stream))
                self.assertEqual(len(rows), 20)
                self.assertEqual(sum(row["status"] == "BOOKED" for row in rows), 3)
                self.assertEqual(stats["remaining"], 0)

    def test_load_tester_failure_is_nonzero_without_barrier_hang(self):
        result = subprocess.run(
            [sys.executable, "tools/load_test.py", "--port", str(free_port()),
             "--users", "3", "--timeout", "0.2", "--quiet"],
            cwd=ROOT, capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 1, result.stderr)

    def test_restart_reuses_port_and_resets_inventory(self):
        port = free_port()
        for mode in ("sequential", "concurrent"):
            with self.server(mode, tickets=1, port=port):
                self.assertEqual(request(port, b"BOOK\n"), b"OK BOOKED\n")

    def test_startup_script_serves_real_bookings(self):
        with self.server("concurrent", tickets=1, use_wrapper=True) as (port, _):
            self.assertEqual(request(port, b"BOOK\n"), b"OK BOOKED\n")
            self.assertEqual(request(port, b"BOOK\n"), b"ERR SOLD_OUT\n")


if __name__ == "__main__":
    unittest.main()
