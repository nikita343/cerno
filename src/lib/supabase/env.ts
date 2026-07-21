/**
 * Supabase environment access.
 *
 * Both values are public by design — the anon key is safe in the browser
 * because Row-Level Security, not key secrecy, is what protects the data. That
 * is exactly why the RLS policies in `supabase/migrations/0001_init.sql` are
 * not optional: without them the anon key would be an open door.
 *
 * Never add the service-role key *here*. It bypasses RLS entirely, and this
 * module is imported by client components — a value in this file is a value in
 * the browser bundle.
 *
 * There is exactly one place the service-role key legitimately exists:
 * `./admin.ts`, used only by the Stripe webhook, which has no user session to
 * derive `auth.uid()` from. That module is fenced with `import "server-only"`
 * so importing it from client code fails the build. See its header for the
 * full reasoning before adding a second caller.
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
