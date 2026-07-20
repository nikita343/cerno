# PageTransition

Fades and lifts each screen in on navigation.

## Why the key matters

```tsx
<div key={pathname} className={styles.page}>
```

Without `key`, React reuses the same DOM element across routes and the CSS
animation only ever plays once — on first mount. Keying on the pathname forces
a fresh element per route, which restarts the animation.

## Enter-only, by design

A true cross-fade needs both screens mounted simultaneously plus a transition
library to hold the outgoing one. App Router navigation is instant here, so
there is no gap to cover — the extra machinery would buy nothing.

Respects `prefers-reduced-motion`.
