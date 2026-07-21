"use client";

import Link from "next/link";

import { ChevronDown, SearchIcon } from "@/components/icons";
import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DASHBOARD_ROOT } from "@/lib/nav";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./MobileTopBar.module.css";

export function MobileTopBar() {
  const user = useUser();
  const menuOpen = useAppStore((s) => s.menuOpen);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);

  // The designs show only the given name up here; the full name lives in the
  // settings popup.
  const firstName = user.name.split(" ")[0];

  return (
    <header className={styles.bar}>
      <button
        type="button"
        className={styles.profile}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <Avatar profile={user} size="1.75rem" />
        <span className={styles.name}>{firstName}</span>
        <ChevronDown size="0.9375rem" className={styles.chevron} />
      </button>

      {/* Search moved up here when Workspaces took its tab. It is the one nav
          destination with no state to display — you go there to type — so it
          survives being an icon in a way "Inbox 6" would not. */}
      <Link
        href={`${DASHBOARD_ROOT}/search`}
        className={styles.iconLink}
        aria-label="Search"
      >
        <SearchIcon size="1.25rem" />
      </Link>

      <NotificationBell />
    </header>
  );
}
