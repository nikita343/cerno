"use client";

import { useEffect } from "react";

import { todayInZone } from "./date";
import { minutesNowInZone } from "./reminders";

/**
 * Drives the app's notion of "now" and "today", both in the user's timezone.
 *
 * Mounted once, near the root. Everything overdue-related reads `nowMinutes`
 * from the store rather than calling `Date.now()` in render, for two reasons:
 *
 *   - A component that reads the clock while rendering produces different
 *     markup on the server and the client, which breaks hydration.
 *   - One shared value means every badge in the tree flips on the same frame,
 *     instead of each one changing whenever it happens to re-render.
 *
 * `today` is re-anchored here as well. The SSR value is computed in the same
 * zone, but a tab left open past midnight — or a timezone change in Settings —
 * has to roll the day over without a reload. Reading both the clock and the
 * date through the chosen IANA zone is what makes the setting visible: the day
 * boundary, and therefore what counts as "today" and "overdue", moves with it.
 *
 * Ticks are aligned to the wall-clock minute rather than a fixed interval from
 * mount, so a task due at 10:31 flips at 10:31.
 */
export function useNowTicker({
  timezone,
  setNowMinutes,
  setToday,
}: {
  timezone: string;
  setNowMinutes: (minutes: number) => void;
  setToday: (iso: string) => void;
}): void {
  useEffect(() => {
    const sync = () => {
      setNowMinutes(minutesNowInZone(timezone));
      setToday(todayInZone(timezone));
    };

    sync();

    let timeout: number;
    const scheduleNext = () => {
      const msPastMinute = Date.now() % 60_000;
      timeout = window.setTimeout(() => {
        sync();
        scheduleNext();
      }, 60_000 - msPastMinute);
    };
    scheduleNext();

    // A backgrounded tab throttles timers, so the clock can be minutes (and the
    // date a whole day) stale by the time the user looks again. Re-reading on
    // focus corrects it immediately.
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Re-runs when the timezone setting changes, rolling the day over live.
  }, [timezone, setNowMinutes, setToday]);
}
