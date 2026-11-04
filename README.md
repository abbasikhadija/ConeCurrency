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
| P2 networking | TCP listener, request handler, sequential server, CLI, timeouts, shutdown, tests | Benchmarks across full integrated system |
| P2 benchmarks | Measurement driver, CSV output, graph tool, system-call demo script | Run both real modes and collect actual results |
| Shared setup | Folders, Makefile, Linux test workflow, protocol and C headers | Fully integrated |
| P1 synchronization | Real booking engine (`booking.c`), POSIX mutex, thread-safe stats (`stats.c`), load tester (`load_test.py`), race proof (`test_race.py`), demo script (`demo.sh`) | Final joint benchmark run |
| P3 concurrency | Bounded queue, worker pool, concurrent mode and tests | Final joint benchmark run |
| GUI | Artisanal Ice Cream Parlour Web UI (`tools/gui.py`) & Desktop UI (`tools/desktop_gui.py`) | Ready to run |

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

## P3 concurrency engine

**Status update:** P3 has delivered `src/queue.c`, `src/threadpool.c` and
`src/concurrent.c` (merged in PR #2). The P3 rows and notes above were written
before that delivery; the only remaining P3 dependency is P1's real
`src/booking.c` and `src/stats.c`.

P3 turns the server from "one cashier" into "many cashiers". The main thread
only accepts customers; a fixed team of worker threads serves them.

```
customers ──► accept loop ──► bounded queue ──► worker 1 ─┐
              (main thread)    [■■■□□□□□]   ──► worker 2 ─┼─► handle_client ─► booking (mutex)
                    │                       ──► worker N ─┘
                    └─► queue full? reply ERR BUSY and close
```

| File | Ice cream shop | What it does |
| --- | --- | --- |
| `src/queue.c` | The rope line | Bounded FIFO of client sockets. One mutex protects it; a condition variable lets idle workers sleep instead of busy-waiting. Never blocks the accept loop: a full queue is rejected immediately. |
| `src/threadpool.c` | The cashier team | Starts `--workers` POSIX threads once. Each repeats: take a client from the queue, call `handle_client`, close the socket. SIGINT/SIGTERM are blocked in workers so only the main thread receives Ctrl+C. |
| `src/concurrent.c` | The door manager | `poll()` every 500 ms (so Ctrl+C is noticed promptly), `accept()`, push to the queue or reply `ERR BUSY`. On shutdown: close the queue, wake and join all workers, free the queue. |

### Key design decisions

- **Fixed thread pool**, not one thread per client: resource use is capped.
- **Load shedding:** when the queue is full the client gets `ERR BUSY` at once
  instead of waiting forever.
- **Condition variable with a `while` re-check:** idle workers use 0% CPU and are
  safe against spurious wakeups.
- **No deadlock by design:** a worker releases the queue lock before calling the
  handler, so no thread ever holds the queue lock and the booking lock together.
- **One owner per socket:** the accept thread owns a client until it is queued;
  after that the worker that takes it is the only one that closes it.

### Run P3's checks

```sh
CFLAGS="-std=c11 -D_POSIX_C_SOURCE=200809L -Iinclude -Wall -Wextra -Werror -g"
mkdir -p build

# Queue and thread pool unit tests
gcc $CFLAGS -O2 src/queue.c tests/test_queue.c -o build/test-queue -pthread && ./build/test-queue
gcc $CFLAGS -O2 src/queue.c src/threadpool.c tests/test_threadpool.c -o build/test-threadpool -pthread && ./build/test-threadpool

# Data race detection
gcc $CFLAGS -fsanitize=thread src/queue.c src/threadpool.c tests/test_threadpool.c -o build/test-threadpool-tsan -pthread && ./build/test-threadpool-tsan

# Full server in concurrent mode with the labelled P1 TEST STUB, plus integration tests
gcc $CFLAGS -O2 -DWITH_CONCURRENT src/main.c src/options.c src/network.c src/handler.c src/sequential.c \
    tests/p1_stub.c src/queue.c src/threadpool.c src/concurrent.c -o build/p3-test-server -pthread
python3 -m unittest tests.test_concurrent -v
```

The same checks run automatically on every push and pull request in
`.github/workflows/p3-tests.yml`, including ThreadSanitizer, AddressSanitizer
and UndefinedBehaviorSanitizer.

The stub build checks the concurrency engine only (workers, queue, `ERR BUSY`,
shutdown). It has no mutex, so it **cannot** prove that tickets are never
oversold; that proof needs P1's real `booking.c`.

### Try concurrent mode

Terminal 1:

```sh
./build/p3-test-server --mode concurrent --workers 4 --queue 8 --tickets 5 --delay-ms 100
```

Terminal 2:

```sh
ps -L -p $(pgrep p3-test-server) -o pid,tid,stat,comm      # 1 main thread + 4 workers
for i in 1 2 3 4 5 6 7; do printf 'BOOK\n' | nc -N 127.0.0.1 8080 & done; wait
```

Overload: restart terminal 1 with `--workers 1 --queue 1 --delay-ms 500` and run
the same burst; some customers receive `ERR BUSY` and the server keeps working.
Press Ctrl+C in terminal 1 for a clean shutdown with final statistics.

Once P1's modules exist, `make concurrent` builds the production server:

```sh
make concurrent
./ticket-server --mode concurrent --tickets 10 --workers 4 --queue 32 --port 8080 --delay-ms 20
```

Full design, timelines and tests: [P3 concurrency engine](docs/CONCURRENCY_ENGINE.md).

## P1 synchronization engine

**Status update:** Person 1 (AQ) has delivered `src/booking.c`, `src/stats.c`, unit tests in `tests/test_booking.c`, the barrier-synchronized Python load tester `tools/load_test.py`, the race condition verification suite `tests/test_race.py`, and the unified demo script `scripts/demo.sh`.

P1 guarantees that no matter how many worker threads or simultaneous client requests arrive, the shared cone inventory is never oversold or double-booked.

```
Worker 1 ──┐                                   ┌── OK BOOKED (inventory decremented)
Worker 2 ──┼──► pthread_mutex_lock(&lock) ──► ┤
Worker N ──┘     [ Critical Section: Check     └── ERR SOLD_OUT (inventory == 0)
                 and decrement remaining ]
                 pthread_mutex_unlock(&lock)
```

| File | Ice cream shop | What it does |
| --- | --- | --- |
| `src/booking.c` | The inventory vault | Shared counter of cones (`remaining`). Wrapped in a POSIX mutex (`pthread_mutex_t`). Atomically tests `remaining > 0` and decrements. In unsafe demo mode (`-DUNSAFE_MODE`), the lock is omitted to prove race hazards. |
| `src/stats.c` | The ledger | Thread-safe counters for `BOOKED`, `SOLD_OUT`, `BUSY`, and `BAD`. Synchronized with a dedicated mutex and printed on server termination. |
| `tests/test_booking.c` | Unit validation | Standalone assertions verifying single-thread depletion and 100 concurrent threads competing for 50 tickets. |
| `tools/load_test.py` | The rush hour simulator | Python tool using `threading.Barrier` so all user threads send `BOOK\n` at the exact same microsecond, calculating throughput, median latency, and error breakdown. |
| `tests/test_race.py` | Race condition proof | Runs 1 ticket vs 20 concurrent users over 20 iterations. In safe mode, `booked == 1` always; in unsafe mode, overselling is detected. |
| `scripts/demo.sh` | Evaluation script | Shell runner demonstrating sequential, concurrent, race condition, overload shedding, and invalid request scenarios. |

### Key design decisions

- **Shortest possible critical section:** Artificial delays and network I/O occur completely outside the mutex. Threads only hold the lock for the single memory comparison and decrement (~nanoseconds).
- **Deadlock prevention:** No thread ever holds the queue lock and inventory lock at the same time.
- **Barrier synchronization:** The Python load tester synchronizes all threads with `threading.Barrier`, ensuring maximum concurrency collision.

### Run P1's checks

```sh
# Run booking and concurrency unit tests
make build/test-booking && ./build/test-booking

# Run with ThreadSanitizer (proves zero data races)
gcc -std=c11 -D_POSIX_C_SOURCE=200809L -Iinclude -Wall -Wextra -Werror -g \
    -fsanitize=thread src/booking.c src/stats.c tests/test_booking.c -o build/test-booking-tsan -pthread
./build/test-booking-tsan

# Run race condition verification (20 iterations)
make concurrent
python3 tests/test_race.py

# Run comparative Safe vs Unsafe demonstration
make unsafe
python3 tests/test_race.py --demo

# Run unified demo script
bash scripts/demo.sh all

# Launch the Artisanal Ice Cream Parlour Web Dashboard (Zero-dependency, works on Ubuntu/WSL)
python3 tools/gui.py
# Or launch the native X11 Tkinter desktop app:
python3 tools/desktop_gui.py
```
