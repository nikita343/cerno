"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to a media query.
 *
 * Always returns `false` on the server and for the first client render, then
 * settles to the real answer in an effect. That is deliberate: the server has
 * no viewport, so any other initial value would be a guess, and a guess that
 * differs from what the browser reports is a hydration mismatch.
 *
 * The cost is one extra render on mount, so this is for choosing *behaviour*
 * (which component to mount, which gesture to bind). Choosing *appearance*
 * belongs in a CSS media query, which has no such flash.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * True on phones: no hover, and narrow enough that a sheet beats a modal.
 *
 * Both halves matter. `hover: none` alone would catch a touchscreen laptop,
 * where a bottom sheet on a 27" display looks broken; the width alone would
 * catch a narrow desktop window, where drag-to-dismiss has no gesture to
 * respond to. This is the same 600px line the stylesheets switch sheets on.
 */
export const PHONE_QUERY = "(max-width: 599px) and (hover: none)";
