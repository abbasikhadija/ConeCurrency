# ConeCurrency Gelateria 🍦

**Current classroom setup:** see [CLASSROOM.md](CLASSROOM.md) for student joining,
admin login, managed C rounds, production hosting and real-backend tests. Admin
controls require ADMIN_PASSWORD; there is no default production password.
The protocol table below describes the mock's extensions. The unchanged C
server supports BOOK only; managed resets restart that real executable, and
/api/status reports bridge-observed metrics. Failed external RESET replies do
not clear the dashboard. Browser connections now use same-origin /ws.
### Modern Visual Dashboard for a Concurrent POSIX Ticket-Booking Engine
**Course:** CSC-251L Operating Systems (Person 1: Concurrency & Synchronization Dashboard)

---

## 🍨 Architecture Overview

Browsers cannot open raw TCP stream sockets due to sandbox constraints. The **ConeCurrency Bridge** bridges this gap: it maintains persistent WebSockets with the browser while orchestrating raw TCP socket connections (`socket(AF_INET, SOCK_STREAM)`) to the C backend on port `8080`.

```
┌────────────────────────────────────────────────────────┐
│             React 18 + Vite Web Client                 │
│   (Framer Motion Physics, Receipt POS, Gelato Theme)   │
└──────────────────────────┬─────────────────────────────┘
                           │ Persistent WebSocket (Port 3001)
                           ▼
┌────────────────────────────────────────────────────────┐
│             Node.js Express + ws Bridge                │
│   (Parallel TCP Socket Pool, Connection Probe, Stats)  │
└──────────────────────────┬─────────────────────────────┘
                           │ Raw TCP Sockets (ASCII Stream)
                           ▼
┌────────────────────────────────────────────────────────┐
│        C Ticket Server (or Mock TCP Backend)           │
│  - Port 8080 (Configurable via BACKEND_PORT)           │
│  - POSIX Threads (pthread_create, pthread_cond_wait)   │
│  - Bounded FIFO Circular Queue (8 slots)               │
│  - Mutex Critical Section (pthread_mutex_lock)        │
└────────────────────────────────────────────────────────┘
```

---

## 📜 Assumed ASCII Protocol (`src/config/protocol.ts`)

All requests and replies are single-line ASCII strings terminated by newline (`\n`):

| Command / Reply | Direction | Purpose | Example Payload |
| :--- | :--- | :--- | :--- |
| `BOOK\n` | Client &rarr; Server | Reserves 1 cone atomically under mutex | `BOOK\n` |
| `STATUS\n` | Client &rarr; Server | Queries current metrics | `STATUS\n` |
| `RESET\n` | Client &rarr; Server | Atomically restores initial stock | `RESET\n` |
| `OK <ticket_id>\n` | Server &rarr; Client | Successful ticket reservation | `OK CONE-0042\n` or `OK BOOKED\n` |
| `SOLD_OUT\n` | Server &rarr; Client | Inventory reached zero | `SOLD_OUT\n` or `ERR SOLD_OUT\n` |
| `BUSY\n` | Server &rarr; Client | Bounded task queue full (load shedding) | `BUSY\n` or `ERR BUSY\n` |
| `ERR <reason>\n` | Server &rarr; Client | Malformed or timed-out request | `ERR BAD_REQUEST\n` |
| `STATUS <b> <s> <q>\n` | Server &rarr; Client | Counts of booked, sold out, and busy | `STATUS 12 5 2\n` |

---

## 🚀 Quickstart

### 1. Launch Everything in One Command (Mock Backend + Bridge + Web UI)
```bash
cd web
npm run dev:all
```
This starts:
- **Mock TCP Server** on `127.0.0.1:8080` (simulates C server with mutex, stock, latency, and bounded queue)
- **Node.js WebSocket Bridge** on `http://127.0.0.1:3001`
- **Vite React Dev Server** on `http://127.0.0.1:5173`

Open **`http://127.0.0.1:5173`** in your browser!

---

### 2. Pointing to the Real C Server (`ticket-server`)

To run against your actual compiled C operating systems binary:

```bash
# Terminal 1: Build and launch the real C concurrent server
cd ..
make concurrent
./ticket-server --mode concurrent --tickets 50 --workers 4 --queue 16 --port 8080 --delay-ms 20

# Terminal 2: Start the Bridge and Web UI
cd web
npm run dev:bridge &
npm run dev
```

*By default, the bridge looks for the C server on `127.0.0.1:8080`. You can override this using environment variables:*
```bash
BACKEND_HOST=127.0.0.1 BACKEND_PORT=8080 npm run dev:bridge
```

---

## 🧪 Testing Suite

### Run Unit and Integration Tests (Vitest + Coverage)
```bash
npm test
```
Runs:
- **Unit Tests:** Latency rolling average, edge case parsing (empty, huge, malformed), protocol serializer, and stats reducer with race condition detection.
- **Component Tests:** `Header`, `StatsStrip`, `RegisterTape`, `ActionButtons`, `RaceConditionBanner`.
- **Bridge Integration Tests:** Verifies TCP socket relays, 25 concurrent requests with zero duplicate ticket IDs under mutex, load shedding (`BUSY`), timeout handling, and backend downtime reconnection.

### Run E2E Tests (Playwright)
```bash
npm run test:e2e
```
Automates the full flow across:
- Single order booking
- Rush Hour (10 parallel requests)
- Flash Mob (25 parallel requests with confetti)
- Bad request error handling
- Reset and clear tape
- Keyboard shortcuts (`B`, `R`, `F`, `C`, `?`)
- Documentation navigation and "Try it" buttons

### Run Typecheck & Production Build
```bash
npm run lint    # tsc --noEmit
npm run build   # tsc && vite build
```

---

## 🎨 Design & Accessibility Features
- **Aesthetic:** Artisanal Italian Gelateria with warm cream background (`#F8F3E8`), waffle crosshatch texture, roasted chocolate header (`#3E2C2A`), and receipt tape POS styling.
- **Race Condition Detection:** Real-time banner warns if duplicate ticket IDs appear or inventory oversells past initial stock.
- **Web Audio API:** Self-contained retro synthesized sound effects (toggled on/off).
- **Accessibility:** Full WCAG AA contrast compliance, keyboard focus rings, ARIA live region on receipt tape (`aria-live="polite"`), and `prefers-reduced-motion` support.

