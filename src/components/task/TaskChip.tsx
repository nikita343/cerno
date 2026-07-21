"use client";

import { AlertIcon } from "@/components/icons";
import { deadlineLabel } from "@/lib/date";
import { taskDuration } from "@/lib/format";
import { labelColor } from "@/lib/labels";
import type { Task } from "@/lib/types";
import { useAppStoreShallow } from "@/store/StoreProvider";

import styles from "./TaskChip.module.css";

export interface TaskChipProps {
  task: Task;
  /** Today's ISO date, used to phrase the deadline pill relatively. */
  today: string;
  showReasoning?: boolean;
  showTag?: boolean;
  /** Renders the completed treatment: gray dot, muted strikethrough title. */
  done?: boolean;
  /** Hides the priority badge where the surrounding UI already conveys it. */
  showPriority?: boolean;
  /** Makes the whole chip a button — used where tapping reveals reasoning. */
  onClick?: () => void;
  /** Past its scheduled finish and still open. Set by the calling view. */
  overdue?: boolean;
  /** Renders the user's own note under the title. */
  showDescription?: boolean;
}

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

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
  showPriority = true,
  done,
  onClick,
  overdue = false,
  showDescription = true,
}: TaskChipProps) {
  // Label colours are per-user data now, so the chip has to read them rather
  // than look them up in a constant. Subscribed shallowly: a recolour should
  // repaint the dot, but an unrelated store change should not.
  const labels = useAppStoreShallow((s) => s.labels);

  const isDone = done ?? task.status === "done";
  const isHigh = task.priority === "high" && !isDone;
  const isOverdue = overdue && !isDone;
  const tag = showTag ? task.tags[0] : undefined;
  const reasoning = showReasoning ? task.reasoning : null;

  const content = (
    <>
      <div className={styles.row}>
        <span
          className={styles.dot}
          data-high={isHigh || undefined}
          data-priority={isDone ? "done" : task.priority}
        />
        <span className={styles.title} data-done={isDone || undefined}>
          {task.title}
        </span>
        <span className={styles.spacer} />

        {isOverdue && (
          <span className={styles.overdue} title="Past its scheduled time">
            <AlertIcon size="0.75rem" />
            Overdue
          </span>
        )}

        {showPriority && (
          <span
            className={styles.priority}
            data-priority={task.priority}
            data-done={isDone || undefined}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}

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
              style={{ background: labelColor(labels, tag) }}
            />
            {tag}
          </span>
        )}
      </div>

      {/* The user's own note, above the AI's reasoning: what you wrote outranks
          what Cerno inferred. Clamped to two lines so a long note can't turn
          the row into a paragraph — the full text is in the edit dialog. */}
      {showDescription && task.description && (
        <p className={styles.description} data-done={isDone || undefined}>
          {task.description}
        </p>
      )}

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
      <button
        type="button"
        className={styles.chip}
        onClick={onClick}
        data-interactive
        data-overdue={isOverdue || undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={styles.chip} data-overdue={isOverdue || undefined}>
      {content}
    </div>
  );
}
