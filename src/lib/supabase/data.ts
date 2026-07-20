import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays } from "@/lib/date";
import type { DayPlan, Dump, Task } from "@/lib/types";

import {
  toDayPlan,
  toTask,
  toTaskRow,
  type DayPlanRow,
  type TaskRow,
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
}

/**
 * Everything the dashboard needs for a first paint.
 *
 * Open work is always included regardless of date; completed work only for the
 * recent window above.
 */
export async function loadDashboard(
  supabase: SupabaseClient,
  today: string,
): Promise<DashboardData> {
  const cutoff = addDays(today, -DONE_HISTORY_DAYS);

  const [tasksResult, plansResult] = await Promise.all([
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
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (plansResult.error) throw plansResult.error;

  const dayPlans: Record<string, DayPlan> = {};
  for (const row of (plansResult.data ?? []) as DayPlanRow[]) {
    dayPlans[row.plan_date] = toDayPlan(row);
  }

  return {
    tasks: ((tasksResult.data ?? []) as TaskRow[]).map(toTask),
    dayPlans,
    // Dumps are raw input history — nothing renders them yet, so they aren't
    // worth a third round trip on every page load.
    dumps: [],
  };
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
    | "priority"
    | "estimated_minutes"
    | "deadline"
    | "status"
    | "plan_date"
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
