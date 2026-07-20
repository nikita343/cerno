"use client";

import { ChevronDown } from "@/components/icons";
import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
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

      <NotificationBell />
    </header>
  );
}
