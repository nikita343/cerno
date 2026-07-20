import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod";

import { describeError, DEFAULT_MODEL, getClient } from "@/lib/ai/client";
import { smartAddSystemPrompt } from "@/lib/ai/prompt";
import { smartTaskSchema } from "@/lib/ai/schema";
import { todayISO } from "@/lib/date";
import { newId } from "@/lib/id";
import { parseSingleTask } from "@/lib/planner";
import { upsertTasks } from "@/lib/supabase/data";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Tag, Task } from "@/lib/types";

/**
 * Persists a task for the signed-in user, if there is one.
 *
 * Returns silently when Supabase isn't configured so a keyless dev environment
 * still gets a working parse. A *failed* write, by contrast, must not be
 * swallowed: the caller would show the user a task that does not exist.
 */
async function persist(task: Task): Promise<void> {
  if (!hasSupabaseConfig()) return;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await upsertTasks(supabase, [task], user.id);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 500;

const requestSchema = z.object({
  text: z.string().min(1).max(MAX_CHARS),
  today: z.string().optional(),
  timezone: z.string().default("UTC"),
});

/**
 * POST /api/tasks/parse — smart add.
 *
 * One phrase in, one structured task out. This is the quick-add path: no
 * replanning, no capacity maths, just "buy milk tomorrow" becoming a titled,
 * tagged, estimated task. Same heuristic fallback as /api/plan when there is
 * no API key.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const today = body.today ?? todayISO();
  const client = getClient();

  if (!client) {
    const task = parseSingleTask(body.text, today);
    await persist(task);
    return NextResponse.json({ task, planner: "heuristic" });
  }

  try {
    const response = await client.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 1_500,
      // A single short phrase — no deliberation needed, and thinking here would
      // only add latency to what should feel instant.
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(smartTaskSchema) },
      system: smartAddSystemPrompt({ now: today, timezone: body.timezone }),
      messages: [{ role: "user", content: body.text }],
    });

    const parsed = response.parsed_output;
    if (!parsed) throw new Error("empty parsed output");

    const createdAt = new Date().toISOString();
    const task: Task = {
      id: newId(),
      dump_id: null,
      title: parsed.title,
      priority: parsed.priority,
      estimated_minutes: Math.min(
        480,
        Math.max(5, Math.round(parsed.estimated_minutes)),
      ),
      deadline: parsed.deadline,
      suggested_start: parsed.suggested_start,
      status: "today",
      // A named future day wins over "drop it on today" — otherwise "massage on
      // Sunday" lands on today's plan and the day the person asked for is lost.
      plan_date: futureDate(parsed.plan_date, today) ?? today,
      tags: [parsed.tag as Tag],
      reasoning: parsed.reasoning,
      sort_order: 0,
      created_at: createdAt,
    };

    await persist(task);
    return NextResponse.json({ task, planner: "ai" });
  } catch (error) {
    const { status, message } = describeError(error);
    console.error("[/api/tasks/parse]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

/** A well-formed plan_date strictly after today, else null. */
function futureDate(value: string | null, today: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value > today ? value : null;
}
