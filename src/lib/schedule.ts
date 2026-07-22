import type { Task } from "./types";

/**
 * Clock placement for a planned day.
 *
 * A task carries `suggested_start` (HH:MM) when something about it is genuinely
 * time-bound — a meeting, a call someone has to be awake for. Most tasks aren't,
 * and the model correctly returns null for them. So the schedule is *derived*:
 * anything with an explicit start keeps it, everything else is laid end-to-end
 * from the start of the working day in the order the planner chose.
 *
 * This is a projection, not a commitment. It answers "roughly when does this
 * land if I work down the list" — which is what the Today timeline shows.
 */

/** Working day starts at 09:00. */
export const DAY_START_MINUTES = 9 * 60;

/** Anything spilling past this is clamped so the timeline can't run to 03:00. */
const DAY_END_MINUTES = 24 * 60 - 1;

/**
 * Where the derived clock should start for a given day.
 *
 * Today lays unplanned work from *now* forward (clamped to no earlier than the
 * working-day start), so open tasks never land in the past and get flagged
 * overdue for no reason. Any other day starts from 09:00 — "now" is meaningless
 * for a day that isn't today.
 *
 * `nowMinutes` is 0 on the server (the clock is client-only), so this returns
 * the 09:00 baseline during SSR and the first client render, then re-derives to
 * the real time once the now-ticker updates — matching, so no hydration jump.
 */
export function derivedDayStart(
  date: string,
  today: string,
  nowMinutes: number,
): number {
  return date === today
    ? Math.max(DAY_START_MINUTES, nowMinutes)
    : DAY_START_MINUTES;
}

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
  /** True when the time came from the task itself rather than being derived. */
  fixed: boolean;
}

/**
 * Lays tasks onto a clock in list order.
 *
 * An explicit `suggested_start` is honoured even when it sits earlier than the
 * running cursor — a 10:00 call is at 10:00 whether or not the preceding work
 * has notionally finished. Moving it to keep the timeline tidy would be the
 * schedule lying about a commitment.
 */
export function withStartTimes(
  tasks: Task[],
  dayStart: number = DAY_START_MINUTES,
): TimedTask[] {
  let cursor = dayStart;

  return tasks.map((task) => {
    const explicit = parseClock(task.suggested_start);
    const start = explicit ?? cursor;
    const end = Math.min(DAY_END_MINUTES, start + task.estimated_minutes);
    cursor = Math.max(cursor, end);
    return { task, start, end, fixed: explicit !== null };
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
    const items = timed.filter((t) => blockFor(t.start).key === block.key);
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
