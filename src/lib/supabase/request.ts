import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_LABELS, isPaidModel, type ModelChoice } from "@/lib/types";

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

/**
 * The caller's planning-model preference.
 *
 * Read server-side rather than sent from the browser: a client-supplied model
 * id is a request to spend our money on a model of the caller's choosing, and
 * the picker's value would then be a suggestion rather than a setting.
 *
 * Null when signed out or unset, which `resolveModel` turns into the default.
 *
 * Team gate: Opus and GPT-5 are paid-only. If the stored preference is one of
 * them and the caller isn't currently entitled — a preference set while
 * subscribed and kept after cancelling, or one forced past the locked picker in
 * devtools — it is treated as unset (→ the free default) rather than run. This
 * is where the money decision is actually made; the picker's lock is only
 * cosmetic. Entitlement is `has_active_plan()`, the same SQL that gates
 * workspace creation, so "paid" has one definition.
 */
export async function loadModelChoice(
  caller: RequestUser | null,
): Promise<ModelChoice | null> {
  if (!caller) return null;

  const { data, error } = await caller.supabase
    .from("user_settings")
    .select("model")
    .eq("user_id", caller.userId)
    .maybeSingle();

  if (error || !data?.model) return null;
  const choice = data.model as ModelChoice;

  if (isPaidModel(choice)) {
    const { data: entitled } = await caller.supabase.rpc("has_active_plan");
    // Null (RPC error) is treated as not-entitled: fail closed, never bill for a
    // paid model on an unverified plan.
    if (entitled !== true) return null;
  }

  return choice;
}

/**
 * The caller's saved timezone (IANA name, e.g. "Europe/Kyiv").
 *
 * Read server-side so the Settings → Language & region choice is what the
 * planner actually uses to resolve "tomorrow" and "Friday", rather than
 * whatever timezone the browser making the request happens to be in. Null when
 * signed out or unset; the caller falls back to the browser value it was sent.
 */
export async function loadTimezone(
  caller: RequestUser | null,
): Promise<string | null> {
  if (!caller) return null;

  const { data, error } = await caller.supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", caller.userId)
    .maybeSingle();

  if (error || !data?.timezone) return null;
  return data.timezone as string;
}
