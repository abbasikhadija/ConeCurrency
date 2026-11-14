# Admin Interface Redesign Plan

**Author:** Sadia Fatima
**Scope:** the admin (owner) side of the web app, plus two customer-side follow-ups
**Follows:** [STUDENT_UI_PLAN.md](STUDENT_UI_PLAN.md) — same ground rules
**Status:** complete — all items implemented and tested

The admin side is where the team runs a shift: sign in, choose how many cones,
cashiers and waiting places the real C server gets, and watch it serve. This
plan makes it read like running a real ice cream parlour, keeps a serious,
professional tone, and removes wording that only made sense to developers.

---

## 1. Ground rules

Same as the student plan: keep the brown / cream / pink theme, never show
invented numbers, one real feature per commit, keep teammates' code changes
small and listed, and keep every test passing.

---

## 2. Checklist

Numbers in brackets refer to the request list.

### Part A — Sign-in and wording
- [x] **A1. Owner sign-in** [1] — "Welcome back, owner" card with a calm,
      professional look and a short warm line; label above the password box.
- [x] **A2. "Customers" everywhere** [3, 9] — "Classroom orders" becomes
      "Customers"; "classmates" and "the whole class" become "customers".
- [x] **A3. Say what the product is** [4, 5] — "Concurrent POSIX ticket booking
      engine" becomes "Concurrent ice cream ordering · POSIX threads";
      "Gelateria" becomes "Ice Cream Parlour".
- [x] **A4. Neutral footer** [7] — "Person 1 … Dashboard" becomes "Admin dashboard".
- [x] **A5. No team-part labels in the interface** [11] — no "P1 / P2 / P3" or
      "Person 1" anywhere on screen (About us keeps names and work, without part numbers).

### Part B — Setting up the shift
- [x] **B1. Manager's briefing** [2] — instead of a bare form, the manager
      "types" a short briefing to the owner, one question at a time: service style,
      cones in the freezer, cashiers on shift, room in the line, time per cone.
      Each answer is an editable box that appears once its line is typed.
- [x] **B2. Live parlour preview** [2] — beside the briefing, a picture of the
      shift that updates as values change: freezer with cones, cashiers on shift
      (one in one-at-a-time mode), waiting places, time per cone.
- [x] **B3. Plain status line** — "Shop open · shift 2 · cashiers serve together"
      instead of developer text; orders in progress shown separately.

### Part C — Dashboard fixes
- [x] **C1. Scoops sit on the cone** [6] — scoops were drawn under the cone.
- [x] **C2. Remove How it works from the admin dashboard** [8] — the dashboard
      shows the parlour only; customers still reach How it works from the menu.
- [x] **C3. Pink How it works buttons** [10] — topic and collapse buttons on the
      customer How it works page use the pink accent instead of brown.

### Part D — Customer guide
- [x] **D1. "What's happening here?"** [12] — a button on the name screen (and
      the first choice screen) that opens a short guide: why you are here, what
      happens when you order, what every message means, and what the shop floor shows.

### Part E — Documentation
- [x] **E1. README and classroom guide** — describe the admin side and Sadia
      Fatima's contributions.

---

## 3. Design notes

### Manager's briefing
```
┌──────── Today's shift ─────────────────────┬──────── Preview ─────────────┐
│ 🧑‍💼 Good morning, owner! Here's the plan   │  FREEZER   🍦🍦🍦🍦🍦  (5)    │
│    for today's shift.                      │  CASHIERS  👩‍🍳 👩‍🍳   on shift  │
│ 🧑‍💼 How should the cashiers work today?    │  LINE      ○○○○○○○○ … (32)   │
│    [ Together — all serve at once ▾ ]      │  ⏱ 1.5 s per cone            │
│ 🧑‍💼 How many cones are in the freezer?     │                              │
│    [ 5 ] cones                             │                              │
│ … cashiers … line … time per cone …        │                              │
│ 🧑‍💼 All set. Shall I open the shop?        │                              │
│    [ Open the shop ]                       │                              │
└────────────────────────────────────────────┴──────────────────────────────┘
```
The typing effect is skipped for people who turn off motion in their system
settings, and a "Show everything" button reveals the whole briefing at once.

---

## 4. Files

| File | Change |
|---|---|
| `web/src/admin/*` | **New** — sign-in, manager's briefing, shift preview, customers list, styles |
| `web/src/student/CustomerGuide.tsx` | **New** — the "What's happening here?" guide |
| `web/src/ClassroomApp.tsx` | Small hooks — render the new admin components; wording |
| `web/src/components/Header.tsx`, `web/src/App.tsx` | Wording; optional hiding of the How it works tab |
| `web/src/App.css` | One-line fix: scoop stack order |
| `web/src/student/*` | Wording ("customers") |
| `web/tests/**` | New and updated tests |

---

## 5. Commits

| # | Commit | Items |
|---|---|---|
| 1 | `docs(ui): add admin interface plan` | this file |
| 2 | `feat(admin): owner sign-in and customer-facing wording` | A1–A5 |
| 3 | `feat(admin): manager's briefing with live shift preview` | B1–B3 |
| 4 | `fix(ui): scoops on the cone, parlour-only admin view, pink learn buttons` | C1–C3 |
| 5 | `feat(student): add "What's happening here?" customer guide` | D1 |
| 6 | `docs: document the admin interface and Sadia Fatima's work` | E1 |

## 6. Result

- Web tests: 79 before this plan, 96 after, plus the updated browser flows
  (How it works is now tested through the customer menu).
- Checked in a real browser against the real C server: owner signs in, the
  briefing types out, 6 cones / 3 cashiers / 1.0 s are set, the shop opens with
  "Shop open · shift 1 · 3 cashiers serve together", and a customer's order shows
  as "being served" then "served" in the Customers list.
