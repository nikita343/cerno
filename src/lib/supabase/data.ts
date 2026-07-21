import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays } from "@/lib/date";
import {
  DEFAULT_LABELS,
  type DayPlan,
  type Dump,
  type Label,
  type Task,
  type UserSettings,
} from "@/lib/types";

import {
  toDayPlan,
  toLabel,
  toSettings,
  toTask,
  toTaskRow,
  type DayPlanRow,
  type LabelRow,
  type TaskRow,
  type UserSettingsRow,
} from "./rows";

/**
 * Data access, shared by the server (initial load, API routes) and the browser
 * (task mutations).
 *
 * Every function takes a client rather than creating one, because the two
 * environments build it differently — cookies on the server, localStorage in
 * the browser — and because a module-level client on the server would leak one
 * user's session into another user's request.
 *
 * None of these filter by user_id. That is not an oversight: RLS does it, and
 * duplicating the predicate here would create a second place to get it wrong.
 * The only exception is writes, which must *state* the user_id they're claiming.
 */

/**
 * How far back completed work is still loaded.
 *
 * Today renders done tasks with strikethrough, so recent history has to come
 * back. Without a bound this query grows forever and every page load gets a
 * little slower for the rest of the account's life.
 */
const DONE_HISTORY_DAYS = 14;

export interface DashboardData {
  tasks: Task[];
  dayPlans: Record<string, DayPlan>;
  dumps: Dump[];
  labels: Label[];
  settings: UserSettings;
}

/**
 * Everything the dashboard needs for a first paint.
 *
 * Open work is always included regardless of date; completed work only for the
 * recent window above.
 */
/**
 * PostgREST's rejection when a JWT's `iat` is ahead of its clock.
 *
 * Hit on the very first request after signing in: the token is milliseconds
 * old, and GoTrue and PostgREST are separate services whose clocks can differ
 * by a fraction of a second. PostgREST allows no leeway, so a token minted
 * "just now" can look like it comes from the future. A second later the same
 * token validates fine — which is why a refresh always appears to fix it.
 */
const CLOCK_SKEW_CODE = "PGRST303";

function isClockSkew(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === CLOCK_SKEW_CODE
  );
}

export async function loadDashboard(
  supabase: SupabaseClient,
  today: string,
): Promise<DashboardData> {
  try {
    return await fetchDashboard(supabase, today);
  } catch (error) {
    if (!isClockSkew(error)) throw error;
    // Wait out the skew rather than showing an error the user can only fix by
    // pressing reload. One retry is enough: the window is sub-second.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return fetchDashboard(supabase, today);
  }
}

async function fetchDashboard(
  supabase: SupabaseClient,
  today: string,
): Promise<DashboardData> {
  const cutoff = addDays(today, -DONE_HISTORY_DAYS);

  const [tasksResult, plansResult, labelsResult, settingsResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .or(`status.neq.done,plan_date.gte.${cutoff}`)
        .order("sort_order", { ascending: true }),
      supabase
        .from("day_plans")
        .select("*")
        .gte("plan_date", cutoff)
        .order("plan_date", { ascending: false }),
      supabase
        .from("labels")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      // maybeSingle, not single: a user with no settings row yet is the normal
      // first-load case, and `single` treats zero rows as an error.
      supabase.from("user_settings").select("*").maybeSingle(),
    ]);

  if (tasksResult.error) throw tasksResult.error;
  if (plansResult.error) throw plansResult.error;
  if (labelsResult.error) throw labelsResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const dayPlans: Record<string, DayPlan> = {};
  for (const row of (plansResult.data ?? []) as DayPlanRow[]) {
    dayPlans[row.plan_date] = toDayPlan(row);
  }

  return {
    tasks: ((tasksResult.data ?? []) as TaskRow[]).map(toTask),
    dayPlans,
    // Dumps are raw input history — nothing renders them yet, so they aren't
    // worth a round trip on every page load.
    dumps: [],
    labels: ((labelsResult.data ?? []) as LabelRow[]).map(toLabel),
    settings: toSettings(settingsResult.data as UserSettingsRow | null),
  };
}

/**
 * Gives a user with no labels the default set.
 *
 * Seeded lazily on load rather than by a trigger on `auth.users`, because a
 * trigger only fires for accounts created after it exists — every account that
 * already signed up would silently have no labels, and the Labels list would be
 * empty with no way to explain why.
 *
 * Returns the seeded rows, or null when there was nothing to do. A failure is
 * swallowed by the caller: labels are recoverable, and a first paint that
 * fails because of a convenience write would be a worse trade.
 */
