import type { BlockKey } from "@/lib/schedule";

/**
 * What a drop *means*, carried on the droppable rather than decided by the
 * component that reads it.
 *
 * The provider's `onDragEnd` is the one place that turns a drop into a store
 * mutation, so every drop zone declares its intent here and the resolver stays
 * a single `switch`. A new kind of target is a new case, not a new code path
 * threaded through three views.
 */
export type DropTarget =
  /** A calendar day. The task is scheduled onto it, keeping its time of day. */
  | { kind: "day"; date: string }
  /**
   * A part of one day (Morning/Afternoon/Evening). Same as `day`, but also
   * pins the task's start to the block — this is how "today must update time"
   * is expressed: drop into Afternoon and it starts when the afternoon does.
   */
  | { kind: "block"; date: string; blockKey: BlockKey }
  /** Tomorrow. The postpone gesture. */
  | { kind: "tomorrow" }
  /** Today. Pulls a deferred or inbox task onto the current day. */
  | { kind: "today" }
  /** The inbox. Strips the day, sending the task back to unscheduled. */
  | { kind: "inbox" };

/** dnd-kit stores arbitrary data on droppables as `unknown`; this narrows it. */
export function asDropTarget(data: unknown): DropTarget | null {
  if (!data || typeof data !== "object" || !("kind" in data)) return null;
  return data as DropTarget;
}

/**
 * Stable droppable ids, so two zones with the same intent don't collide.
 *
 * `day` doubles as the DOM id Upcoming scrolls to (`day-2026-07-21`), which is
 * why it uses a hyphen and no colon — one identifier for both the drag system
 * and `getElementById`.
 */
export const dropId = {
  day: (date: string) => `day-${date}`,
  /** The week-strip chip for a day. Same intent as `day`, distinct id — a day
   *  is a drop target twice (the strip and its section), and dnd-kit ids must
   *  be unique. */
  stripDay: (date: string) => `strip-${date}`,
  block: (date: string, block: BlockKey) => `block:${date}:${block}`,
  tomorrow: "postpone:tomorrow",
  // The mobile tab bar and the desktop sidebar are both always mounted (each
  // hidden at the other's breakpoint), so the two "Today" / "Inbox" drop zones
  // must have distinct ids even though they share a target.
  today: "tab:today",
  inbox: "tab:inbox",
  navToday: "nav:today",
  navInbox: "nav:inbox",
} as const;
