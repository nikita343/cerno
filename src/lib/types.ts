/**
 * Domain types.
 *
 * These mirror the Supabase schema in DEVELOPMENT.md §5 field-for-field so the
 * phase-2 backend swap is a swap, not a rebuild. Fields the mock layer cannot
 * know yet (user_id) are optional here and become required once auth lands.
 */

export type Priority = "high" | "medium" | "low";

/** Fixed 5-label taxonomy. The AI is constrained to these — never free-form. */
export type Tag = "work" | "home" | "errand" | "comms" | "health";

export const TAGS: readonly Tag[] = [
  "work",
  "home",
  "errand",
  "comms",
  "health",
] as const;

/**
 * `inbox`   — parsed, not yet placed
 * `today`   — on the plan for `plan_date`
 * `deferred`— parked with a reason
 * `done`    — completed
 */
export type TaskStatus = "inbox" | "today" | "deferred" | "done";

export interface Task {
  id: string;
  user_id?: string;
  dump_id: string | null;
  title: string;
  priority: Priority;
  estimated_minutes: number;
  /** ISO date `YYYY-MM-DD`, or null. */
  deadline: string | null;
  /** `HH:MM`, or null. */
  suggested_start: string | null;
  status: TaskStatus;
  /** ISO date the task is planned for. Drives Today and carry-over. */
  plan_date: string | null;
  tags: Tag[];
  /** One calm line: why this priority/time/deadline. */
  reasoning: string | null;
  sort_order: number;
  created_at: string;
}

export interface DayPlan {
  id: string;
  user_id?: string;
  /** ISO date. One per user per day. */
  plan_date: string;
  /** Renders as the Today H1. */
  summary: string;
  /** Renders as the Today sub-line. */
  capacity_note: string;
  created_at: string;
}

export interface Dump {
  id: string;
  user_id?: string;
  raw_text: string;
  source: "text" | "voice";
  created_at: string;
}

/** Shape returned by `POST /api/plan` — mocked in phase 1, real in phase 2. */
export interface PlanResult {
  dump: Dump;
  tasks: Task[];
  dayPlan: DayPlan;
}

export type ScreenKey =
  | "today"
  | "upcoming"
  | "inbox"
  | "filters"
  | "search";

export type CaptureMode = "ready" | "listening" | "thinking";

export type Theme = "dark" | "light";

export interface UserProfile {
  name: string;
  email: string;
  initials: string;
}
