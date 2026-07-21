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

/**
 * Absolute URL for Stripe's return redirects.
 *
 * Order matters, and the middle entry is the point.
 *
 * `VERCEL_URL` is the *per-deployment* host — `cerno-6hu2bzfb4-….vercel.app`,
 * a different value for every build. Sending a customer back there after paying
 * lands them on a domain their session cookie was never set for, so the app
 * bounces them to /login as if the payment hadn't happened. It is only used
 * here as a last resort before localhost.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the stable production domain and is what
 * a deployment should fall back to. `NEXT_PUBLIC_SITE_URL` still wins over
 * both, because a custom domain is the only one of the three that knows about
 * `usecerno.xyz`.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  // Trailing slashes would produce `//dashboard/settings`, which some hosts
  // treat as a protocol-relative URL.
  return raw.replace(/\/+$/, "");
}
