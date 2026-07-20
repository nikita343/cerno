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
} from "@/components/icons";
import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DASHBOARD_ROOT, NAV_ITEMS, screenFromPath } from "@/lib/nav";
import type { ScreenKey } from "@/lib/types";
import { inboxTasks } from "@/store/createAppStore";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import styles from "./Sidebar.module.css";

const NAV_ICONS: Record<ScreenKey, typeof SearchIcon> = {
  search: SearchIcon,
  today: CalendarIcon,
  upcoming: ListIcon,
  inbox: MailIcon,
  filters: FilterIcon,
  settings: CogIcon,
};

export function Sidebar() {
  const user = useUser();
  const pathname = usePathname();
  const openCapture = useAppStore((s) => s.openCapture);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const inboxCount = useAppStore((s) => inboxTasks(s.tasks).length);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const labels = useAppStoreShallow((s) => s.labels);
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
              <span>{item.label}</span>
              {item.key === "inbox" && inboxCount > 0 && (
                <span className={styles.badge}>{inboxCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={styles.labels}>
        <span className={styles.labelsHeading}>Labels</span>
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
    </aside>
  );
}
