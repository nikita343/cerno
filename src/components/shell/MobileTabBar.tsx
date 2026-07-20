"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  FilterIcon,
  ListIcon,
  MailIcon,
  SearchIcon,
} from "@/components/icons";
import { NAV_ITEMS, TAB_ORDER } from "@/lib/nav";
import type { ScreenKey } from "@/lib/types";

import styles from "./MobileTabBar.module.css";

const NAV_ICONS: Record<ScreenKey, typeof SearchIcon> = {
  search: SearchIcon,
  today: CalendarIcon,
  upcoming: ListIcon,
  inbox: MailIcon,
  filters: FilterIcon,
};

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Primary">
      {TAB_ORDER.map((key) => {
        const item = NAV_ITEMS.find((n) => n.key === key);
        if (!item) return null;
        const Icon = NAV_ICONS[key];
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

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
