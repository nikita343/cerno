# SmartAddBar

Quick add for a **single** task. Type one phrase, Cerno infers title, effort,
tag and deadline.

## Not the same as the brain dump

| | SmartAddBar | CaptureOverlay (dump) |
|---|---|---|
| Input | One phrase | A paragraph of everything |
| Effect | Appends one task to today | **Replans the whole day** |
| Endpoint | `POST /api/tasks/parse` | `POST /api/plan` |
| Capacity maths | None | Yes — schedules what fits, defers the rest |

Use the dump when the day should be rebuilt; use this when you just remembered
one thing and don't want your existing plan touched.

## Props

| Prop | Type | Default |
|---|---|---|
| `placeholder` | `string` | `"Add one thing — Cerno fills in the rest"` |

## Behaviour

- Clears the input immediately on submit — the field feels instant while the
  parse is still in flight; the task appears when it resolves.
- New tasks land at the **end** of today's list (`sort_order` = max + 1) rather
  than reshuffling a plan the user has already read.
- Falls back to the local heuristic parser when the route is unreachable, so it
  works offline and with no API key.

## Mounted in

`TodayView` (under the header) and `InboxView` (under the title).
