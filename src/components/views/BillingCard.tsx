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
  const workspaces = useAppStore((s) => s.workspaces);

  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entitled = isEntitled(subscription);

  const go = async (kind: "checkout" | "portal") => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(`/api/stripe/${kind}`, { method: "POST" });
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

  return (
    <div className={styles.card}>
      <div className={styles.planHead}>
        <div className={styles.planText}>
          <span className={styles.planName}>
            {entitled ? t.billing.team : t.billing.free}
          </span>
          <span className={styles.fieldNote}>{describe(subscription, t)}</span>
        </div>
        <span className={styles.planBadge} data-paid={entitled || undefined}>
          {entitled ? t.billing.perMonth : t.billing.current}
        </span>
      </div>

      <ul className={styles.planPoints}>
        {entitled ? (
          <>
            <li>{t.billing.unlimitedWorkspaces} &mdash; {workspaces.length} {t.billing.soFar}</li>
            <li>{MAX_WORKSPACE_MEMBERS} {t.billing.upToPeople}</li>
            <li>{t.billing.sharedLists}</li>
          </>
        ) : (
          <>
            <li>{t.billing.freeForever}</li>
            <li>
              {t.billing.teamAddsPrefix} {MAX_WORKSPACE_MEMBERS}{" "}
              {t.billing.teamAddsWorkspaces}
            </li>
            {/* Said plainly and up front, because discovering it at the invite
                screen is how people end up annoyed. */}
            <li>{t.billing.inviterPays}</li>
          </>
        )}
      </ul>

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
