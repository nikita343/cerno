import type { DayPlan, Dump, Priority, Tag, Task, TaskStatus } from "@/lib/types";

/**
 * Database row shapes and their mapping to domain types.
 *
 * The column names deliberately match `src/lib/types.ts`, so this is almost an
 * identity mapping. Almost — and the exceptions are the whole reason this file
 * exists rather than a cast:
 *
 *   - Postgres `time` comes back as "11:00:00"; the UI and scheduler both
 *     expect "HH:MM".
 *   - `user_id` is required in the database and absent from the client domain
 *     type, because the client never chooses it — RLS does.
 *   - `tags` is a real array column, not JSON, so it needs no parsing but does
 *     need a null guard for rows written before the default existed.
 */

export interface TaskRow {
  id: string;
  user_id: string;
  dump_id: string | null;
  title: string;
  priority: Priority;
  estimated_minutes: number;
  deadline: string | null;
  suggested_start: string | null;
  status: TaskStatus;
  plan_date: string | null;
  tags: Tag[] | null;
  reasoning: string | null;
  sort_order: number;
  created_at: string;
}

export interface DayPlanRow {
  id: string;
  user_id: string;
  plan_date: string;
  summary: string;
  capacity_note: string;
  created_at: string;
}

export interface DumpRow {
  id: string;
  user_id: string;
  raw_text: string;
  source: "text" | "voice";
  created_at: string;
}

/** "11:00:00" -> "11:00". Null stays null. */
export function trimClock(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    user_id: row.user_id,
    dump_id: row.dump_id,
    title: row.title,
    priority: row.priority,
    estimated_minutes: row.estimated_minutes,
    deadline: row.deadline,
    suggested_start: trimClock(row.suggested_start),
    status: row.status,
    plan_date: row.plan_date,
    tags: row.tags ?? [],
    reasoning: row.reasoning,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

/**
 * Domain task -> insertable row.
 *
 * `user_id` is passed explicitly rather than read from the task: it must come
 * from the verified session, never from client-supplied data. RLS would reject
 * a mismatch anyway, but sending the right value is not the same as letting the
 * client pick it.
 */
export function toTaskRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    dump_id: task.dump_id,
    title: task.title,
    priority: task.priority,
    estimated_minutes: task.estimated_minutes,
    deadline: task.deadline,
    suggested_start: task.suggested_start,
    status: task.status,
    plan_date: task.plan_date,
    tags: task.tags,
    reasoning: task.reasoning,
    sort_order: task.sort_order,
    created_at: task.created_at,
  };
}

export function toDayPlan(row: DayPlanRow): DayPlan {
  return {
    id: row.id,
    user_id: row.user_id,
    plan_date: row.plan_date,
    summary: row.summary,
    capacity_note: row.capacity_note,
    created_at: row.created_at,
  };
}

export function toDump(row: DumpRow): Dump {
  return {
    id: row.id,
    user_id: row.user_id,
    raw_text: row.raw_text,
    source: row.source,
    created_at: row.created_at,
  };
}
