"use client";

import { useState } from "react";

import { useT } from "@/lib/i18n";
import { isEntitled, MAX_WORKSPACE_MEMBERS, type Subscription } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SettingsView.module.css";

/**
 * Plan state, and the two buttons that change it.
 *
 * Neither button decides anything. "Upgrade" asks the server for a Checkout
 * URL and navigates; "Manage billing" does the same for the customer portal.
 * Entitlement is written only by the Stripe webhook, so nothing here — and
 * nothing a user does to this component in devtools — can grant a plan.
 *
 * What the status *means* is decided by `has_active_plan()` in SQL. This
 * mirrors it via `isEntitled` purely to choose what to show; if the two ever
 * disagreed, the database would win and the user would see a button that
 * doesn't work rather than access they hadn't paid for.
 */
export function BillingCard() {
  const t = useT();
  const subscription = useAppStore((s) => s.subscription);

  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Yearly preselected — the cheaper per-month deal and the Stripe default.
  const [interval, setInterval] = useState<"month" | "year">("year");

  const entitled = isEntitled(subscription);

  const go = async (kind: "checkout" | "portal") => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(`/api/stripe/${kind}`, {
        method: "POST",
        // Only checkout needs a body; the portal ignores it. The chosen billing
        // interval rides along so the server picks the matching Stripe price.
        headers:
          kind === "checkout" ? { "content-type": "application/json" } : undefined,
        body: kind === "checkout" ? JSON.stringify({ interval }) : undefined,
      });
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
        detail?: string;
      } | null;

      if (!response.ok || !body?.url) {
        // `detail` is only ever populated outside production — see devDetail.
        setError(
          [body?.error ?? t.billing.genericError, body?.detail]
            .filter(Boolean)
            .join(" — "),
        );
        return;
      }
      // A full navigation, not a fetch redirect: Stripe's page has to replace
      // ours. Following the 302 inside fetch would land the HTML in a variable
      // and leave the user looking at an unchanged screen.
      window.location.href = body.url;
    } catch {
      setError(t.billing.networkError);
    } finally {
      setBusy(null);
    }
  };

  const freeFeatures = [
    t.billing.freeFeat1,
    t.billing.freeFeat2,
    t.billing.freeFeat3,
    t.billing.freeFeat4,
  ];
  const teamFeatures = [
    t.billing.teamFeat1,
    t.billing.teamFeat2,
    t.billing.teamFeat3,
  ];

  return (
    <div>
      {/* Two plans side by side so the difference reads at a glance rather than
          as a paragraph. The one you're on is marked "Current plan"; the other
          carries the action. */}
      <div className={styles.planGrid}>
        {/* -------------------------------------------------- Free */}
        <div className={styles.planCol} data-current={!entitled || undefined}>
          <div className={styles.planColHead}>
            <span className={styles.planColName}>{t.billing.free}</span>
            {!entitled && (
              <span className={styles.planColTag}>{t.billing.currentPlan}</span>
            )}
          </div>
          <div className={styles.planPrice}>
            <span className={styles.planPriceAmount}>{t.billing.freePrice}</span>
            <span className={styles.planPricePeriod}>{t.billing.period}</span>
          </div>
          <ul className={styles.planFeatures}>
            {freeFeatures.map((feat) => (
              <li key={feat}>{feat}</li>
            ))}
          </ul>
        </div>

        {/* -------------------------------------------------- Team */}
        <div
          className={styles.planCol}
          data-featured
          data-current={entitled || undefined}
        >
          <div className={styles.planColHead}>
            <span className={styles.planColName}>{t.billing.team}</span>
            {entitled ? (
              <span className={styles.planColTag}>{t.billing.currentPlan}</span>
            ) : (
              <span className={styles.planColTag} data-accent>
                {MAX_WORKSPACE_MEMBERS} {t.workspace.seatsWord}
              </span>
            )}
          </div>
          {/* Only shown pre-upgrade: once entitled, the interval is whatever
              Stripe holds and is changed in the portal, not picked here. */}
          {!entitled && (
            <div
              className={styles.intervalToggle}
              role="group"
              aria-label={t.billing.billingPeriod}
            >
              <button
                type="button"
                data-selected={interval === "month" || undefined}
                onClick={() => setInterval("month")}
              >
                {t.billing.monthly}
              </button>
              <button
                type="button"
                data-selected={interval === "year" || undefined}
                onClick={() => setInterval("year")}
              >
                {t.billing.yearly}
                <span className={styles.intervalSave}>{t.billing.yearlySave}</span>
              </button>
            </div>
          )}
          <div className={styles.planPrice}>
            <span className={styles.planPriceAmount}>
              {interval === "month"
                ? t.billing.teamPriceMonthly
                : t.billing.teamPriceYearly}
            </span>
            <span className={styles.planPricePeriod}>
              {interval === "month"
                ? t.billing.periodMonth
                : t.billing.periodYear}
            </span>
          </div>
          <p className={styles.planPlus}>{t.billing.everythingInFree}</p>
          <ul className={styles.planFeatures} data-accent>
            {teamFeatures.map((feat) => (
              <li key={feat}>{feat}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* One line on the current subscription's real state, straight from
          Stripe — renewal date, a failed payment, a pending cancellation. */}
      <p className={styles.planStatus}>{describe(subscription, t)}</p>

      {error && (
        <p className={styles.planError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.planActions}>
        {entitled ? (
          <button
            type="button"
            className={styles.planSecondary}
            onClick={() => void go("portal")}
            disabled={busy !== null}
          >
            {busy === "portal" ? t.billing.opening : t.billing.manageBilling}
          </button>
        ) : (
          <button
            type="button"
            className={styles.planPrimary}
            onClick={() => void go("checkout")}
            disabled={busy !== null}
          >
            {busy === "checkout" ? t.billing.opening : t.billing.upgrade}
          </button>
        )}

        {/* Beyond the seat cap is a conversation, not a checkout — there is no
            self-serve path, so this is a mailto rather than a button that
            pretends otherwise. */}
        <a
          className={styles.planLink}
          href={`mailto:hello@usecerno.xyz?subject=${encodeURIComponent(
            "Cerno Enterprise",
          )}`}
        >
          {t.billing.needMore} {MAX_WORKSPACE_MEMBERS}? {t.billing.talkToUs}
        </a>
      </div>
    </div>
  );
}

/** One line of plain English for each Stripe status. */
function describe(subscription: Subscription, t: Dictionary): string {
  const renews = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  switch (subscription.status) {
    case "active":
    case "trialing":
      if (subscription.cancel_at_period_end && renews) {
        return `${t.billing.cancelsOn} ${renews}. ${t.billing.keepUntilThen}`;
      }
      return renews ? `${t.billing.renewsOn} ${renews}` : t.billing.active;
    case "past_due":
      return t.billing.pastDue;
    case "unpaid":
      return t.billing.unpaid;
    case "canceled":
      return t.billing.canceled;
    case "incomplete":
    case "incomplete_expired":
      return t.billing.incomplete;
    default:
      return t.billing.personalFree;
  }
}
