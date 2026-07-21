"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { isEntitled } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import { UpgradeCelebration } from "./UpgradeCelebration";
import styles from "./SettingsView.module.css";

/**
 * Reconciles the plan after Stripe sends the customer back.
 *
 * The gap this closes: paying and being *recorded* as having paid are two
 * different requests. Stripe redirects the browser immediately, and separately
 * calls our webhook. The redirect nearly always wins, so the page rendered at
 * `?checkout=success` was showing plan state loaded *before* the payment
 * existed — which is why a real upgrade still read "Free".
 *
 * Reloading wouldn't reliably fix it either; it would just re-run the same race
 * a bit later. So this polls: the subscription is re-read on a short backoff
 * until it turns up, and the UI says what it is doing rather than sitting on a
 * stale answer.
 */

/** Roughly 20s total. Webhook delivery is normally under two seconds. */
const ATTEMPT_DELAYS_MS = [0, 1000, 2000, 3000, 4000, 5000, 5000];

type Phase = "idle" | "waiting" | "confirmed" | "timedOut";

/**
 * Remembers that this upgrade was already celebrated.
 *
 * sessionStorage, not state: the confirmation can arrive on a page that then
 * navigates, and nobody wants the confetti again every time they open Settings.
 * Keyed per tab, so it clears itself.
 */
const CELEBRATED_KEY = "cerno.upgrade.celebrated";

export function CheckoutReturn() {
  const params = useSearchParams();
  const outcome = params.get("checkout");

  const subscription = useAppStore((s) => s.subscription);
  const refreshSubscription = useAppStore((s) => s.refreshSubscription);

  const [phase, setPhase] = useState<Phase>("idle");
  const [celebrating, setCelebrating] = useState(false);
  const started = useRef(false);

  const celebrate = () => {
    try {
      if (sessionStorage.getItem(CELEBRATED_KEY)) return;
      sessionStorage.setItem(CELEBRATED_KEY, "1");
    } catch {
      // Private browsing can throw on sessionStorage. Showing the celebration
      // twice is a far smaller problem than not showing it at all.
    }
    setCelebrating(true);
  };

  useEffect(() => {
    if (outcome !== "success" || started.current) return;
    started.current = true;

    // Already recorded — the webhook beat the redirect, which does happen.
    if (isEntitled(subscription)) {
      setPhase("confirmed");
      celebrate();
      cleanUrl();
      return;
    }

    let cancelled = false;
    setPhase("waiting");

    void (async () => {
      for (const delay of ATTEMPT_DELAYS_MS) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        if (await refreshSubscription()) {
          if (cancelled) return;
          setPhase("confirmed");
          celebrate();
          cleanUrl();
          return;
        }
      }
      if (!cancelled) setPhase("timedOut");
    })();

    return () => {
      cancelled = true;
    };
  }, [outcome, subscription, refreshSubscription]);

  if (outcome === "cancelled") {
    return <Toast>Checkout cancelled — nothing was charged.</Toast>;
  }

  if (phase === "waiting") {
    return (
      <Toast live="status">Payment received. Waiting for Stripe to confirm…</Toast>
    );
  }

  if (phase === "confirmed") {
    // The modal carries the message; a toast underneath would say it twice.
    return celebrating ? (
      <UpgradeCelebration onClose={() => setCelebrating(false)} />
    ) : null;
  }

  if (phase === "timedOut") {
    return (
      <Toast tone="warn" live="alert">
        Your payment went through, but we haven&rsquo;t had confirmation from
        Stripe yet. This usually settles within a minute — reload to check. If
        it persists, the billing webhook may not be reaching this site.
      </Toast>
    );
  }

  return null;
}

/**
 * A fixed, portalled notice.
 *
 * Portalled because this component now mounts in the app shell rather than
 * inside a card, so it has no layout context to sit in — and because an
 * ancestor `transform` anywhere would otherwise capture its `position: fixed`.
 */
function Toast({
  children,
  tone,
  live,
}: {
  children: React.ReactNode;
  tone?: "warn";
  live?: "status" | "alert";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className={styles.toast} data-warn={tone === "warn" || undefined} role={live}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * Drops `?checkout=` once handled.
 *
 * `replaceState` rather than a router navigation: this is cosmetic tidying of
 * the address bar, and a re-render would restart the effect above. It also
 * stops a bookmark or a refresh from replaying the "thanks for paying" state
 * indefinitely.
 */
function cleanUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("checkout")) return;
  url.searchParams.delete("checkout");
  window.history.replaceState({}, "", url.toString());
}
