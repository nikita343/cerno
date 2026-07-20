"use client";

import { deadlineLabel } from "@/lib/date";
import { taskDuration } from "@/lib/format";
import { labelColor } from "@/lib/labels";
import type { Task } from "@/lib/types";

import styles from "./TaskChip.module.css";

export interface TaskChipProps {
  task: Task;
  /** Today's ISO date, used to phrase the deadline pill relatively. */
  today: string;
  showReasoning?: boolean;
  showTag?: boolean;
  /** Renders the completed treatment: gray dot, muted strikethrough title. */
  done?: boolean;
  /** Makes the whole chip a button — used where tapping reveals reasoning. */
  onClick?: () => void;
}

/**
 * The atomic task row. Everything else composes this.
 *
 * A task carries a `tags[]` array to match the DB schema, but the chip only
 * ever renders the first one — the design has room for a single label pill.
 */
export function TaskChip({
  task,
  today,
  showReasoning = false,
  showTag = true,
  done,
  onClick,
}: TaskChipProps) {
  const isDone = done ?? task.status === "done";
  const isHigh = task.priority === "high" && !isDone;
  const tag = showTag ? task.tags[0] : undefined;
  const reasoning = showReasoning ? task.reasoning : null;

  const content = (
    <>
      <div className={styles.row}>
        <span
          className={styles.dot}
          data-high={isHigh || undefined}
          style={{ background: isHigh ? "var(--accent)" : "var(--dot-neutral)" }}
        />
        <span className={styles.title} data-done={isDone || undefined}>
          {task.title}
        </span>
        <span className={styles.spacer} />
        <span className={styles.time}>{taskDuration(task.estimated_minutes)}</span>

        {task.deadline && (
          <span className={styles.pill}>
            due {deadlineLabel(task.deadline, today)}
          </span>
        )}

        {tag && (
          <span className={styles.pill}>
            <span
              className={styles.tagDot}
              style={{ background: labelColor(tag) }}
            />
            {tag}
          </span>
        )}
      </div>

      {reasoning && (
        <div className={styles.reasoning}>
          <span className={styles.rule} />
          <span className={styles.reasoningText}>{reasoning}</span>
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={styles.chip} onClick={onClick} data-interactive>
        {content}
      </button>
    );
  }

  return <div className={styles.chip}>{content}</div>;
}
