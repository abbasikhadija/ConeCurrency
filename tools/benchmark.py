"""P2 benchmark measurement driver, not a replacement for P1's stress/race tester."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import platform
import signal
import socket
import statistics
import subprocess
import threading
import time


def percentile95(values):
    return sorted(values)[max(0, math.ceil(len(values) * .95) - 1)]


def request(port, timeout, barrier):
    barrier.wait(timeout=30)
    started = time.perf_counter()
    result = "ERROR"
    detail = ""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout) as client:
            client.sendall(b"BOOK\n")
            response = bytearray()
            while len(response) < 64:
                chunk = client.recv(1)
                if not chunk:
                    break
                response.extend(chunk)
                if chunk == b"\n":
                    break
            result = {b"OK BOOKED\n": "BOOKED", b"ERR SOLD_OUT\n": "SOLD_OUT",
                      b"ERR BUSY\n": "BUSY", b"ERR BAD_REQUEST\n": "BAD_REQUEST"}.get(
                          bytes(response), "INVALID_REPLY")
    except OSError as error:
        detail = type(error).__name__
    return result, (time.perf_counter() - started) * 1000, detail


def proc_sample(pid):
    # Linux procfs: CPU seconds, resident memory KiB, current thread count.
    stat = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
    ticks = __import__("os").sysconf("SC_CLK_TCK")
    cpu = (int(stat[11]) + int(stat[12])) / ticks
    status = Path(f"/proc/{pid}/status").read_text().splitlines()
    fields = dict(line.split(":", 1) for line in status)
    return cpu, int(fields["VmRSS"].split()[0]), int(fields["Threads"].strip())


def run_case(args, directory, mode, users, run, raw_writer, raw_file):
    stem = f"{mode}-{users}-{run}"
    command = [str(args.server.resolve()), "--mode", mode, "--tickets", str(users),
               "--workers", str(args.workers), "--queue", str(max(32, users)),
               "--port", str(args.port), "--delay-ms", str(args.delay_ms)]
    with (directory / f"{stem}.log").open("w") as log:
        process = subprocess.Popen(command, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 5
            log_path = directory / f"{stem}.log"
            while "ConeCurrency " not in log_path.read_text():
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError(f"Server did not start. Inspect {log_path}")
                time.sleep(.02)
            cpu_before, rss_before, threads_before = proc_sample(process.pid)
            samples = [(cpu_before, rss_before, threads_before)]
            monitor_stop = threading.Event()

            def monitor():
                while not monitor_stop.wait(.01):
                    try:
                        samples.append(proc_sample(process.pid))
                    except (OSError, KeyError, ValueError):
                        return

            monitor_thread = threading.Thread(target=monitor, daemon=True)
            monitor_thread.start()
            try:
                barrier = threading.Barrier(users + 1)
                timeout = max(5, users * args.delay_ms / 1000 + 5)
                with ThreadPoolExecutor(max_workers=users) as pool:
                    futures = [pool.submit(request, args.port, timeout, barrier) for _ in range(users)]
                    started = time.perf_counter()
                    barrier.wait(timeout=30)
                    results = [future.result() for future in futures]
                    elapsed = time.perf_counter() - started
                samples.append(proc_sample(process.pid))
            finally:
                monitor_stop.set()
                monitor_thread.join(timeout=2)
            for index, (outcome, latency, detail) in enumerate(results):
                raw_writer.writerow([mode, users, run, index, outcome, latency, detail])
            raw_file.flush()
            latencies = [latency for _, latency, _ in results]
            booked = sum(outcome == "BOOKED" for outcome, _, _ in results)
            summary = [mode, users, run, elapsed, users / elapsed, booked / elapsed,
                       statistics.mean(latencies), statistics.median(latencies), percentile95(latencies),
                       booked, users - booked,
                       (samples[-1][0] - cpu_before) / elapsed * 100,
                       max(sample[1] for sample in samples), max(sample[2] for sample in samples)]
            return summary
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    raise RuntimeError("Server failed clean shutdown")
            if process.returncode != 0:
                raise RuntimeError(f"Server exited {process.returncode}; inspect {stem}.log")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", type=Path, default=Path("ticket-server"))
    parser.add_argument("--output", type=Path, default=Path("benchmarks/results"))
    parser.add_argument("--modes", nargs="+", choices=["sequential", "concurrent"],
                        default=["sequential", "concurrent"])
    parser.add_argument("--users", nargs="+", type=int, default=[1, 10, 50, 100])
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay-ms", type=int, default=20)
    args = parser.parse_args()
    if platform.system() != "Linux":
        parser.error("Run benchmarks on Linux; server metrics use /proc")
    if (not args.server.is_file() or not 1 <= args.port <= 65535 or
            not 1 <= args.workers <= 1024 or not 0 <= args.delay_ms <= 60000 or
            args.runs < 1 or any(n < 1 or n > 1000 for n in args.users)):
        parser.error("Check server path, port, workers, delay, positive runs, and users (1..1000)")
    directory = args.output / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    directory.mkdir(parents=True)
    revision = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    metadata = {key: str(value) if isinstance(value, Path) else value for key, value in vars(args).items()}
    metadata.update(platform=platform.platform(), python=platform.python_version(),
                    commit=revision.stdout.strip(), dirty=bool(dirty.stdout.strip()),
                    design="one request per synchronized user, fresh server per case, no warmup",
                    status="running")
    metadata_path = directory / "config.json"
    metadata_path.write_text(json.dumps(metadata, indent=2))
    try:
        with (directory / "raw.csv").open("w", newline="") as raw_file, \
                (directory / "summary.csv").open("w", newline="") as summary_file:
            raw = csv.writer(raw_file)
            raw.writerow(["mode", "users", "run", "request", "outcome", "latency_ms", "error"])
            summary = csv.writer(summary_file)
            summary.writerow(["mode", "users", "run", "elapsed_s", "requests_per_s", "bookings_per_s",
                              "mean_ms", "median_ms", "p95_ms", "booked", "failed",
                              "server_cpu_percent", "sampled_peak_rss_kib", "sampled_peak_threads"])
            for users in args.users:
                for run in range(1, args.runs + 1):
                    # Alternate mode order to reduce systematic ordering bias.
                    modes = args.modes if run % 2 else list(reversed(args.modes))
                    for mode in modes:
                        row = run_case(args, directory, mode, users, run, raw, raw_file)
                        summary.writerow(row)
                        summary_file.flush()
                        if row[10]:
                            raise RuntimeError("Non-booked responses invalidate this throughput comparison; raw data retained")
        metadata["status"] = "complete"
    except Exception as error:
        metadata.update(status="failed", error=str(error))
        raise
    finally:
        metadata_path.write_text(json.dumps(metadata, indent=2))
        print(directory)


if __name__ == "__main__":
    main()
