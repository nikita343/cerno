"use client";

import { useState } from "react";

import { SmartAddBar } from "@/components/task/SmartAddBar";
import { TaskRow } from "@/components/task/TaskRow";
import { pluralize } from "@/lib/format";
import { inboxTasks } from "@/store/createAppStore";
import { useT } from "@/lib/i18n";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./InboxView.module.css";
import view from "./View.module.css";

export function InboxView() {
  const today = useAppStore((s) => s.today);
  const t = useT();
  const tasks = useAppStoreShallow((s) => inboxTasks(s.tasks));
  const lastDump = useAppStore((s) => s.dumps[0]);
  const completeTask = useAppStore((s) => s.completeTask);
  const moveToToday = useAppStore((s) => s.moveToToday);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const openCapture = useAppStore((s) => s.openCapture);

  const fromLastDump = lastDump
    ? tasks.filter((t) => t.dump_id === lastDump.id).length
    : 0;

  return (
    <div className={view.view}>
      <div className={view.titleRow}>
        <h1 className={view.h1}>{t.inbox.title}</h1>
        <span className={view.titleMeta}>
          {fromLastDump > 0
            ? `${fromLastDump} ${t.inbox.parsedFromDump}`
            : `${tasks.length} ${pluralize(tasks.length, "task")}`}
        </span>
      </div>

      <SmartAddBar placeholder={t.inbox.addToInbox} />

      {tasks.length === 0 ? (
        <EmptyState
          title={t.inbox.clear}
          helper={t.inbox.clearHelper}
          action={
            <button
              type="button"
              className={styles.emptyAction}
              onClick={openCapture}
            >
              {t.inbox.addSomethingNew}
            </button>
          }
        />
      ) : (
        <ul className={view.list}>
          {tasks.map((task) => {
            const onToday = task.status === "today" && task.plan_date === today;
            return (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                // Inbox tasks have no day, so there is no clock to show.
                clock={null}
                // Inbox is where you check Cerno's thinking, so the reasoning
                // stays visible here and nowhere else.
                showReasoning
                onToggle={() => void completeTask(task.id)}
                onDelete={(id) => void deleteTask(id)}
                menuOpen={menuTaskId === task.id}
                onMenuOpenChange={(next) =>
                  setMenuTaskId(next ? task.id : null)
                }
                // Labelled, not a bare "+". The icon gave no clue what it did
                // and read as "add something", when it actually schedules the
                // task — the one action this screen exists for.
                // Drag an inbox item onto a day in Upcoming, a time block in
                // Today, or the Today tab — the labelled button is the one-tap
                // path, the drag is the "put it exactly there" path.
                draggable
                action={
                  <button
                    type="button"
                    className={styles.todayButton}
                    data-on={onToday || undefined}
                    onClick={() => moveToToday(task.id)}
                    disabled={onToday}
                  >
                    {onToday ? t.inbox.onToday : t.inbox.addToToday}
                  </button>
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
