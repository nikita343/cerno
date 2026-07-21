# TaskRow

One task on a timeline: the time above, the card, and the ways into it. Used by
both Today and Upcoming.

## Why it exists

Today and Upcoming had grown near-identical copies of this row — same grid, same
time label, same swipe/menu wiring, same CSS down to the byte (~60 lines of TSX
and ~75 lines of CSS each). That is not a hypothetical cost: the copies had
already drifted.

Today hid its `⋯` on touch when the swipe gesture replaced it. Upcoming's copy
kept it, so a phone showed a permanent button beside every upcoming row that was
meant to have been gone — eating title width, and leaving a 42px column gap that
surfaced as a strip of bare page behind the swipe actions. Nobody noticed,
because the fix had been applied to the file it was reported against.

Anything true of a task row lives here now, so it can only be true in one place.

## Props

| Prop | Type | Notes |
|---|---|---|
| `task` | `Task` | — |
| `today` | `string` | Today's ISO date, for phrasing deadlines relatively |
| `clock` | `string \| null` | `HH:MM` above the card, or `null` to omit it |
| `fixed` | `boolean` | The time came from the task, not from laying it on the clock |
| `overdue` | `boolean` | — |
| `onToggle` | `() => void` | — |
| `onDelete` | `(id: string) => void` | Takes the id, to match `TaskMenu` |
| `menuOpen` / `onMenuOpenChange` | — | The menu state is always controlled |
| `removing` | `boolean` | Mid exit animation |
| `index` | `number \| undefined` | Opts into the staggered entrance |

`clock === null` is how a view says "this repeats the row above". The caller owns
that comparison because only it knows what the previous row was.

`index` is opt-in rather than defaulted because Upcoming renders a whole week at
once, where a per-row entrance would be a wave of forty rows rather than a
rhythm. Today passes it; Upcoming doesn't.

`onDelete` differs meaningfully per view and that's why it's a prop rather than a
store call: Today defers the delete so the row can animate out, Upcoming deletes
straight away.

## Three ways into the menu

The `⋯` on a pointer device, the swipe tray's **More**, and a tap on the card.
All three live here. Which of them is *available* is a media query's business,
not a view's — see the `(hover: none)` block in `TaskRow.module.css`.

That block collapses the grid track as well as hiding the button. An empty `auto`
column still contributes its column gap, and that gap shows as a strip of page
between the swipe actions and the edge of the screen. See `SwipeRow.md`.

## Gotchas

- **The row can move under an open menu.** Setting a start time re-sorts the
  timeline; if the task crosses a part-of-day boundary it lands in a different
  block, which unmounts this row and the menu with it. `TaskMenu` closes its
  date panel on a time pick specifically so that is deterministic rather than
  depending on which time you picked. The real fix is a per-view menu singleton
  that outlives its row.
- **It renders an `<li>`.** Both views wrap their rows in a list — Today's
  `.timeline` (`<ol>`) and Upcoming's `.blockRows` (`<ul>`). A new caller has to
  do the same.
