"""P2 integration tests use a labelled, sequential-only P1 substitute."""
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
import unittest

SERVER = Path(os.environ.get("P2_TEST_SERVER", "build/p2-test-server")).resolve()


@unittest.skipUnless(SERVER.is_file(), "Build the Linux P2 test server with make test")
class NetworkTests(unittest.TestCase):
    def setUp(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            self.port = probe.getsockname()[1]
        self.process = subprocess.Popen(
            [str(SERVER), "--port", str(self.port), "--tickets", "2", "--delay-ms", "0"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # Startup announces readiness only after bind/listen succeed.
        self.assertIn(b"ConeCurrency sequential", self.process.stdout.readline())

    def tearDown(self):
        if self.process.poll() is None:
            self.process.send_signal(signal.SIGINT)
        out, err = self.process.communicate(timeout=4)
        self.assertEqual(self.process.returncode, 0, (out, err))

    def request(self, message, fragments=False):
        with socket.create_connection(("127.0.0.1", self.port), timeout=4) as client:
            client.settimeout(4)
            if fragments:
                for byte in message:
                    client.sendall(bytes([byte]))
                    time.sleep(.01)
            else:
                client.sendall(message)
            reply = bytearray()
            while not reply.endswith(b"\n"):
                chunk = client.recv(64)
                if not chunk:
                    break
                reply.extend(chunk)
            return bytes(reply)

    def test_fragmentation_and_sold_out(self):
        self.assertEqual(self.request(b"BOOK\n", True), b"OK BOOKED\n")
        self.assertEqual(self.request(b"BOOK\n"), b"OK BOOKED\n")
        self.assertEqual(self.request(b"BOOK\n"), b"ERR SOLD_OUT\n")

    def test_invalid_requests_do_not_consume_stock(self):
        for request in (b"garbage\n", b"BOOK\x00\n", b"BOOK\r\n", b"\n", b"x" * 64):
            self.assertEqual(self.request(request), b"ERR BAD_REQUEST\n")
        self.assertEqual(self.request(b"BOOK\n"), b"OK BOOKED\n")

    def test_partial_eof(self):
        with socket.create_connection(("127.0.0.1", self.port), timeout=4) as client:
            client.sendall(b"BO")
            client.shutdown(socket.SHUT_WR)
            self.assertEqual(client.recv(64), b"ERR BAD_REQUEST\n")

    def test_silent_client_has_deadline(self):
        start = time.monotonic()
        with socket.create_connection(("127.0.0.1", self.port), timeout=4) as client:
            self.assertEqual(client.recv(64), b"ERR BAD_REQUEST\n")
        self.assertLess(time.monotonic() - start, 3.5)
        self.assertEqual(self.request(b"BOOK\n"), b"OK BOOKED\n")

    def test_disconnect_does_not_kill_server(self):
        client = socket.create_connection(("127.0.0.1", self.port), timeout=4)
        client.close()
        self.assertEqual(self.request(b"BOOK\n"), b"OK BOOKED\n")

    def test_sigint_while_client_is_idle(self):
        with socket.create_connection(("127.0.0.1", self.port), timeout=4):
            start = time.monotonic()
            self.process.send_signal(signal.SIGINT)
            self.process.wait(timeout=2)
            self.assertLess(time.monotonic() - start, 2)

    def test_cli_rejects_invalid_values(self):
        for arguments in (["--port", "0"], ["--tickets", "-1"], ["--workers", "0"],
                          ["--queue", "0"], ["--delay-ms", "abc"], ["--mode", "wrong"],
                          ["--port", "65536"], ["--tickets", "999999999999"], ["extra"]):
            result = subprocess.run([str(SERVER)] + arguments, capture_output=True, timeout=2)
            self.assertEqual(result.returncode, 2, arguments)


if __name__ == "__main__":
    unittest.main()
