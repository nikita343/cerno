"use client";

import { useEffect, useRef } from "react";

import {
  ChevronRight,
  CogIcon,
  LogOutIcon,
  ThemeIcon,
} from "@/components/icons";
import { APP_VERSION, DEMO_USER } from "@/lib/fixtures";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SettingsMenuOverlay.module.css";

export function SettingsMenuOverlay() {
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
          <span className={styles.avatar}>{DEMO_USER.initials}</span>
          <span className={styles.headerText}>
            <span className={styles.name}>{DEMO_USER.name}</span>
            <span className={styles.email}>{DEMO_USER.email}</span>
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

        <button type="button" className={styles.row} role="menuitem">
          <LogOutIcon size="1.1875rem" className={styles.rowIcon} />
          <span className={styles.rowLabel}>Log out</span>
        </button>

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
