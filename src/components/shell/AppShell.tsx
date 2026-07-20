"use client";

import type { ReactNode } from "react";

import { CaptureOverlay } from "@/components/capture/CaptureOverlay";
import { SettingsMenuOverlay } from "@/components/settings/SettingsMenuOverlay";
import { useAppStore } from "@/store/StoreProvider";

import { Fab } from "./Fab";
import { MobileTabBar } from "./MobileTabBar";
import { MobileTopBar } from "./MobileTopBar";
import { PageTransition } from "./PageTransition";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

/**
 * One responsive layout, no device frames.
 *
 * The sidebar and the mobile chrome are both always in the DOM and swapped by
 * CSS at the 960px breakpoint, so there is no JS-measured breakpoint and
 * nothing to mismatch during hydration.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const captureOpen = useAppStore((s) => s.captureOpen);

  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.main}>
        <MobileTopBar />
        <main className={styles.content} id="main">
          <PageTransition>{children}</PageTransition>
        </main>
        {!captureOpen && <Fab />}
        <MobileTabBar />
      </div>

      <CaptureOverlay />
      <SettingsMenuOverlay />
    </div>
  );
}
