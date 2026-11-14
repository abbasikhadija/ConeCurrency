# Student Interface Redesign Plan

**Author:** Sadia Fatima (P3 — Threads & Scheduling)
**Scope:** the student side of the classroom web app (`web/`)
**Branch:** `Sadia-branch` → pull request into `main`
**Status:** complete — all items implemented and tested
**GUI credits:** student interface by Sadia Fatima; the admin gelateria dashboard it sits beside
is Abdul Qudoos's work and is unchanged by this plan.

The classroom app already connects real students to the real C server. This
plan makes the student side **explain what is happening inside the server**,
especially the worker threads and the waiting queue (P3), while keeping the
existing ice cream parlour look.

---

## 1. Ground rules

1. **Keep the theme.** Brown, beige/cream and pink stay. New colours are accents
   in the same family (strawberry pink, pistachio green, vanilla cream, mint).
2. **Never show invented data.** Every number a student sees comes from the real
   server or from the bridge's real measurements. Anything that is an estimate
   is labelled as an estimate (see section 4).
3. **Small, real commits.** One feature per commit, each one built and tested.
   No empty or artificially split commits.
4. **Respect teammates' code.** New features go in **new files** under
   `web/src/student/` and `web/server/`. Existing files (`ClassroomApp.tsx`,
   `classroom.ts`, `classroom.css`) only receive small, additive hooks, and every
   such change is listed in the pull request.
5. **Nothing changes for the admin dashboard** unless a plan item says so.
6. **All existing tests keep passing**, and every new feature adds its own tests.

---

## 2. Checklist

Numbers in brackets refer to the original request list.

### Part A — Navigation and flow
- [x] **A1. Leave the shop / start again** [1, 2] — a *Leave shop* button that
      clears the student session on the server, returning to the welcome screen
      without restarting the server. *Order again* stays available.
- [x] **A2. Remove developer text** [7, 8] — remove "Round N" and "Your order
      reserves one shared cone. Flavors in the dashboard are decorative."
- [x] **A3. Readable shop mode** [9] — show "1 cashier (sequential)" or
      "4 cashiers working at once (concurrent)" instead of the raw mode name.

### Part B — Welcome screen
- [x] **B1. Fix the layout** [3] — intro sentence on its own line, the
      *Your display name* label above its input, button below; works on phones.
- [x] **B2. Rename the button** [5] — "Enter the parlour".
- [x] **B3. Animated shop front** [3, 4] — illustrated parlour with balloons on
      the roof and small customers walking in one by one (CSS / framer-motion,
      respects `prefers-reduced-motion`).
- [x] **B4. Two clear entry choices** [11] — "I'm a customer" and "Team admin".

### Part C — Menu and pages
- [x] **C1. Menu button (☰)** [11] — in the top bar, with a dropdown:
      *Admin login*, *How it works*, *About us*.
- [x] **C2. About us page** [11] — team members and roles, project vision,
      course, copyright line.
- [x] **C3. How it works for students** [12] — the existing learning articles,
      reachable from the menu without admin login.

### Part D — Ordering experience
- [x] **D1. Confetti on success** [13] — "Yay, your ice cream is ready!" with
      confetti (`canvas-confetti`, already a dependency).
- [x] **D2. Clear sold-out and busy screens** [9] — an empty cone for
      `ERR SOLD_OUT`; "the line is full, try again in a moment" for `ERR BUSY`.
- [x] **D3. "Learn while you eat?" prompt** [12] — after a successful order,
      offer to open *How it works*.
- [x] **D4. Served time** [6, 9] — "Served in 1.5 s — making a cone takes 0.5 s;
      the rest was waiting for a free cashier."
- [x] **D5. My order history** [10] — at the bottom: totals (served / sold out /
      busy) and a list of this student's orders with time, result and duration.

### Part E — Live shop floor (top-down view) [6]
- [x] **E1. Shop snapshot endpoint** — `GET /api/shop` for joined students.
- [x] **E2. Shop floor view** — cashier counters, the waiting line with real
      display names, the cone in preparation, stock left, and a sold-out state.
- [x] **E3. "You are here"** — highlight the student's own place in the line.

### Part F — Documentation
- [x] **F1. Update `web/CLASSROOM.md`** with the new student features.
- [x] **F2. README** — illustrate P3's queue and worker pool through the shop floor.

---

## 3. Design notes

