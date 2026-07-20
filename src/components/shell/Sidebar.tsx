"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  ChevronDown,
  EditIcon,
  FilterIcon,
  ListIcon,
  MailIcon,
  SearchIcon,
} from "@/components/icons";
import { DEMO_USER } from "@/lib/fixtures";
import { LABEL_COLORS } from "@/lib/labels";
import { NAV_ITEMS } from "@/lib/nav";
import { TAGS, type ScreenKey } from "@/lib/types";
import { inboxTasks } from "@/store/createAppStore";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./Sidebar.module.css";

const NAV_ICONS: Record<ScreenKey, typeof SearchIcon> = {
  search: SearchIcon,
  today: CalendarIcon,
  upcoming: ListIcon,
  inbox: MailIcon,
  filters: FilterIcon,
};

export function Sidebar() {
  const pathname = usePathname();
  const openCapture = useAppStore((s) => s.openCapture);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const inboxCount = useAppStore((s) => inboxTasks(s.tasks).length);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);

  return (
    <aside className={styles.sidebar}>
      <button
        type="button"
        className={styles.profile}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className={styles.avatar}>{DEMO_USER.initials}</span>
        <span className={styles.profileText}>
          <span className={styles.profileName}>{DEMO_USER.name}</span>
          <span className={styles.profileEmail}>{DEMO_USER.email}</span>
        </span>
        <ChevronDown size="1rem" className={styles.profileChevron} />
      </button>

      <button type="button" className={styles.dumpButton} onClick={openCapture}>
        <EditIcon size="1.125rem" />
        What&rsquo;s on your mind?
      </button>

      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
        {TAGS.map((tag) => (
          <Link
            key={tag}
            href={`/search?tag=${tag}`}
            className={styles.labelRow}
            onClick={() => setSearchQuery(tag)}
          >
            <span
              className={styles.labelDot}
              style={{ background: LABEL_COLORS[tag] }}
            />
            <span>{tag}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
