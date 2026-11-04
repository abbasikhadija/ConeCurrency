# Concurrency Engine — How Our Server Serves Many Users at Once

**Owner:** P3 (Threads & Scheduling)
**Implementation:** `src/queue.c`, `src/threadpool.c`, `src/concurrent.c`
**Interfaces (shared, agreed with P2):** `include/queue.h`, `include/threadpool.h`, `include/concurrent.h`
**Tests:** `tests/test_queue.c`, `tests/test_threadpool.c`, `tests/test_concurrent.py`, `.github/workflows/p3-tests.yml`
**Course labs:** Lab 06 (Processes), Lab 09 (Pthreads), Lab 11 (Synchronization)

This document explains **what** the concurrent part of our server does, **how** it does it, and **why** it is designed this way. Every idea is first explained with the **Ice Cream Shop** story, and then with the real C code concept behind it.

The same story is used by our UI: every event described here is something the UI can show as a kid, a cashier, a rope line, or a cone.

---

## Part 1 — The Story in One Page

An ice cream shop has **10 cones** left. **50 kids** run in at the same moment, all shouting *"I want one!"*

- At the door stands a **Door Manager**. He lets each kid in.
- Inside there is a **rope line** that fits only a fixed number of kids (for example 32).
- Behind the counter work **4 cashiers**. Each cashier takes the next kid from the front of the rope line, serves them, then calls the next kid.
- When no kids are waiting, cashiers **sit down and rest** instead of pacing around. When a kid arrives, the Door Manager **rings a bell** and one resting cashier gets up.
- The cones are in a **freezer that has only one key**. A cashier must hold the key to check and take a cone. This makes it impossible for two cashiers to promise the same last cone.
- If the rope line is **full**, the Door Manager tells the new kid politely: *"Sorry, we're too busy, come back later."* He never lets the shop overflow.
- At closing time, the owner shouts **"CLOSING!"**. The Door Manager locks the door, the cashiers finish serving everyone already in the rope line, then they go home. The owner waits until **every** cashier has left, then turns off the lights.

That is the entire concurrent server.

---

## Part 2 — Who Is Who (The Cast)

| Ice Cream Shop | Our Server | Where in code |
|---|---|---|
| The shop | The running `ticket-server` program (one **process**) | `main.c` (P2) |
| A kid | One user / one TCP connection | — |
| The kid's "number" given at the door | A **file descriptor (fd)**, an integer like `7` that Linux gives to each connection | returned by `accept()` |
| The street outside the door | The **kernel backlog**, where Linux keeps kids who have arrived but not been let in yet | `listen(fd, 128)` |
| The Door Manager | The **main thread**, running the accept loop | `concurrent.c` |
| The rope line | The **bounded queue** | `queue.c` |
| The rope line's size | `--queue 32` | `queue_init(32)` |
| A cashier | A **worker thread** | `threadpool.c` |
| The team of cashiers | The **thread pool** | `pool_start()` |
| The number of cashiers | `--workers 4` | `pool_start(4, queue, handle_client)` |
| A cashier resting in a chair | A thread sleeping in `pthread_cond_wait()` | `queue_pop()` |
| The bell | `pthread_cond_signal()` | `queue_try_push()` |
| Shouting "everyone wake up!" | `pthread_cond_broadcast()` | `queue_close()` |
| The rope line's clipboard (who is next) | The queue's **mutex** | `q->lock` |
| The freezer key | The booking **mutex** | `booking.c` (P1) |
| Cones | The `remaining` ticket count | `booking.c` (P1) |
| How the cashier serves a kid | The **handler** function | `handle_client()` (P2) |
| "Too busy, come back later" | `ERR BUSY\n` | `concurrent.c` |
| The owner shouting "CLOSING!" | **Ctrl+C** (`SIGINT`) or `SIGTERM`; the handler sets the shared `server_stop` flag | `main.c` (P2) |
| Owner waiting for every cashier to leave | `pthread_join()` | `pool_stop()` |

---

## Part 3 — Two Shops Compared

### Shop A: One Cashier (Sequential mode, built by P2)
The Door Manager **is** the cashier. He lets one kid in, serves them completely, then goes back to the door for the next kid. Everyone else waits outside on the street.

