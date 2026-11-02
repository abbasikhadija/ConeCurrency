# P2 implementation and team handoffs

## Scope and current status

P2 owns src/main.c, options.c, network.c, handler.c, sequential.c, networking
tests, system-call scripts, and benchmark measurement/graphs. A teammate owns
the ice cream shop GUI; no GUI implementation is included in P2's work.
Shared work includes the
folder layout, Makefile, protocol, and common headers.

The source files are local implementation, not evidence of passed Linux tests.
GitHub review, team signoff, production integration, and actual measurements
remain separate completion gates. No generated results are included.

## Shared setup

| Task | State |
| --- | --- |
| S1 Linux tools | WSL is not installed on this Windows machine; Linux setup pending |
| S2 Folders | Local src/include/tests/tools/scripts/docs/benchmarks present |
| S3 Makefile | Written; Linux execution must be verified |
| S4 Shared protocol/headers | Written from task division; concrete signatures await team review |

On Ubuntu/WSL install: `sudo apt install build-essential git gdb strace netcat-openbsd python3 python3-matplotlib`.
Installing WSL itself may require administrator access and a restart; it has not
been attempted automatically.

## P1 handoff

Implement src/booking.c and src/stats.c against include/booking.h and stats.h.
booking_try_reserve must protect check-and-decrement atomically. remaining must
be synchronized too. Stats must be thread-safe and stats_print runs after workers
join. Initialization happens once per process. Keep all network I/O and fake work
outside inventory locks. P1 still owns the general-purpose load tester, booking
unit tests, repeated race proof, and shared demo script.

tests/p1_stub.c is deliberately sequential and labelled TEST STUB. Only the
build/p2-test-server target links it. Neither production target links it.
Passing P2 tests cannot prove mutex correctness or no overselling.

## P3 handoff

Implement queue.c, threadpool.c, concurrent.c against the shared headers. Review
the proposed opaque allocation APIs together before parallel work. Creation
functions return NULL on failure; partial pool creation must close the queue,
join created workers, release resources, and report failure.

concurrent_run owns queue/pool lifecycle but borrows listen_fd. main closes the
listener after concurrent_run returns. Stop accepting when server_stop is set,
queue_close, drain queued descriptors, join workers, then destroy the queue.
Workers still close every owned fd even when handle_client returns immediately
because shutdown has begun. No worker may print final stats or destroy inventory.

main installs SIGINT/SIGTERM handlers that only set server_stop. Before creating
workers, P3 must use pthread_sigmask to block SIGINT and SIGTERM so workers inherit
that mask, then unblock them in the acceptor. Observe server_stop using bounded
poll waits, including error cleanup. The handler checks it during bounded read,
write, and artificial-work waits. SIGPIPE is ignored process-wide.

Use `make concurrent` after P1/P3 modules exist. Without that target, the default
sequential build explicitly rejects --mode concurrent; it never fakes concurrency.

## P2 tests and demonstration

`make test` compiles the P2-only test server with strict warnings and runs the
Python tests. They cover request fragmentation, sold out, malformed and oversized
input, incomplete EOF, silent timeout, disconnect survival, active-client SIGINT,
and invalid CLI values. Client tests exercise BOOK and fragmented replies through
real local sockets. Linux CI is configured but has not run until pushed.

`bash scripts/system_calls.sh` runs strace. Send `printf 'BOOK\n' | nc -N 127.0.0.1 8080`
from a second terminal. `bash scripts/system_calls.sh PID` lists that server's file descriptors.
The accept loop handles one client before accepting the next; each connection
has a descriptor that is closed exactly once by its owner.

## Benchmarks

Once real modules are integrated, run `bash scripts/run_benchmarks.sh`.
The P2 driver measures a fixed BOOK-only workload directly against raw TCP, using
both modes, 1/10/50/100 simultaneous users and three repetitions. Each case starts
a fresh server with tickets equal to users, queue capacity at least users, four
workers and identical 20ms work. Each user sends one order; no warmup is used.
Run on the same otherwise idle machine; the client shares the server machine.
This short-burst experiment does not establish sustained-load saturation.

The P2 benchmark driver is separate from P1's broader stress/race tool, whose
CLI is not delivered yet. Integrating that tool is still a joint handoff.

Every suite records a timestamped config.json, commit/dirty status, server logs,
raw.csv and summary.csv under benchmarks/results. Mode order alternates per
repetition. Non-booked outcomes, startup failure, or failed shutdown fail the
suite while retaining data; partial suites cannot be plotted as complete.

Summary includes request and successful-booking throughput, mean/median/nearest-
rank p95 latency, CPU percentage from procfs CPU-time delta over the load window,
and RSS/thread peaks sampled every 10ms. CPU may exceed 100% across cores; very
short tests have coarse CPU-tick resolution. Memory/thread peaks are sampled,
not exact lifetime maxima. Latency includes connect, server wait/work, and reply.

Generate actual graphs with:
`python3 tools/plot_benchmarks.py benchmarks/results/RUN_DIRECTORY/summary.csv`.
Graphs show per-mode means across repetitions with sample-standard-deviation
error bars. Never substitute illustrative measurements or claim concurrency wins
without inspecting results. P1's race proof and P3's overload tests remain required.

## Final shared gates still pending

Each member documents their component and reviews another member's code. The
team must verify production builds, both modes, race/overload tests, clean shutdown,
the live shop, and a fresh clone. Demo rehearsal, PR reviews, and a v1.0 tag must
follow actual verification; none is assumed complete here.
