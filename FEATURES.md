# Cerno — Product features

Cerno is an AI daily planner. You dump what's on your mind in plain language;
Cerno turns it into a realistic, time-blocked day and keeps it in sync across
your devices, your calendar, and your team.

This document describes every feature and how it works, end to end. It's the
product companion to the setup docs (`README.md`, `STRIPE.md`, `EMAIL.md`,
`TELEGRAM.md`) — those cover *configuration*; this covers *behaviour*.

---

## 1. Capture — the brain dump

**What it does.** One box, "What's on your mind?", takes everything you need to
do as a single stream of text (or voice). You don't format it, tag it, or
estimate it — you just write.

**How it works.**
- The text goes to `/api/plan`, which prompts the model (your chosen Claude or
  OpenAI model) with a structured-output schema. The model returns titled tasks,
  each with a **priority**, an **effort estimate**, an inferred **deadline**, a
  **suggested start time**, a **label**, and a one-line **reasoning**.
- A **capacity guard** runs after the model: anything that pushes the day past
  your working capacity (default 8h) is moved to *Deferred* — tomorrow — no
  matter what the model labelled it. This is why the day is *realistic* rather
  than a wish list.
- A **day summary** and a **capacity note** ("14 things came in (~9h), I planned
  9 that fit today and parked 5 for tomorrow") are generated so the top of Today
  always explains the shape of the day.
- **Voice**: tap the mic, speak, and the recording is transcribed server-side
  (Whisper) before it's planned. Typing works everywhere; voice needs a secure
  connection and mic permission, and degrades to a clear message if either is
  missing.

**No key? Still works.** With no AI key configured, a local heuristic planner
produces the same shape of result, so the whole loop is demoable offline.

---

## 2. Today

The home screen. Your day, laid on a clock and bucketed into **Morning /
Afternoon / Evening** blocks, each with a running time total.

- **Time labels** distinguish a *commitment* (a time the task actually carries)
  from a *projection* (a time derived by laying tasks end to end).
- **Overdue** tasks — past their scheduled time and still open — are tinted and
  badged, and surfaced in the notification bell.
- A **"Reschedule N"** bulk action appears when tasks are overdue, moving them
  all to a chosen day at once.
- **Deferred** tasks (parked for tomorrow) sit in their own section with a
  one-tap "Move to today".

---

## 3. Quick add

Every list has a smart add bar. Type one thing — "call the dentist tomorrow" —
and Cerno parses it into a titled, estimated, tagged task through
`/api/tasks/parse`, without replanning the whole day.

- **Instant and durable.** The row appears the moment you hit enter and is
  written to the database within ~100ms; the AI parse then *enriches* that same
  row. A reload or a failed parse never loses what you typed — worst case it
  keeps your exact words without the inferred details.
- **Pinned days.** Adding from a specific day (in Upcoming) pins the task to that
  day regardless of what the text says.
- **`@mention` assignees** (in a workspace): type `@name` to assign the task to a
  teammate; the mention is stripped from the title and shown as a chip.

---

## 4. Inbox

Anything Cerno parses but doesn't schedule lands here — a holding pen. Each row
shows Cerno's **reasoning** so you can see *why* it wasn't scheduled, and a
one-tap **"Add to today"**. Inbox rows are full task rows: swipe, edit, drag,
complete.

---

## 5. Upcoming

A week view: a day strip on top, an agenda below. Each day is its own section
with its own blocks and its own add bar.

- Selecting a day scrolls its agenda into view rather than filtering — the week
  stays readable as context.
- Step forward/back a week; jump back to "this week".

---

## 6. Drag and drop

Tasks can be dragged to reschedule, across the whole app.

- **Desktop**: click-drag starts after 8px of movement, so clicks (checkbox,
  menu) still work.
- **Mobile**: press-and-hold (220ms) starts a drag, so it coexists with the
  swipe-to-reveal gesture and vertical scrolling.

**Drop targets:**
- A **day** in Upcoming (the strip chip *or* the agenda section) → reschedules.
- A **time block** on Today → schedules onto today and sets the start time to
  that block.
- The **"postpone to tomorrow"** bar (appears only while dragging on Today).
- The **Today / Inbox** items in the sidebar and mobile tab bar.
- **Inbox → any of the above.**

---

## 7. Task actions

Each task row exposes:
- **Complete** — checkbox, or the swipe tray.
- **Edit** — a dialog for title, note, priority, start time, and estimate.
- **Reschedule** — a date picker with presets (Today, Tomorrow, This weekend,
  Next week, No date) *and* a time picker (Morning/Midday/Afternoon/Evening).
- **Delete** — behind a confirmation, so it can't be hit while reaching for the
  check.

On a phone the same actions live in a **swipe-left tray** (Done · More · Delete)
and a tap-to-open menu, since there's no hover.

---

## 8. Labels, filters, and search

- **Labels** are smart tags Cerno applies automatically (errand, comms, health,
  work…), fully editable — rename, recolour, add, remove.
- **Filters** group open tasks by **priority**, **deadline**, or **label**.
- **Search** scans task titles, labels, and Cerno's reasoning; results are
  grouped by day. An empty search shows quick links to Today, Inbox, Upcoming.

---

## 9. Reminders and notifications

A bell (top bar and sidebar) collects what needs you: **overdue** tasks and
tasks **coming up** within your chosen lead time (1/2/4/8 hours). Each reminder
can be completed or dismissed inline. Overdue reminders can't be dismissed —
they clear only when the task is done or moved. Reminders can be turned off
entirely.

---

## 10. Workspaces (Team)

A workspace is a **shared task list** — one per team or project.

**How it works.**
- Every member sees the same shared day: a Today section and a Later section,
  plus the roster and, for admins, invites.
- **Assignees**: a task can be assigned to a member; their avatar shows on the
  row, and `@mention` in the add bar assigns on creation.
- **Roles.** *Admins* (starting with the creator) can invite, remove, promote,
  and transfer ownership. *Members* can add and edit tasks but not manage
  people. The **owner** can't be removed or demoted, and can hand ownership to
  someone else.
- **Invites.** Two kinds: an **email invite** (only that address can accept) and
  a **copyable link** (whoever opens it first). Both expire in 7 days and both
  land the link on your clipboard, so a mail outage never blocks you.
- **Seat cap.** Up to **10 people** per workspace; beyond that is Enterprise, a
  conversation rather than a checkout (a mailto, not a button that pretends to
  self-serve).

**Security.** Multi-tenant isolation is enforced in the database (Row-Level
Security), not the UI — an admin who edits the DOM to reveal a control still
can't act, because the policy says so. Membership is checked through security-
definer functions to avoid policy recursion.

---

## 11. Plans and billing

Two plans, shown side by side in **Settings → Plan & billing** as a comparison
grid:

| | **Free** | **Team — $12/month** |
| --- | --- | --- |
| Personal tasks | Unlimited | Unlimited |
| AI planning | ✓ | ✓ |
| Calendar feed | ✓ | ✓ |
| Reminders | ✓ | ✓ |
| Shared workspaces | — | Up to 10 people |
| Assign to teammates | — | ✓ |
| Who pays | — | You; invitees don't |

**How it works.**
- Checkout and the customer portal are **Stripe-hosted** redirects — no card
  data or Stripe code touches the browser.
- **Entitlement is written only by the Stripe webhook**, never by the client, so
  no amount of devtools tinkering grants a plan. The UI mirrors the database's
  `has_active_plan()` purely to decide what to show; if the two disagreed, the
  database wins.
- After checkout, the app **polls** for the new plan (the webhook races the
  redirect and usually loses), and shows a status toast until Stripe confirms.
- The plan card also surfaces the real subscription state from Stripe — renewal
  date, a failed payment, a pending cancellation.

Setup: `STRIPE.md`.

---

## 12. Calendar feed

Settings → Calendar feed mints a **private iCal URL** you subscribe to from
Google, Apple, or Outlook. Your scheduled tasks appear as events, updated
automatically.

- The token is a **credential**, not your user id: random, revocable, and
  regenerating it instantly kills the old URL. An unknown token 404s (never
  revealing whether one exists), and the feed is served `no-store` /
  `no-referrer`.

---

## 13. Planning model

Settings → Planning model lets you choose which model plans your day —
**Claude** (Opus, Sonnet, Haiku) or **OpenAI** (GPT-5, GPT-5-mini). The choice
is stored as a preference and read **server-side**; the browser never names the
model, so the picker can't be used to spend on a model of a caller's choosing.
If a chosen provider isn't configured, requests fall back to Claude — a dropdown
can never break planning.

---

## 14. Language (English / Ukrainian)

The whole authenticated app is available in **English** and **Ukrainian**,
switchable in Settings, with a one-time language choice on first run.

- Translations live in a single typed dictionary where English is the source of
  truth — a missing Ukrainian string is a **build error**, not a silent
  fallback, so coverage is compiler-enforced.
- The **login/signup** pages stay English by design: they render before sign-in,
  where the language preference doesn't exist yet.

---

## 15. Accounts and sign-in

- **Google** (OAuth) or **email + password**.
- **Password reset**: "Forgot password?" on the login screen emails a reset
  link; the link establishes a short-lived recovery session and drops you on a
  "choose a new password" page.
- Server-side auth verifies the session on every protected request; the session
  cookie is refreshed transparently by middleware.

---

## 16. Email

Cerno sends branded, responsive HTML email (welcome, workspace invite, team
welcome, payment issue, subscription ended) through **Resend**. The
authentication emails (confirm address, magic link, reset password) are sent by
**Supabase Auth** using the same branding — see `EMAIL.md` and
`supabase/auth-emails/`. Mail is **optional**: with none configured, actions that
would email simply skip it (an invite's link is still copied to your clipboard).

---

## 17. Telegram bot *(built, currently hidden)*

A Telegram integration exists in the codebase — send tasks to the bot, get a
morning brief — but its Settings tab is **turned off** while the bot is finished.
The routes and code remain; re-adding the entry in `lib/settingsNav.ts` turns it
back on. See `TELEGRAM.md`.

---

## Design principles running through all of it

- **The database is the source of truth.** Entitlement, tenancy, and identity
  are enforced by Postgres RLS and server-only keys; the UI decides what's
  *worth showing*, never what's *allowed*.
- **Optimistic, but durable.** Actions feel instant and are written through to
  the database; a failure rolls back visibly rather than silently.
- **Fail visible, never silent.** A dropped save, a skipped step, or a failed
  send surfaces — the worst outcome is a task that quietly never existed.
- **Provider wording never leaks.** Model, Stripe, Resend, and Supabase errors
  are mapped to plain, user-safe copy.
