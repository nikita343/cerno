"use client";

import type { ReactNode } from "react";

import { Suspense } from "react";

import { CaptureOverlay } from "@/components/capture/CaptureOverlay";
import { CheckoutReturn } from "@/components/views/CheckoutReturn";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { LanguageOnboarding } from "@/components/onboarding/LanguageOnboarding";
import { SettingsMenuOverlay } from "@/components/settings/SettingsMenuOverlay";
import { useNowTicker } from "@/lib/useNow";
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
  const setNowMinutes = useAppStore((s) => s.setNowMinutes);

  // Mounted once here rather than per view, so navigating between Today and
  // Upcoming doesn't restart the clock.
  useNowTicker(setNowMinutes);

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
      {/* Rendered here, not beside each bell: the sidebar and the mobile top
          bar are both always in the DOM, so a panel next to each trigger would
          exist twice. */}
      <NotificationCenter />

      {/* First-run language choice. Renders nothing once `onboarded` is true,
          which is the common case, so it costs a boolean check per mount. */}
      <LanguageOnboarding />

      {/* Mounted here, not in the billing card.
          It used to live inside BillingCard, which only renders on one Settings
          section — so a customer returning to any other page (including the
          Settings index, which is where Stripe was sending them) got no
          reconciliation at all and sat looking at the old plan. Nothing about
          "did the payment land" should depend on which screen you happen to be
          on. */}
      <Suspense fallback={null}>
        <CheckoutReturn />
      </Suspense>
    </div>
  );
}
