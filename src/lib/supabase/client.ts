"use client";

import { createBrowserClient } from "@supabase/ssr";

import { assertSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Browser Supabase client.
 *
 * Cached module-level: `createBrowserClient` is safe to call repeatedly, but a
 * fresh instance per render would mean a fresh auth listener per render too.
 */
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  assertSupabaseConfig();
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
