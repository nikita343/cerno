# FiltersView

Route `/dashboard/filters`. Quick views plus the user's labels.

## Sections

- **My filters** — Priority / Deadline / By smart tag. Each is a toggle; the
  count on the right is live.
- **Labels** — the user's labels as pills with live counts.
- **Edit labels** — `LabelEditor` (see `LabelEditor.md`).
- **Results** — appears only when a filter or label is active.

Filters and labels are mutually exclusive; selecting one clears the other.

## Counts

All computed from open (non-done) tasks:

| Filter | Count |
|---|---|
| Priority | tasks with `priority === "high"` |
| Deadline | tasks with a `deadline` |
| By smart tag | number of **distinct** tags in use |

## Gotchas

- **Labels are user-defined.** The taxonomy used to be a fixed 5; it is now a
  per-user table. The model still cannot invent a tag — the constraint just
  moved from a build-time constant to a per-request enum built from the caller's
  own labels (`buildTagSchema` in `src/lib/ai/schema.ts`).
- Label colours come from the `labels` rows, so `labelColor()` needs the label
  list passed in. It is no longer a lookup in a module constant.
- The "By smart tag" count is distinct tags **in use**, which can exceed the
  number of labels if a task still carries a deleted one.
