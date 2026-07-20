# Cerno

An AI daily planner. You dump everything on your mind; Cerno parses it into
tasks, estimates effort, weighs priority and deadlines, and builds a realistic
day — scheduling what fits and parking the rest with a one-line reason.

```bash
npm install
cp .env.example .env.local   # optional — see "Running without a key"
npm run dev
```

## Stack

Next.js 15 (App Router) · TypeScript · Zustand · CSS Modules · Anthropic SDK.

Two deliberate deviations from `Cerno — Daily Planner Brief/DEVELOPMENT.md`:

- **CSS Modules, not Chakra UI.** The design is bespoke — flat surfaces,
  hairline borders, no component-library patterns — and the brief's fluid rem
  ladder fights a theme system.
- **No device frames.** The `.dc.html` phone and desktop shells (including the
  9:41 status bar) are mockup chrome, not app UI. This renders responsive
  full-viewport, swapping sidebar ↔ tab bar at 960px.

## Layout

```
src/
  app/                 routes + API handlers
    api/plan/          POST — dump → replanned day
    api/tasks/parse/   POST — one phrase → one task
  components/          each folder has .md docs alongside the .tsx
  lib/                 domain types, date/format helpers, planner, AI layer
  store/               Zustand store + SSR-safe provider
```

Every component ships a `.md` next to it describing props, behaviour and
gotchas. Start there before changing one.

## How planning works

```
CaptureOverlay  ──POST /api/plan──►  Claude (structured outputs)
                                       │
                                     zod-validated, capacity re-checked
                                       │
                                     tasks + day_plan  ──►  store  ──►  Today
```

- **Structured outputs** (`output_config.format` + `zodOutputFormat`) constrain
  the model to the schema in `src/lib/ai/schema.ts`, so malformed JSON isn't a
  failure mode to handle.
- **The server re-checks capacity.** A schema guarantees shape, not arithmetic:
  anything the model labelled `today` that pushes the day over budget is moved
  to deferred, and the capacity note is regenerated from the final counts. The
  Today header can never contradict the sections beneath it.
- **A dump replans everything outstanding**, not just the new text. Existing
  tasks are sent with their ids and echoed back, so completion state and React
  keys survive.

### Running without a key

Both routes fall back to a keyword heuristic planner (`src/lib/planner.ts`)
that implements the same contract — split, estimate, tag, fit to capacity,
defer the rest. The whole loop works offline. `planner: "ai" | "heuristic"` in
the response says which path ran.

The client adds a second layer: if the route itself is unreachable it plans
locally. A 4xx is *not* retried locally — that means the request was rejected,
and quietly producing a different answer would hide a real bug.

## Data

Supabase is the source of truth. There is no localStorage copy of tasks — the
only thing in local storage is the theme.

```
/dashboard layout  --loadDashboard()-->  Supabase   (server, per request)
       │                                    ▲
   StoreProvider                            │
       │                                    │
   task mutations  --write-through----------┘        (browser, RLS-scoped)
   dump / smart add --> /api/plan, /api/tasks/parse   (server, persists then returns)
```

- **Reads** happen once, on the server, in the dashboard layout. The first paint
  already contains the real plan — no spinner, no loading flash.
- **Task mutations** (complete, defer, delete, edit) apply optimistically and
  write through from the browser. A failed write **rolls the store back** and
  sets `syncError`; leaving the optimistic state would show a change that
  doesn't exist on the server and the user would only find out on reload.
- **Planning routes persist server-side before returning**, so the tasks the
  client receives already carry their database ids. The client never re-writes
  them.
- **No query filters by `user_id`.** RLS does that. Duplicating the predicate in
  application code creates a second place to get it wrong. Writes are the one
  exception: they must state the `user_id` they're claiming, and it comes from
  the verified session — never from the request body.

Migrations live in `supabase/migrations/`. Paste each whole file into the
Supabase SQL editor in order; every one is safe to re-run.

Ids are UUIDs generated in `lib/id.ts` rather than by the database default, so
the planner can reference a task's id while assembling a response, before
anything is written.

Completed work older than 14 days is not loaded. Open work is always loaded
regardless of age.

## Labels

Labels are **user-defined** — create, rename, recolour, delete in
Filters & labels. A new account is seeded with the original five.

`tasks.tags` stores label **names**, not foreign keys, because the planner
speaks in names: Claude returns `"work"`, not a uuid. The cost is that renames
and deletes must cascade into every tagged task, so both go through Postgres
functions (`rename_label`, `delete_label`) that do it in one transaction. They
run `SECURITY INVOKER`, so RLS makes another user's label simply *not found*.

