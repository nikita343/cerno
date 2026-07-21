import { addDays, deadlineLabel, toISODate, todayISO } from "./date";
import { totalDuration } from "./format";
import { DAY_CAPACITY_MINUTES } from "./fixtures";
import { newId } from "./id";
import {
  DEFAULT_LABELS,
  type DayPlan,
  type Dump,
  type PlanResult,
  type Priority,
  type Tag,
  type Task,
} from "./types";

/**
 * Mock planner — phase 1 stand-in for `POST /api/plan`.
 *
 * It deliberately implements the *same contract* as the Claude transform in
 * DEVELOPMENT.md §6: split a messy dump into tasks, estimate effort, assign one
 * tag from the fixed taxonomy, fit what it can into the day's capacity, and
 * defer the rest with a short reason. When the real endpoint lands in phase 2,
 * `planDump` is replaced by a fetch and nothing downstream changes.
 *
 * The heuristics below are keyword rules, not intelligence. They exist so the
 * dump → thinking → Today loop is fully clickable with no backend.
 */

const THINKING_DELAY_MS = 1500;

interface PlanInput {
  dumpText: string;
  source: "text" | "voice";
  /** ISO date to plan against. Injected so tests and SSR stay deterministic. */
  today?: string;
  capacityMinutes?: number;
  /**
   * Tasks that are still outstanding when the dump arrives — today's open
   * items and anything previously parked.
   *
   * They are replanned alongside the new items rather than left untouched. A
   * dump is a fresh planning pass over everything on your plate, so leaving
   * old deferrals out would both ignore real work and make the capacity note
   * disagree with the Deferred list it sits above.
   */
  carryIn?: Task[];
  /**
   * The user's label names. Defaults are used when absent — the client-side
   * offline fallback has no way to fetch them.
   */
  labelNames?: string[];
}

/* -------------------------------------------------------------------------- */
/* Keyword tables                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Keyed by the default label names.
 *
 * Labels are user-defined, so these keywords only help a user who kept the
 * defaults. `detectTag` handles the rest: it matches the user's own names
 * first, consults this table only for labels they actually have, and otherwise
 * falls back to their first label. There is no useful way to guess keywords for
 * a label named "gardening" — and the AI path, which is the one that matters,
 * gets the real list.
 */
const TAG_KEYWORDS: Record<string, string[]> = {
  work: [
    "deck", "slide", "report", "email client", "meeting", "presentation",
    "deploy", "review", "ship", "spec", "invoice", "client", "standup",
    "roadmap", "pitch", "draft", "code", "bug", "launch", "hire", "interview",
  ],
  home: [
    "landlord", "leak", "clean", "laundry", "dishes", "tidy", "rent",
    "plumber", "fix", "trash", "bins", "vacuum", "repair", "boiler", "kitchen",
  ],
  errand: [
    "groceries", "shop", "buy", "pick up", "post", "package", "bank", "return",
    "collect", "drop off", "car", "petrol", "pharmacy", "market",
  ],
  comms: [
    "reply", "call", "text", "message", "email", "ping", "follow up",
    "respond", "answer", "write back", "catch up", "ring",
  ],
  health: [
    "gym", "run", "walk", "dentist", "doctor", "yoga", "workout", "stretch",
    "therapy", "meditate", "sleep", "physio", "appointment", "swim",
  ],
};

const HIGH_PRIORITY_HINTS = [
  "urgent", "asap", "today", "deadline", "must", "critical", "overdue",
  "important", "leak", "broken", "emergency", "before", "final",
];

const LOW_PRIORITY_HINTS = [
  "sometime", "at some point", "eventually", "maybe", "someday", "if i can",
  "whenever", "no rush", "nice to have",
];

/** Rough effort estimates keyed by the verb or noun that dominates the item. */
const DURATION_HINTS: Array<[RegExp, number]> = [
  [/\b(deck|presentation|slides|report|proposal)\b/i, 90],
  [/\b(write|draft|design|build|code|plan)\b/i, 60],
  [/\b(gym|workout|run|swim|yoga)\b/i, 60],
  [/\b(groceries|shop|shopping|market)\b/i, 40],
  [/\b(clean|laundry|tidy|vacuum)\b/i, 30],
  [/\b(meeting|review|catch up|interview)\b/i, 30],
  [/\b(call|ring|phone)\b/i, 15],
  [/\b(reply|respond|text|message|email|ping)\b/i, 10],
  [/\b(book|schedule|order|pay|send)\b/i, 10],
];

