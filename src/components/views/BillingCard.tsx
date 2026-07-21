"use client";

import { useState } from "react";

import { isEntitled, MAX_WORKSPACE_MEMBERS, type Subscription } from "@/lib/types";
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
          [body?.error ?? "Something went wrong. Try again.", body?.detail]
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
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.planHead}>
        <div className={styles.planText}>
          <span className={styles.planName}>
            {entitled ? "Team" : "Free"}
          </span>
          <span className={styles.fieldNote}>{describe(subscription)}</span>
        </div>
        <span className={styles.planBadge} data-paid={entitled || undefined}>
          {entitled ? "$12 / month" : "Current"}
        </span>
      </div>

      <ul className={styles.planPoints}>
        {entitled ? (
          <>
            <li>Unlimited workspaces &mdash; {workspaces.length} so far</li>
            <li>Up to {MAX_WORKSPACE_MEMBERS} people per workspace</li>
            <li>Shared task lists with assignees</li>
          </>
        ) : (
          <>
            <li>Everything personal, free forever</li>
            <li>
              Team adds shared workspaces for up to {MAX_WORKSPACE_MEMBERS}{" "}
              people
            </li>
            {/* Said plainly and up front, because discovering it at the invite
                screen is how people end up annoyed. */}
            <li>You pay; the people you invite don&rsquo;t</li>
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
            {busy === "portal" ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <button
            type="button"
            className={styles.planPrimary}
            onClick={() => void go("checkout")}
            disabled={busy !== null}
          >
            {busy === "checkout" ? "Opening…" : "Upgrade to Team"}
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
          Need more than {MAX_WORKSPACE_MEMBERS}? Talk to us
        </a>
      </div>
    </div>
  );
}

/** One line of plain English for each Stripe status. */
function describe(subscription: Subscription): string {
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
        // The distinction that matters most to someone who just cancelled:
        // they have not lost anything yet.
        return `Cancels on ${renews}. You keep everything until then.`;
      }
      return renews ? `Renews on ${renews}` : "Active";
    case "past_due":
      return "Payment failed. We'll retry — update your card to be safe.";
    case "unpaid":
      return "Payment failed too many times. Update your card to restore Team.";
    case "canceled":
      return "Cancelled. Your workspaces are still here, read and write.";
    case "incomplete":
    case "incomplete_expired":
      return "That checkout didn't finish.";
    default:
      return "Personal planning, free forever";
  }
}
