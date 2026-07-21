import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./env";

/**
 * The service-role client. Bypasses Row-Level Security entirely.
 *
 * ---------------------------------------------------------------------------
 * This is the only master key in Cerno, and it exists for the sessionless
 * callers — the ones with no cookie to derive `auth.uid()` from.
 * ---------------------------------------------------------------------------
 *
 * Everywhere else, `env.ts` is right: the anon key is public, RLS protects the
 * data, and the service-role key must not exist in anything the browser can
 * reach. That rule has a small, closed set of exceptions, all of the same kind.
 *
 *   - The **Stripe webhook**. Stripe's server talking to ours about a customer
 *     who isn't present. `public.subscriptions` deliberately has no INSERT or
 *     UPDATE policy — a table the browser can write is a paid tier you grant
 *     yourself with devtools open — so the write can only be the service role.
 *   - The **Telegram bot webhook and reminder cron**. Telegram's server, or a
 *     scheduler, acting for a user who isn't in a browser. The chat is
 *     authenticated by the webhook secret, and the user id is looked up from a
 *     link the user themselves established — never taken from the message.
 *
 * `import "server-only"` is what enforces it. If any module reachable from a
 * `"use client"` component ever imports this file, the **build fails** rather
 * than shipping the key in a bundle. That is a guarantee, not a convention, and
 * it is the reason this is a separate module instead of a branch inside
 * `server.ts`.
 *
 * Rules for anything added here later:
 *   - Never accept a user id from a request body. Derive it from verified
 *     data — the signed Stripe event, or a Telegram chat that proved which
 *     account it owns via a one-time code.
 *   - Every query must scope itself by `user_id`. The admin client bypasses
 *     RLS, so a query that leans on a policy would read across tenants.
 *   - Never widen this beyond callers that genuinely have no session. "It was
 *     easier" is not that.
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
