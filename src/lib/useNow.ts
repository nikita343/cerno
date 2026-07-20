"use client";

import { useEffect } from "react";

import { minutesNow } from "./reminders";

/**
 * Drives the app's notion of "now".
 *
 * Mounted once, near the root. Everything overdue-related reads `nowMinutes`
 * from the store rather than calling `Date.now()` in render, for two reasons:
 *
 *   - A component that reads the clock while rendering produces different
 *     markup on the server and the client, which breaks hydration.
 *   - One shared value means every badge in the tree flips on the same frame,
 *     instead of each one changing whenever it happens to re-render.
 *
 * The first tick happens on mount, which is also what moves `nowMinutes` off
 * its server value of 0 — so no overdue state is ever server-rendered.
 */

/**
 * Ticks are aligned to the wall clock minute rather than fired on a fixed
 * interval from mount. A task due at 10:31 should flip at 10:31, not up to a
 * minute later because the tab happened to open at 10:30:45.
 */
export function useNowTicker(setNowMinutes: (minutes: number) => void): void {
  useEffect(() => {
    setNowMinutes(minutesNow());

    let timeout: number;

    const scheduleNext = () => {
      const msPastMinute = Date.now() % 60_000;
      timeout = window.setTimeout(() => {
        setNowMinutes(minutesNow());
        scheduleNext();
      }, 60_000 - msPastMinute);
    };

    scheduleNext();

    // A backgrounded tab throttles timers, so the clock can be minutes stale by
    // the time the user looks again. Re-reading on focus corrects it
    // immediately rather than waiting for the next tick to fire.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNowMinutes(minutesNow());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [setNowMinutes]);
}
