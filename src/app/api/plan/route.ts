import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod";

import { describeError, DEFAULT_MODEL, getClient } from "@/lib/ai/client";
import { planSystemPrompt, planUserPrompt } from "@/lib/ai/prompt";
import { planResponseSchema, type PlannedTask } from "@/lib/ai/schema";
import { addDays, todayISO } from "@/lib/date";
import { DAY_CAPACITY_MINUTES } from "@/lib/fixtures";
import { buildPlan } from "@/lib/planner";
import type { DayPlan, Dump, PlanResult, Tag, Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guards against a giant paste turning into a giant bill. */
const MAX_DUMP_CHARS = 8_000;
const MAX_TOKENS = 8_000;

const taskInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  estimated_minutes: z.number(),
  deadline: z.string().nullable(),
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

  const client = getClient();

  // No key configured — serve the heuristic planner rather than erroring.
  if (!client) {
    const result = buildPlan({
      dumpText: body.dumpText,
      source: body.source,
      today,
      capacityMinutes,
      carryIn,
    });
    return NextResponse.json({ ...result, planner: "heuristic" });
  }

  try {
    const response = await client.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Estimating effort and deciding what to cut is judgement work — let the
      // model think about it rather than answering off the cuff.
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(planResponseSchema),
      },
      system: planSystemPrompt({
        now: today,
        timezone: body.timezone,
        capacityMinutes,
      }),
      messages: [
        {
          role: "user",
          content: planUserPrompt({ dumpText: body.dumpText, carryIn }),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      // The model refused or hit the token cap before completing the object.
      throw new Error("empty parsed output");
    }

    const result = assemble({
      parsed,
      carryIn,
      today,
      capacityMinutes,
      source: body.source,
      dumpText: body.dumpText,
    });

    return NextResponse.json({ ...result, planner: "ai" });
  } catch (error) {
    const { status, message } = describeError(error);
    console.error("[/api/plan]", error);
    return NextResponse.json({ error: message }, { status });
  }
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
  const dumpId = `dump-${Date.now().toString(36)}`;
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
      id: prior?.id ?? `task-${dumpId}-${index}`,
      dump_id: prior?.dump_id ?? dumpId,
      title: item.title,
      priority: item.priority,
      estimated_minutes: minutes,
      deadline: item.deadline,
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

  const totalMinutes = parsed.tasks.reduce(
    (n, t) => n + clampMinutes(t.estimated_minutes),
    0,
  );

  const dayPlan: DayPlan = {
    id: `plan-${dumpId}`,
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

  return { dump, tasks: [...scheduled, ...later, ...deferred], dayPlan };
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