**A plain `UPDATE` on `labels.name` will orphan every task carrying it.**

The model still can't invent a tag. That constraint moved rather than
disappeared: `buildTagSchema()` builds the structured-output enum per request
from the caller's own labels, and the prompt is given the same list. If those
two ever disagree, the model is told to do something the schema then blocks.

## Settings

One `user_settings` row per user, created lazily on first save. Every control
writes through optimistically and rolls back on failure — there is no Save
button, because each control is an independent preference.

Language and model choice are **stored but not yet applied**; both say so on
screen. Timezone and the reminder settings are live.

Avatars go to a public-read `avatars` bucket at `{user_id}/avatar.{ext}` — the
first path segment is what the storage policy checks against `auth.uid()`, so
that prefix is the ownership check, not just naming.

## Reminders

Derived from the same `withStartTimes` projection the timeline renders, so an
overdue badge can never disagree with the clock printed beside it.

- **Overdue** — the scheduled *finish* has passed. Not the start: flagging a
  task the moment it comes up is technically true and useless.
- **Soon** — starts within `reminder_lead_hours`, **high priority only**.

"Now" lives in the store as `nowMinutes`, ticked by `useNowTicker` in `AppShell`
and aligned to the wall-clock minute. It starts at 0 so the server never renders
an overdue state the client immediately contradicts, and it re-reads on tab
focus because background tabs throttle timers.

## Theme

Light is the default. Dark is the palette the designs actually specify;
light is derived from it in `globals.css` (same flat surfaces, same single red
accent, neutral ramp inverted).

Theme lives in its own `localStorage` key so the inline script in
`app/layout.tsx` can apply it before first paint without parsing the store —
otherwise a dark-mode user gets a light flash on every navigation. `<html>`
carries `suppressHydrationWarning` because that script deliberately makes the
DOM disagree with the server-rendered attribute.

**`--on-accent` is the foreground for anything sitting on the accent.** The
accent is a saturated red in both themes, so its contents are white in both —
never `--text`, which inverts and would render near-black on red in light mode.

## Time

The Today and Upcoming timelines are **derived**, not stored. `lib/schedule.ts`
lays tasks end-to-end from 09:00 in plan order; a task with a planner-assigned
`suggested_start` keeps its own time. So the timeline reshapes on reorder or
completion with no extra state and no migration.

Derived times render muted, planner-assigned times render in full weight — one
is a projection, the other a commitment, and the UI distinguishes them.

### `deadline` vs `plan_date`

These are different questions and the planner is prompted to keep them apart:

| Phrase | Field | Meaning |
|---|---|---|
| "finish the deck **by** Friday" | `deadline` | Must be done *by* then; schedule it whenever it fits |
| "massage **on** Sunday at 11" | `plan_date` | Do it *on* that day |

A task pinned to a future `plan_date` **bypasses the capacity guard entirely**.
Letting it compete for today's budget meant it could overflow into "deferred",
which rewrites `plan_date` to tomorrow — silently overriding the day the person
actually asked for. Both `/api/plan` and the heuristic route these into a
separate `later` bucket, and the capacity note gains a clause for them.

A malformed or past `plan_date` falls back to normal scheduling rather than
stranding the task on a day that has already gone.

## Voice

Web Speech API, feature-detected. Click to start, click again to stop — the
browser's end-of-speech timeout doesn't end the session. Permission is
confirmed *before* the UI enters the listening state, so the mic never appears
to be recording when it isn't; a blocked mic gets an explanatory dialog. Where
`SpeechRecognition` is absent the mic button isn't rendered.

## Known rough edges

- The brief's fluid rem ladder has a discontinuity (the `max-width:1200px` step
  resolves to ~10.5px root at a 1000px viewport). It's implemented but each
  step is wrapped in `clamp()` with a 13px floor. Remove the clamps for the
  raw curve.
- Deferral rarely fires at the spec'd 480-minute capacity — it takes a genuinely
  overloaded dump. The seed fixture hard-codes the designed 4/2 split so a cold
  open shows the Deferred section.
- The heuristic planner's tag keywords only help a user who kept the default
  label names. It matches the user's own names first and falls back to their
  first label; there is no useful way to guess keywords for a label called
  "gardening". The AI path gets the real list.
- `env(safe-area-inset-bottom)` on the mobile notification sheet is untested —
  it resolves to 0 in headless Chrome and needs a real device.
- Notifications are in-app only. The reminder layer is pure and decoupled
  (`lib/reminders.ts`), so an OS-notification layer can sit on top without
  rework.

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
