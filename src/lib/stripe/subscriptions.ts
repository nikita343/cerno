import "server-only";

import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Copies Stripe's state onto our `subscriptions` row.
 *
 * The one writer of subscription state, shared by the webhook (event-driven) and
 * the reconcile route (pull-driven) so "what we store" has a single definition.
 * `status` is stored verbatim; deciding what each status *means* belongs in
 * `has_active_plan()` in SQL, so there is one definition of "paid".
 */
export async function writeSubscriptionRow(
  admin: Admin,
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  // The period end lives on the subscription item in current Stripe API
  // versions, not on the subscription itself.
  const periodEnd = subscription.items.data[0]?.current_period_end;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

/**
 * The subscription that best represents the account right now.
 *
 * A customer can have several over time (an old cancelled one, a new active
 * one). Prefer whichever is currently live; otherwise the most recently created,
 * so a fully-lapsed customer still reconciles to their real last state rather
 * than an arbitrary row.
 */
function mostRelevant(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subscriptions.length === 0) return null;
  const live = subscriptions.find((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  );
  if (live) return live;
  return [...subscriptions].sort((a, b) => b.created - a.created)[0];
}

/**
 * Pulls the caller's current subscription straight from Stripe and rewrites the
 * row — so a missed, delayed, or out-of-order webhook can't leave the billing UI
 * stale. This is the safety net under the webhook, not a replacement: the
 * webhook is still what reacts in real time.
 *
 * Idempotent: writes exactly what Stripe currently reports. When the customer
 * has no subscription at all (never upgraded, or fully deleted server-side) the
 * row is marked inactive so it reflects reality rather than a leftover `active`.
 */
export async function reconcileSubscription(userId: string): Promise<void> {
  const admin = createAdminClient();

  // The customer id we recorded at checkout. No row / no customer means the user
  // has never started a subscription, so there is nothing to reconcile.
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const customerId = data?.stripe_customer_id as string | undefined;
  if (!customerId) return;

  let list: Stripe.ApiList<Stripe.Subscription>;
  try {
    list = await stripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
  } catch (error) {
    // A customer id from the *other* Stripe mode (a test-mode row lingering in
    // this shared database, hit with a live key) resolves to "no such customer".
    // We genuinely can't know that account's state, so leave the row untouched
    // rather than wrongly downgrade it — reconciliation only ever writes truth.
    if (
      error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "resource_missing"
    ) {
      return;
    }
    throw error;
  }

  const subscription = mostRelevant(list.data);
  if (!subscription) {
    await admin
      .from("subscriptions")
      .update({
        status: "inactive",
        cancel_at_period_end: false,
        current_period_end: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return;
  }

  await writeSubscriptionRow(admin, userId, subscription);
}
