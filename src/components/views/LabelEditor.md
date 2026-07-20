# LabelEditor

Create, rename, recolour, and delete labels. Rendered inside `FiltersView`.

## Why tasks store label *names*

`tasks.tags` is a `text[]` of label names, not foreign keys into `labels`. Two
reasons, both in `0002_labels_and_settings.sql`:

- The planner speaks in names. Claude returns `"work"`, not a uuid, and mapping
  names to ids on every response adds a lookup that can fail mid-plan.
- Every pre-existing row keeps working. A `uuid[]` column needs a backfill and a
  rewrite of the AI layer for integrity we can get another way.

The cost is that renames and deletes must cascade into `tasks.tags` by hand.

## Rename and delete go through RPC

`rename_label` and `delete_label` are Postgres functions, **not** plain updates.
The label change and the task rewrite have to be one transaction — a failure
between them leaves tasks tagged with a name that no longer exists.

They run `SECURITY INVOKER`, so RLS applies. This is load-bearing: the `select`
inside each function is RLS-filtered, so another user's label is simply *not
found*, and ownership is enforced without the function checking it itself.
Verified against a real Postgres — Alice renaming Bob's label raises
`label not found`, and her cascade leaves Bob's identically-named tag alone.

**A bare `UPDATE labels SET name = …` will silently orphan every tagged task.**
Use the store actions.

## Optimistic writes

`renameLabel` and `removeLabel` update *both* `labels` and `tasks` optimistically
and restore both on failure — that's why the store has `writeLabels` alongside
`writeThrough` rather than one generalised helper.

`addLabel` is the odd one: the optimistic row carries a client-generated id that
the database replaces, so the real row is swapped in on success. Without that, a
rename immediately after a create would target an id the server has never seen.

## Validation

`validateLabelName` mirrors the database constraints — 1–24 characters,
case-insensitive unique per user — so the user gets an inline message instead of
a failed round trip. **The database still enforces both.** This is the courtesy,
not the guarantee.

## Deletion

Asks first, and says how many tasks lose the tag. It is one transaction and
there is no undo.

## Gotchas

- The colour swatch is a native `<input type="color">` at zero opacity over a
  painted dot — the OS picker beats anything worth building, and it's one tap on
  mobile.
- Row actions are hidden until hover on pointer devices only; on touch they are
  always visible, since there is no hover to reveal them.
- A task can carry a tag whose label was deleted elsewhere. `labelColor()` falls
  back to grey and the counts skip unknown keys rather than inventing a pill.
