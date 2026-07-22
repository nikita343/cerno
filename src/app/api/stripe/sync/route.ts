import { NextResponse } from "next/server";

import { hasStripeConfig } from "@/lib/stripe";
import { reconcileSubscription } from "@/lib/stripe/subscriptions";
import { hasAdminConfig } from "@/lib/supabase/admin";
import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/sync — reconcile the caller's plan against Stripe.
 *
 * The safety net under the webhook. The webhook reacts to events in real time,
 * but delivery is best-effort: an endpoint subscribed to the wrong events, a
 * deploy mid-delivery, or a plain outage can leave our row behind Stripe — and
 * the user then sees "Renews" on a plan they cancelled. This pulls the truth
 * straight from Stripe on demand and rewrites the row, so the billing screen can
 * self-correct rather than wait for a webhook that may never come.
 *
 * Grants nothing on its own: it copies Stripe's current state verbatim, the same
 * as the webhook. It cannot be used to fake a plan, because the only thing it
 * trusts is Stripe's answer for the caller's own customer id.
 */
export async function POST() {
  if (!hasStripeConfig() || !hasAdminConfig()) {
    // Billing not wired up here — nothing to reconcile, and not an error the
    // client should surface. The stored row (free) already reflects reality.
    return NextResponse.json({ ok: false, reason: "not-configured" });
  }

  const caller = await resolveRequestUser();
  if (!caller) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  try {
    await reconcileSubscription(caller.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/stripe/sync]", error);
    return NextResponse.json({ error: "Sync failed." }, { status: 502 });
  }
}