- Simple. Never makes mistakes with cones, because only one person touches the freezer.
- Slow. If serving takes 20 ms, 50 kids take about 1 second.

### Shop B: Many Cashiers (Concurrent mode, built by P3 — this document)
The Door Manager **only** lets kids in and puts them in the rope line. Cashiers serve in parallel.

- Fast. With 4 cashiers and 20 ms per kid, 50 kids take roughly a quarter of the time.
- Dangerous **unless** we use locks, because now several people touch shared things (the rope line and the freezer) at the same time.

> **Important honesty point:** more cashiers are not always faster. If serving takes almost no time, the extra work of managing cashiers can cancel out the benefit. That is why we measure instead of assuming. (See Part 12.)

---

## Part 4 — The Rope Line (Bounded Queue)

### The story
The rope line holds a fixed number of kids. Kids enter at the back and leave from the front: **first come, first served**. A **clipboard** hangs on the rope. Anyone who wants to add or remove a kid must first **grab the clipboard**, write the change, and hang it back. Only one person can hold the clipboard at a time.

### Why the line has a limit
If the line could grow forever, on a crazy day 10,000 kids would be inside, the shop would run out of space, and everyone would wait forever. A limit means the shop **stays healthy** and kids who can't fit get a **quick, clear answer** instead of an endless wait.

> Industry name: **load shedding**. Real services (online stores on sale day, ticket sites) reject extra traffic quickly instead of collapsing.

### How the line is built: a circle, not a row
Imagine the rope line is drawn as a **circle of 32 spots** on the floor.

- `head` = the spot where the **next kid to be served** stands.
- `tail` = the **next empty spot** where a new kid will stand.
- `count` = how many kids are standing in the circle.

When `head` or `tail` reaches spot 31, the next step takes it back to spot 0. Because it is a circle, **no kid ever has to shuffle forward**. We just move the `head` and `tail` markers. In code: `tail = (tail + 1) % capacity`.

```
capacity = 8
                 head            tail
                  v               v
  spots:  [ ][ ][K1][K2][K3][K4][ ][ ]     count = 4
```

### The functions

The queue is an **opaque type**: other files only see `struct client_queue *` and cannot touch its fields directly. Only `queue.c` knows what is inside. This forces everyone to go through the locked functions.

| Function | Story | What happens in code |
|---|---|---|
| `struct client_queue *queue_init(size_t capacity)` | Build a rope line with `capacity` spots and hang a clipboard | allocate struct and array, `pthread_mutex_init`, `pthread_cond_init`. Returns `NULL` (and frees anything half-built) if capacity is 0 or anything fails |
| `bool queue_try_push(queue, fd)` | Door Manager tries to put a kid in line | lock → if full or closed: unlock, return **false** → else: put fd at `tail`, move `tail`, `count++`, **ring the bell** (`pthread_cond_signal`), unlock, return **true** |
| `bool queue_pop(queue, int *fd)` | A cashier calls the next kid | lock → **while** line empty and not closed: sit down and rest (`pthread_cond_wait`) → if still empty (closed and drained): unlock, return **false** (go home) → else: write the kid into `*fd`, move `head`, `count--`, unlock, return **true** |
| `void queue_close(queue)` | Owner says no more kids will join | lock → `closed = true` → **shout to all cashiers** (`pthread_cond_broadcast`) → unlock |
| `struct queue_snapshot queue_stats(queue)` | Read the clipboard | lock → copy `pending`, `capacity`, `closed` → unlock → return the copy |
| `void queue_destroy(queue)` | Take down the rope and clipboard | `pthread_cond_destroy`, `pthread_mutex_destroy`, free memory. Only after every cashier has gone home |

### Why `try` push and not "wait for space"?
The Door Manager **never waits** for the line to have space. If he did, he would stand frozen at the door, new kids would pile up on the street, and nobody would tell them anything. So he **tries once**: success means the kid is in line, failure means he says "too busy" immediately and turns to the next kid.

This is also why the queue needs only **one** bell (`not_empty`), not two. Nobody ever waits for "not full".

---

## Part 5 — Resting Cashiers and the Bell (Condition Variables)

### The story
When the line is empty, a cashier could keep walking to the rope every second asking *"anyone there? anyone there?"*. That wastes energy for nothing. Instead, the cashier **sits in a chair and sleeps**. When the Door Manager adds a kid, he **rings the bell** once, and **one** sleeping cashier wakes up.

