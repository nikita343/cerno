"use client";

import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./TimezoneNudge.module.css";

const DISMISS_KEY = "cerno:tz-nudge-dismissed";

/** "Europe/Kyiv" -> "Kyiv", "America/Los_Angeles" -> "Los Angeles". */
function cityOf(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/**
 * Offers to align the saved timezone with the device's, when they differ.
 *
 * The timezone setting drives the day boundary and calendar times, so a saved
 * zone that no longer matches where the user actually is quietly makes "today"
 * wrong. This catches that — someone who travelled, or never set it — with one
 * tap to fix it.
 *
 * Shown at most once per "don't show again": that choice persists in
 * localStorage rather than the database, because it's a per-device nag
 * preference, not account data. A plain dismiss only hides it for the session.
 */
export function TimezoneNudge() {
  const t = useT();
  const timezone = useAppStore((s) => s.settings.timezone);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true);

  // Client-only: `Intl` resolves the device zone, and localStorage isn't
  // readable during SSR. Starting dismissed means nothing flashes before the
  // check runs.
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDeviceZone(zone || null);
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDeviceZone(null);
    }
  }, []);

  const mismatch =
    deviceZone !== null && deviceZone !== timezone && !dismissed;
  if (!mismatch) return null;

  const dontShowAgain = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode can refuse writes; the session dismiss below still hides it.
    }
    setDismissed(true);
  };

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        {t.tzNudge.msgPrefix} <strong>{cityOf(deviceZone)}</strong>
        {t.tzNudge.msgMid} <strong>{cityOf(timezone)}</strong>.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void updateSettings({ timezone: deviceZone })}
        >
          {t.tzNudge.switchTo} {cityOf(deviceZone)}
        </button>
        <button type="button" className={styles.ghost} onClick={dontShowAgain}>
          {t.tzNudge.dontShow}
        </button>
      </div>
      <button
        type="button"
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label={t.tzNudge.dismiss}
      >
        <CloseIcon size="0.9375rem" />
      </button>
    </div>
  );
}
