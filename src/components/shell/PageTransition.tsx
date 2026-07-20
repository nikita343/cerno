"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./PageTransition.module.css";

/**
 * Fades each screen in on navigation.
 *
 * Keying the wrapper on the pathname makes React tear down the old subtree and
 * mount a fresh one, which restarts the CSS animation — without a key the
 * element persists across routes and the animation only ever plays once.
 *
 * The animation is enter-only. A cross-fade would need both screens mounted at
 * once (and a transition library to hold the outgoing one), which is more
 * machinery than this earns — and App Router navigation is instant here, so
 * there is no gap to cover.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={styles.page}>
      {children}
    </div>
  );
}
