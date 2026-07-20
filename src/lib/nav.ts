import type { ScreenKey } from "./types";

export interface NavItem {
  key: ScreenKey;
  href: string;
  /** Sidebar wording; the tab bar uses `shortLabel` where they differ. */
  label: string;
  shortLabel?: string;
}

/** The authenticated app is mounted under here; everything above it is public. */
export const DASHBOARD_ROOT = "/dashboard";

/** Sidebar order puts Search first, the tab bar puts it last (per the designs). */
export const NAV_ITEMS: NavItem[] = [
  { key: "search", href: `${DASHBOARD_ROOT}/search`, label: "Search" },
  { key: "today", href: DASHBOARD_ROOT, label: "Today" },
  { key: "upcoming", href: `${DASHBOARD_ROOT}/upcoming`, label: "Upcoming" },
  { key: "inbox", href: `${DASHBOARD_ROOT}/inbox`, label: "Inbox" },
  {
    key: "filters",
    href: `${DASHBOARD_ROOT}/filters`,
    label: "Filters & labels",
    shortLabel: "Filters",
  },
];

export const TAB_ORDER: ScreenKey[] = [
  "today",
  "upcoming",
  "inbox",
  "filters",
  "search",
];

export function screenFromPath(pathname: string): ScreenKey {
  // The dashboard root is a prefix of every other nav href, so it can only be
  // matched by equality — checked first, before the startsWith scan.
  const trimmed = pathname.replace(/\/$/, "");
  if (trimmed === DASHBOARD_ROOT || trimmed === "") return "today";
  const match = NAV_ITEMS.find(
    (item) => item.href !== DASHBOARD_ROOT && trimmed.startsWith(item.href),
  );
  return match?.key ?? "today";
}
