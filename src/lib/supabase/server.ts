import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { assertSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Server Supabase client, scoped to the current request's cookies.
 *
 * Must be created per request — never hoisted to a module-level singleton, or
 * one user's session would leak into another user's request.
 */
export async function createClient() {
  assertSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. That's fine: middleware
          // refreshes the session on every request, so the write here is
          // redundant rather than load-bearing.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null.
 *
 * Always `getUser()`, never `getSession()`, on the server. `getSession()` reads
 * the cookie without verifying it, so its contents are attacker-controlled;
 * `getUser()` revalidates the token with Supabase. Authorization decisions must
 * only ever be made on the latter.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
