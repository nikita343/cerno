import { NextResponse } from "next/server";
import * as z from "zod";

import { describeError } from "@/lib/ai/client";
import { buildSmartTask } from "@/lib/ai/smartTask";
import { todayISO } from "@/lib/date";
import { upsertTasks } from "@/lib/supabase/data";
import {
  loadLabelNames,
  loadModelChoice,
  resolveRequestUser,
  type RequestUser,
} from "@/lib/supabase/request";
import type { Task } from "@/lib/types";

/**
 * Persists a task for the signed-in user, if there is one.
 *
 * Returns silently when there is no session or no backend, so a keyless dev
 * environment still gets a working parse. A *failed* write, by contrast, must
 * not be swallowed: the caller would show the user a task that does not exist.
 */
async function persist(task: Task, caller: RequestUser | null): Promise<void> {
  if (!caller) return;
  await upsertTasks(caller.supabase, [task], caller.userId);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 500;

const requestSchema = z.object({
  text: z.string().min(1).max(MAX_CHARS),
  today: z.string().optional(),
  timezone: z.string().default("UTC"),
  /**
   * Adds the task to a workspace instead of the caller's own list.
   *
   * Not verified here. The insert policy on `tasks` requires membership, so a
   * workspace the caller doesn't belong to is refused by the database — which
   * is the check that actually counts. Re-checking in the route would be a
   * second place to get multi-tenant isolation wrong.
   */
  workspaceId: z.string().uuid().nullish(),
  /**
   * Who the task is for, inside a workspace. Not verified here for the same
   * reason as `workspaceId`: the row is inserted with the caller's client, so
   * the tasks insert policy is the check that counts. A non-member id would at
   * worst be a dangling assignee, never a tenant-isolation break.
   */
  assigneeId: z.string().uuid().nullish(),
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
  const caller = await resolveRequestUser();
  const [labelNames, modelChoice] = await Promise.all([
    loadLabelNames(caller),
    loadModelChoice(caller),
  ]);

  try {
    const task = await buildSmartTask({
      text: body.text,
      today,
      timezone: body.timezone,
      labelNames,
      modelChoice,
      // Set before persisting so the insert is checked against the workspace
      // policy, not written as personal and moved afterwards.
      workspaceId: body.workspaceId ?? null,
      assigneeId: body.assigneeId ?? null,
    });

    await persist(task, caller);
    return NextResponse.json({ task });
  } catch (error) {
    const { status, message } = describeError(error);
    console.error("[/api/tasks/parse]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
