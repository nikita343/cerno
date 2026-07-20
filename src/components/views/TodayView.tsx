"use client";

import { CheckIcon, TrashIcon } from "@/components/icons";
import { SmartAddBar } from "@/components/task/SmartAddBar";
import { TaskChip } from "@/components/task/TaskChip";
import { eyebrowDate } from "@/lib/date";
import { taskDuration, totalDuration, pluralize } from "@/lib/format";
import { deferredFor, scheduledFor, totalMinutes } from "@/store/createAppStore";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./TodayView.module.css";
import view from "./View.module.css";

export function TodayView() {
  const today = useAppStore((s) => s.today);
  const dayPlan = useAppStore((s) => s.dayPlans[s.today]);
  const scheduled = useAppStoreShallow((s) => scheduledFor(s.tasks, s.today));
  const deferred = useAppStoreShallow((s) => deferredFor(s.tasks, s.today));

  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const moveToToday = useAppStore((s) => s.moveToToday);
  const openCapture = useAppStore((s) => s.openCapture);

  const open = scheduled.filter((t) => t.status !== "done");
  const remaining = totalMinutes(open);

  const hasAnything = scheduled.length > 0 || deferred.length > 0;

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      <header className={styles.header}>
        <span className={view.eyebrow}>{eyebrowDate(today)}</span>
        <h1 className={`${view.h1} ${view.h1Long}`}>
          {dayPlan?.summary ?? "Nothing planned yet."}
        </h1>
        {dayPlan?.capacity_note && (
          <p className={view.subline}>{dayPlan.capacity_note}</p>
        )}
      </header>

      <SmartAddBar />

      {!hasAnything && (
        <EmptyState
          title="Nothing to plan yet"
          helper="Dump whatever is on your mind and Cerno will build the day around it."
          action={
            <button
              type="button"
              className={styles.emptyAction}
              onClick={openCapture}
            >
              What&rsquo;s on your mind?
            </button>
          }
        />
      )}

      {scheduled.length > 0 && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>Scheduled</h2>
            <span className={view.sectionMeta}>
              {open.length} {pluralize(open.length, "task")}
            </span>
            <span className={view.sectionMetaRight}>
              &asymp; {totalDuration(remaining)}
            </span>
          </div>

          <ol className={view.list}>
            {scheduled.map((task, index) => {
              const isDone = task.status === "done";
              return (
                <li key={task.id} className={styles.row}>
                  <span className={styles.index}>{index + 1}</span>
                  <div className={styles.chipWrap}>
                    <TaskChip task={task} today={today} />
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      data-on={isDone || undefined}
                      onClick={() =>
                        isDone ? uncompleteTask(task.id) : completeTask(task.id)
                      }
                      aria-label={
                        isDone
                          ? `Mark "${task.title}" as not done`
                          : `Mark "${task.title}" as done`
                      }
                      aria-pressed={isDone}
                    >
                      <CheckIcon size="1rem" />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => deleteTask(task.id)}
                      aria-label={`Delete "${task.title}"`}
                    >
                      <TrashIcon size="1rem" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {deferred.length > 0 && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>Deferred</h2>
            <span className={view.sectionMeta}>
              {deferred.length} · parked for tomorrow
            </span>
          </div>

          <ul className={view.list}>
            {deferred.map((task) => (
              <li key={task.id} className={styles.deferredCard}>
                <div className={styles.deferredTop}>
                  <span className={styles.deferredDot} />
                  <span className={styles.deferredTitle}>{task.title}</span>
                  <span className={styles.deferredTime}>
                    {taskDuration(task.estimated_minutes)}
                  </span>
                </div>
                <div className={styles.deferredBottom}>
                  <span className={styles.deferredReason}>{task.reasoning}</span>
                  <button
                    type="button"
                    className={styles.moveButton}
                    onClick={() => moveToToday(task.id)}
                  >
                    Move to today
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
