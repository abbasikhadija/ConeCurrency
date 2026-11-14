export interface LearnArticle {
  id: string;
  title: string;
  badge: string;
  summary: string;
  plainEnglish: string;
  backendWalkthrough: string;
  cCodeSnippet: string;
  diagramType: 'book' | 'concurrency' | 'soldout' | 'queue' | 'bad' | 'latency' | 'reset' | 'tape';
  actionTrigger?: 'BOOK' | 'RUSH' | 'FLASH_MOB' | 'BAD' | 'RESET' | 'CLEAR';
  actionLabel?: string;
}

export const ARTICLES: LearnArticle[] = [
  {
    id: 'order-one',
    title: '1. Order 1 Cone (BOOK): The Single Request Lifecycle',
    badge: 'Core Synchronization',
    summary: 'How a simple click travels over WebSockets and raw TCP through the C accept loop into a thread worker.',
    plainEnglish: `When a customer orders a single scoop, the browser cannot open raw TCP sockets directly due to web sandbox security. Instead, it sends a lightweight WebSocket frame to our Node.js bridge. The bridge opens a streaming TCP socket to the C server on port 8080 and writes "BOOK\\n". The main server thread accepts the descriptor, passes it to an idle POSIX worker thread, decrements the inventory under mutual exclusion, and replies with "OK BOOKED\\n".`,
    backendWalkthrough: `1. Browser emits WebSocket message { type: 'BOOK' }.
2. Node.js bridge opens TCP socket to 127.0.0.1:8080 and transmits "BOOK\\n".
3. C main thread poll() detects POLLIN on listener socket and calls accept().
4. Client file descriptor (fd) is pushed to the bounded FIFO queue.
5. An idle worker thread blocked on pthread_cond_wait wakes up and pops the fd.
6. Worker calls handle_client(fd), sleeps for simulated work delay, takes pthread_mutex_lock(&inventory_lock), verifies remaining > 0, decrements remaining, and releases the lock.
7. Worker transmits "OK BOOKED\\n" back over TCP and closes the client socket.`,
    cCodeSnippet: `// Worker thread execution in C
void handle_client(int fd) {
    char req[64];
    read(fd, req, sizeof(req)); // Read "BOOK\\n"
    
    // Simulate work delay outside locks
    nanosleep(&delay, NULL);

    pthread_mutex_lock(&inventory_lock); // <-- CRITICAL SECTION
    if (remaining > 0) {
        remaining--;
        stats_inc(STAT_BOOKED);
        write(fd, "OK BOOKED\\n", 10);
    } else {
        stats_inc(STAT_SOLD_OUT);
        write(fd, "ERR SOLD_OUT\\n", 13);
    }
    pthread_mutex_unlock(&inventory_lock); // <-- RELEASE
}`,
    diagramType: 'book',
    actionTrigger: 'BOOK',
    actionLabel: 'Try Order 1 Cone',
  },
  {
    id: 'rush-hour',
    title: '2. Rush Hour & Flash Mob: Concurrency & Lock Contention',
    badge: 'Race Conditions',
    summary: 'Why simultaneous requests cause double-booking without mutexes, and how pthread_mutex guarantees correctness.',
    plainEnglish: `In sequential mode, a single thread acts like one lone cashier: everyone waits in a line. In concurrent mode, a fixed team of 4 cashier threads works in parallel. When 10 (Rush Hour) or 25 (Flash Mob) customers rush the counter at the exact same microsecond, their threads execute simultaneously across multiple CPU cores. Without synchronization, two threads would read remaining=1 at the exact same time and both sell it—overselling the inventory! The POSIX mutex forces serialization at the critical counter check.`,
    backendWalkthrough: `1. The bridge uses Promise.all() to launch 10 or 25 parallel TCP connections concurrently.
2. The server's accept loop pushes descriptors to the bounded queue.
3. Multiple worker threads wake up in parallel and execute on separate CPU cores.
4. When workers hit booking_try_reserve(), only ONE thread can hold inventory_lock at any instant.
5. Other threads block in the OS kernel until the lock is released.
6. Invariant check: Total Booked + Remaining == Initial Inventory (holds 100% of the time).`,
    cCodeSnippet: `// Race Condition Demonstration (Unsafe vs Safe)
#ifndef UNSAFE_MODE
    pthread_mutex_lock(&inventory_lock);
#endif

    // HAZARD WINDOW: Read-Modify-Write
    int current = remaining;
    // Without mutex, context switch here leads to OVERSELLING!
    if (current > 0) {
        remaining = current - 1;
        result = BOOK_OK;
    }

#ifndef UNSAFE_MODE
    pthread_mutex_unlock(&inventory_lock);
#endif`,
    diagramType: 'concurrency',
    actionTrigger: 'RUSH',
    actionLabel: 'Try Rush Hour (10 Cones)',
  },
  {
    id: 'sold-out',
    title: '3. SOLD OUT: Resource Depletion in the Critical Section',
    badge: 'Critical Section',
    summary: 'What happens when stock reaches zero, and how atomic verification prevents negative counts.',
    plainEnglish: `When all 50 cones are sold out, incoming orders must immediately fail cleanly rather than freezing or crashing. Because inventory is decremented atomically inside the mutex, the remaining counter transitions from 1 to 0 exactly once. All subsequent threads see remaining == 0, increment the STAT_SOLD_OUT metric, and respond with "ERR SOLD_OUT\\n" (or "SOLD_OUT\\n"). In our UI, the scoop melts and stamps the cone with a red SOLD OUT seal.`,
    backendWalkthrough: `1. Inventory reaches 0 inside the critical section.
2. The condition if (remaining > 0) evaluates to false.
3. No decrement occurs, preventing negative values (e.g. -1 or underflow).
4. The server increments STAT_SOLD_OUT and replies "ERR SOLD_OUT\\n".
5. The client registers the rejection without blocking or crashing.`,
    cCodeSnippet: `enum booking_result booking_try_reserve(void) {
    pthread_mutex_lock(&inventory_lock);
    enum booking_result res;
    
    if (remaining > 0) {
        remaining--;
        res = BOOK_OK;
    } else {
        res = BOOK_SOLD_OUT; // Clean depletion guard
    }
    
    pthread_mutex_unlock(&inventory_lock);
    return res;
}`,
    diagramType: 'soldout',
    actionTrigger: 'FLASH_MOB',
    actionLabel: 'Try Depleting Stock (Flash Mob)',
  },
  {
    id: 'queue-shed',
    title: '4. Queue Shed (BUSY): Backpressure & Bounded Buffers',
    badge: 'Load Shedding',
    summary: 'Using circular arrays and semaphores to shed load immediately rather than crashing the operating system.',
    plainEnglish: `What happens when 500 customers show up at once? An unbounded server would spawn 500 threads, run out of memory (ENOMEM), and crash. ConeCurrency solves this with a Bounded FIFO Queue (capacity 8) and a fixed thread pool (4 workers). If all 4 workers are busy and all 8 queue slots are full, the door manager does not block: it immediately replies "BUSY\\n" (or "ERR BUSY\\n") and closes the connection. This is called Load Shedding (Backpressure).`,
    backendWalkthrough: `1. Client connects via TCP.
2. Accept loop checks queue_try_push(queue, client_fd).
3. If queue->count == queue->capacity:
   - queue_try_push returns false immediately without waiting.
   - Accept loop writes "ERR BUSY\\n", increments STAT_BUSY, and closes socket.
4. Server resources remain protected, and memory use stays strictly bounded.`,
    cCodeSnippet: `// Bounded Queue Try-Push (Load Shedding)
bool queue_try_push(struct client_queue *q, int fd) {
    pthread_mutex_lock(&q->lock);
    if (q->count == q->capacity) {
        pthread_mutex_unlock(&q->lock);
        return false; // Queue full! Shed load immediately
    }
    q->slots[q->tail] = fd;
    q->tail = (q->tail + 1) % q->capacity;
    q->count++;
    pthread_cond_signal(&q->not_empty); // Wake idle worker
    pthread_mutex_unlock(&q->lock);
    return true;
}`,
    diagramType: 'queue',
    actionTrigger: 'FLASH_MOB',
    actionLabel: 'Trigger Queue Shedding',
  },
  {
    id: 'bad-request',
    title: '5. Bad Request: Protocol Validation & Socket Sanitation',
    badge: 'Defensive Coding',
    summary: 'Handling garbage bytes, partial TCP chunks, and lowercase commands without hanging or crashing.',
    plainEnglish: `In raw socket programming, clients can send anything: partial strings, uppercase/lowercase typos, binary garbage, or disconnect midway. The C request handler inspects incoming bytes through the first newline (up to a MAX_REQ safety limit of 64 bytes). If the request is not exactly "BOOK\\n", "STATUS\\n", or "RESET\\n", the server increments STAT_BAD, transmits "ERR BAD_REQUEST\\n", and cleanly terminates the connection.`,
    backendWalkthrough: `1. Client transmits arbitrary garbage, e.g. "GARBAGE_PAYLOAD\\n".
2. Server reads bytes into buffer until '\\n'.
3. Strict memcmp(req, "BOOK\\n", 5) check fails.
4. Server sets timeout setsockopt(SO_SNDTIMEO, 2s).
5. Writes "ERR BAD_REQUEST\\n" and immediately closes fd.`,
    cCodeSnippet: `// Protocol validation in C
if (!complete || used != 5 || memcmp(request, "BOOK\\n", 5)) {
    stats_inc(STAT_BAD);
    reply(fd, "ERR BAD_REQUEST\\n");
    return; // Handler returns; caller closes fd
}`,
    diagramType: 'bad',
    actionTrigger: 'BAD',
    actionLabel: 'Send Bad Request Test',
  },
  {
    id: 'avg-latency',
    title: '6. Average Latency: Measuring Lock Contention Jitter',
    badge: 'Performance Metrics',
    summary: 'How round-trip latency exposes queue queuing delays and lock contention.',
    plainEnglish: `Latency is the time from when the first byte of a request is transmitted until the final byte of the reply is parsed. With a single client, latency is simply Network Time + Simulated Delay (~20ms). But during a Flash Mob with 25 concurrent connections, threads must wait in line for the 4 workers and fight for the inventory mutex. Latency climbs to 150ms+! Monitoring average latency gives real-time visibility into thread contention.`,
    backendWalkthrough: `1. High-precision timestamp start = process.hrtime.bigint() captured before socket write.
2. Byte stream parsed through newline terminator '\\n'.
3. timestamp end = process.hrtime.bigint() recorded.
4. Latency = (end - start) / 1,000,000 ms.
5. Rolling window average computed across recent requests.`,
    cCodeSnippet: `// High resolution monotonic timing in C
struct timespec start, end;
clock_gettime(CLOCK_MONOTONIC, &start);

// ... handle connection ...

clock_gettime(CLOCK_MONOTONIC, &end);
long long ms = (end.tv_sec - start.tv_sec)*1000 + 
               (end.tv_nsec - start.tv_nsec)/1000000;`,
    diagramType: 'latency',
    actionTrigger: 'RUSH',
    actionLabel: 'Measure Latency Spike',
  },
  {
    id: 'reset-counters',
    title: '7. Reset Counters: Atomic Reset Across Threads',
    badge: 'State Consistency',
    summary: 'Why resetting inventory and metrics requires synchronization so workers do not corrupt state mid-reset.',
    plainEnglish: `Clicking Reset Counters restores inventory back to 50 and zeroes out all metrics (booked, sold out, busy, bad). If a reset occurred while worker threads were actively decrementing inventory, half-reset values could produce invalid negative counts or orphaned tickets. The reset operation atomically acquires the inventory lock and stats lock, restoring baseline state cleanly.`,
    backendWalkthrough: `1. UI emits RESET command to bridge.
2. Bridge transmits "RESET\\n" to TCP server.
3. Server acquires pthread_mutex_lock(&inventory_lock) and pthread_mutex_lock(&stats_lock).
4. Remaining stock reset to initial count, metrics set to 0.
5. Locks released; "OK RESET\\n" reply returned.
6. UI wipes local counters and empties the visual scoop stack.`,
    cCodeSnippet: `void booking_reset(int new_stock) {
    pthread_mutex_lock(&inventory_lock);
    remaining = new_stock;
    pthread_mutex_unlock(&inventory_lock);
    
    pthread_mutex_lock(&stats_lock);
    memset(counts, 0, sizeof(counts));
    pthread_mutex_unlock(&stats_lock);
}`,
    diagramType: 'reset',
    actionTrigger: 'RESET',
    actionLabel: 'Reset All Counters',
  },
  {
    id: 'register-tape',
    title: '8. Register Tape: The Real-Time TCP Stream Relay',
    badge: 'Network Bridge',
    summary: 'How Node.js acts as a protocol bridge between modern WebSockets and low-level POSIX TCP sockets.',
    plainEnglish: `Modern web browsers speak HTTP and WebSockets, but cannot create raw TCP connections (like socket(AF_INET, SOCK_STREAM)). Our Node.js bridge server bridges this gap! It maintains persistent WebSockets with the browser while opening real raw TCP streams to 127.0.0.1:8080. Every raw byte returned by C is timestamped, measured, and streamed directly onto the Register Tape receipt printer.`,
    backendWalkthrough: `1. Browser connects to ws://127.0.0.1:3001.
2. Bridge accepts WebSocket connection and monitors backend health with periodic TCP probes.
3. On request, bridge creates net.createConnection({ port: 8080, host: '127.0.0.1' }).
4. Incoming TCP chunks collected until newline '\\n'.
5. Log entry formatted and broadcast to all connected web clients in real time.`,
    cCodeSnippet: `// Bridge WebSocket to TCP socket relay (Node.js net)
const client = net.createConnection({ port: 8080, host: '127.0.0.1' }, () => {
    client.write(Buffer.from("BOOK\\n", "ascii"));
});

client.on("data", (chunk) => {
    // Broadcast real-time tape entry to browser WebSocket
    ws.send(JSON.stringify({ type: "TAPE_ENTRY", reply: chunk.toString() }));
});`,
    diagramType: 'tape',
    actionTrigger: 'CLEAR',
    actionLabel: 'Clear Register Tape',
  },
];