### The tricky part: hand the clipboard back before sleeping
A cashier holds the clipboard while checking the line. If she fell asleep **while holding it**, nobody could ever add a kid, and the shop would freeze forever.

`pthread_cond_wait(&not_empty, &lock)` does three things as one safe step:
1. **Gives back the clipboard** (unlocks the mutex).
2. **Falls asleep** until the bell rings.
3. On waking, **grabs the clipboard again** before continuing.

### Why `while`, never `if`
```c
while (q->count == 0 && !q->closed)
    pthread_cond_wait(&q->not_empty, &q->lock);
```
When a cashier wakes up, **the line might be empty again**:
- Another cashier might have grabbed the kid first.
- Sometimes threads wake up for no reason at all (called a **spurious wakeup**; the system is allowed to do this).

So after waking, she **checks again**. `while` means "keep checking until it is really true". With `if`, she would try to serve a kid who isn't there, which is a bug.

### Why not just keep checking in a loop (busy waiting)?
```c
while (q->count == 0) { }   /* BAD: burns 100% CPU doing nothing */
```
This is the cashier pacing around non-stop. Every idle worker would use a full CPU core. With `pthread_cond_wait`, sleeping workers use **0% CPU**. You can prove this live with `top -H`.

---

## Part 6 — The Cashier Team (Thread Pool)

### The story
At opening time, the owner hires a **fixed number of cashiers** (for example 4). They stay all day. Each one repeats the same routine:

```
loop forever:
    call the next kid from the rope line            (queue_pop(queue, &fd))
    if queue_pop says false: shop closed and line empty, go home  (exit loop)
    serve the kid                                   (handler(fd))
    say goodbye, kid leaves                         (close(fd))
```

### Why a fixed team instead of hiring a new cashier for every kid?
| Hire per kid (thread per connection) | Fixed team (thread pool) |
|---|---|
| Hiring takes time (`pthread_create` is not free) | Hire once at opening |
| 1,000 kids means 1,000 cashiers squeezed in the shop | Never more than N cashiers |
| Cashiers bump into each other; the manager wastes time switching between them (**context switching**) | Controlled, predictable |
| Shop can run out of space (memory) | Resources are capped |

> Industry: web servers like Apache and Tomcat, and database connection pools, use fixed pools for exactly these reasons.

### The handler is "plugged in" (dependency injection)
The cashier team does not care *how* a kid is served. The owner hands them a **job card** at opening time that says how to serve.

```c
struct thread_pool *pool_start(int n, struct client_queue *queue, void (*handler)(int));
pool = pool_start(4, queue, handle_client);
```
The third argument is a **function pointer**: the address of the function each worker should call.
- **Unit tests:** we hand them a fake job card, like "check the fd and count it".
- **After integration:** `main.c` hands them P2's real `handle_client`, which reads the request, asks P1's booking engine for a cone, and replies.

This lets P3 build and test the whole cashier system **without waiting for P2's code**.

### Functions
| Function | Story |
|---|---|
| `pool_start(n, queue, handler)` | Put on earplugs (block `SIGINT`/`SIGTERM`), hire `n` cashiers (they copy the earplugs), then remove the caller's earplugs. If hiring cashier #3 fails: close the queue, send #1 and #2 home (`pthread_join`), free memory, return `NULL` |
| `worker_main(arg)` | One cashier's daily routine (the loop above). Private to `threadpool.c` |
| `pool_stop(pool)` | Wait at the back door until every cashier has finished and left (`pthread_join` for each), then free the pool. The queue must already be closed |

---

## Part 7 — The Door Manager (Concurrent Accept Loop)

### The story
The Door Manager's only job is the door. He never serves ice cream himself.

```
open the shop: build the rope line, hire the cashiers
while server_stop is not set (the owner has not shouted CLOSING):
    look at the door for half a second                  (poll, 500 ms)
    if no kid is there: check for CLOSING again
    let one kid in, give them a number                  (accept -> fd)
    try to put the kid in the rope line                 (queue_try_push)
    if the line is full:
        count it on the tally board                     (stats_inc(STAT_BUSY))
        tell the kid "too busy, come back later"        (write "ERR BUSY\n")
        the kid leaves                                  (shutdown, drain, close(fd))
closing time:
    tell the cashiers no more kids are coming           (queue_close)
    wait for every cashier to go home                   (pool_stop)
    take down the rope line                             (queue_destroy)
return to main.c, which locks the front door          (close(listen_fd))
    and reads out today's tally                         (stats_print)
```

