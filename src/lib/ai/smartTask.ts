import { generateStructured } from "@/lib/ai/generate";
import { smartAddSystemPrompt } from "@/lib/ai/prompt";
import { buildSmartTaskSchema } from "@/lib/ai/schema";
import { newId } from "@/lib/id";
import { parseSingleTask } from "@/lib/planner";
import type { ModelChoice, Tag, Task } from "@/lib/types";

/** A well-formed plan_date strictly after today, else null. */
function futureDate(value: string | null, today: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value > today ? value : null;
}

/**
 * One phrase in, one structured task out — the shared quick-add parser.
 *
 * Extracted from the `/api/tasks/parse` route so the Telegram bot can create
 * tasks exactly the way the in-app add bar does: same model, same schema, same
 * heuristic fallback when no key is configured. The only difference between the
 * two callers is *whose* task it is and how it gets persisted, which is the
 * caller's business, not the parser's.
 *
 * Returns a task with a fresh id and `created_at`; it is not persisted here.
 */
export async function buildSmartTask({
  text,
  today,
  timezone,
  labelNames,
  modelChoice,
  workspaceId = null,
  assigneeId = null,
}: {
  text: string;
  today: string;
  timezone: string;
  labelNames: string[];
  modelChoice: ModelChoice | null;
  workspaceId?: string | null;
  assigneeId?: string | null;
}): Promise<Task> {
  const createdAt = new Date().toISOString();

  const heuristic = (): Task => ({
    ...parseSingleTask(text, today, labelNames),
    workspace_id: workspaceId,
    assignee_id: assigneeId,
  });

  const generated = await generateStructured({
    choice: modelChoice,
    schema: buildSmartTaskSchema(labelNames),
    schemaName: "smart_task",
    maxTokens: 1_500,
    // A single short phrase — no deliberation needed, and thinking here would
    // only add latency to what should feel instant.
    thinking: false,
    system: smartAddSystemPrompt({ now: today, timezone, labelNames }),
    user: text,
  });

  if (!generated) return heuristic();
  const parsed = generated.parsed;

  return {
    id: newId(),
    dump_id: null,
    workspace_id: workspaceId,
    assignee_id: assigneeId,
    title: parsed.title,
    description: null,
    priority: parsed.priority,
    estimated_minutes: Math.min(480, Math.max(5, Math.round(parsed.estimated_minutes))),
    deadline: parsed.deadline,
    suggested_start: parsed.suggested_start,
    status: "today",
    // A named future day wins over "drop it on today".
    plan_date: futureDate(parsed.plan_date, today) ?? today,
    tags: [parsed.tag as Tag],
    reasoning: parsed.reasoning,
    sort_order: 0,
    created_at: createdAt,
  };
}
