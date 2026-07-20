# SwipeRow

Swipe-left-to-reveal Done/Delete actions. Touch only.

Wraps a task row (in practice a `TaskChip`) and exposes the same two actions
the desktop row shows on hover. Touch devices have no hover, so without this
the only way to complete or delete on a phone would be permanently-visible
buttons stealing width from the title.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | — | Task title, used only to phrase the `aria-label`s |
| `completed` | `boolean` | `false` | Flips the first action between "Done" and "Undo" |
| `onComplete` | `() => void` | — | Fired by the first action. The caller decides whether that means complete or uncomplete |
| `onDelete` | `() => void` | — | Fired by the second action |
| `children` | `ReactNode` | — | The row content that slides |

## Behaviour

- **Axis lock.** A gesture is undecided until it travels 6px, then commits to
  horizontal or vertical for its whole lifetime. Without this, a mostly-vertical
  scroll with a few pixels of horizontal drift drags the row sideways and fights
  the scroll container. `touch-action: pan-y` tells the browser the same thing.
- **Direction.** Dragging left opens; the tray is right-anchored and the row slides left off the top of it. `offset` is always a positive "how far open" value and the direction lives only in the sign of the transform, which keeps the clamping arithmetic readable.
- **Snap.** On release the row opens if it passed 45% of the tray width,
  otherwise it springs shut (`--ease-spring`). While a finger is down the row
  tracks it 1:1 with no transition — the transition is applied only when not
  dragging, or the row would lag behind the thumb.
- **Elastic overshoot.** Dragging past fully-open keeps moving at 25% rate.
  Dragging back past closed is a hard stop at 0, so a right-swipe on an already
  closed row does nothing rather than opening a mirrored tray.
- **Tray width is measured**, not assumed — `offsetWidth` of the tray element,
  since the buttons are sized in rem against a fluid root font size.
- **Actions close the row before firing**, so a delete doesn't animate out of a
  row that is still translated.

## Accessibility

Tray buttons are `tabIndex={-1}` while closed, so keyboard users tab straight
past them to the row's real hover actions rather than through a duplicate pair
of controls they can't see. The tray is `aria-hidden` when closed.

## Gotchas

- **Nothing here fires on a mouse.** Pointer devices don't dispatch touch
  events, and the tray is `display: none` under
  `(hover: hover) and (pointer: fine)` with `transform: none !important` on the
  content. Desktop behaviour is unchanged by mounting this.
- **Only one row's state is local to it.** Swiping a second row open does not
  close the first — there is no shared controller. Acceptable because opening a
  row is cheap to undo, but if that changes it needs lifting into a parent.
- The exit animation on delete lives in the *parent* (`TodayView`), not here.
  This component doesn't know a row is being removed.