export async function seedDefaultLabels(
  supabase: SupabaseClient,
  userId: string,
): Promise<Label[] | null> {
  const { data, error } = await supabase
    .from("labels")
    .insert(
      DEFAULT_LABELS.map((label, i) => ({
        user_id: userId,
        name: label.name,
        color: label.color,
        sort_order: i,
      })),
    )
    .select();

  if (error) throw error;
  return ((data ?? []) as LabelRow[]).map(toLabel);
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/** Inserts a dump and returns the stored row's id. */
export async function insertDump(
  supabase: SupabaseClient,
  dump: Pick<Dump, "id" | "raw_text" | "source" | "created_at">,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("dumps").insert({
    id: dump.id,
    user_id: userId,
    raw_text: dump.raw_text,
    source: dump.source,
    created_at: dump.created_at,
  });
  if (error) throw error;
}

/**
 * Writes a replanned set of tasks.
 *
 * Upsert rather than insert: a replan returns carried-forward tasks with their
 * existing ids, and those rows must be updated in place so completion state and
 * foreign keys survive.
 */
export async function upsertTasks(
  supabase: SupabaseClient,
  tasks: Task[],
  userId: string,
): Promise<void> {
  if (tasks.length === 0) return;
  const { error } = await supabase
    .from("tasks")
    .upsert(tasks.map((t) => toTaskRow(t, userId)));
  if (error) throw error;
}

/** One plan per user per day — conflicts update the existing row. */
export async function upsertDayPlan(
  supabase: SupabaseClient,
  plan: DayPlan,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("day_plans").upsert(
    {
      user_id: userId,
      plan_date: plan.plan_date,
      summary: plan.summary,
      capacity_note: plan.capacity_note,
    },
    { onConflict: "user_id,plan_date" },
  );
  if (error) throw error;
}

/**
 * Patches one task.
 *
 * Deliberately narrow: the UI only ever changes these fields, and accepting a
 * whole Task here would let a client rewrite `user_id` or `created_at` on a row
 * it happens to own.
 */
export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "priority"
    | "estimated_minutes"
    | "deadline"
    | "status"
    | "plan_date"
    // A time the user set by hand. Writable because rescheduling is not only a
    // question of which day — "move it to 16:00" is the same action.
    | "suggested_start"
    | "reasoning"
    | "sort_order"
  >
>;

export async function updateTaskRow(
  supabase: SupabaseClient,
  id: string,
  patch: TaskPatch,
): Promise<void> {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRow(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export async function insertLabel(
  supabase: SupabaseClient,
  label: { name: string; color: string; sort_order: number },
  userId: string,
): Promise<Label> {
  const { data, error } = await supabase
    .from("labels")
    .insert({ ...label, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return toLabel(data as LabelRow);
}

/**
 * Renames a label and rewrites every task tagged with the old name.
 *
 * Goes through the `rename_label` function rather than a plain update because
 * tasks store label *names*, not foreign keys — the two writes have to be one
 * transaction, or a failure between them leaves tasks pointing at a name that
 * no longer exists. See the comment at the top of `0002_labels_and_settings.sql`.
 */
export async function renameLabelRow(
  supabase: SupabaseClient,
  id: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.rpc("rename_label", {
    label_id: id,
    new_name: name,
  });
  if (error) throw error;
}

/** Colour is cosmetic and lives only on the label, so a plain update is safe. */
export async function updateLabelColor(
  supabase: SupabaseClient,
  id: string,
  color: string,
): Promise<void> {
  const { error } = await supabase.from("labels").update({ color }).eq("id", id);
  if (error) throw error;
}

/** Deletes the label and strips it from every task carrying it. Atomic. */
export async function deleteLabelRow(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.rpc("delete_label", { label_id: id });
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Upsert, not update: the settings row is created on first save rather than at
 * signup, so the first write a user ever makes has nothing to update.
 */
export async function saveSettings(
  supabase: SupabaseClient,
  patch: Partial<UserSettings>,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("user_settings").upsert(
    { user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/** Bucket is public-read, so the returned URL can go straight into an <img>. */
export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads an avatar and returns its public URL.
 *
 * The path is prefixed with the user's id because the storage policy checks
 * the first path segment against `auth.uid()` — that prefix is what stops one
 * user overwriting another's avatar, so it is not merely tidy naming.
 *
 * A cache-busting query is appended because the object path is stable per user:
 * without it, a new upload keeps showing the previous image until the CDN entry
 * expires.
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  file: File,
  userId: string,
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