const DEFAULT_MINUTES = 30;

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

/* -------------------------------------------------------------------------- */
/* Fragment extraction                                                        */
/* -------------------------------------------------------------------------- */

/** Split a dump into candidate items on commas, newlines, semicolons, "and". */
function splitFragments(text: string): string[] {
  return text
    .split(/[\n;•]|,(?![^(]*\))|\.(?=\s|$)|\band then\b|\balso\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

const LEADING_FILLER =
  /^(i\s+)?(need to|have to|should|must|want to|gotta|got to|remember to|keep forgetting( to)?|don'?t forget to|make sure to|todo:?|and)\s+/i;

/** Strip filler, trim to <= 8 words, sentence-case. */
function toTitle(fragment: string): string {
  let t = fragment.replace(LEADING_FILLER, "").trim();

  // Drop time and deadline phrasing — both live in structured fields, so
  // repeating them in the title is noise.
  t = t
    // "…by friday", "…for tuesday", and a bare trailing "…tomorrow".
    .replace(
      /\s+((by|before|on|due|for)\s+)?(today|tonight|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i,
      "",
    )
    // "spend 45 min on the deck" -> "the deck"; "2 hours of code review" -> "code review".
    .replace(/^(spend\s+)?\d{1,3}\s*(min|minute|minutes|m|h|hr|hrs|hour|hours)\b\s*(of|on)?\s*/i, "")
    // A duration tucked mid-phrase: "review the deck for 30 min".
    .replace(/\s+(for\s+)?\d{1,3}\s*(min|minute|minutes|hour|hours|hrs?)\b/i, "")
    .replace(/\s+(at some point|sometime|eventually|asap|urgently|if i can|no rush)\b.*$/i, "")
    .replace(/\s+(please|thanks)\s*$/i, "")
    .trim();

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) t = words.slice(0, 8).join(" ");
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function detectTag(fragment: string, labelNames: string[]): Tag {
  const available =
    labelNames.length > 0 ? labelNames : DEFAULT_LABELS.map((l) => l.name);
  const lower = fragment.toLowerCase();

  // A label the person named themselves, mentioned outright ("gardening: prune
  // the roses"). Their own vocabulary beats any table we could ship.
  const named = available.find((name) => {
    const n = name.trim().toLowerCase();
    return n.length > 2 && lower.includes(n);
  });
  if (named) return named;

  // Keyword scoring, restricted to labels this user actually has — scoring a
  // label they deleted would produce a tag nothing can render.
  let best: string | null = null;
  let bestScore = 0;
  for (const name of available) {
    const words = TAG_KEYWORDS[name.trim().toLowerCase()];
    if (!words) continue;
    const score = words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best ?? available[0];
}

function detectMinutes(fragment: string): number {
  // An explicit duration in the dump always wins.
  const explicit = fragment.match(/\b(\d{1,3})\s*(min|minute|minutes|m)\b/i);
  if (explicit) return Math.min(480, Number(explicit[1]));
  const hours = fragment.match(/\b(\d{1,2})\s*(h|hr|hrs|hour|hours)\b/i);
  if (hours) return Math.min(480, Number(hours[1]) * 60);

  for (const [pattern, minutes] of DURATION_HINTS) {
    if (pattern.test(fragment)) return minutes;
  }
  return DEFAULT_MINUTES;
}

function detectDeadline(fragment: string, today: string): string | null {
  const lower = fragment.toLowerCase();
  if (/\b(today|tonight)\b/.test(lower)) return today;
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1);
  if (/\bnext week\b/.test(lower)) return addDays(today, 7);

  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(lower)) {
      // The next occurrence of that weekday, strictly ahead of today.
      const todayDow = new Date(
        Number(today.slice(0, 4)),
        Number(today.slice(5, 7)) - 1,
        Number(today.slice(8, 10)),
      ).getDay();
      let delta = i - todayDow;
      if (delta <= 0) delta += 7;
      return addDays(today, delta);
    }
  }
  return null;
}

/**
 * Splits a detected date into "do it on this day" vs "finish it by this day".
 *
 * The preposition carries the whole distinction: "massage on Sunday" names the
 * day to do it, "deck by Friday" names a limit. Treating both as a deadline is
 * what puts a Sunday task on today's plan.
 *
 * Returns `[planDate, deadline]` — at most one is ever non-null.
 */
function detectDates(
  fragment: string,
  today: string,
): [planDate: string | null, deadline: string | null] {
  const date = detectDeadline(fragment, today);
  if (!date) return [null, null];

  // "by"/"before"/"due" mark a limit. A bare weekday or "on"/"at" is a choice
  // of day, which is also the more common phrasing, so it's the default.
  const isLimit = /\b(by|before|due|deadline)\b/i.test(fragment);
  if (isLimit) return [null, date];
  return [date > today ? date : null, null];
}

/** `HH:MM` from "at 11", "11:00", "2pm". Null when no clock time is stated. */
function detectStartTime(fragment: string): string | null {
  const match = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(fragment);
  if (!match) return null;
  // Bare small numbers are usually durations or counts, not clock times.
  if (!match[2] && !match[3]) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (hours > 23 || minutes > 59) return null;
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function detectPriority(
  fragment: string,
  deadline: string | null,
  today: string,
): Priority {
  const lower = fragment.toLowerCase();
  if (LOW_PRIORITY_HINTS.some((h) => lower.includes(h))) return "low";
  if (HIGH_PRIORITY_HINTS.some((h) => lower.includes(h))) return "high";
  if (deadline) {
    // Anything due within two days is high.
    return deadline <= addDays(today, 2) ? "high" : "medium";
  }
  return "medium";
}

function buildReasoning(
  priority: Priority,
  minutes: number,
  deadline: string | null,
  today: string,
): string {
  if (deadline) {
    const when = deadlineLabel(deadline, today);
    return priority === "high"
      ? `Due ${when}, so it leads the day.`
      : `Due ${when}, there is still room before then.`;
  }
  if (priority === "high") return "Urgent, and quick to clear.";
  if (minutes <= 15) return "Small enough to be an easy win.";
  if (minutes >= 60) return "Needs a real block of focus.";
  return "No fixed deadline, fits the middle of the day.";
}

/* -------------------------------------------------------------------------- */
/* Ordering & capacity                                                        */
/* -------------------------------------------------------------------------- */

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Heavier, higher-priority work earlier; quick wins after the anchor for
 * momentum. Within `high` the longest item leads (it is the anchor); within
 * `medium`/`low` the shortest leads so the day picks up pace.
 */
function orderForDay(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    return a.priority === "high"
      ? b.estimated_minutes - a.estimated_minutes
      : a.estimated_minutes - b.estimated_minutes;
  });
}

function deferralReason(task: Task): string {
  if (task.priority === "low") return "Low priority, fits better tomorrow.";
  if (task.estimated_minutes >= 60)
    return "Too big for what is left of today.";
  return "No time pressure, parked for tomorrow.";
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Synchronous core, so it stays unit-testable without timers. */
export function buildPlan({
  dumpText,
  source,
  today = todayISO(),
  capacityMinutes = DAY_CAPACITY_MINUTES,
  carryIn = [],
  labelNames = [],
}: PlanInput): PlanResult {
  const createdAt = new Date().toISOString();
  const dumpId = newId();

  const dump: Dump = {
    id: dumpId,
    raw_text: dumpText,
    source,
    created_at: createdAt,
  };

  // Carried-over titles seed the dedupe set, so re-dumping something already
  // on the list updates nothing rather than creating a twin.
  const seen = new Set(carryIn.map((t) => t.title.toLowerCase()));
  const parsed: Task[] = [];

  for (const fragment of splitFragments(dumpText)) {
    const title = toTitle(fragment);
    if (!title) continue;

    // Merge duplicates, as the real prompt instructs the model to do.
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const [planDate, deadline] = detectDates(fragment, today);
    const priority = detectPriority(fragment, deadline, today);
    const minutes = detectMinutes(fragment);

    parsed.push({
      id: newId(),
      dump_id: dumpId,
      title,
      // The planner never writes a description — it is the user's own note.
      description: null,
      priority,
      estimated_minutes: minutes,
      deadline,
      suggested_start: detectStartTime(fragment),
      status: "today",
      plan_date: planDate ?? today,
      tags: [detectTag(fragment, labelNames)],
      reasoning: buildReasoning(priority, minutes, deadline, today),
      sort_order: parsed.length,
      created_at: createdAt,
    });
  }

  // Fit what we can into the day; park the rest with a reason. Carried-over
  // work is planned on equal footing with the new items.
  const all = [...carryIn, ...parsed];

  // Work pinned to a future day is scheduled, just not for today — it must not
  // compete for today's capacity, or it could be "deferred" onto tomorrow and
  // silently lose the day the person actually named.
  const later = all.filter((t) => t.plan_date !== null && t.plan_date > today);
  const ordered = orderForDay(all.filter((t) => !later.includes(t)));

  const scheduled: Task[] = [];
  const deferred: Task[] = [];
  let used = 0;

  for (const task of ordered) {
    if (used + task.estimated_minutes <= capacityMinutes) {
      used += task.estimated_minutes;
      // A carried-over task may arrive as `deferred`; landing it on the plan
      // has to reset both status and date.
      scheduled.push({
        ...task,
        status: "today",
        plan_date: today,
        sort_order: scheduled.length,
      });
    } else {
      deferred.push({
        ...task,
        status: "deferred",
        plan_date: addDays(today, 1),
        reasoning: deferralReason(task),
        sort_order: deferred.length,
      });
    }
  }

  const newMinutes = parsed.reduce((n, t) => n + t.estimated_minutes, 0);

  const dayPlan: DayPlan = {
    id: newId(),
    plan_date: today,
    summary: buildSummary(scheduled),
    capacity_note: buildCapacityNote({
      newCount: parsed.length,
      newMinutes,
      carriedCount: carryIn.length,
      scheduledCount: scheduled.length,
      laterCount: later.length,
      deferredCount: deferred.length,
    }),
    created_at: createdAt,
  };

  return {
    dump,
    tasks: [
      ...scheduled,
      ...later.map((t, i) => ({ ...t, status: "today" as const, sort_order: i })),
      ...deferred,
    ],
    dayPlan,
  };
}

function buildSummary(scheduled: Task[]): string {
  if (scheduled.length === 0) return "Nothing scheduled — the day is yours.";
  const anchor = scheduled[0];
  if (scheduled.length === 1) {
    return `One thing today — ${anchor.title.toLowerCase()} has your full attention.`;
  }
  const heavy = scheduled.filter((t) => t.estimated_minutes >= 60).length;
  if (heavy >= 2) {
    return `A heavy day — ${anchor.title.toLowerCase()} first, then hold the line.`;
  }
  return `A focused day — ${anchor.title.toLowerCase()} is your anchor, with quick wins around it.`;
}

/**
 * The Today sub-line. Counts always describe the plan that is actually on
 * screen, so `scheduledCount` and `deferredCount` reconcile with the Scheduled
 * and Deferred sections beneath it.
 */
function buildCapacityNote({
  newCount,
  newMinutes,
  carriedCount,
  scheduledCount,
  laterCount,
  deferredCount,
}: {
  newCount: number;
  newMinutes: number;
  carriedCount: number;
  scheduledCount: number;
  laterCount: number;
  deferredCount: number;
}): string {
  const things =
    newCount === 1
      ? `1 thing came in (~${totalDuration(newMinutes)})`
      : `${newCount} things came in (~${totalDuration(newMinutes)})`;

  const opener =
    carriedCount > 0
      ? `${things}, on top of ${carriedCount} already open.`
      : `${things}.`;

  // Mirrors the AI route's note: a clause only appears when its bucket is
  // non-empty, so the header can never claim rows that aren't rendered.
  const clauses: string[] = [];
  if (deferredCount > 0 || laterCount > 0) {
    clauses.push(`I planned ${scheduledCount} that fit today`);
    if (laterCount > 0) clauses.push(`set ${laterCount} for the day you asked for`);
    if (deferredCount > 0) clauses.push(`parked ${deferredCount} for tomorrow`);
  }

  if (clauses.length === 0) return `${opener} All of it fits today.`;
  const last = clauses.pop();
  return clauses.length > 0
    ? `${opener} ${clauses.join(", ")} and ${last}.`
    : `${opener} ${last}.`;
}

/**
 * Parses a single phrase into one task — the local half of smart add.
 *
 * Used as the fallback when `/api/tasks/parse` has no API key behind it.
 */
export function parseSingleTask(
  text: string,
  today = todayISO(),
  labelNames: string[] = [],
): Task {
  const title = toTitle(text.trim()) || text.trim().slice(0, 60);
  const [planDate, deadline] = detectDates(text, today);
  const priority = detectPriority(text, deadline, today);
  const minutes = detectMinutes(text);

  return {
    id: newId(),
    dump_id: null,
    title,
    description: null,
    priority,
    estimated_minutes: minutes,
    deadline,
    suggested_start: detectStartTime(text),
    status: "today",
    plan_date: planDate ?? today,
    tags: [detectTag(text, labelNames)],
    reasoning: buildReasoning(priority, minutes, deadline, today),
    sort_order: 0,
    created_at: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Server-backed planning                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Calls `POST /api/plan`, which runs the Claude transform server-side.
 *
 * Two layers of graceful degradation, so the core loop never hard-fails:
 *   1. No API key configured — the route itself answers with the heuristic.
 *   2. Route unreachable (offline, 5xx) — we fall back locally here.
 *
 * A 4xx is *not* retried locally: that means the request was rejected, and
 * silently producing a different answer would hide a real bug.
 */
export async function planDump(input: PlanInput): Promise<PlanResult> {
  const {
    dumpText,
    source,
    today = todayISO(),
    capacityMinutes = DAY_CAPACITY_MINUTES,
    carryIn = [],
  } = input;

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dumpText,
        source,
        today,
        capacityMinutes,
        carryIn,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      }),
    });

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "That dump was rejected.");
      }
      throw new ServerUnavailableError();
    }

    return (await response.json()) as PlanResult;
  } catch (error) {
    if (error instanceof Error && !(error instanceof ServerUnavailableError)) {
      // A rejected request is a real error — surface it.
      if (!isNetworkError(error)) throw error;
    }
    // Offline or the route fell over: plan locally so the loop still closes.
    const result = buildPlan(input);
    await new Promise((resolve) => setTimeout(resolve, THINKING_DELAY_MS));
    return result;
  }
}

