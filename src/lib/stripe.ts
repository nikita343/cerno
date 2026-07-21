import "server-only";

import Stripe from "stripe";

/**
 * Stripe, server-side only.
 *
 * Nothing Stripe-related runs in the browser: Checkout and the customer portal
 * are both hosted redirects, so there is no publishable key and no client SDK
 * to load. That is why this file is `server-only` and why `.env.example` has no
 * `NEXT_PUBLIC_STRIPE_*` entry — there is nothing the client needs.
 */

/** Lazy: the app must build and boot without billing configured. */
let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  // Reused across requests: the SDK holds a connection pool, and constructing
  // one per request is measurable latency on a route the user is waiting on.
  client ??= new Stripe(key);
  return client;
}

export function hasStripeConfig(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_TEAM);
}

/**
 * Stripe statuses that mean "currently entitled".
 *
 * Must agree with `public.has_active_plan()` in 0005_workspaces.sql. Two
 * definitions of "paid" that disagree is a support ticket where the UI says one
 * thing and the database enforces another — the SQL wins, because it is what
 * actually gates `create_workspace`.
 *
 * `past_due` is deliberately included: a failed card retry should not lock a
 * team out of their work mid-day. The database additionally requires the period
 * not to have ended.
 */
export const ENTITLED_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

/** Absolute URL for Stripe's return redirects. */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
