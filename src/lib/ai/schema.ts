import * as z from "zod";

import { DEFAULT_LABELS } from "@/lib/types";

/**
 * The contract Claude must satisfy.
 *
 * These schemas are handed to the API as structured outputs (`output_config.
 * format`), so the model is *constrained* to this shape rather than merely
 * asked for it — which removes the whole class of "stray prose around the
 * JSON" failures the brief anticipated. They are still validated on the way
 * out, because a schema guarantees shape, not sense.
 *
 * The tag enum used to be a module constant. Labels are user-defined now, so
 * the schemas are built per request from the caller's own label names — that
 * enum is what makes an invented tag impossible rather than merely discouraged,
 * so it has to be as specific as the user's list.
 */

export const prioritySchema = z.enum(["high", "medium", "low"]);

const FALLBACK_TAGS = DEFAULT_LABELS.map((l) => l.name);

/**
 * Constrains the tag to the user's labels.
 *
 * Falls back to the default taxonomy when the list is empty — a brand-new
 * account mid-seed, or a label read that failed. An empty enum is not a valid
 * schema, and rejecting the whole plan because the user has no labels would
 * turn a cosmetic problem into a broken dump.
 */
export function buildTagSchema(labelNames: string[]) {
  const names = labelNames.map((n) => n.trim()).filter(Boolean);
  const values = names.length > 0 ? names : FALLBACK_TAGS;
  return z.enum(values as [string, ...string[]]);
}

/**
 * One planned item.
 *
 * `id` is the join back to existing work: the request sends every outstanding
 * task with its id, and the model echoes that id for anything it is carrying
 * forward. `null` means the item was parsed fresh from this dump.
 */
export function buildPlannedTaskSchema(labelNames: string[]) {
  return z.object({
  id: z
    .string()
    .nullable()
    .describe(
      "The id of an existing task being replanned, or null for a task newly parsed from this dump.",
    ),
  title: z
    .string()
    .describe("Imperative, at most 8 words. No trailing punctuation."),
  priority: prioritySchema,
  estimated_minutes: z
    .number()
    .int()
    .describe("Realistic effort in minutes, between 5 and 480."),
  deadline: z
    .string()
    .nullable()
    .describe(
      "Hard due date as YYYY-MM-DD — the day this must be finished BY. Null when there isn't one.",
    ),
  deadline_time: z
    .string()
    .nullable()
    .describe(
      "HH:MM (24h) the deadline falls at, when a clock time was given for it ('by 6pm', 'before 18:00'). Null when the deadline has no specific time or there's no deadline.",
    ),
  plan_date: z
    .string()
    .nullable()
    .describe(
      "The day to actually DO this, as YYYY-MM-DD, when the person named a specific day ('massage on Sunday'). Null means schedule it into today's plan normally.",
    ),
  suggested_start: z
    .string()
    .nullable()
    .describe("HH:MM if the item is time-bound, otherwise null."),
    tag: buildTagSchema(labelNames).describe(
      "Exactly one label, chosen from the caller's own label set.",
    ),
    reasoning: z
      .string()
      .describe(
        "One short, calm line explaining this priority/effort/placement. No exclamation marks.",
      ),
    status: z
      .enum(["today", "deferred"])
      .describe("'today' if it fits the day's capacity, 'deferred' if parked."),
  });
}

export function buildPlanResponseSchema(labelNames: string[]) {
  return z.object({
    tasks: z
      .array(buildPlannedTaskSchema(labelNames))
      .describe(
        "Every outstanding item, new and carried over, in execution order. Scheduled items first.",
      ),
    summary: z
      .string()
      .describe("One calm sentence describing the shape of the day."),
    // No capacity_note here on purpose: it's reconciled from the final split in
    // assemble(), so asking the model for one only burns output tokens (and thus
    // latency) on a field that gets thrown away.
  });
}

/**
 * Types are derived from the default-label instance of each schema.
 *
 * The tag enum's *members* vary per user but its TypeScript type is `string`
 * either way, so one representative instance describes every variant.
 */
export type PlanResponse = z.infer<ReturnType<typeof buildPlanResponseSchema>>;
export type PlannedTask = z.infer<ReturnType<typeof buildPlannedTaskSchema>>;

/** The narrower shape used by the smart single-task add. */
export function buildSmartTaskSchema(labelNames: string[]) {
  return z.object({
    title: z.string().describe("Imperative, at most 8 words."),
    priority: prioritySchema,
    estimated_minutes: z.number().int(),
    deadline: z
      .string()
      .nullable()
      .describe("YYYY-MM-DD the task must be finished BY, or null."),
    deadline_time: z
      .string()
      .nullable()
      .describe(
        "HH:MM (24h) the deadline falls at ('by 6pm', 'before 18:00'), or null when it has no set time.",
      ),
    plan_date: z
      .string()
      .nullable()
      .describe(
        "YYYY-MM-DD to actually DO this, when a specific day was named. Null means today.",
      ),
    suggested_start: z
      .string()
      .nullable()
      .describe("HH:MM if a clock time was given, otherwise null."),
    tag: buildTagSchema(labelNames),
    reasoning: z
      .string()
      .describe("One short line on why this priority/effort."),
  });
}

export type SmartTask = z.infer<ReturnType<typeof buildSmartTaskSchema>>;
