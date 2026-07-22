"use client";

import { Avatar } from "@/components/auth/Avatar";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { deadlineLabel } from "@/lib/date";

import { useT } from "@/lib/i18n";
import { labelColor, labelDisplay } from "@/lib/labels";
import type { Task, UserProfile } from "@/lib/types";
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
  /**
   * Toggles completion from the checkbox on the left.
   *
   * Optional: views that show a task purely as a search or filter *result*
   * pass nothing and get a plain priority dot instead, because completing
   * something from a result list is not what that screen is for.
   */
  onToggleComplete?: () => void;
  /** Past its scheduled finish and still open. Set by the calling view. */
  overdue?: boolean;
  /** Renders the user's own note under the title. */
  showDescription?: boolean;
  /**
   * Name of the workspace this task belongs to, when worth showing.
   *
   * Passed in rather than looked up: the workspace screen already knows every
   * row is its own and passes nothing, while Today passes the name so a shared
   * task is distinguishable from a personal one.
   */
  workspaceName?: string | null;
  /**
   * Who the task is assigned to, shown as a small avatar. Only meaningful on a
   * workspace task; personal rows pass nothing and show no avatar.
   */
  assignee?: UserProfile | null;
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
  showPriority = true,
  done,
  onToggleComplete,
  overdue = false,
  showDescription = true,
  workspaceName = null,
  assignee = null,
}: TaskChipProps) {
  // Label colours are per-user data now, so the chip has to read them rather
  // than look them up in a constant. Subscribed shallowly: a recolour should
  // repaint the dot, but an unrelated store change should not.
  const labels = useAppStoreShallow((s) => s.labels);
  const t = useT();

  // Built per render rather than as a module constant, because the labels are
  // translated and a constant would freeze whichever language loaded first.
  const priorityLabel: Record<Task["priority"], string> = {
    high: t.today.high,
    medium: t.today.medium,
    low: t.today.low,
  };

  const isDone = done ?? task.status === "done";
  const isHigh = task.priority === "high" && !isDone;
  const isOverdue = overdue && !isDone;
  const tag = showTag ? task.tags[0] : undefined;
  const reasoning = showReasoning ? task.reasoning : null;

  const content = (
    <>
      <div className={styles.row}>
        {/* The checkbox takes the priority dot's place rather than sitting
            beside it: two small circles on one left edge read as related when
            they aren't. Priority survives as the ring colour, and in the
            HIGH/MED/LOW badge on the right. */}
        {onToggleComplete ? (
          <button
            type="button"
            className={styles.checkbox}
            data-priority={isDone ? "done" : task.priority}
            data-done={isDone || undefined}
            onClick={onToggleComplete}
            role="checkbox"
            aria-checked={isDone}
            aria-label={
              isDone
                ? `Mark "${task.title}" as not done`
                : `Mark "${task.title}" as done`
            }
          >
            <CheckIcon size="0.75rem" className={styles.checkboxTick} />
          </button>
        ) : (
          <span
            className={styles.dot}
            data-high={isHigh || undefined}
            data-priority={isDone ? "done" : task.priority}
          />
        )}
        <span className={styles.title} data-done={isDone || undefined}>
          {task.title}
        </span>
        <span className={styles.spacer} />

        {isOverdue && (
          <span className={styles.overdue} title="Past its scheduled time">
            <AlertIcon size="0.75rem" />
            {t.today.overdue}
          </span>
        )}

        {showPriority && (
          <span
            className={styles.priority}
            data-priority={task.priority}
            data-done={isDone || undefined}
          >
            {priorityLabel[task.priority]}
          </span>
        )}

        {/* The per-task estimate is deliberately not shown. It is a guess, and
            printing "90 min" next to every row gives it a precision it hasn't
            earned. The number still drives the timeline — it is what lays tasks
            onto the clock — it just isn't presented as fact. The block and day
            totals remain, because "does this fit" is the question the estimate
            is actually good enough to answer. */}

        {task.deadline && (
          <span className={styles.pill}>
            {t.today.due} {deadlineLabel(task.deadline, today)}
          </span>
        )}

        {/* Which workspace this belongs to, shown only when the surrounding
            screen isn't already one workspace. On Today a shared task looks
            identical to a personal one otherwise, which makes "is this mine or
            the team's" unanswerable at a glance. */}
        {workspaceName && (
          <span className={styles.pill} data-workspace title={`In ${workspaceName}`}>
            {workspaceName}
          </span>
        )}

        {tag && (
          <span className={styles.pill}>
            <span
              className={styles.tagDot}
              style={{ background: labelColor(labels, tag) }}
            />
            {labelDisplay(tag, t.labels)}
          </span>
        )}

        {/* The assignee, as a bare avatar at the end of the row. A name pill
            here would compete with the title on a phone; the face is enough to
            answer "whose is this" and the full name is in its tooltip. */}
        {assignee && (
          <span className={styles.assignee} title={`Assigned to ${assignee.name}`}>
            <Avatar profile={assignee} size="1.375rem" />
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

      {/* While a quick-add is being parsed the row is already visible, but its
          details (priority, tag, time) aren't real yet — this line says so, so
          the placeholder values don't read as the model's actual answer. */}
      {task.pending ? (
        <div className={styles.reasoning}>
          <span className={styles.rule} />
          <span className={styles.reasoningText}>{t.capture.planning}</span>
        </div>
      ) : (
        reasoning && (
          <div className={styles.reasoning}>
            <span className={styles.rule} />
            <span className={styles.reasoningText}>{reasoning}</span>
          </div>
        )
      )}
    </>
  );

  return (
    <div
      className={styles.chip}
      data-overdue={isOverdue || undefined}
      data-pending={task.pending || undefined}
    >
      {content}
    </div>
  );
}
