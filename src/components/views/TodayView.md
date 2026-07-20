# TodayView

The payoff screen and the app's home route (`/`). A realistic ordered plan,
plus what was deferred and why.

## Sections

1. **Header** — eyebrow date → `dayPlan.summary` as H1 → `dayPlan.capacity_note`
2. **SmartAddBar**
3. **Scheduled** — numbered `TaskChip` rows with hover actions
4. **Deferred** — sunken cards with a reason and a "Move to today" button

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

Hidden until row hover or focus-within (`opacity: 0`), always visible on touch
via `@media (hover: none)`. Check toggles done; trash deletes.

## Gotchas

- Uses `useAppStoreShallow` for `scheduledFor`/`deferredFor` — they build a new
  array each call, and a reference-compared selector causes a re-render loop.
  See `src/store/StoreProvider.tsx`.
