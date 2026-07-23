import { NextResponse } from "next/server";
import * as z from "zod";

import { describeError } from "@/lib/ai/client";
import { generateStructured } from "@/lib/ai/generate";
import { planSystemPrompt, planUserPrompt } from "@/lib/ai/prompt";
import { buildPlanResponseSchema, type PlannedTask } from "@/lib/ai/schema";
import { addDays, todayISO, todayInZone } from "@/lib/date";
import { DAY_CAPACITY_MINUTES } from "@/lib/fixtures";
import { newId } from "@/lib/id";
import { buildPlan } from "@/lib/planner";
import { minutesNowInZone } from "@/lib/reminders";
import { DAY_END_MINUTES } from "@/lib/schedule";
import { insertDump, upsertDayPlan, upsertTasks } from "@/lib/supabase/data";
import {
  loadLabelNames,
  loadLanguage,
  loadModelChoice,
  loadTimezone,
  resolveRequestUser,
  type RequestUser,
} from "@/lib/supabase/request";
import type { DayPlan, Dump, PlanResult, Tag, Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A plan with adaptive thinking can take tens of seconds; give the function the
// Hobby-plan ceiling so a slow model can't trip the default timeout.
export const maxDuration = 60;

/** Guards against a giant paste turning into a giant bill. */
const MAX_DUMP_CHARS = 8_000;
const MAX_TOKENS = 8_000;

const taskInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  estimated_minutes: z.number(),
  deadline: z.string().nullable(),
  deadline_time: z.string().nullable().optional(),
  suggested_start: z.string().nullable().optional(),
  status: z.enum(["inbox", "today", "deferred", "done"]),
  plan_date: z.string().nullable(),
  tags: z.array(z.string()),
  reasoning: z.string().nullable(),
  sort_order: z.number(),
  dump_id: z.string().nullable(),
  created_at: z.string(),
});

const requestSchema = z.object({
  dumpText: z.string().min(1).max(MAX_DUMP_CHARS),
  source: z.enum(["text", "voice"]).default("text"),
  today: z.string().optional(),
  timezone: z.string().default("UTC"),
  capacityMinutes: z.number().int().positive().max(1440).optional(),
  carryIn: z.array(taskInputSchema).default([]),
});

/**
 * POST /api/plan — brain dump in, realistic day out.
 *
 * Falls back to the local heuristic planner when no API key is configured, so
 * the app is fully usable (and demoable) without one. The response shape is
 * identical either way; `planner` tells the caller which path ran.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const today = body.today ?? todayISO();
  const capacityMinutes = body.capacityMinutes ?? DAY_CAPACITY_MINUTES;
  const carryIn = body.carryIn as Task[];

  // Resolved once and reused for persistence below: verifying the session is a
  // round trip to the auth server, and doing it twice per dump is wasteful.
  const caller = await resolveRequestUser();
  const [labelNames, modelChoice, savedTimezone, language] = await Promise.all([
    loadLabelNames(caller),
    loadModelChoice(caller),
    loadTimezone(caller),
    loadLanguage(caller),
  ]);
  // The Settings → Language & region choice wins over the browser's timezone,
  // so the planner resolves "tomorrow"/"Friday" in the zone the user picked.
  const timezone = savedTimezone ?? body.timezone;

  // A realistic day can't hold more than the hours actually left in it. When
  // planning today, cap the budget at the time remaining before end-of-day —
  // otherwise the planner schedules a full 8h into the evening and the timeline
  // clamps the overflow onto a 23:59 wall instead of deferring it to tomorrow.
  const planningToday = today === todayInZone(timezone, new Date());
  const effectiveCapacity = planningToday
    ? Math.min(capacityMinutes, Math.max(0, DAY_END_MINUTES - minutesNowInZone(timezone)))
    : capacityMinutes;

  // Whether *any* vendor is configured is decided inside generateStructured,
  // which falls back across providers before giving up. This local helper is
  // what both that fallback and a hard failure land on.
  const heuristic = () =>
    buildPlan({
      dumpText: body.dumpText,
      source: body.source,
      today,
      capacityMinutes: effectiveCapacity,
      carryIn,
      labelNames,
    });

  try {
    const generated = await generateStructured({
      // The user's stored preference, read server-side — never sent by the
      // browser, which would let a caller choose what we spend money on.
      choice: modelChoice,
      schema: buildPlanResponseSchema(labelNames),
      schemaName: "plan_response",
      maxTokens: MAX_TOKENS,
      // Thinking off: adaptive thinking pushed planning to ~50s, and Sonnet 5
      // handles this structured extraction well without it. The detailed prompt
      // carries the judgement (effort, what to cut) that thinking used to add.
      thinking: false,
      system: planSystemPrompt({
        now: today,
        timezone,
        capacityMinutes: effectiveCapacity,
        labelNames,
        language: language ?? "en",
      }),
      user: planUserPrompt({ dumpText: body.dumpText, carryIn }),
    });

    // Neither vendor is configured — the heuristic planner is still a complete
    // answer, so this is a fallback rather than a failure.
    if (!generated) {
      const result = heuristic();
      await persistPlan(result, caller);
      return NextResponse.json({ ...result, planner: "heuristic" });
    }
    const parsed = generated.parsed;

    const result = assemble({
      parsed,
      carryIn,
      today,
      capacityMinutes: effectiveCapacity,
      source: body.source,
      dumpText: body.dumpText,
    });

    await persistPlan(result, caller);
    return NextResponse.json({ ...result, planner: "ai" });
  } catch (error) {
    const { status, message } = describeError(error);
    console.error("[/api/plan]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Writes a whole planning result for the signed-in user.
 *
 * Order matters: the dump goes first because tasks carry `dump_id` as a foreign
 * key, and inserting a task that references a missing dump would be rejected.
 *
 * Errors propagate. A replan that silently failed to save is worse than a
 * visible failure — the user would keep working against a plan that only exists
 * in their tab.
 */
