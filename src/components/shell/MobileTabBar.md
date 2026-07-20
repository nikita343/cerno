# MobileTabBar

Bottom navigation below 960px. Absolutely positioned within the shell's `main`,
so it stays put while `content` scrolls underneath.

5 tabs in `TAB_ORDER`: Today / Upcoming / Inbox / Filters / Search — note
Search is **last** here and **first** in the sidebar, per the designs.

Active state comes from `usePathname()` (see `Sidebar.md` for why). Uses
`shortLabel` where it exists ("Filters" rather than "Filters & labels").

Padding includes `env(safe-area-inset-bottom)` for the iOS home indicator.
