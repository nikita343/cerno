import { NextResponse } from "next/server";

import { devDetail } from "@/lib/apiError";
import {
  hasStripeConfig,
  siteUrl,
  stripe,
  teamPriceId,
  type BillingInterval,
} from "@/lib/stripe";
import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout — start a Team subscription.
 *
 * Returns a URL for the browser to visit. Deliberately not a redirect: a fetch
 * that 302s to Stripe is followed by the fetch, not by the page, and the user
 * ends up nowhere.
 *
 * Nothing here grants access. It creates a Checkout Session and stops; the
 * webhook is what writes `subscriptions`. If this route wrote entitlement, a
 * user could get a plan by starting a checkout and closing the tab.
 */
export async function POST(request: Request) {
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

  // Yearly is the default: it's the Stripe "Default" price and the better deal,
  // so a body-less request (older clients sent none) still resolves to a valid
  // price rather than 400ing. Anything but a literal "month" means yearly.
  const body = (await request.json().catch(() => null)) as {
    interval?: string;
  } | null;
  const interval: BillingInterval = body?.interval === "month" ? "month" : "year";

  const price = teamPriceId(interval);
  if (!price) {
    return NextResponse.json(
      { error: "That billing period isn't available." },
      { status: 400 },
    );
  }

  try {
    const { data: userData } = await caller.supabase.auth.getUser();
    const email = userData.user?.email ?? undefined;

    // Reuse the Stripe customer if this user already has one. Without this,
    // every visit to the upgrade button creates another customer record and
    // the same person accumulates duplicates with separate billing histories.
    const { data: existing } = await caller.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", caller.userId)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email,
        // The link back to our user. Stripe's own dashboard shows it, which
        // makes a support question answerable without a database query.
        metadata: { supabase_user_id: caller.userId },
      });
      customerId = customer.id;
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      // How the webhook maps the payment back to an account. Matching on email
      // instead is tempting and wrong: a customer can change their Stripe email
      // and two accounts can share one.
      client_reference_id: caller.userId,
      subscription_data: { metadata: { supabase_user_id: caller.userId } },
      // The *plan* section, not the Settings index. Settings is split into
      // routed sections, and its index renders Profile — so a return to
      // `/dashboard/settings` lands on a page that shows nothing about billing.
      success_url: `${siteUrl()}/dashboard/settings/plan?checkout=success`,
      cancel_url: `${siteUrl()}/dashboard/settings/plan?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error("Checkout session has no URL");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Stripe's messages can name the account, the price, or the mode. Logged
    // for us, never echoed.
    console.error("[/api/stripe/checkout]", error);
    return NextResponse.json(
      { error: "Couldn't start checkout. Try again.", ...devDetail(error) },
      { status: 502 },
    );
  }
}
