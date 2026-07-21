"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  CogIcon,
  FilterIcon,
  ListIcon,
  MailIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/icons";
import { NAV_ITEMS, screenFromPath, TAB_ORDER } from "@/lib/nav";
import type { ScreenKey } from "@/lib/types";

import styles from "./MobileTabBar.module.css";

const NAV_ICONS: Record<ScreenKey, typeof SearchIcon> = {
  search: SearchIcon,
  today: CalendarIcon,
  upcoming: ListIcon,
  inbox: MailIcon,
  filters: FilterIcon,
  // Settings isn't in TAB_ORDER so this never renders here, but the map is
  // keyed by ScreenKey and an incomplete map is a type error waiting to happen
  // the next time a screen is added.
  workspaces: UsersIcon,
  settings: CogIcon,
};

export function MobileTabBar() {
  const pathname = usePathname();
  // Resolved once, rather than each tab testing the path itself: every nav href
  // starts with /dashboard, so a per-tab `startsWith` lights up Today on every
  // page. screenFromPath already handles the root and the non-tab routes.
  const current = screenFromPath(pathname);

  return (
    <nav className={styles.bar} aria-label="Primary">
      {TAB_ORDER.map((key) => {
        const item = NAV_ITEMS.find((n) => n.key === key);
        if (!item) return null;
        const Icon = NAV_ICONS[key];
        const active = current === key;

        return (
          <Link
            key={key}
            href={item.href}
            className={styles.tab}
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon size="1.375rem" />
            <span>{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
