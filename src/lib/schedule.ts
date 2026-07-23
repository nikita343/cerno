import type { Task } from "./types";

/**
 * Clock placement for a planned day.
 *
 * A task carries `suggested_start` (HH:MM) only when something about it is
 * genuinely time-bound — a meeting, a call someone has to be awake for. Most
 * tasks aren't, and the model correctly returns null for them.
 *
 * Those without one are never put on the clock. Cerno used to lay them out
 * end-to-end from the start of the day as a "roughly when this lands"
 * projection, but a fabricated time reads as a real commitment: a task due at
 * 18:00 with no stated start would get stamped 09:00–11:00 and could show as
 * overdue hours before its actual deadline. So the schedule only ever shows
 * what the task itself claims — see `splitByTime`.
 */

/** Working day starts at 09:00. */
export const DAY_START_MINUTES = 9 * 60;

/** Anything spilling past this is clamped so the timeline can't run to 03:00. */
export const DAY_END_MINUTES = 24 * 60 - 1;

export type BlockKey = "morning" | "afternoon" | "evening";

export interface TimeBlock {
  key: BlockKey;
  label: string;
  /** Inclusive start, exclusive end, in minutes from midnight. */
  from: number;
  to: number;
}

/**
 * `label` is an English fallback. Views render `t.today[block.key]` instead —
 * this module is imported outside React (the iCal feed, tests) and can't call
 * a hook, so the string stays here for those callers.
 */
export const TIME_BLOCKS: readonly TimeBlock[] = [
  { key: "morning", label: "Morning", from: 0, to: 12 * 60 },
  { key: "afternoon", label: "Afternoon", from: 12 * 60, to: 17 * 60 },
  { key: "evening", label: "Evening", from: 17 * 60, to: 24 * 60 },
] as const;

/** `"14:30"` -> `870`. Returns null for null/malformed input. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** `870` -> `"14:30"`. 24-hour, zero-padded, so times align in a column. */
export function formatClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_END_MINUTES, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function blockFor(startMinutes: number): TimeBlock {
  return (
    TIME_BLOCKS.find((b) => startMinutes >= b.from && startMinutes < b.to) ??
    TIME_BLOCKS[TIME_BLOCKS.length - 1]
  );
}

export interface TimedTask {
  task: Task;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** Always true — every `TimedTask` now carries a real, task-given time. Kept
   *  so `data-fixed` styling and existing callers don't need to change. */
  fixed: boolean;
}

/**
 * Splits tasks into those with a real clock time and those without.
 *
 * `timed` is what belongs on a schedule; `untimed` — a deadline with no stated
 * hour, "someday this week" — has nowhere on a clock to honestly go and is the
 * caller's job to render as its own plain group, with no time shown.
 */
export function splitByTime<T extends Task>(
  tasks: T[],
): { timed: T[]; untimed: T[] } {
  const timed: T[] = [];
  const untimed: T[] = [];
  for (const task of tasks) {
    (parseClock(task.suggested_start) !== null ? timed : untimed).push(task);
  }
  return { timed, untimed };
}

/**
 * Projects tasks that have an explicit `suggested_start` onto the clock.
 *
 * Callers pass `splitByTime(...).timed` — anything without a real start is
 * filtered out defensively here too, so this can never fabricate one.
 */
export function withStartTimes(tasks: Task[]): TimedTask[] {
  return tasks.flatMap((task) => {
    const start = parseClock(task.suggested_start);
    if (start === null) return [];
    const end = Math.min(DAY_END_MINUTES, start + task.estimated_minutes);
    return [{ task, start, end, fixed: true }];
  });
}

export interface BlockGroup {
  block: TimeBlock;
  items: TimedTask[];
  /** Summed estimate of the block's tasks, in minutes. */
  minutes: number;
  /** Clock span actually covered, for the block's right-hand label. */
  from: number;
  to: number;
}

/** Buckets timed tasks into Morning/Afternoon/Evening, dropping empty blocks. */
export function groupIntoBlocks(timed: TimedTask[]): BlockGroup[] {
  return TIME_BLOCKS.map((block) => {
    // Order by clock within the block so the printed times always ascend. A
    // task with a fixed early time (e.g. a 17:00 pickup) must not appear below
    // work that spilled to 23:59 just because it sat later in plan order — that
    // reads as a rendering fault. Ties keep plan order (stable sort).
    const items = timed
      .filter((t) => blockFor(t.start).key === block.key)
      .sort((a, b) => a.start - b.start);
    return {
      block,
      items,
      // Only open work counts toward the subtotal, so the sum of the blocks
      // reconciles with the section total (which is also open-only). Done tasks
      // still render in the block, they just don't add to the "time to go".
      minutes: items
        .filter((t) => t.task.status !== "done")
        .reduce((n, t) => n + t.task.estimated_minutes, 0),
      from: items.length > 0 ? Math.min(...items.map((t) => t.start)) : block.from,
      to: items.length > 0 ? Math.max(...items.map((t) => t.end)) : block.to,
    };
  }).filter((g) => g.items.length > 0);
}
