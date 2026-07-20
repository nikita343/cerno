"use client";

import { useEffect, useRef } from "react";

import {
  ChevronRight,
  CogIcon,
  LogOutIcon,
  ThemeIcon,
} from "@/components/icons";
import { useUser } from "@/components/auth/UserProvider";
import { signOut } from "@/lib/auth/actions";
import { APP_VERSION } from "@/lib/fixtures";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SettingsMenuOverlay.module.css";

export function SettingsMenuOverlay() {
  const user = useUser();
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
        aria-label="Profile and settings"
      >
        <div className={styles.header}>
          <span className={styles.avatar}>{user.initials}</span>
          <span className={styles.headerText}>
            <span className={styles.name}>{user.name}</span>
            <span className={styles.email}>{user.email}</span>
          </span>
        </div>

        <div className={styles.divider} />

        <button type="button" className={styles.row} role="menuitem">
          <CogIcon size="1.1875rem" className={styles.rowIcon} />
          <span className={styles.rowLabel}>Settings</span>
          <ChevronRight size="0.9375rem" className={styles.rowChevron} />
        </button>

        <div className={styles.themeRow}>
          <ThemeIcon size="1.1875rem" className={styles.rowIcon} />
          <span className={styles.rowLabel}>Theme</span>
          <div className={styles.segmented} role="group" aria-label="Theme">
            <button
              type="button"
              className={styles.segment}
              data-active={theme === "dark" || undefined}
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              Dark
            </button>
            <button
              type="button"
              className={styles.segment}
              data-active={theme === "light" || undefined}
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
            >
              Light
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
            <span className={styles.rowLabel}>Log out</span>
          </button>
        </form>

        <div className={styles.footer}>
          <span>Cerno v{APP_VERSION}</span>
          <span className={styles.footerDot} />
          <a href="#changelog" className={styles.footerLink}>
            Changelog
          </a>
        </div>
      </div>
    </>
  );
}
