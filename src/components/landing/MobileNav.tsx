"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "@/app/landing.module.css";

/**
 * Mobile-only nav. On narrow viewports the desktop links are hidden (see the
 * ≤820px media query); this exposes them behind an animated hamburger that
 * morphs into an X on open. Kept client-side purely for the open/close toggle.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the sheet is open, and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.mobileNav}>
      <button
        type="button"
        className={styles.navToggle}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.navToggleBar} />
        <span className={styles.navToggleBar} />
        <span className={styles.navToggleBar} />
      </button>

      <button
        type="button"
        className={styles.mobileScrim}
        data-open={open || undefined}
        aria-hidden={!open}
        tabIndex={-1}
        onClick={close}
      />

      <div className={styles.mobileSheet} data-open={open || undefined}>
        <nav className={styles.mobileSheetNav}>
          <a href="#how" onClick={close}>
            how it works
          </a>
          <a href="#features" onClick={close}>
            features
          </a>
          <a href="#plans" onClick={close}>
            plans
          </a>
          <a href="#faq" onClick={close}>
            faq
          </a>
          <Link href="/login" className={styles.mobileSheetSignIn} onClick={close}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.mobileSheetCta} onClick={close}>
            Get started
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default MobileNav;
