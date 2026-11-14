# Classroom web application

The existing React gelateria dashboard is retained behind an admin session. The
new student page joins by display name, submits one pending order at a time, and
polls that student's private order result. Successful real BOOK replies display
an ice cream on the phone. Admins see named participants and pending/completed
orders alongside the original dashboard, bursts, tape and learning articles.

## Student experience

*Designed and built by Sadia Fatima (P3). Plan and checklist:
[docs/STUDENT_UI_PLAN.md](../docs/STUDENT_UI_PLAN.md).*

| Screen | What the student sees |
|---|---|
| Welcome | Animated parlour front, then a choice: **I'm a customer** or **Team admin** |
| Join | Display name (shown to classmates) and **Enter the parlour** |
| Order | Plain-language shop mode, a wobbling cone while waiting, then the result |
| Served | Confetti and "Yay! Your ice cream is ready!", with an offer to open How it works |
| Sold out / busy | A grey cone with a SOLD OUT stamp, or "the line is full right now" |
| Served time | "Served in 1.5 s: making a cone takes 0.5 s, and about 1.0 s was spent waiting in line" |
| Your orders | Totals and the last 20 orders with result and measured time |
| Inside the parlour | Live shop floor: cashier counters, the waiting line with names, "you are here", cones left |
| Menu (☰) | Admin login, How it works (read-only for students), About us |

**Leave shop** ends the student session on the server and returns to the
welcome screen; no server restart is needed. A student cannot leave while an
order is still waiting for the C server.

### Where the numbers come from

| Shown | Source |
|---|---|
| Result of an order | The real C server reply relayed by the bridge |
| Served time | The bridge's measured round trip for that order |
| "Waiting in line" part | Measured time minus the round's preparation delay (managed rounds only) |
| Cones left | Round stock minus cones booked this round (managed rounds only) |
| Cashiers | The round's worker count (one in sequential mode) |
| People at counters / in line | Students' pending orders in the order they were sent |

The C server does not report which worker holds which customer, so the split
between counters and the line is **estimated from arrival order** (the real
queue is first come, first served) and the page says so. Admin bursts appear as
anonymous "crowd" customers so the picture is not missing real load.

### Student API

| Endpoint | Purpose |
|---|---|
| `POST /api/leave` | End the student session (409 while an order is pending) |
| `GET /api/student` | Adds `history`, `workers` and `delayMs` to the existing fields |
| `GET /api/shop` | Live shop snapshot for joined students; contains display names only |

The bridge waits up to 5 seconds for each C reply. Keep
*delay × (customers ÷ workers)* under that, for example 500–1000 ms with
4 workers, or late customers are reported as not confirmed.

## Ubuntu setup

Use Node.js 22 with npm, and the repository's Ubuntu C build dependencies.
Check `node --version`; Ubuntu's default nodejs package may be older.

```sh
# From the repository root, on this branch:
make all
cd web
npm ci
cp .env.example .env
```

Edit web/.env and set ADMIN_PASSWORD to a private, strong password. There is no
default admin password; an empty value disables admin sign-in. Do not commit
this file. Keep MANAGE_BACKEND=1 and C_SERVER_PATH=../ticket-server for the class
demo. Stop any manually launched server on BACKEND_PORT first: the bridge never
kills an unrelated process to take its port.

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. Students use the default join screen. Team members
choose Admin login, sign in, then start a new sequential or concurrent round.
No C server starts until the admin starts the first managed round.

For development, run `npm run dev:bridge` and `npm run dev` in separate terminals
inside web/. Open http://127.0.0.1:5173. Vite proxies /api and /ws to the bridge.
No browser environment depends on Node's process global, and WebSocket URLs use
the page's own host and ws/wss scheme rather than classmates' localhost.

For mock-only development, set MANAGE_BACKEND=0 in .env before `npm run dev:all`.
That command uses the mock TCP server, not the C engine; it is not OS validation.

## Admin and student boundaries

Admin login issues an eight-hour HttpOnly, SameSite=Strict cookie. Administrative
HTTP actions and WebSocket commands check the session on the server. Login is
rate-limited. Logout revokes the session. Students cannot switch mode, reset,
launch crowds, or retrieve another student's order using the student API.
Names are display names, not verified school identities; no registration/password
database is introduced. Student cookies, orders and sessions are in memory and
are lost when the bridge restarts. Name/order information is visible to the admin
for the class demonstration.

Only the admin can start a new managed round. It waits for bridge-tracked pending
orders to finish, stops its owned C process, and launches the same executable
with the selected mode, stock, worker/queue counts and fake-work delay. Inventory
and dashboard counters reset together after startup succeeds. Student results
retain their old round references. It never changes the booking algorithm.
Do not run direct benchmark clients against the managed demo server during a
round switch: the bridge cannot track clients that bypass it.

With MANAGE_BACKEND=0, an independently started C server remains supported for
BOOK requests. Its RESET command is unsupported: the bridge reports failure
without clearing counters or claiming inventory was restored. The mock's
confirmed OK RESET reply is still supported. /api/status returns explicitly
labelled bridge-observed metrics, not a fabricated global C-server snapshot.

The UI's pending state means waiting for a real TCP response; it does not claim
an exact position in P3's queue or invent service-stage events. Flavor animation
is decorative; all orders share the original single inventory. Original BOOKED
responses are acknowledgements, not ticket IDs. Duplicate detection only uses
actual IDs; oversell warnings only compare with explicitly configured stock
(managed rounds set it automatically; external mode can set BACKEND_STOCK).

## Internet deployment

The bridge serves the production build and /ws on port 3001. For AWS, put it
behind HTTPS with a reverse proxy forwarding /api, /ws (WebSocket upgrade), Host
and X-Forwarded-Proto. Keep the raw C TCP port private. The bridge trusts a local
reverse proxy only. Use HTTPS before sharing admin credentials over the internet.
This patch does not provision AWS resources, a certificate, or a public URL.

## Verification

```sh
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests normally use the mock and a test-only admin secret. CI additionally
compiles the real C executable, checks managed round switching/depletion/reset,
and runs the browser suite against both real C modes. Locally on Ubuntu:

```sh
REAL_C_SERVER="$(realpath ../ticket-server)" npm test
PLAYWRIGHT_REAL_BACKEND=1 TEST_C_MODE=sequential npm run test:e2e
PLAYWRIGHT_REAL_BACKEND=1 TEST_C_MODE=concurrent npm run test:e2e
```

On this Windows development machine, Node 22.14 and headless Chrome verified
the build, 41 unit/component/integration cases, and 12 browser cases. The real C
test is skipped locally because WSL/compiler tools are absent; Ubuntu CI is the
source of evidence for actual C execution. Development dependency advisories
remain in the inherited Vite/Vitest toolchain; do not expose development/test
servers publicly. `npm audit --omit=dev` reported zero runtime vulnerabilities.
