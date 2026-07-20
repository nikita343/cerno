# Sidebar

Desktop navigation (≥960px). Hidden below that; `MobileTabBar` takes over.

## Contents, in order

1. **Profile chip** — avatar + name + email; toggles `SettingsMenuOverlay`
2. **"What's on your mind?"** — the accent button; opens capture
3. **Nav list** — Search / Today / Upcoming / Inbox / Filters & labels
4. **Labels** — the fixed 5-tag taxonomy, each linking to a filtered search

## Active state

Derived from `usePathname()`, not from store state, so it survives a hard
refresh and is correct during SSR. `/` matches exactly; everything else uses
`startsWith`.

Active styling: `--text` at weight 600 on `--surface` with a `--border`
hairline. Inactive: `--text-muted`, transparent, no border.

## Gotchas

- The Inbox badge counts `inboxTasks()` (everything not done) — it is not the
  same as "tasks on today".
- Nav order here differs from the tab bar: Search leads on desktop, trails on
  mobile. That's from the designs; see `NAV_ITEMS` vs `TAB_ORDER` in
  `src/lib/nav.ts`.
