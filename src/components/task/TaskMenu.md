# TaskMenu

The per-task `⋯` menu: Edit, Date, Priority, Delete. Three panels, two
presentations.

## Two presentations, one set of panels

| | Phone | Everything else |
|---|---|---|
| Chrome | `vaul` bottom sheet, drag to dismiss | Centred modal, portalled to `<body>` |
| Chosen by | `PHONE_QUERY` | fallback |

The panel markup is built once into `panels` and handed to whichever shell is
active, so a change to an action cannot land on one form factor and not the
other.

`PHONE_QUERY` is `(max-width: 599px) and (hover: none)` — **both halves matter**.
`hover: none` alone catches a touchscreen laptop, where a bottom sheet on a 27"
display looks broken; the width alone catches a narrow desktop window, where
drag-to-dismiss has no gesture behind it. A narrow desktop window still gets
`.pop`, which has its own sheet-like styling under `max-width: 599px`.

## Why vaul rather than hand-rolling the drag

The gesture is not the hard part. The surrounding behaviour is: velocity-based
dismiss, scrolling inside the sheet not fighting the drag, focus trapping,
restoring focus on close, an inert background. That is a lot of subtle work to
get wrong, and it is what the library already does.

Cost: ~26kB on the two routes that mount it (Today and Upcoming).

### Configuration worth knowing

- **`noBodyStyles`.** The app shell is `100dvh; overflow: hidden` and scrolls in
  an inner element, so the body never scrolls — vaul's body lock has nothing to
  fix, and its iOS `position: fixed` variant would fight the shell's layout. The
  overlay already swallows background touches.
- **`Drawer.Title`** is required by the underlying Radix dialog. It is visually
  redundant next to the task's own row, so it is `srOnly`.
- **`aria-describedby={undefined}`** on `Drawer.Content` — otherwise Radix warns
  about a missing description that this menu has no use for.
- **`DatePicker flat={isPhone}`.** The picker brings its own glass card, which
  inside the sheet's glass reads as a panel floating on a panel — two borders,
  two blurs. `flat` drops its chrome so the sheet is the surface.

## Controlled vs uncontrolled

Omit `open`/`onOpenChange` and the menu manages itself. Today and Upcoming both
control it, because the menu can be opened three ways there: the `⋯` button, the
swipe tray's **More**, and a tap on the card. Those last two live outside this
component, so the open state has to.

`hideTrigger` hides the `⋯` for callers that open it some other way.

## Gotchas

- **The `⋯` button is hidden on touch** by the *views*, not here — see the
  `(hover: none)` blocks in `TodayView.module.css` and `UpcomingView.module.css`.
  Those blocks also collapse the grid track, which the swipe tray depends on;
  see `SwipeRow.md`.
- **Escape and focus are handled only for the modal.** The sheet does its own,
  via Radix. Running both would double-handle the key.
- **Delete lives in here** rather than as an inline icon, so it can't be hit
  while reaching for the check and so it can carry a confirmation. The inline ✓
  stays on the card — completing is the most common action on a row and
  shouldn't cost two taps.
