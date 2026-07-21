"use client";

import type { Task } from "@/lib/types";

import { SwipeRow } from "./SwipeRow";
import { TaskChip } from "./TaskChip";
import { TaskMenu } from "./TaskMenu";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  /** Today's ISO date, for phrasing deadlines relatively. */
  today: string;
  /**
   * `HH:MM` to print above the card, or null to omit it.
   *
   * Null is how a view says "this repeats the row above" — the caller owns that
   * comparison, because only it knows what the previous row was.
   */
  clock: string | null;
  /** The time came from the task itself, not from laying it on the clock. */
  fixed?: boolean;
  overdue?: boolean;
  onToggle: () => void;
  /**
   * Takes the id rather than closing over it, to match `TaskMenu`. Views differ
   * in what they do with it: Today defers the delete so the row can animate
   * out, Upcoming deletes straight away.
   */
  onDelete: (id: string) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  /** Mid exit animation — the task outlives the click by one animation. */
  removing?: boolean;
  /**
   * Position in the list, which opts the row into the staggered entrance.
   * Omit it and the row simply appears.
   */
  index?: number;
}

/**
 * One task on a timeline: the time above, the card, and the ways into it.
 *
 * Extracted from Today and Upcoming, which had grown near-identical copies of
 * this — same grid, same time label, same swipe/menu wiring, same CSS down to
 * the byte. The copies had already drifted once: the `⋯` was hidden on touch in
 * Today and left visible in Upcoming, so a phone showed a permanent button
 * beside every upcoming row that was meant to have been replaced by the swipe.
 * Anything true of a task row belongs here now, so it can only be true in one
 * place.
 *
 * The three ways into the menu are deliberate and all live here: the `⋯` on a
 * pointer device, the swipe tray's **More**, and a tap on the card. Which of
 * them is available is a media query's business, not a view's.
 */
export function TaskRow({
  task,
  today,
  clock,
  fixed = false,
  overdue = false,
  onToggle,
  onDelete,
  menuOpen,
  onMenuOpenChange,
  removing = false,
  index,
}: TaskRowProps) {
  const isDone = task.status === "done";

  return (
    <li
      className={styles.row}
      data-grouped={clock === null || undefined}
      data-removing={removing || undefined}
      data-stagger={index !== undefined || undefined}
      style={index !== undefined ? ({ "--i": index } as React.CSSProperties) : undefined}
    >
      {clock !== null && (
        <span
          className={styles.time}
          data-fixed={fixed || undefined}
          data-overdue={overdue || undefined}
        >
          {clock}
        </span>
      )}

      <div className={styles.chipWrap}>
        <SwipeRow
          title={task.title}
          completed={isDone}
          onComplete={onToggle}
          onDelete={() => onDelete(task.id)}
          onMenu={() => onMenuOpenChange(true)}
        >
          <TaskChip
            task={task}
            today={today}
            overdue={overdue}
            onToggleComplete={onToggle}
          />
        </SwipeRow>
      </div>

      <div className={styles.actions}>
        {/* Delete lives in this menu so it can't be hit while reaching for the
            check, and so it can carry a confirmation. */}
        <TaskMenu
          task={task}
          today={today}
          onDelete={onDelete}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
        />
      </div>
    </li>
  );
}
