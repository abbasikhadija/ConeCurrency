# Integration verification on 4 November 2026

## Checkout and scope

Started from the clean Desktop checkout at a65a707 (merged main). Repairs are
isolated on codex/ubuntu-integration, preserving the original main and all
contributors' modules. Local work used Windows with Python 3.9 and MSYS Bash for
syntax checks; no WSL/compiler is installed locally. Actual backend execution
was verified on GitHub-hosted Ubuntu runners, not inferred from a Windows build.

## Ubuntu execution evidence

- [Complete cross-version run at 98993de](https://github.com/abbasikhadija/ConeCurrency/actions/runs/41852900194)
  passed on Ubuntu 22.04 and 24.04, plus full-server ThreadSanitizer on Ubuntu 24.04.
- [Setup/start script and integration run at 7ed7e70](https://github.com/abbasikhadija/ConeCurrency/actions/runs/41853709816)
  additionally runs the exact setup_ubuntu.sh instructions and startup-wrapper
  booking regression. Consult the run for each job's final status.
- The Ubuntu 24.04 job in that run passed with GCC 13.3.0 and Python 3.12.3.
  Its make test run executed 25 Python cases (7 P2 isolated, 5 concurrent,
  1 repeated-race case, 7 real-server networking, 5 application integration),
  plus all booking, descriptor-ownership, queue and thread-pool C checks.
  No required missing-binary skips were used.
- P1, P2 and P3 contributor workflows passed independently after integration.
  Their source/unit tests and existing sanitizer checks were retained.

## Workflows verified beyond compilation

- Real production sequential and concurrent servers accept BOOK, deplete stock,
  reject malformed input, handle partial requests/timeouts and survive disconnects.
- P1 inventory invariant: one ticket versus 20 users, repeated 20 times, exactly
  one booking, 19 sold-out replies, remaining zero and booked + remaining = initial.
- P3 workers exist, process in parallel, reject overload with ERR BUSY, recover
  after overload and exit promptly with active clients on SIGINT.
- Full application under ThreadSanitizer: repeated contention plus concurrent
  tests, including shutdown. The shared stop flag uses a lock-free C11 atomic;
  the thread-count assertion accounts for the sanitizer's one helper thread.
- Real P1 load tester connects to both modes, validates expected outcomes and
  writes CSV. Unreachable-server failures return nonzero without a barrier hang.
- Restarting on the same port resets inventory and reuses the listener address.
- All five original demo scenarios complete under a 60-second outer timeout;
  they validate actual replies instead of printing assumed outcomes.
- The optional unsafe demonstration compiles and runs separately. It remains
  intentionally data-racing; whether a particular run oversells is timing-dependent.
- Full benchmark/plot pipeline runs against real production modules. Inspected
  Ubuntu 24.04 artifact at 98993de: 24 cases, 966 requests, 966 bookings, zero
  failures, config status complete and one comparison graph. Raw data/config/logs
  are available in that run's integrated-benchmarks-ubuntu-24.04 artifact.

These shared-runner measurements validate reproducibility, not a universal
performance advantage. No illustrative benchmark numbers were substituted.

## Local checks

Python syntax compilation, Bash syntax for setup/start/demo/benchmark/syscall
scripts, and git diff --check passed. Local load-client checks confirmed exit
code 1 for an unreachable server and 2 for invalid user counts.

## Remaining limits and joint work

- No GUI or browser bridge is present in this checkout, so GUI end-to-end behavior
  cannot be verified. Supply the teammate's interface/bridge when ready to integrate.
- The system-call inspection script is syntax-checked; an interactive strace/procfs
  walkthrough with the team has not been performed.
- Repeat demo/benchmarks on the final lab machine, review the integration branch,
  obtain team approval and prepare the release/presentation. No changes were
  pushed to main during this integration task.
- Inventory is intentionally in memory; there is no database or persistence to
  initialize. Pending clients may lose replies during shutdown, and lost replies
  cannot be safely retried automatically without a future request-ID feature.
- Runtime coverage and sanitizer results are evidence for these executions;
  they do not prove that every possible interleaving is safe.

Historical reference: the P2-only implementation was previously verified at
bb8cc34 on 2 November. Its original test substitute remains confined to P2's
isolated build; the current complete application tests use real P1/P3 modules.
