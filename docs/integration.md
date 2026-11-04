# Integrated Ubuntu backend

## Architecture and preserved ownership

A TCP client sends BOOK LF to 127.0.0.1. P2 creates the listener, parses CLI
options and handles each request. In sequential mode it accepts, handles and
closes one client at a time. In concurrent mode P3 accepts into its bounded FIFO;
a fixed worker pool invokes that same P2 handler, then closes each descriptor.
The handler calls P1's mutex-protected booking engine and thread-safe statistics.
No queue lock is held during booking, fake work, socket I/O or statistics calls.

The original C/POSIX/TCP architecture, single-cone inventory, wire protocol,
module APIs, all owners' source files, unit tests, demo scenarios, benchmark
formats and optional unsafe lab demonstration have been retained. The unsafe
binary is separate; the real application never links the P1 test substitute.
The shared stop flag uses a lock-free C11 atomic integer so signal delivery and
worker reads are synchronized. Signal handlers still only set a stop flag.

No GUI/bridge, database or authentication component is present in this checkout.
A teammate's GUI can use the agreed TCP protocol. Browsers require that
teammate's bridge because the backend provides raw TCP rather than HTTP.

## Integration repairs

- One production ticket-server now contains all owners' real modules and supports
  sequential and concurrent modes. make concurrent remains a compatibility alias.
- make test builds/runs all C tests, real-server networking/concurrency/client tests,
  and the 20-iteration race invariant. P2's isolated substitute tests remain too.
- The optional unsafe build no longer fails strict warnings on its unused mutex.
- P1 workflow YAML is valid; P3 CI uses real inventory instead of a data-racing stub.
- The load tester releases its barrier before connections, avoiding preconnected
  sockets filling workers/backlog while other clients wait at the barrier.
  Connection/barrier failures now cause nonzero exit codes. CSV fields are
  retained, with started_at added; percentile calculation uses nearest rank.
- Demo startup reads its own readiness log instead of injecting empty TCP probes.
  Concurrent demonstration waits for its client workload rather than the server.
  Race/overload/invalid scenarios check outcomes and propagate failures.
- Startup and package setup scripts run from any working directory. No dependency
  on a contributor's Windows paths or shell profile is introduced.
- ThreadSanitizer's helper thread is explicitly included in instrumented test
  expectations; ordinary builds must still have exactly main + worker threads.

## Ubuntu dependencies and commands

See README for fresh-checkout commands. Supported verification targets are
Ubuntu 22.04/24.04, GCC 11+, Make 4.3+, Python 3.10+, Bash 5. Core operation needs
build-essential and Python; demos use netcat-openbsd, system-call inspection
uses strace, and graphing uses python3-matplotlib. git and gdb support development.
No pip packages or virtual environment are required when using Ubuntu packages.
No .env, database setup or secrets are needed. Options are passed on the CLI.

bash scripts/setup_ubuntu.sh installs packages then runs make all test.
bash scripts/start.sh concurrent starts the real backend; server flags may follow.
Start only one server per port. Inventory resets to --tickets each process start.

During shutdown P3 closes the queue, wakes/joins workers, then frees it; main
closes its listener and prints statistics after joining. Pending descriptors
are drained and closed, but interrupted requests may receive no reply, as in
the original design. A lost reply does not roll back a completed reservation.

## Benchmark design

P2's benchmark driver and P1's load tester remain separate tools with different
purposes. Both use real BOOK traffic against the same production binary.
The driver measures both modes at 1/10/50/100 users, three repetitions, a fresh
server for every case, inventory equal to users, queue at least users, four
workers, and identical 20ms work. Mode order alternates between repetitions.
There is no warmup; this is a short-burst comparison, not sustained saturation.

Raw CSV, logs, configuration, commit identity and summary metrics are preserved.
Non-booked responses or failed shutdown invalidate the comparison; failed suites
retain data and cannot be plotted as complete. Latency includes connection/wait/
work/reply. CPU is procfs CPU delta divided by load duration; RSS/thread peaks
are sampled every 10ms and can miss shorter peaks. Very short CPU measurements
have coarse tick resolution. Shared CI hardware is unsuitable for general claims
that one mode always wins. Re-run on the agreed idle lab machine for the report.

## Remaining joint work

Review the integration branch together, connect the separately delivered GUI,
rehearse the presentation and repeat performance measurements on the agreed
Ubuntu demo machine. A release tag should follow those checks. Verification
history and exact CI evidence are in verification.md.
