/**
 * Domain types.
 *
 * These mirror the Supabase schema in DEVELOPMENT.md §5 field-for-field so the
 * phase-2 backend swap is a swap, not a rebuild. Fields the mock layer cannot
 * know yet (user_id) are optional here and become required once auth lands.
 */

export type Priority = "high" | "medium" | "low";

/**
 * A label name.
 *
 * Was a fixed 5-value union; labels are user-defined now, so the type can only
 * be `string`. The constraint didn't disappear, it moved: the planner is
 * constrained at request time to whatever labels the user actually has (see
 * `buildTagSchema` in `lib/ai/schema.ts`), which is the only place that can
 * know them.
 */
export type Tag = string;

export interface Label {
  id: string;
  user_id?: string;
  name: string;
  /** `#rrggbb`. Interpolated into a style attribute, so validated at the DB. */
  color: string;
  sort_order: number;
  created_at: string;
}

/**
 * Seeded for a user who has none — the original taxonomy, so an existing
 * account's tasks keep their colours and a new account isn't handed a blank
 * Labels list with nothing to click.
 */
export const DEFAULT_LABELS: ReadonlyArray<{ name: string; color: string }> = [
  { name: "work", color: "#5B8DEF" },
  { name: "home", color: "#F2A93B" },
  { name: "errand", color: "#3FB98A" },
  { name: "comms", color: "#9B7BFF" },
  { name: "health", color: "#E8618C" },
] as const;

/** Offered when creating a label, so users don't need a colour picker. */
export const LABEL_PALETTE: readonly string[] = [
  "#5B8DEF",
  "#F2A93B",
  "#3FB98A",
  "#9B7BFF",
  "#E8618C",
  "#E8553E",
  "#3FB6C4",
  "#B8863F",
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
  /**
   * The user's own note. Distinct from `reasoning`, which is Cerno's
   * explanation of why the task sits where it does — merging them would mean
   * an edit destroys the planner's rationale, and a replan overwrites a note
   * the person typed. Null means never written.
   */
  description: string | null;
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
  | "search"
  | "settings";

/* ------------------------------------------------------------------ settings */

export type AppLanguage = "en" | "uk";

export const LANGUAGES: ReadonlyArray<{
  value: AppLanguage;
  label: string;
  /** Endonym — a language list is easier to scan in its own language. */
  native: string;
}> = [
  { value: "en", label: "English", native: "English" },
  { value: "uk", label: "Ukrainian", native: "Українська" },
] as const;

/**
 * Model choice is stored per user but nothing reads it yet — the planning
 * routes still use the server default. Kept as a coarse tier name rather than
 * an API model id so a model refresh doesn't invalidate every stored row.
 */
export type ModelChoice = "opus" | "sonnet" | "haiku";

export const MODEL_CHOICES: ReadonlyArray<{
  value: ModelChoice;
  label: string;
  note: string;
}> = [
  { value: "opus", label: "Opus", note: "Most capable. Slower, best judgement." },
  { value: "sonnet", label: "Sonnet", note: "Balanced. The default." },
  { value: "haiku", label: "Haiku", note: "Fastest. Best for short dumps." },
] as const;

export interface UserSettings {
  language: AppLanguage;
  /** IANA name, e.g. "Europe/Kyiv". */
  timezone: string;
  model: ModelChoice;
  /** Hours ahead of a task's start to warn about it. */
  reminder_lead_hours: number;
  reminders_enabled: boolean;
  /** Overrides the name derived from the auth profile. */
  display_name: string | null;
  avatar_url: string | null;
  /**
   * Secret token for the iCal feed, or null when no feed exists.
   *
   * This is a credential, not an identifier: anyone holding it can read every
   * task title without signing in. Regenerating it revokes the old URL.
   */
  feed_token: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: "en",
  timezone: "UTC",
  model: "sonnet",
  reminder_lead_hours: 2,
  reminders_enabled: true,
  display_name: null,
  avatar_url: null,
  feed_token: null,
};

/* ------------------------------------------------------- notifications */

/**
 * `overdue` — start time has passed and it isn't done
 * `soon`    — starts within the reminder window
 */
export type ReminderKind = "overdue" | "soon";

export interface Reminder {
  /** The task's id: one live reminder per task, so it doubles as the key. */
  id: string;
  kind: ReminderKind;
  task: Task;
  /** Minutes from midnight the task is scheduled to start. */
  start: number;
  /** Signed minutes until start — negative once overdue. */
  minutesUntil: number;
}

export type CaptureMode = "ready" | "listening" | "thinking";

export type Theme = "dark" | "light";

export interface UserProfile {
  name: string;
  email: string;
  initials: string;
  /** Uploaded avatar, or the OAuth provider's photo. Null falls back to initials. */
  avatarUrl: string | null;
}
