# AppShell

The single responsive layout. There are **no device frames** — the `.dc.html`
phone/desktop shells in the design bundle are presentation chrome for the
mockups, not app UI.

## Structure

```
shell (flex, 100dvh)
├── Sidebar              desktop only  (≥960px)
├── main
│   ├── MobileTopBar     mobile only   (<960px)
│   ├── content          scroll area → PageTransition → route children
│   ├── Fab              mobile only
│   └── MobileTabBar     mobile only
├── CaptureOverlay       fixed, z-50
└── SettingsMenuOverlay  fixed, z-40/41
```

## The 960px breakpoint

Sidebar and mobile chrome are **both always in the DOM**, swapped by CSS media
queries. This is deliberate: a JS-measured breakpoint would render differently
on server and client and produce a hydration mismatch.

Do not replace the CSS toggle with a `useMediaQuery` hook.

## Gotchas

- `content` carries bottom padding below 960px to clear the tab bar plus
  `env(safe-area-inset-bottom)`.
- The FAB is hidden while capture is open (here) and while the settings menu is
  open (inside `Fab` itself) — two different conditions, two different places.
