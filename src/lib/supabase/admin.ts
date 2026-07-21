import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./env";

/**
 * The service-role client. Bypasses Row-Level Security entirely.
 *
 * ---------------------------------------------------------------------------
 * This is the only master key in Cerno, and it exists for exactly one caller.
 * ---------------------------------------------------------------------------
 *
 * Everywhere else, `env.ts` is right: the anon key is public, RLS protects the
 * data, and the service-role key must not exist in anything the browser can
 * reach. That rule has one unavoidable exception.
 *
 * The Stripe webhook has no user session. It is Stripe's server talking to
 * ours about a customer who is not present, so there is no cookie to derive
 * `auth.uid()` from and no RLS policy that could authorise the write. And the
 * write *must* happen from the server: `public.subscriptions` deliberately has
 * no INSERT or UPDATE policy at all, because a table the browser can write is
 * a paid tier you can grant yourself with devtools open.
 *
 * So the trade is explicit — one key, one route, one table.
 *
 * `import "server-only"` is what enforces it. If any module reachable from a
 * `"use client"` component ever imports this file, the **build fails** rather
 * than shipping the key in a bundle. That is a guarantee, not a convention, and
 * it is the reason this is a separate module instead of a branch inside
 * `server.ts`.
 *
 * Rules for anything added here later:
 *   - Never accept a user id from a request body. Derive it from verified
 *     data — for the webhook, that is the signed Stripe event.
 *   - Never widen this beyond writes that genuinely cannot be expressed as an
 *     RLS policy. "It was easier" is not that.
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseClient(SUPABASE_URL, key, {
    auth: {
      // No session handling of any kind: this client is never a user. Leaving
      // persistence on in a server runtime can also leak one request's auth
      // state into the next.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** True when the webhook can actually write. Checked before Stripe is called. */
export function hasAdminConfig(): boolean {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
