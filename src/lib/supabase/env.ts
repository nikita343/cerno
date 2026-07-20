/**
 * Supabase environment access.
 *
 * Both values are public by design — the anon key is safe in the browser
 * because Row-Level Security, not key secrecy, is what protects the data. That
 * is exactly why the RLS policies in `supabase/migrations/0001_init.sql` are
 * not optional: without them the anon key would be an open door.
 *
 * Never add the service-role key here. It bypasses RLS entirely and must not
 * exist in anything reachable from a `"use client"` module.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True when both values are present.
 *
 * The app has to build and boot without them — Vercel builds run before the
 * env vars are set, and a missing key should surface as a clear message rather
 * than a stack trace from deep inside the SDK.
 */
export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function assertSupabaseConfig(): void {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}
