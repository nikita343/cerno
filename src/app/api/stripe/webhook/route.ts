import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createAdminClient, hasAdminConfig } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — the only thing that grants paid access.
 *
 * ===========================================================================
 * This endpoint is a public URL that hands out entitlement. Read the three
 * rules before changing it.
 * ===========================================================================
 *
 * 1. THE SIGNATURE IS THE AUTHENTICATION.
 *    There is no session here. Without `constructEvent` anyone who finds this
 *    path can POST `{"type":"checkout.session.completed"}` and upgrade
 *    themselves. Verification is not a nicety; it is the entire access check.
 *
 * 2. VERIFY AGAINST THE RAW BODY.
 *    `await request.text()`, never `.json()`. The signature covers the exact
 *    bytes Stripe sent — parsing and re-serialising changes key order and
 *    whitespace and every signature fails. This is the classic silent failure:
 *    it looks like a misconfigured secret.
 *
 * 3. THE USER ID COMES FROM STRIPE, NEVER FROM THE REQUEST SHAPE.
 *    We read it from the signed event's `client_reference_id` / metadata. Any
 *    field an unsigned caller could influence is not usable as identity.
 *
 * Delivery is at-least-once and unordered — Stripe retries, and
 * `subscription.updated` can arrive before `checkout.session.completed`. Every
 * handler here is an idempotent upsert keyed on `user_id`, so a replay is a
 * no-op and an out-of-order pair converges on the same row.
 */

const HANDLED = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !hasAdminConfig()) {
    console.error("[stripe/webhook] not configured");
    return NextResponse.json({ error: "Not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Rule 2. Must be the untouched bytes.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    // A bad signature is either a misconfigured secret or someone probing.
    // Either way: log, reject, tell the caller nothing.
    console.error("[stripe/webhook] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    // 200, not 4xx. A non-2xx makes Stripe retry an event we will never want,
    // and repeated failures eventually disable the endpoint — taking the events
    // we *do* care about down with it.
    return NextResponse.json({ received: true });
  }

  try {
    const admin = createAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !subscriptionId) {
        console.error("[stripe/webhook] session missing user or subscription", {
          id: session.id,
        });
        return NextResponse.json({ received: true });
      }

      // Re-fetched rather than trusted from the session: the session carries an
      // id, and we want the subscription's actual status and period end.
      const subscription =
        await stripe().subscriptions.retrieve(subscriptionId);
      await write(admin, userId, subscription);
      return NextResponse.json({ received: true });
    }

    // The three customer.subscription.* events share a payload shape.
    const subscription = event.data.object as Stripe.Subscription;
    const userId = await resolveUserId(subscription);
    if (!userId) {
      console.error("[stripe/webhook] no user for subscription", {
        id: subscription.id,
      });
      return NextResponse.json({ received: true });
    }
    await write(admin, userId, subscription);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] handler failed", event.type, error);
    // 500 so Stripe retries. This is the one case where a retry is what we
    // want: the event was genuine and our write failed.
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}

/**
 * Our user id for a subscription.
 *
 * Metadata first (set at checkout), falling back to the customer record — a
 * subscription created by hand in the Stripe dashboard won't carry metadata,
 * and during testing that is exactly how subscriptions get made.
 */
async function resolveUserId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromSubscription = subscription.metadata?.supabase_user_id;
  if (fromSubscription) return fromSubscription;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return null;

  const customer = await stripe().customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.metadata?.supabase_user_id ?? null;
}

/**
 * Copies Stripe's state onto our row.
 *
 * `status` is stored verbatim. Deciding what each status *means* belongs in
 * `has_active_plan()` in SQL, so there is one definition of "paid" and it is
 * the one that actually gates workspace creation.
 */
async function write(
  admin: ReturnType<typeof createAdminClient>,
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
