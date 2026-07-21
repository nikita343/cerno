"use client";

import { PlusIcon } from "@/components/icons";
import { SmartAddBar } from "@/components/task/SmartAddBar";
import { TaskChip } from "@/components/task/TaskChip";
import { pluralize } from "@/lib/format";
import { inboxTasks } from "@/store/createAppStore";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./InboxView.module.css";
import view from "./View.module.css";

export function InboxView() {
  const today = useAppStore((s) => s.today);
  const tasks = useAppStoreShallow((s) => inboxTasks(s.tasks));
  const lastDump = useAppStore((s) => s.dumps[0]);
  const completeTask = useAppStore((s) => s.completeTask);
  const moveToToday = useAppStore((s) => s.moveToToday);
  const openCapture = useAppStore((s) => s.openCapture);

  const fromLastDump = lastDump
    ? tasks.filter((t) => t.dump_id === lastDump.id).length
    : 0;

  return (
    <div className={view.view}>
      <div className={view.titleRow}>
        <h1 className={view.h1}>Inbox</h1>
        <span className={view.titleMeta}>
          {fromLastDump > 0
            ? `${fromLastDump} parsed from your last dump`
            : `${tasks.length} ${pluralize(tasks.length, "task")}`}
        </span>
      </div>

      <SmartAddBar placeholder="Add one thing to the inbox" />

      {tasks.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          helper="Everything you dumped has been planned or finished."
          action={
            <button
              type="button"
              className={styles.emptyAction}
              onClick={openCapture}
            >
              Add something new
            </button>
          }
        />
      ) : (
        <ul className={view.list}>
          {tasks.map((task) => {
            const onToday = task.status === "today" && task.plan_date === today;
            return (
              <li key={task.id} className={styles.row}>
                <div className={styles.chipWrap}>
                  {/* Reasoning is always visible here — Inbox is where you
                      check Cerno's thinking. */}
                  <TaskChip
                    task={task}
                    today={today}
                    showReasoning
                    onToggleComplete={() => void completeTask(task.id)}
                  />
                </div>
                <div className={styles.actions}>
                  {/* Completing moved onto the card's checkbox; what remains
                      here is the action unique to Inbox — placing the task. */}
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-on={onToday || undefined}
                    onClick={() => moveToToday(task.id)}
                    disabled={onToday}
                    aria-label={
                      onToday
                        ? `"${task.title}" is already on today`
                        : `Add "${task.title}" to today`
                    }
                  >
                    <PlusIcon size="1rem" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
