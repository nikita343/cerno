import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_LABELS } from "@/lib/types";

import { hasSupabaseConfig } from "./env";
import { createClient } from "./server";

/**
 * The signed-in caller for one API request.
 *
 * Both planning routes need the same three things — a client, the verified
 * user, and that user's label names — and they need them *before* the model
 * call, because the labels go into the prompt and the output schema. Resolving
 * them once and passing the result down avoids re-verifying the session a
 * second time just to persist the result.
 */
export interface RequestUser {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Resolves the caller, or null when there is no session or no backend.
 *
 * `getUser()` rather than `getSession()`: only the former verifies the cookie
 * against the auth server, and this value decides which rows get written.
 */
export async function resolveRequestUser(): Promise<RequestUser | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

/**
 * The caller's label names, for the prompt and the output schema.
 *
 * Falls back to the default taxonomy for an anonymous or keyless request, and
 * on a failed read. A planning request is not worth failing because the label
 * list was unavailable — the tags would just be the defaults, which is exactly
 * what a new account has anyway.
 */
export async function loadLabelNames(
  caller: RequestUser | null,
): Promise<string[]> {
  const fallback = DEFAULT_LABELS.map((l) => l.name);
  if (!caller) return fallback;

  const { data, error } = await caller.supabase
    .from("labels")
    .select("name")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return fallback;
  return (data as { name: string }[]).map((row) => row.name);
}
