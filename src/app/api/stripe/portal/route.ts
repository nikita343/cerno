import { NextResponse } from "next/server";

import { hasStripeConfig, siteUrl, stripe } from "@/lib/stripe";
import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal — cancel, change card, download invoices.
 *
 * All of that is Stripe's hosted portal rather than screens here. Building them
 * ourselves would mean handling card details (PCI scope), dunning, proration
 * and tax — for a redirect's worth of value.
 *
 * The customer id comes from *our* row for the *verified* caller, never from
 * the request. Accepting a customer id from the body would let anyone open
 * anyone else's billing portal.
 */
export async function POST() {
  if (!hasStripeConfig()) {
    return NextResponse.json(
      { error: "Billing isn't configured." },
      { status: 501 },
    );
  }

  const caller = await resolveRequestUser();
  if (!caller) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  // RLS restricts this to the caller's own row, so there is no `.eq("user_id")`
  // that could be forgotten — but it is stated anyway, because a read that
  // depends on a policy elsewhere for correctness is one refactor from wrong.
  const { data } = await caller.supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", caller.userId)
    .maybeSingle();

  if (!data?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet." },
      { status: 404 },
    );
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[/api/stripe/portal]", error);
    return NextResponse.json(
      { error: "Couldn't open billing. Try again." },
      { status: 502 },
    );
  }
}
