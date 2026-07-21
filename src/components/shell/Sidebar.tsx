"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  ChevronDown,
  CogIcon,
  EditIcon,
  FilterIcon,
  ListIcon,
  MailIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/icons";
import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DASHBOARD_ROOT, NAV_ITEMS, screenFromPath } from "@/lib/nav";
import { isEntitled, type ScreenKey } from "@/lib/types";
import { inboxTasks } from "@/store/createAppStore";
import { useT } from "@/lib/i18n";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import styles from "./Sidebar.module.css";

const NAV_ICONS: Record<ScreenKey, typeof SearchIcon> = {
  search: SearchIcon,
  today: CalendarIcon,
  upcoming: ListIcon,
  inbox: MailIcon,
  filters: FilterIcon,
  workspaces: UsersIcon,
  settings: CogIcon,
};

/** First letter, for the workspace glyph. Falls back rather than rendering "". */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "#";
}

export function Sidebar() {
  const user = useUser();
  const pathname = usePathname();
  const openCapture = useAppStore((s) => s.openCapture);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const inboxCount = useAppStore((s) => inboxTasks(s.tasks).length);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const t = useT();
  const labels = useAppStoreShallow((s) => s.labels);
  const workspaces = useAppStoreShallow((s) => s.workspaces);
  // Only decides what to *offer*. Creating one is gated by the database.
  const entitled = useAppStore((s) => isEntitled(s.subscription));
  // See MobileTabBar: a per-item `startsWith` would mark Today active on every
  // page, because every nav href is prefixed with the dashboard root.
  const current = screenFromPath(pathname);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.profileRow}>
        <button
          type="button"
          className={styles.profile}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar profile={user} size="2.125rem" />
          <span className={styles.profileText}>
            <span className={styles.profileName}>{user.name}</span>
            <span className={styles.profileEmail}>{user.email}</span>
          </span>
          <ChevronDown size="1rem" className={styles.profileChevron} />
        </button>

        <NotificationBell />
      </div>

      <button type="button" className={styles.dumpButton} onClick={openCapture}>
        <EditIcon size="1.125rem" />
        What&rsquo;s on your mind?
      </button>

      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const active = current === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={styles.navItem}
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size="1.1875rem" />
              <span>{navLabel(t, item.key)}</span>
              {item.key === "inbox" && inboxCount > 0 && (
                <span className={styles.badge}>{inboxCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={styles.labels}>
        <span className={styles.labelsHeading}>{t.nav.labels}</span>
        {labels.map((label) => (
          <Link
            key={label.id}
            href={`${DASHBOARD_ROOT}/search?tag=${encodeURIComponent(label.name)}`}
            className={styles.labelRow}
            onClick={() => setSearchQuery(label.name)}
          >
            <span
              className={styles.labelDot}
              style={{ background: label.color }}
            />
            <span className={styles.labelName}>{label.name}</span>
          </Link>
        ))}
        {labels.length === 0 && (
          <Link href={`${DASHBOARD_ROOT}/filters`} className={styles.labelEmpty}>
            Add a label
          </Link>
        )}
      </div>

      {/* Workspaces sit below labels: personal navigation first, shared spaces
          under it. Someone on the free plan sees the section only as a single
          upsell row — an empty "Workspaces" heading on a plan that cannot have
          any is just a reminder of what you haven't bought. */}
      <div className={styles.labels}>
        {entitled || workspaces.length > 0 ? (
          <>
            <span className={styles.labelsHeading}>{t.nav.workspaces}</span>
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`${DASHBOARD_ROOT}/workspaces/${workspace.id}`}
                className={styles.labelRow}
                data-active={pathname.includes(workspace.id) || undefined}
              >
                <span className={styles.workspaceGlyph} aria-hidden="true">
                  {initial(workspace.name)}
                </span>
                <span className={styles.labelName}>{workspace.name}</span>
                <span className={styles.workspaceSeats}>
                  {workspace.member_count}
                </span>
              </Link>
            ))}
            {entitled && (
              <Link
                href={`${DASHBOARD_ROOT}/workspaces/new`}
                className={styles.labelEmpty}
              >
                New workspace
              </Link>
            )}
          </>
        ) : (
          <Link
            href={`${DASHBOARD_ROOT}/settings`}
            className={styles.upsellRow}
          >
            <span className={styles.labelName}>{t.nav.workspaces}</span>
            <span className={styles.upsellBadge}>Team</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

/**
 * Translated nav label.
 *
 * Keyed off `ScreenKey` rather than the English string, so a wording change in
 * `NAV_ITEMS` can't silently break the lookup.
 */
function navLabel(t: ReturnType<typeof useT>, key: ScreenKey, short = false): string {
  switch (key) {
    case "today": return t.nav.today;
    case "upcoming": return t.nav.upcoming;
    case "inbox": return t.nav.inbox;
    case "filters": return short ? t.nav.filtersShort : t.nav.filters;
    case "search": return t.nav.search;
    case "workspaces": return short ? t.nav.workspacesShort : t.nav.workspaces;
    case "settings": return t.nav.settings;
  }
}
