# SearchView

Route `/search`. Search across tasks, or jump to a screen.

Query lives in the store (`searchQuery`) so the sidebar's label links can
pre-fill it.

## Matching

Substring, case-insensitive, over title + reasoning + tags + priority. Results
are grouped by `plan_date` and labelled with the same relative day names as
Upcoming.

## Empty query

Shows "Recently viewed" (live counts, not a stored history) and "Jump to"
pills. With a query and no matches, a dashed empty card.

## Keyboard

`Escape` clears the query; pressing it again navigates home. The "esc" chip in
the field advertises this.

## Gotchas

- "Recently viewed" is synthesised from current state. A real history would
  need a store slice — worth doing if it earns its keep.
