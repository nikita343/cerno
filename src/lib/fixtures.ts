import { addDays, todayISO } from "./date";
import type { DayPlan, Dump, Task, UserProfile } from "./types";

/**
 * Seed data lifted from the `renderVals()` blocks in the design files, but
 * anchored to the *current* date rather than the mockup's July 18 2026 so the
 * app always opens on a live-looking day.
 */

export const DEMO_USER: UserProfile = {
  name: "Mara Lindqvist",
  email: "mara@cerno.app",
  initials: "ML",
};

export const APP_VERSION = "1.0.0";

/** Default working capacity in minutes (DEVELOPMENT.md §6). */
export const DAY_CAPACITY_MINUTES = 480;

const SEED_DUMP_ID = "dump-seed";

export const SEED_DUMP_TEXT =
  "call the landlord about the leak, finish the deck for tuesday, buy groceries, gym at some point, reply to Anna, keep forgetting the dentist.";

/**
 * The six seed tasks: four scheduled today, two deferred — the exact split the
 * Today design shows, so the Deferred section renders on a cold open.
 */
export function seedTasks(today = todayISO()): Task[] {
  const createdAt = new Date().toISOString();
  const base = {
    dump_id: SEED_DUMP_ID,
    suggested_start: null,
    created_at: createdAt,
  };

  return [
    {
      ...base,
      id: "task-deck",
      title: "Finish the deck",
      priority: "high",
      estimated_minutes: 90,
      deadline: addDays(today, 2),
      status: "today",
      plan_date: today,
      tags: ["work"],
      reasoning: "Hard deadline Tuesday, highest stakes.",
      sort_order: 0,
    },
    {
      ...base,
      id: "task-landlord",
      title: "Call landlord about leak",
      priority: "high",
      estimated_minutes: 15,
      deadline: null,
      status: "today",
      plan_date: today,
      tags: ["home"],
      reasoning: "Leak is urgent, quick to clear.",
      sort_order: 1,
    },
    {
      ...base,
      id: "task-anna",
      title: "Reply to Anna",
      priority: "medium",
      estimated_minutes: 10,
      deadline: null,
      status: "today",
      plan_date: today,
      tags: ["comms"],
      reasoning: "Short reply, keeps things moving.",
      sort_order: 2,
    },
    {
      ...base,
      id: "task-groceries",
      title: "Buy groceries",
      priority: "medium",
      estimated_minutes: 40,
      deadline: null,
      status: "today",
      plan_date: today,
      tags: ["errand"],
      reasoning: "Fits the gap after focused work.",
      sort_order: 3,
    },
    {
      ...base,
      id: "task-gym",
      title: "Gym",
      priority: "low",
      estimated_minutes: 60,
      deadline: null,
      status: "deferred",
      plan_date: addDays(today, 1),
      tags: ["health"],
      reasoning: "No time pressure, parked for tomorrow.",
      sort_order: 4,
    },
    {
      ...base,
      id: "task-dentist",
      title: "Book the dentist",
      priority: "low",
      estimated_minutes: 10,
      deadline: null,
      status: "deferred",
      plan_date: addDays(today, 1),
      tags: ["health"],
      reasoning: "Low priority, fits better tomorrow.",
      sort_order: 5,
    },
  ];
}

export function seedDayPlan(today = todayISO()): DayPlan {
  return {
    id: "plan-seed",
    plan_date: today,
    summary:
      "A focused day — the deck is your anchor, with quick wins around it.",
    capacity_note:
      "6 things came in (~3h 45m). I planned 4 that fit today and parked 2 for tomorrow.",
    created_at: new Date().toISOString(),
  };
}

export function seedDump(): Dump {
  return {
    id: SEED_DUMP_ID,
    raw_text: SEED_DUMP_TEXT,
    source: "text",
    created_at: new Date().toISOString(),
  };
}
