# TodayView

The payoff screen and the app's home route (`/`). A realistic ordered plan,
plus what was deferred and why.

## Sections

1. **Header** — eyebrow date → `dayPlan.summary` as H1 → `dayPlan.capacity_note`
2. **SmartAddBar**
3. **Scheduled** — grouped into time blocks; each row is a start time + a
   `TaskChip` with hover actions (desktop) or swipe actions (touch)
4. **Deferred** — sunken cards with a reason and a "Move to today" button

## Time blocks

Rows are bucketed into Morning / Afternoon / Evening by `src/lib/schedule.ts`.
Each block shows its clock span and summed estimate.

The schedule is **derived, not stored**. `withStartTimes()` walks the tasks in
plan order and lays them end-to-end from 09:00; a task that carries its own
`suggested_start` keeps it, and everything else gets the running cursor. So
reordering or completing a task reshapes the timeline with no migration and no
extra state.

Two consequences worth knowing:

- A derived time is a *projection* ("roughly when this lands if you work down
  the list"), not a commitment. Times from the planner are rendered in full
  `--text` weight; derived ones are muted. One is a promise, the other a guess,
  and the UI says which.
- Empty blocks are dropped, so a short day renders a single "Morning" band
  rather than three headers with two of them empty.

## Data

| Rendered | Source |
|---|---|
| H1 | `dayPlans[today].summary` |
| Sub-line | `dayPlans[today].capacity_note` |
| Scheduled | `scheduledFor(tasks, today)` — status `today` or `done` |
| Deferred | `deferredFor(tasks, today)` — status `deferred`, dated tomorrow |
| "≈ 2h 35m" | Sum of **open** tasks only; completing one lowers it |

## The counts must reconcile

The capacity note says "I planned N … parked M". N and M must equal the rows
actually rendered below. This is enforced at the source — `/api/plan` and
`buildPlan` both regenerate the note from the final split *after* the capacity
guard runs. Never render a model-authored count directly.

## Row actions

**Desktop** — hidden until row hover or focus-within (`opacity: 0`). Check
toggles done; trash deletes.

**Touch** — the hover buttons are `display: none` and `SwipeRow` provides the
same two actions on a left swipe instead. They'd otherwise sit there
permanently, stealing width from the title.

## Deletion is deferred by one animation

`requestDelete()` marks the id in local `removing` state, lets the row play
`cernoRowOut` (260ms), and only then calls `deleteTask`. Deleting from the
store immediately would make the row vanish and the rows below snap up.

The pending timers are tracked in a `Map<timerId, taskId>`. On unmount the
cleanup **flushes** them — clears the timer *and* performs the delete. Simply
clearing would resurrect the task when you navigated back, which reads as the
delete having silently failed.

`REMOVE_MS` must stay in sync with the animation duration in the CSS module.

## Gotchas

- Uses `useAppStoreShallow` for `scheduledFor`/`deferredFor` — they build a new
  array each call, and a reference-compared selector causes a re-render loop.
  See `src/store/StoreProvider.tsx`.
- The row entrance stagger is `--i` (the index within its block) fed to a CSS
  `animation-delay`, capped at 8 slots. Past that the tail reads as lag rather
  than rhythm.
