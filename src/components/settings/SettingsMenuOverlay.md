# SettingsMenuOverlay

The profile popup. Opened by the profile chip in `Sidebar` (desktop) or
`MobileTopBar` (mobile).

## Positioning

- **Desktop** — anchored `top: 4rem; left: 1rem`, 18.375rem wide
- **<960px** — inset from both edges, `top: 4.375rem`

## Contents

Profile header → divider → Settings row → Theme toggle → divider → Log out →
footer (version + changelog).

## Theme toggle

Both Dark and Light are live. Selecting one calls `setTheme`, which:

1. sets `data-theme` on `<html>` (this is what the CSS actually reads)
2. writes `localStorage["cerno-theme"]`
3. mirrors the value into the store for render

**Light is the default.** See `src/lib/theme.ts` and the token block in
`globals.css`.

## Dismissal

Scrim click or `Escape`. Focus moves into the popup on open.

## Gotchas

- Settings and Log out are presentational — auth lands in phase 2.
- Don't move theme into the persisted Zustand blob; the no-flash script in
  `layout.tsx` needs a single synchronous `localStorage` read.