**Who owns the front door?** `concurrent_run` only **borrows** the listening socket. `main.c` (P2) opened it and `main.c` closes it after `concurrent_run` returns.

### Why "look for half a second" (poll) instead of just waiting at the door?
`accept()` on its own means the Door Manager **stares at the door until a kid comes**. If the owner shouts "CLOSING!" while no kids are coming, he would never hear it and the shop would never close.

`poll()` with a 500 ms timeout means: *"watch the door, but at least every half second, look up and check if the owner said CLOSING."* So the shop always closes within half a second of Ctrl+C.

### Who receives the "CLOSING!" shout? (Signals and threads)
In Linux, a signal like Ctrl+C can be delivered to **any** thread in the process. If a cashier received it, the Door Manager might never find out.

So inside `pool_start`, before hiring cashiers, the Door Manager **puts on earplugs** (`pthread_sigmask` blocks `SIGINT` and `SIGTERM`). New cashiers copy his earplugs. Then the Door Manager **takes his own earplugs out** (restores his previous mask). Result: **only the Door Manager hears Ctrl+C**.

### What does the signal handler do?
The handler lives in `main.c` (P2) and does only one thing: it **sets a flag**.
```c
static void stop_server(int signal_number) { (void)signal_number; server_stop = 1; }
```
Every part of the program checks that flag: the accept loop between `poll` calls, and P2's `handle_client` during its waits.
It does **not** print, lock mutexes, or free memory. A signal can interrupt the program in the middle of anything, even in the middle of `printf` or `malloc`, so calling those from a handler can corrupt them. Setting a flag is always safe. The main loop sees the flag and does the real closing work calmly.

---

## Part 8 — The Freezer Key (Where P3 Meets P1)

The **freezer key** (booking mutex) belongs to P1. P3's job is to make sure the cashiers use it correctly and **never cause a deadlock**.

### The danger without the key (race condition)
1 cone left. Cashier 1 opens the freezer and sees 1 cone. At the same instant Cashier 2 also sees 1 cone. Both say "yes!". Two kids were promised one cone.

In code, the gap is between **checking** and **taking**:
```c
if (remaining > 0)     /* both cashiers pass this check...      */
    remaining--;       /* ...then both subtract: remaining = -1 */
```
P1 fixes this by doing the check and the take while holding the key (`pthread_mutex_lock` … `pthread_mutex_unlock`).

### P3's rule: never hold two keys at once
A cashier holds the **rope-line clipboard** only while taking a kid from the line. She **hangs the clipboard back before** walking to the freezer.

```
queue_pop():  [grab clipboard] take kid [hang clipboard back]
handler():                                                  [grab freezer key] take cone [return key]
```
Because no cashier ever holds the clipboard **and** the freezer key at the same time, it is **impossible** for two cashiers to end up each holding one and waiting forever for the other. That situation is called a **deadlock**, and this rule prevents it.

> Presentation answer to *"How did you prevent deadlock?"*: "No thread ever holds more than one lock at a time. The queue lock is always released before the booking lock is taken."

---

## Part 9 — Who Holds the Kid's Hand? (FD Ownership)

Every kid holds exactly **one adult's hand** at any moment. Only the adult holding the hand may say goodbye (`close(fd)`).

| Moment | Who holds the hand | Who may `close(fd)` |
|---|---|---|
| Just let in by `accept()` | Door Manager | Door Manager |
| Successfully placed in the rope line | The rope line | Nobody; it is waiting |
| Line was full | Still the Door Manager | Door Manager (after saying "too busy") |
| Called by a cashier via `queue_pop()` | That cashier | That cashier, **after** the handler finishes |

### Why this matters
- **Two adults say goodbye (double close):** Linux reuses fd numbers. After the first `close(7)`, number 7 may be given to a **new kid**. The second `close(7)` then sends the **wrong kid** away.
- **Nobody says goodbye (leak):** the kid stands in the shop forever. After a few thousand, the shop has no more numbers to give (`accept` fails with "too many open files").

