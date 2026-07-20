"use client";

import { BellIcon, ChevronDown } from "@/components/icons";
import { DEMO_USER } from "@/lib/fixtures";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./MobileTopBar.module.css";

export function MobileTopBar() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);

  // The designs show only the given name up here; the full name lives in the
  // settings popup.
  const firstName = DEMO_USER.name.split(" ")[0];

  return (
    <header className={styles.bar}>
      <button
        type="button"
        className={styles.profile}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className={styles.avatar}>{DEMO_USER.initials}</span>
        <span className={styles.name}>{firstName}</span>
        <ChevronDown size="0.9375rem" className={styles.chevron} />
      </button>

      <button type="button" className={styles.bell} aria-label="Notifications">
        <BellIcon size="1.1875rem" />
      </button>
    </header>
  );
}
