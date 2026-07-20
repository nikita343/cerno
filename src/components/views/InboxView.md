# InboxView

Route `/inbox`. Every parsed task with Cerno's reasoning visible — this is
where you check the AI's thinking.

Tasks come from `inboxTasks()` (everything not done), sorted by priority then
`sort_order`.

## Per row

`TaskChip` with `showReasoning` **always on** — that's the point of this screen
— plus two actions:

| Button | Effect |
|---|---|
| Check | `completeTask` |
| Plus | `moveToToday`; disabled and accent-tinted when already on today |

## Layout

Below 479px the action column moves from a tall stack beside the chip to a row
underneath it, because wrapped chips get tall.

## Gotchas

- The "6 parsed from your last dump" line counts tasks matching
  `dumps[0].id` — it falls back to a plain total when there's no dump.
- Same shallow-selector requirement as `TodayView`.