async function persistPlan(
  result: PlanResult,
  caller: RequestUser | null,
): Promise<void> {
  if (!caller) return;
  const { supabase, userId } = caller;

  await insertDump(supabase, result.dump, userId);
  await upsertTasks(supabase, result.tasks, userId);
  await upsertDayPlan(supabase, result.dayPlan, userId);
}

/* -------------------------------------------------------------------------- */
/* Model output -> domain objects                                             */
/* -------------------------------------------------------------------------- */

/**
 * Turns the validated model output into persisted-shape tasks.
 *
 * Structured outputs guarantee the shape, not the arithmetic — so capacity is
 * re-checked here. Anything that pushes the day over budget is moved to
 * deferred regardless of what the model labelled it, and the capacity note is
 * regenerated from the final counts so the Today header can never contradict
 * the sections beneath it.
 */
function assemble({
  parsed,
  carryIn,
  today,
  capacityMinutes,
  source,
  dumpText,
}: {
  parsed: { tasks: PlannedTask[]; summary: string; capacity_note: string };
  carryIn: Task[];
  today: string;
  capacityMinutes: number;
  source: "text" | "voice";
  dumpText: string;
}): PlanResult {
  const createdAt = new Date().toISOString();
  const dumpId = newId();
  const existing = new Map(carryIn.map((t) => [t.id, t]));

  const dump: Dump = {
    id: dumpId,
    raw_text: dumpText,
    source,
    created_at: createdAt,
  };

  const scheduled: Task[] = [];
  const later: Task[] = [];
  const deferred: Task[] = [];
  let used = 0;
  let newCount = 0;

  parsed.tasks.forEach((item, index) => {
    const prior = item.id ? existing.get(item.id) : undefined;
    if (!item.id) newCount += 1;

    const minutes = clampMinutes(item.estimated_minutes);

    // A task the person pinned to a future day is scheduled work that simply
    // isn't today's. It must bypass the capacity guard entirely — competing for
    // today's budget would let it be "deferred" onto tomorrow, silently
    // overriding the day they actually asked for.
    const pinned = futureDate(item.plan_date, today);

    // A model-labelled 'today' only sticks if it actually fits.
    const fits = !pinned && item.status === "today" && used + minutes <= capacityMinutes;

    const base: Task = {
      // Reuse the id when carrying a task forward so completion state and
      // React keys survive the replan; mint one only for genuinely new work.
      id: prior?.id ?? newId(),
      dump_id: prior?.dump_id ?? dumpId,
      title: item.title,
      // Carried forward, never regenerated. The description is the user's own
      // note; the planner has no opinion on it and a replan must not erase
      // something they typed.
      description: prior?.description ?? null,
      priority: item.priority,
      estimated_minutes: minutes,
      deadline: item.deadline,
      deadline_time: item.deadline_time ?? null,
      suggested_start: item.suggested_start,
      status: pinned || fits ? "today" : "deferred",
      plan_date: pinned ?? (fits ? today : addDays(today, 1)),
      tags: [item.tag as Tag],
      reasoning: item.reasoning,
      sort_order: 0,
      created_at: prior?.created_at ?? createdAt,
    };

    if (pinned) {
      later.push({ ...base, sort_order: later.length });
    } else if (fits) {
      used += minutes;
      scheduled.push({ ...base, sort_order: scheduled.length });
    } else {
      deferred.push({ ...base, sort_order: deferred.length });
    }
  });

  // Safety net for "fail visible, never silent": the model is told to echo
  // every carried-in id, but if it drops one, we carry that task forward
  // unchanged rather than letting a replan quietly delete existing work. It
  // keeps its prior status and day; the user can re-plan it deliberately.
  const echoed = new Set(
    parsed.tasks.map((t) => t.id).filter((id): id is string => Boolean(id)),
  );
  const preserved = carryIn.filter((t) => !echoed.has(t.id));
  if (preserved.length > 0) {
    console.warn(
      `[/api/plan] model dropped ${preserved.length} carried-in task(s); preserving them`,
    );
  }

  const totalMinutes = parsed.tasks.reduce(
    (n, t) => n + clampMinutes(t.estimated_minutes),
    0,
  );

  const dayPlan: DayPlan = {
    id: newId(),
    plan_date: today,
    summary: parsed.summary,
    // Regenerated locally: the model's own count can drift from the final split
    // once the capacity guard above has moved anything.
    capacity_note: capacityNote({
      newCount,
      carriedCount: carryIn.length,
      totalMinutes,
      scheduledCount: scheduled.length,
      laterCount: later.length,
      deferredCount: deferred.length,
    }),
    created_at: createdAt,
  };

  return {
    dump,
    tasks: [...scheduled, ...later, ...deferred, ...preserved],
    dayPlan,
  };
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(480, Math.max(5, Math.round(value)));
}

