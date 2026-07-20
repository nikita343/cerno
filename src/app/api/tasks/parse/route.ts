import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod";

import { describeError, DEFAULT_MODEL, getClient } from "@/lib/ai/client";
import { smartAddSystemPrompt } from "@/lib/ai/prompt";
import { smartTaskSchema } from "@/lib/ai/schema";
import { todayISO } from "@/lib/date";
import { parseSingleTask } from "@/lib/planner";
import type { Tag, Task } from "@/lib/types";

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
    return NextResponse.json({
      task: parseSingleTask(body.text, today),
      planner: "heuristic",
    });
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
      id: `task-${Date.now().toString(36)}`,
      dump_id: null,
      title: parsed.title,
      priority: parsed.priority,
      estimated_minutes: Math.min(
        480,
        Math.max(5, Math.round(parsed.estimated_minutes)),
      ),
      deadline: parsed.deadline,
      suggested_start: null,
      status: "today",
      plan_date: today,
      tags: [parsed.tag as Tag],
      reasoning: parsed.reasoning,
      sort_order: 0,
      created_at: createdAt,
    };

    return NextResponse.json({ task, planner: "ai" });
  } catch (error) {
    const { status, message } = describeError(error);
    console.error("[/api/tasks/parse]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
