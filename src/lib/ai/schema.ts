import * as z from "zod";

import { TAGS } from "@/lib/types";

/**
 * The contract Claude must satisfy.
 *
 * These schemas are handed to the API as structured outputs (`output_config.
 * format`), so the model is *constrained* to this shape rather than merely
 * asked for it — which removes the whole class of "stray prose around the
 * JSON" failures the brief anticipated. They are still validated on the way
 * out, because a schema guarantees shape, not sense.
 */

export const prioritySchema = z.enum(["high", "medium", "low"]);

export const tagSchema = z.enum(TAGS as unknown as [string, ...string[]]);

/**
 * One planned item.
 *
 * `id` is the join back to existing work: the request sends every outstanding
 * task with its id, and the model echoes that id for anything it is carrying
 * forward. `null` means the item was parsed fresh from this dump.
 */
export const plannedTaskSchema = z.object({
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
  tag: tagSchema.describe("Exactly one label from the fixed taxonomy."),
  reasoning: z
    .string()
    .describe(
      "One short, calm line explaining this priority/effort/placement. No exclamation marks.",
    ),
  status: z
    .enum(["today", "deferred"])
    .describe("'today' if it fits the day's capacity, 'deferred' if parked."),
});

export const planResponseSchema = z.object({
  tasks: z
    .array(plannedTaskSchema)
    .describe(
      "Every outstanding item, new and carried over, in execution order. Scheduled items first.",
    ),
  summary: z
    .string()
    .describe("One calm sentence describing the shape of the day."),
  capacity_note: z
    .string()
    .describe(
      "One line reconciling what came in against what was planned and parked.",
    ),
});

export type PlanResponse = z.infer<typeof planResponseSchema>;
export type PlannedTask = z.infer<typeof plannedTaskSchema>;

/** The narrower shape used by the smart single-task add. */
export const smartTaskSchema = z.object({
  title: z.string().describe("Imperative, at most 8 words."),
  priority: prioritySchema,
  estimated_minutes: z.number().int(),
  deadline: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD the task must be finished BY, or null."),
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
  tag: tagSchema,
  reasoning: z.string().describe("One short line on why this priority/effort."),
});

export type SmartTask = z.infer<typeof smartTaskSchema>;
