"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  ChevronRight,
  CogIcon,
  LogOutIcon,
  ThemeIcon,
} from "@/components/icons";
import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import { signOut } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n";
import { SETTINGS_HREF } from "@/lib/nav";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SettingsMenuOverlay.module.css";

export function SettingsMenuOverlay() {
  const user = useUser();
  const t = useT();
  const menuOpen = useAppStore((s) => s.menuOpen);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape closes; the scrim handles pointer dismissal.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, setMenuOpen]);

  // Move focus into the popup so keyboard users land inside it.
  useEffect(() => {
    if (menuOpen) menuRef.current?.focus();
  }, [menuOpen]);

  if (!menuOpen) return null;

  return (
    <>
      <div
        className={styles.scrim}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        className={styles.menu}
        role="menu"
        tabIndex={-1}
        aria-label={t.menu.profileAndSettings}
      >
        <div className={styles.header}>
          <Avatar profile={user} size="2.375rem" />
          <span className={styles.headerText}>
            <span className={styles.name}>{user.name}</span>
            <span className={styles.email}>{user.email}</span>
          </span>
        </div>

        <div className={styles.divider} />

        <Link
          href={SETTINGS_HREF}
          className={styles.row}
          role="menuitem"
          // The menu is a fixed overlay; leaving it open across a navigation
          // would cover the page it just navigated to.
          onClick={() => setMenuOpen(false)}
        >
          <CogIcon size="1.1875rem" className={styles.rowIcon} />
          <span className={styles.rowLabel}>{t.menu.settings}</span>
          <ChevronRight size="0.9375rem" className={styles.rowChevron} />
        </Link>

        <div className={styles.themeRow}>
          <ThemeIcon size="1.1875rem" className={styles.rowIcon} />
          <span className={styles.rowLabel}>{t.menu.theme}</span>
          <div className={styles.segmented} role="group" aria-label={t.menu.theme}>
            <button
              type="button"
              className={styles.segment}
              data-active={theme === "dark" || undefined}
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              {t.menu.dark}
            </button>
            <button
              type="button"
              className={styles.segment}
              data-active={theme === "light" || undefined}
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
            >
              {t.menu.light}
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        {/* A form, not an onClick: sign-out is a server action that clears the
            auth cookies and redirects. Doing it client-side would leave the
            httpOnly cookies in place. */}
        <form action={signOut}>
          <button
            type="submit"
            className={styles.row}
            role="menuitem"
            style={{ width: "100%" }}
          >
            <LogOutIcon size="1.1875rem" className={styles.rowIcon} />
            <span className={styles.rowLabel}>{t.menu.logOut}</span>
          </button>
        </form>
      </div>
    </>
  );
}
