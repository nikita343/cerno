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

/**
 * Settings is reached from the profile menu, not the primary nav.
 *
 * Deliberately kept out of `NAV_ITEMS`: the tab bar renders one tab per entry
 * and already carries five, which is the most that fits a small phone without
 * the labels truncating.
 */
export const SETTINGS_HREF = `${DASHBOARD_ROOT}/settings`;

/**
 * `workspaces` is in the tab bar but not the sidebar: the sidebar already lists
 * every workspace by name below Labels, so a generic entry there would be a
 * second, worse route to the same place.
 */
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
  {
    key: "workspaces",
    href: `${DASHBOARD_ROOT}/workspaces`,
    label: "Workspaces",
    shortLabel: "Teams",
  },
];

/**
 * The tab bar. Five is the ceiling before labels truncate on a small phone, so
 * adding Workspaces meant removing something.
 *
 * Search lost its slot and moved into the top bar beside the notification bell.
 * It is the one nav item with no state to show — you go there to type — so it
 * survives being an icon, which the other four don't: "Inbox" without its count
 * or "Today" without its label would be worse.
 */
export const TAB_ORDER: ScreenKey[] = [
  "today",
  "upcoming",
  "inbox",
  "workspaces",
  "filters",
];

export function screenFromPath(pathname: string): ScreenKey {
  // The dashboard root is a prefix of every other nav href, so it can only be
  // matched by equality — checked first, before the startsWith scan.
  const trimmed = pathname.replace(/\/$/, "");
  if (trimmed === DASHBOARD_ROOT || trimmed === "") return "today";
  // Not in NAV_ITEMS, so it needs its own check or it would fall through to
  // the "today" default and light up the wrong tab.
  if (trimmed.startsWith(SETTINGS_HREF)) return "settings";
  // Every workspace URL nests under this, including /workspaces/new and
  // /workspaces/<id>/settings, so the tab stays lit throughout.
  if (trimmed.startsWith(`${DASHBOARD_ROOT}/workspaces`)) return "workspaces";
  const match = NAV_ITEMS.find(
    (item) => item.href !== DASHBOARD_ROOT && trimmed.startsWith(item.href),
  );
  return match?.key ?? "today";
}
