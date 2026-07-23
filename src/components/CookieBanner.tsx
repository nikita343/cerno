"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./CookieBanner.module.css";

const STORAGE_KEY = "cerno-cookie-notice";

/**
 * Informational cookie notice. Cerno sets only strictly-necessary cookies (the
 * Supabase auth session), so this is a notice, not a consent gate — there are
 * no non-essential cookies to opt out of. Dismissal is remembered in
 * localStorage. Rendered only after mount so the server markup (which can't
 * read localStorage) and the client agree.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "dismissed") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      /* private mode — just hide for this session */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Cookie notice">
      <p className={styles.text}>
        Cerno uses only essential cookies to keep you signed in and run the
        app — no tracking, no advertising. See our{" "}
        <Link href="/privacy" className={styles.link}>
          Privacy Policy
        </Link>
        .
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.accept} onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}

export default CookieBanner;
