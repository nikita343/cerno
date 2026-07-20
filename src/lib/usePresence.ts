"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a component mounted long enough to play an exit animation.
 *
 * Overlays in this app render on a boolean from the store, so closing one
 * unmounts it on the same frame — the entrance animates and the exit is a hard
 * cut. That asymmetry is what makes a panel feel abrupt no matter how long its
 * open animation is.
 *
 * `present` stays true for `exitMs` after `open` flips false; `leaving` is true
 * for that window, so the markup can switch to its exit keyframes.
 *
 * `exitMs` must match the CSS exit duration. Too short truncates the animation,
 * too long leaves an invisible element capturing nothing but still mounted.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return { present, leaving: present && !open };
}