class ServerUnavailableError extends Error {}

function isNetworkError(error: Error): boolean {
  return error instanceof TypeError || error.name === "TypeError";
}

/**
 * Calls `POST /api/tasks/parse` for smart add, falling back to the local
 * heuristic parser if the route is unreachable.
 */
export async function smartAddTask(
  text: string,
  today = todayISO(),
  /** Only used by the offline fallback — the route reads them server-side. */
  labelNames: string[] = [],
  /** Adds to a workspace rather than the caller's own list. */
  workspaceId: string | null = null,
  /** Who the task is for, when it's a workspace task. Null means unassigned. */
  assigneeId: string | null = null,
  /** The id the caller already persisted a placeholder under, if any. */
  taskId: string | null = null,
): Promise<Task> {
  try {
    const response = await fetch("/api/tasks/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
        workspaceId,
        assigneeId,
        taskId,
      }),
    });
    if (!response.ok) throw new ServerUnavailableError();
    const body = (await response.json()) as { task: Task };
    return body.task;
  } catch {
    // Offline fallback. The id, workspace and assignee are all carried so the
    // task keeps its already-persisted row and lands in the right list.
    return {
      ...parseSingleTask(text, today, labelNames),
      ...(taskId ? { id: taskId } : {}),
      workspace_id: workspaceId,
      assignee_id: assigneeId,
    };
  }
}

/** Guard for the empty/junk dump path — no API call, friendly empty state. */
export function isPlannableDump(text: string): boolean {
  return text.trim().length >= 3;
}

export { toISODate };
