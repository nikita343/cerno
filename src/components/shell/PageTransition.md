# PageTransition

Fades each screen in on navigation. Opacity only, `--dur-fast`.

## Why the key matters

```tsx
<div key={pathname} className={styles.page}>
```

Without `key`, React reuses the same DOM element across routes and the CSS
animation only ever plays once — on first mount. Keying on the pathname forces
a fresh element per route, which restarts the animation.

## Why it is so short, and has no transform

It used to run for `--dur-slow` (0.34s) and pair the fade with a 0.5rem rise.
Both were wrong for a screen you navigate to constantly:

- The rise means content is still moving when you start reading it.
- Any duration long enough to *notice* reads as the app being slow to load,
  not as a transition. Navigation here is genuinely instant, so the animation
  was inventing latency that wasn't there and then showing it to the user.

Dropping the transform mattered for a second, unrelated reason. **A transformed
element becomes the containing block for its `position: fixed` descendants**,
and traps them in its stacking context. That is one element wrapping every
screen in the app, so every fixed-position child of every view was resolving
against it rather than the viewport. It is what sent the date picker off the
bottom of the screen, and what put the edit dialog's Save button below the fold.

Those two were fixed by portalling to `<body>`, and the portals stay — this
component should not be the only thing standing between the app and that class
of bug. But nothing new has to work around it now.

## Enter-only, by design

A true cross-fade needs both screens mounted simultaneously plus a transition
library to hold the outgoing one. There is no gap to cover, so the extra
machinery would buy nothing.

Respects `prefers-reduced-motion`.

## Related

Perceived navigation speed is mostly *not* this component — it's
`app/dashboard/loading.tsx`, which lets the router paint a skeleton
immediately instead of waiting on the next segment. See `ViewSkeleton.md`.