**Team contract:** P2's `handle_client(fd)` reads, books, and replies, but **does not** close. The cashier (worker) closes after it returns.

---

## Part 10 — Full Timelines

### 10.1 Opening the shop
```
1. Owner (main.c)       reads options: --workers 4 --queue 32 --tickets 10
2. Owner (main.c)       installs the CLOSING handler  sigaction(SIGINT/SIGTERM) -> sets server_stop
3. Owner (main.c)       opens the front door          create_listener(8080)
4. Owner (main.c)       hands over to concurrent mode concurrent_run(listen_fd, &config)
5. Door Manager         builds the rope line          queue_init(32)
6. Door Manager         hires 4 cashiers              pool_start(4, queue, handle_client)
                        (earplugs on -> hire W1..W4 -> his own earplugs off)
7. Cashiers             find the line empty, sit down and sleep
8. Door Manager         starts watching the door      poll loop (500 ms)
```

### 10.2 One kid buys a cone
```
1. Kid arrives at the door, waits on the street       (kernel backlog)
2. Door Manager notices (poll), lets the kid in        accept() -> fd 7
3. Door Manager grabs clipboard, adds kid #7, rings bell, hangs clipboard   try_push OK
4. Cashier W2 wakes, grabs clipboard, takes kid #7, hangs clipboard back    pop -> 7
5. W2 serves: reads "BOOK", uses freezer key, takes a cone, replies "OK BOOKED"
6. W2 says goodbye                                     close(7)
7. W2 goes back to the line, finds it empty, sits down to sleep
```

### 10.3 Rush hour (overload)
```
4 cashiers all busy, rope line 32/32 full
1. Kid #41 is let in                                   accept() -> fd 51
2. Door Manager tries the rope line: FULL              try_push FAILS, rejected++
3. Door Manager: "Sorry, too busy"                      write "ERR BUSY\n"
4. Door Manager says goodbye                            shutdown + drain + close(51)
5. Door Manager immediately goes back to the door
```
The shop stays alive, kids get a quick answer, and **no cone is ever wrongly sold**.

### 10.4 Last cone, many kids (race condition prevented)
```
1 cone left, 20 kids served at the same moment by 4 cashiers
- All 4 cashiers want the freezer key at once
- Only 1 gets it, sees 1 cone, takes it, returns key  -> "OK BOOKED"
- The next cashier gets the key, sees 0 cones         -> "ERR SOLD_OUT"
- ...and so on
Result: exactly 1 booked, 19 sold out. Every single run.
```

### 10.5 Closing time (Ctrl+C)
```
1. Owner presses Ctrl+C                       SIGINT -> server_stop = 1
2. Within 0.5 s the Door Manager notices      poll times out, checks flag, stops accepting
3. He announces "no more kids"                queue_close(): closed = true + broadcast
4. All sleeping cashiers wake up
5. Busy cashiers notice server_stop inside handle_client and stop early
6. Cashiers drain the line: every remaining kid is taken and their connection
   closed exactly once (handle_client returns at once, so they get no reply)
7. When the line is empty AND closed, queue_pop returns false -> cashier goes home
8. Door Manager waits for each cashier        pool_stop: pthread_join x 4
9. Takes down the rope line                   queue_destroy
10. main.c locks the front door               close(listen_fd)
11. main.c reads out today's tally            stats_print (after all workers joined)
```

---

## Part 11 — The Tally Board (Statistics)

Two places keep numbers:

**1. The rope line's clipboard** (`queue_stats`, P3), read **while holding the clipboard** so the numbers are never half-written:

| Field | Meaning | Used for |
|---|---|---|
| `pending` | Kids in line right now | Live UI, rope line fill bar |
| `capacity` | Size of the rope line | Context for `pending` |
| `closed` | Has "CLOSING" been announced? | Shutdown state |

**2. The shop's tally board** (`stats.c`, P1), thread-safe counters printed at closing:

| Counter | Who adds to it |
|---|---|
| `booked`, `sold_out`, `bad` | P2's `handle_client` |
| `busy` | P3's accept loop, every time the line is full |

