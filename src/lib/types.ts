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
  /**
   * The workspace this task belongs to, or null for a personal task.
   *
   * Nullable rather than a separate table: a task is the same shape either
   * way, the planner produces both, and Today interleaves them.
   */
  workspace_id?: string | null;
  /** Who is responsible. Only meaningful on a workspace task. */
  assignee_id?: string | null;
  tags: Tag[];
  /** One calm line: why this priority/time/deadline. */
  reasoning: string | null;
  sort_order: number;
  created_at: string;
  /**
   * Client-only: a quick-add placeholder awaiting its parse from the server.
   *
   * Never persisted — `toTaskRow` doesn't read it — and never set on a task
   * that came from the database. It exists so a smart-add can show a row the
   * instant you hit enter, instead of an empty gap while the model thinks.
   */
  pending?: boolean;
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
  | "workspaces"
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
/**
 * Selectable planning models.
 *
 * These strings are stored in `user_settings.model` and constrained by a CHECK
 * — widening this type means widening that constraint in the same commit, or
 * every save of a new value fails. See 0009_model_choices.sql.
 */
export type ModelChoice =
  | "opus"
  | "sonnet"
  | "haiku"
  | "gpt-5"
  | "gpt-5-mini";

export const MODEL_CHOICES: ReadonlyArray<{
  value: ModelChoice;
  label: string;
  note: string;
  /** Shown as a group heading in the picker. */
  vendor: "Claude" | "OpenAI";
  /** Team-only. Free users see it locked; the server refuses to run it. */
  paid: boolean;
}> = [
  {
    value: "opus",
    label: "Opus 4.8",
    note: "Best judgement about what to cut. Slower.",
    vendor: "Claude",
    paid: true,
  },
  {
    value: "sonnet",
    label: "Sonnet 5",
    note: "Balanced, and the default.",
    vendor: "Claude",
    paid: false,
  },
  {
    value: "haiku",
    label: "Haiku 4.5",
    note: "Fastest. Good for short dumps.",
    vendor: "Claude",
    paid: false,
  },
  {
    value: "gpt-5",
    label: "GPT-5",
    note: "Capable and even-handed.",
    vendor: "OpenAI",
    paid: true,
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 mini",
    note: "Quick and cheap.",
    vendor: "OpenAI",
    paid: false,
  },
] as const;

/**
 * The Team-only planning models, derived from MODEL_CHOICES so the two can't
 * drift. Opus and GPT-5 are the expensive, high-judgement models; the rest are
 * free. Enforced server-side in `loadModelChoice` (the source of truth) and
 * mirrored by the picker only to decide what to lock.
 */
export const PAID_MODELS: ReadonlySet<ModelChoice> = new Set(
  MODEL_CHOICES.filter((m) => m.paid).map((m) => m.value),
);

export function isPaidModel(choice: ModelChoice): boolean {
  return PAID_MODELS.has(choice);
}

export interface UserSettings {
  language: AppLanguage;
  /** IANA name, e.g. "Europe/Kyiv". */
  timezone: string;
  model: ModelChoice;
  /** Hours ahead of a task's start to warn about it. */
  reminder_lead_hours: number;
  reminders_enabled: boolean;
  /**
   * True once first-run language selection has happened.
   *
   * Separate from `language`, which has a default and therefore cannot tell
   * "chose English" from "never asked".
   */
  onboarded: boolean;
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
  /**
   * Whether a Telegram chat is linked. Just the boolean — the chat id itself
   * stays server-side, since the client only ever needs to show connected or
   * not and offer to disconnect.
   */
  telegram_linked: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: "en",
  timezone: "UTC",
  model: "sonnet",
  reminder_lead_hours: 2,
  reminders_enabled: true,
  // Fixtures skip onboarding: a keyless dev environment should land on the
  // dashboard, not on a language dialog whose choice it cannot persist.
  onboarded: true,
  display_name: null,
  avatar_url: null,
  feed_token: null,
  telegram_linked: false,
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

/* --------------------------------------------------------------- workspaces */

export type WorkspaceRole = "admin" | "member";

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  /** The signed-in user's role here. Derived on load, not a column. */
  role: WorkspaceRole;
  /** How many people are in it, for the seats indicator. */
  member_count: number;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  /** Resolved from the profile where available; the email is the fallback. */
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  /** Null for a shareable link; set for one addressed to a person. */
  email: string | null;
  token: string;
  role: WorkspaceRole;
  max_uses: number;
  uses: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

/**
 * Stripe's own vocabulary, copied verbatim.
 *
 * Which of these count as "paid" is decided in one place — `has_active_plan()`
 * in SQL — because that is what actually gates workspace creation. The client
 * mirrors it for what to *show*, never for what to *allow*.
 */
export type PlanStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

export interface Subscription {
  status: PlanStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_customer: boolean;
}

export const FREE_PLAN: Subscription = {
  status: "inactive",
  current_period_end: null,
  cancel_at_period_end: false,
  has_customer: false,
};

/** Team plan seat ceiling. Must match `max_workspace_members()` in SQL. */
export const MAX_WORKSPACE_MEMBERS = 10;

/**
 * True when the plan currently entitles the user.
 *
 * Mirrors `has_active_plan()`. Used only to decide what the UI *offers* —
 * every actual grant is enforced by the database, so a client that got this
 * wrong would show a misleading button, not hand out a free plan.
 */
export function isEntitled(subscription: Subscription): boolean {
  if (subscription.status === "active" || subscription.status === "trialing") {
    return true;
  }
  if (subscription.status === "past_due" && subscription.current_period_end) {
    return new Date(subscription.current_period_end) > new Date();
  }
  return false;
}
