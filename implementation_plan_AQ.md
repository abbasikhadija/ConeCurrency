# Implementation Plan & Work Log — Person 1 (P1)
**Project:** ConeCurrency 🍦 — Scalability Analysis of a Concurrent Ticket Booking Server  
**Owner / Contributor:** Person 1 (AQ / Abdul Qudoos — Branch: `qudoos`)  
**Role:** Synchronization Owner (POSIX Mutexes, Race Condition Prevention, Thread-Safe Counters, Load Testing, Race Verification)  
**Lab Focus:** Lab 11 (Concurrency, Critical Sections, and Synchronization)

---

## 1. Project Component Ownership Matrix

| Member | OS Component | Deliverables / Files | Current Status |
| :--- | :--- | :--- | :--- |
| **Person 2** (Khadija) | Sockets, Networking, Sequential Server, Benchmarks | `src/main.c`, `src/options.c`, `src/network.c`, `src/handler.c`, `src/sequential.c`, `tests/test_handler.c`, `tests/test_network.py`, `tools/benchmark.py`, `scripts/run_benchmarks.sh`, `scripts/system_calls.sh` | **Delivered** (Tests passing on CI) |
| **Person 3** | Bounded Queue, Thread Pool, Concurrent Accept Loop | `src/queue.c`, `src/threadpool.c`, `src/concurrent.c`, `tests/test_queue.c`, `tests/test_threadpool.c`, `tests/test_concurrent.py`, `docs/CONCURRENCY_ENGINE.md` | **Delivered** (Merged in PR #2) |
| **Person 1** (**AQ**) | **Synchronization Engine, Mutexes, Stats, Load Tester, Race Proof, Demo Script** | `src/booking.c`, `src/stats.c`, `tests/test_booking.c`, `tools/load_test.py`, `tests/test_race.py`, `scripts/demo.sh`, `.github/workflows/p1-tests.yml`, `README.md` updates | **Completed** |

---

## 2. Task Checklist & Progress Log

| ID | Task Description | Target File(s) | Status | Waits On |
| :---: | :--- | :--- | :---: | :--- |
| **T0** | Create implementation plan & architectural log | `implementation_plan_AQ.md` | Completed | — |
| **T1** | Core Booking Engine with POSIX Mutex | `src/booking.c` | Completed | `include/booking.h` |
| **T2** | Thread-Safe Statistics Tracker | `src/stats.c` | Completed | `include/stats.h` |
| **T3** | Booking Unit Tests (Inventory & Concurrency) | `tests/test_booking.c` | Completed | `src/booking.c` |
| **T4** | Python Concurrent Load Tester (Barrier-synced) | `tools/load_test.py` | Completed | Server binaries |
| **T5** | Race Condition Proof & Safe vs. Unsafe Comparison | `tests/test_race.py`, `Makefile` | Completed | `src/booking.c`, `load_test.py` |
| **T6** | End-to-End System Demonstration Script | `scripts/demo.sh` | Completed | Full server stack |
| **T7** | Makefile Integration & Production Compilation | `Makefile` | Completed | `src/booking.c`, `src/stats.c` |
| **T8** | GitHub Actions Workflow for P1 Validation | `.github/workflows/p1-tests.yml` | Completed | T1–T5 |
| **T9** | Documentation & Presentation Guide | `README.md` (P1 Section) | Completed | All tasks |

---

## 3. Detailed Component Specifications (What, How, and File Paths)

### Task 1: Core Booking Engine (`src/booking.c`)
* **File Path:** [`src/booking.c`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/src/booking.c)
* **Header:** [`include/booking.h`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/include/booking.h)
* **What it does:**
  Manages the shared inventory of tickets (ice cream cones). It provides:
  - `void booking_init(int n)`: Sets initial inventory count.
  - `enum booking_result booking_try_reserve(void)`: Decrements inventory if available (`BOOK_OK`), or reports exhausted inventory (`BOOK_SOLD_OUT`).
  - `int booking_remaining(void)`: Thread-safely reads current remaining inventory.
* **How it does it:**
  - Employs a `pthread_mutex_t inventory_lock = PTHREAD_MUTEX_INITIALIZER`.
  - In `booking_try_reserve()`, acquires the lock, checks if `remaining > 0`, decrements if positive, and releases the lock.
  - **Critical Rule:** Only the comparison and decrement occur inside the critical section. No networking, disk I/O, or sleeping happens under the lock.
  - Supports `#ifdef UNSAFE_MODE` compile flag to intentionally omit the mutex lock, allowing direct demonstration of the race condition (overselling) during testing and lab presentations.

### Task 2: Thread-Safe Statistics (`src/stats.c`)
* **File Path:** [`src/stats.c`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/src/stats.c)
* **Header:** [`include/stats.h`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/include/stats.h)
* **What it does:**
  Maintains atomic metrics for the server lifecycle:
  - `STAT_BOOKED`: Successfully booked cones.
  - `STAT_SOLD_OUT`: Rejected due to inventory exhaustion.
  - `STAT_BUSY`: Rejected due to full worker queue (P3 load shedding).
  - `STAT_BAD`: Malformed or timed-out requests.
  - `void stats_print(void)`: Displays formatted metrics summary when server shuts down.
* **How it does it:**
  - Implements synchronized counter updates either using a dedicated `pthread_mutex_t stats_lock` or GCC atomic builtins (`__atomic_fetch_add`).
  - Guarantees no two locks are ever held simultaneously (preserves deadlock-freedom).

### Task 3: Booking Unit Tests (`tests/test_booking.c`)
* **File Path:** [`tests/test_booking.c`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/tests/test_booking.c)
* **What it does:**
  Validates inventory logic under isolated unit-test conditions.
* **How it does it:**
  - Tests boundary conditions: 0 initial tickets, exact depletion, depletion with excess attempts.
  - Spawns multiple threads trying to book simultaneously to test basic mutex integrity in isolation before testing full TCP networking.

### Task 4: Python Multi-Threaded Load Tester (`tools/load_test.py`)
* **File Path:** [`tools/load_test.py`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/tools/load_test.py)
* **What it does:**
  Simulates high concurrency loads (e.g., 20 to 200 users) targeting the ticket server over TCP.
* **How it does it:**
  - Uses `threading.Barrier(num_users)`: All client threads connect and synchronize at the barrier before releasing the `BOOK\n` payload simultaneously.
  - Measures per-request response time with `time.perf_counter()`.
  - Computes min, max, mean, and median latency, along with response status counts (`BOOKED`, `SOLD_OUT`, `BUSY`, `BAD_REQUEST`).
  - Supports `--csv` export and CLI arguments (`--users`, `--port`, `--host`).

### Task 5: Race Condition Proof (`tests/test_race.py`)
* **File Path:** [`tests/test_race.py`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/tests/test_race.py)
* **What it does:**
  Proves the existence and hazard of race conditions and verifies that the mutex completely eliminates them.
* **How it does it:**
  - Configures the server with 1 ticket and bombards it with 20 concurrent clients across 20 iterations.
  - **Invariant Check:** `booked_count + remaining_count == initial_tickets`.
  - In Safe Mode (with mutex): Invariant holds 100% of the time (exactly 1 booked, 19 sold out).
  - In Unsafe Mode (without mutex): Shows frequent invariant violations (e.g., 2 or more booked for 1 available ticket).
  - Integrates with ThreadSanitizer (`-fsanitize=thread`).

### Task 6: Unified Demonstration Script (`scripts/demo.sh`)
* **File Path:** [`scripts/demo.sh`](file:///c:/Users/Microsoft/Desktop/ConeCurrency/scripts/demo.sh)
* **What it does:**
  Provides an automated terminal demo covering all 5 lab evaluation scenarios:
  1. Sequential Server: Demonstrates head-of-line blocking under delay.
  2. Concurrent Server: Demonstrates multi-worker throughput improvement.
  3. Race Condition Prevention: Mutex vs Unsafe demonstration.
  4. Overload & Load Shedding: Demonstrates `ERR BUSY` under constrained queue.
  5. Invalid Request Handling: Demonstrates `ERR BAD_REQUEST` resilience.

---

## 4. Compatibility & Architectural Inspection

1. **Locking Invariants & Deadlock Avoidance:**
   - Worker thread calls `handle_client(fd)` with NO locks held.
   - Inside `handle_client(fd)`:
     - First, artificial delay is executed (`nanosleep`).
     - Second, `booking_try_reserve()` acquires and immediately releases `inventory_lock`.
     - Third, `stats_inc()` acquires and immediately releases `stats_lock`.
   - The bounded queue lock in `src/queue.c` is never held when entering `handle_client()`.
   - **Conclusion:** No two locks are ever nested. Deadlock probability is mathematically zero.

2. **Standards Compliance:**
   - Strict C11 (`-std=c11`) with POSIX.1-2008 (`-D_POSIX_C_SOURCE=200809L`).
   - Clean compilation under `-Wall -Wextra -Werror -O2 -g`.
   - Thread safety validated with `valgrind --tool=helgrind` and GCC `-fsanitize=thread`.