**Check after a test run:** every client gets exactly one of booked / sold out / busy / bad, so the four counters add up to the number of clients (except clients still waiting when Ctrl+C arrived).

> Possible extension (needs a team change to `include/queue.h`): add `high_water` (longest line ever) and `rejected` to `queue_snapshot`.

---

## Part 12 — How We Prove It Works (Tests)

| File | Test | Expected |
|---|---|---|
| `test_queue.c` | Capacity 0 | `queue_init` returns `NULL` |
| `test_queue.c` | FIFO order: kids 10, 11, 12 join | Called as 10, 11, 12 |
| `test_queue.c` | Full line: capacity 4, 5th push | Rejected immediately, no waiting |
| `test_queue.c` | Wrap-around: 10 rounds on a line of 3 | Correct order every round |
| `test_queue.c` | Close drains: 5 queued, then close | Push refused, all 5 popped in order, then `false` |
| `test_queue.c` | Close wakes sleepers: 4 workers asleep, then close | All 4 wake and return `false` (no hang) |
| `test_queue.c` | 4 producers × 4 consumers, 10,000 items | Every item popped **exactly once** |
| `test_threadpool.c` | Bad arguments (0 workers, no queue, no handler) | `pool_start` returns `NULL` |
| `test_threadpool.c` | Idle shutdown | Workers exit, no hang |
| `test_threadpool.c` | 2,000 real fds | Each handled once; all 2,000 closed (open-fd count back to start) |
| `test_threadpool.c` | 40 slow jobs | All 4 workers used; `SIGINT`/`SIGTERM` blocked in workers, not in caller |
| `test_concurrent.py` | One `BOOK` | `OK BOOKED` |
| `test_concurrent.py` | Thread count | Main thread + 4 workers |
| `test_concurrent.py` | 8 users × 200 ms with 4 workers | Finishes well under the 1.6 s one worker would need |
| `test_concurrent.py` | Overload: 1 worker, line of 1, 10 users | Some `ERR BUSY`, some `OK BOOKED`, server still works afterwards |
| `test_concurrent.py` | Ctrl+C with clients mid-request | Exit code 0 within 2 s, stats printed |
| CI | Unit tests repeated 20 times | Pass every time |
| CI | ThreadSanitizer, AddressSanitizer, UBSan on queue and pool | No reports |

> `test_concurrent.py` uses P1's labelled **test stub**, which has no mutex. It tests the concurrency engine, not booking correctness. The "no overselling" proof needs P1's real `booking.c`.

### Seeing it in Linux
```bash
ps -L -p <PID> -o pid,tid,stat,pcpu,comm   # main thread + 4 worker threads
top -H -p <PID>                            # idle workers at 0% CPU (sleeping, not busy waiting)
```

---

## Part 13 — Mapping to the Ice Cream UI

Every server event can become one animation in the UI.

| Server event | UI animation |
|---|---|
| Server starts with `--workers 4 --queue 32` | 4 cashiers appear, rope line with 32 spots |
| `accept()` | A kid walks through the door |
| `queue_try_push` succeeds | Kid joins the back of the rope line |
| `queue_try_push` fails | Kid gets a "Too busy!" bubble and walks out |
| Worker sleeping in `pthread_cond_wait` | Cashier sits in chair, 💤 |
| `pthread_cond_signal` | Bell rings 🔔, one cashier stands up |
| `queue_pop` | Kid walks from the front of the line to a cashier |
| Booking mutex locked | Freezer shows a 🔒 with that cashier's name |
| `OK BOOKED` | Kid leaves happy with a cone 🍦, cone counter drops |
| `ERR SOLD_OUT` | Kid leaves sad, empty hands |
| `ERR BAD_REQUEST` | Kid asked for pizza 🍕, cashier shrugs |
| Ctrl+C / `queue_close` | "CLOSING" sign, door locks, cashiers finish line then leave |
| `high_water` | Mark on the floor showing the longest line today |

> **Honesty rule for the UI:** the UI must be driven by **real events from the real server** (for example, from a STATS command or event log), never by invented numbers. The UI is a window into the real system, not a cartoon of what we hope happens.

---