### Welcome screen (B)
```
┌───────────────────────────────────────────────┐
│ 🍦 ConeCurrency                         ☰ Menu │
├───────────────────────────────────────────────┤
│        🎈  🎈  🎈                              │
│      ┌──────────────┐                          │
│      │  GELATERIA   │   🚶 🚶 🚶 → (walking in)  │
│      └──────────────┘                          │
│   Welcome to ConeCurrency 🍦                   │
│   A real server serves the whole class at once │
│                                               │
│   [ I'm a customer ]   [ Team admin ]          │
│                                               │
│   Your display name                           │
│   [______________]                            │
│   [ Enter the parlour ]                       │
└───────────────────────────────────────────────┘
```

### Shop floor (E)
```
        CASHIERS (worker threads)            STOCK: 🍦 37 / 50
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ 👩‍🍳 Ali │ │ 👩‍🍳 Sara│ │ 👩‍🍳 —   │ │ 👩‍🍳 Zoya│   ← "making a cone…" bar
   └────────┘ └────────┘ └────────┘ └────────┘
   WAITING LINE (queue)
   🧍 Hamza → 🧍 Sadia (you) → 🧍 Ayesha → 🧍 Bilal
   Served just now: Ali 0.5 s · Sara 1.0 s · Omar sold out
```

---

## 4. Honesty rules for the shop floor

The real C server does not report which worker holds which customer or exact
queue positions. The bridge **does** know, for real:

| Fact | Source |
|---|---|
| Which orders are waiting for a reply, and when each was sent | Bridge order tracking |
| Each order's result and measured round-trip time | Bridge measurement |
| Number of workers, queue size, preparation delay, starting stock | The round settings used to start the C server |
| Cones booked in this round | Bridge counters (all managed-round orders pass through the bridge) |

The shop floor therefore:
- lists waiting customers **in the order they were sent** (FIFO, like the real queue);
- shows the first *workers* customers at the counters and the rest in line —
  labelled **"estimated from arrival order"**;
- shows stock as **starting stock − cones booked this round**;
- shows anonymous "crowd" customers for admin bursts, so the picture is not
  missing load the server really has.

Display names become visible to other students on the shop floor. The join
screen will say so.

---

## 5. Files

| File | Change |
|---|---|
| `web/src/student/*` | **New** — welcome, menu, about, shop floor, history, celebration components |
| `web/src/student/student.css` | **New** — styles in the existing palette |
| `web/server/shop.ts` | **New** — builds the `/api/shop` snapshot |
| `web/src/ClassroomApp.tsx` | Small hook — render the new student components |
| `web/server/classroom.ts` | Small additive hooks — leave endpoint, order history, data for the snapshot |
| `web/tests/**` | **New** tests for every feature |
| `web/CLASSROOM.md`, `README.md` | Documentation sections, credited to Sadia Fatima |

---

## 6. Testing

Every part must pass before it is committed:

```sh
cd web
npm run lint          # TypeScript type check
npm test              # unit, component and integration tests
npm run build         # production build
```

Manual check for each part: admin starts a round, two browser windows join as
different students, order, watch the change, and check the phone layout using
the browser's device toolbar.

---

## 7. Commits

| # | Commit | Items |
|---|---|---|
| 1 | `docs(ui): add student interface redesign plan` | this file |
| 2 | `feat(student): add leave-shop endpoint and button` | A1 |
| 3 | `feat(student): move student view into its own component; remove developer text` | A2, A3 |
| 4 | `feat(student): redesign welcome layout and rename entry button` | B1, B2 |
| 5 | `feat(student): add animated parlour front` | B3 |
| 6 | `feat(student): add entry choice and menu with about page` | B4, C1, C2 |
| 7 | `fix(learn): quote the real OK BOOKED reply in How it works` | correctness fix found while doing C3 |
| 8 | `feat(student): open how-it-works without admin login` | C3 |
| 9 | `feat(student): celebrate served orders and clarify sold-out/busy` | D1, D2, D3 |
| 10 | `feat(student): track order history and served time` | D4, D5 |
| 11 | `feat(shop): add live shop snapshot endpoint` | E1 |
| 12 | `feat(student): add live shop floor view` | E2, E3 |
| 13 | `docs(ui): document student experience` | F1, F2 |

## 8. Result

- Web test suite: 42 tests before this work, 79 after (unit, component and
  integration), plus the updated browser end-to-end flows.
- Checked in a real browser against the real C server: five students ordering
  at once in a managed round (3 cones, 2 workers) showed two customers at the
  counters, three in line with estimated positions, then SOLD OUT with served
  times of 2.5 s, 2.5 s and 4.8 s.
- Known limit: the bridge waits up to 5 seconds for each C reply, so very long
  preparation delays with few workers report late customers as not confirmed.