/**
 * A model-supplied plan_date, but only when it is a well-formed date strictly
 * after today. A malformed or past date falls back to normal scheduling rather
 * than stranding the task on a day that has already gone.
 */
function futureDate(value: string | null, today: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value > today ? value : null;
}

function formatTotal(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function capacityNote({
  newCount,
  carriedCount,
  totalMinutes,
  scheduledCount,
  laterCount,
  deferredCount,
}: {
  newCount: number;
  carriedCount: number;
  totalMinutes: number;
  scheduledCount: number;
  laterCount: number;
  deferredCount: number;
}): string {
  const things =
    newCount === 1
      ? `1 thing came in (~${formatTotal(totalMinutes)})`
      : `${newCount} things came in (~${formatTotal(totalMinutes)})`;
  const opener =
    carriedCount > 0
      ? `${things}, on top of ${carriedCount} already open.`
      : `${things}.`;

  // Each clause is emitted only when it has a non-zero count behind it, so the
  // note can never claim a bucket the sections below don't render.
  const clauses: string[] = [];
  if (deferredCount > 0 || laterCount > 0) {
    clauses.push(`I planned ${scheduledCount} that fit today`);
    if (laterCount > 0) clauses.push(`set ${laterCount} for the day you asked for`);
    if (deferredCount > 0) clauses.push(`parked ${deferredCount} for tomorrow`);
  }

  if (clauses.length === 0) return `${opener} All of it fits today.`;
  const last = clauses.pop();
  return clauses.length > 0
    ? `${opener} ${clauses.join(", ")} and ${last}.`
    : `${opener} ${last}.`;
}
