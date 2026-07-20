import { withStartTimes } from "./schedule";
import type { Reminder, Task, UserSettings } from "./types";

/**
 * Which tasks are late, and which are about to start.
 *
 * Derived from the same `withStartTimes` projection the Today timeline renders,
 * so a row's overdue badge can never disagree with the clock printed beside it.
 * Computing it separately would let the two drift apart on any change to how
 * the day is laid out.
 *
 * Everything here is a pure function of (tasks, date, minute). No timers, no
 * state — the caller decides how often to re-evaluate, which keeps this
 * testable and keeps the notion of "now" in one place.
 */

/** Minutes from midnight, in the viewer's local time. */
export function minutesNow(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * A task is only late once it was actually supposed to have *finished*.
 *
 * Flagging at the start time would mark a task overdue the moment it comes up,
 * while the person is sitting down to do it — technically true, useless, and
 * noisy enough that the badge would be ignored.
 */
export function buildReminders({
  tasks,
  today,
  now,
  settings,
}: {
  tasks: Task[];
  today: string;
  now: number;
  settings: UserSettings;
}): Reminder[] {
  if (!settings.reminders_enabled) return [];

  const scheduled = tasks
    .filter((t) => t.plan_date === today && t.status === "today")
    .sort((a, b) => a.sort_order - b.sort_order);

  const leadMinutes = settings.reminder_lead_hours * 60;
  const timed = withStartTimes(scheduled);
  const reminders: Reminder[] = [];

  for (const { task, start, end } of timed) {
    if (end <= now) {
      reminders.push({
        id: task.id,
        kind: "overdue",
        task,
        start,
        minutesUntil: start - now,
      });
      continue;
    }

    // Upcoming warnings are high-priority only. A reminder for every task in
    // the next two hours is just the timeline again, and the point of the
    // warning is that it means something when it appears.
    const withinWindow = start >= now && start - now <= leadMinutes;
    if (withinWindow && task.priority === "high") {
      reminders.push({
        id: task.id,
        kind: "soon",
        task,
        start,
        minutesUntil: start - now,
      });
    }
  }

  // Overdue first, then by how soon — the most urgent thing is always on top.
  return reminders.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "overdue" ? -1 : 1;
    return a.minutesUntil - b.minutesUntil;
  });
}

/** Is this specific task past its scheduled finish? Drives the row badge. */
export function overdueIds(reminders: Reminder[]): Set<string> {
  return new Set(
    reminders.filter((r) => r.kind === "overdue").map((r) => r.id),
  );
}

/** "25m late", "1h 10m late", "in 40m". */
export function formatLateness(minutesUntil: number): string {
  const late = minutesUntil < 0;
  const total = Math.abs(minutesUntil);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const span = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  if (!late) return `in ${span}`;
  return `${span} late`;
}
