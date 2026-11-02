# OS Project
# ConeCurrency 🍦

Scalability Analysis of a Concurrent
Ice Cream Ordering Server.

## Technologies
- C
- Linux
- POSIX Threads
- TCP Sockets
- Python

## Team
Three-member Operating Systems project.

## Delivered work and remaining integration

Khadija has delivered the P2 implementation and shared setup listed below.
GitHub's Linux P2 networking checks passed for implementation commit `bb8cc34`.
This is a component delivery; the complete application still requires P1 and P3.

| Area | Delivered | Remaining |
| --- | --- | --- |
| P2 networking | TCP listener, request handler, sequential server, CLI, timeouts, shutdown, tests | Integration with real P1 booking/statistics and P3 concurrent mode |
| P2 benchmarks | Measurement driver, CSV output, graph tool, system-call demo script | Run both real modes and collect actual results |
| Shared setup | Folders, Makefile, Linux test workflow, protocol and C headers | Team review/signoff of interfaces |
| P1 synchronization | Integration headers and clearly labelled test substitute only | Real booking engine, mutex, statistics, load tester, race proof |
| P3 concurrency | Integration headers only | Bounded queue, worker pool, concurrent mode and tests |
| GUI | Assigned to a teammate | Ice cream shop interface |

See [verification evidence and limitations](docs/verification.md). P2 tests use
a sequential-only P1 substitute; they do not prove concurrent inventory safety.

## Ice cream shop and team roles

Each BOOK reserves one cone from shared inventory. The core experiment compares
sequential and concurrent ticket booking using C, Linux sockets, mutexes, and
POSIX threads. A teammate owns the ice cream shop GUI; it is outside P2's scope.

The supplied Team Task Division assigns P1 synchronization and load testing,
P2 networking/sequential server and benchmarks, and P3 queue/thread pool and
concurrent mode. The user identifies as P2. Other member names are not assigned
here. See [protocol](docs/protocol.md) and [integration status](docs/integration.md).

## P2 verification before other members deliver their modules

On Linux with GCC, make, and Python 3 installed:

```sh
make test
./build/p2-test-server --mode sequential --tickets 10 --port 8080 --delay-ms 20
```

This server uses a labelled, unsynchronized TEST STUB for P1. It is only for
networking checks. It cannot validate concurrency or prevent overselling.

In another terminal, send a request using netcat:

```sh
printf 'BOOK\n' | nc -N 127.0.0.1 8080
```

The teammate's GUI can connect using the same BOOK protocol.

## Production integration

`make all` requires P1's real src/booking.c and src/stats.c. `make concurrent`
also requires P3's src/queue.c, src/threadpool.c and src/concurrent.c. These files
have not been supplied; missing modules intentionally fail the build.

```sh
make all
./ticket-server --mode sequential --tickets 10 --workers 4 --queue 32 --port 8080 --delay-ms 20
```

After both modes and the real inventory have passed integration tests:

```sh
bash scripts/run_benchmarks.sh
python3 tools/plot_benchmarks.py benchmarks/results/RUN_DIRECTORY/summary.csv
```

Benchmarks produce measured CSV/logs/configuration and optional graphs. No
performance claims or concurrency correctness results have been recorded yet.