## Part 14 — Design Decisions (Why We Chose This)

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Thread model | Fixed pool | New thread per user | Capped resources, no creation cost per request |
| When queue is full | Reject immediately (`ERR BUSY`) | Door Manager waits for space | Accept loop never freezes; users get a fast answer |
| Worker waiting | Condition variable | Busy loop | 0% CPU while idle |
| Wait check | `while` loop | `if` | Safe against spurious wakeups and stolen items |
| Locks | One lock per shared structure, never two held at once | Nested locks | Deadlock impossible by design |
| Shutdown | Drain the queue | Drop queued users | Nobody who was accepted is silently abandoned |
| Waiting for connections | `poll()` with 500 ms timeout | Plain blocking `accept()` | Can notice Ctrl+C even when no users arrive |
| Signal delivery | Block in workers, unblock in main | Let any thread receive it | Predictable: only main handles shutdown |
| Signal handler | Only sets a flag | Do cleanup inside handler | Most functions are unsafe inside handlers |
| Request handling | Injected function pointer | Call P2's function directly | P3 can build and test independently |
| FD closing | Worker closes after handler | Handler closes | One clear owner, no double close |

---

## Part 15 — How to Run P3's Checks

```bash
CFLAGS="-std=c11 -D_POSIX_C_SOURCE=200809L -Iinclude -Wall -Wextra -Werror -g"
mkdir -p build

# Unit tests
gcc $CFLAGS -O2 src/queue.c tests/test_queue.c -o build/test-queue -pthread && ./build/test-queue
gcc $CFLAGS -O2 src/queue.c src/threadpool.c tests/test_threadpool.c -o build/test-threadpool -pthread && ./build/test-threadpool

# Data race detection
gcc $CFLAGS -fsanitize=thread src/queue.c src/threadpool.c tests/test_threadpool.c -o build/test-threadpool-tsan -pthread && ./build/test-threadpool-tsan

# Full server in concurrent mode (labelled P1 test stub) + integration tests
gcc $CFLAGS -O2 -DWITH_CONCURRENT src/main.c src/options.c src/network.c src/handler.c src/sequential.c \
    tests/p1_stub.c src/queue.c src/threadpool.c src/concurrent.c -o build/p3-test-server -pthread
python3 -m unittest tests.test_concurrent -v
```
The same steps run automatically on every push in `.github/workflows/p3-tests.yml`. Once P1's modules exist, `make concurrent` builds the production server.

### Known limitations
- Booking correctness under concurrency cannot be shown until P1's real `booking.c` replaces the stub.
- `server_stop` is declared in shared code as `volatile sig_atomic_t`. ThreadSanitizer reports its cross-thread reads as a data race when the full server is built with `-fsanitize=thread`; a C11 `atomic_int` would remove the report. This is a shared-header decision for the team.
- During shutdown, clients still waiting in the queue have their connection closed without a reply.
- Under ThreadSanitizer, `/proc/PID/task` shows one extra (sanitizer) thread.

---

## Part 16 — Glossary (Easy Words)

| Word | Simple meaning |
|---|---|
| **Process** | A running program. Our whole server is one process (the shop). |
| **Thread** | A worker inside a process. Threads share the same memory (the same shop). |
| **Concurrency** | Several things in progress at the same time. |
| **File descriptor (fd)** | A small number Linux uses to refer to an open file or connection (the kid's number). |
| **Mutex** | A lock that only one thread can hold at a time (the clipboard, the freezer key). |
| **Critical section** | The code that runs while holding a lock. Keep it short. |
| **Race condition** | A bug where the result depends on which thread happens to go first. |
| **Deadlock** | Two threads each holding something the other needs, both waiting forever. |
| **Condition variable** | A way for a thread to sleep until another thread says "something changed" (the bell). |
| **Spurious wakeup** | Waking up without the bell actually having meant anything for you. |
| **Busy waiting** | Checking again and again in a loop, wasting CPU. |
| **Bounded queue** | A waiting line with a maximum size. |
| **Thread pool** | A fixed team of worker threads created once and reused. |
| **Load shedding** | Rejecting extra work quickly so the system stays healthy. |
| **Signal** | A message from the OS to a process, like Ctrl+C (`SIGINT`). |
| **Join** | Waiting until a thread has completely finished. |
| **Throughput** | How many requests are completed per second. |
| **Latency** | How long one request takes from start to finish. |
| **High-water mark** | The highest level ever reached. |
