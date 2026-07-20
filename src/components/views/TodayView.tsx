"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CheckIcon, TrashIcon } from "@/components/icons";
import { SmartAddBar } from "@/components/task/SmartAddBar";
import { SwipeRow } from "@/components/task/SwipeRow";
import { TaskChip } from "@/components/task/TaskChip";
import { eyebrowDate } from "@/lib/date";
import { taskDuration, totalDuration, pluralize } from "@/lib/format";
import { formatClock, groupIntoBlocks, withStartTimes } from "@/lib/schedule";
import { useReminders } from "@/lib/useReminders";
import { deferredFor, scheduledFor, totalMinutes } from "@/store/createAppStore";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./TodayView.module.css";
import view from "./View.module.css";

/** Must match the .row exit animation duration in TodayView.module.css. */
const REMOVE_MS = 260;

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

  // Same derivation the notification bell uses, so a row's badge and the panel
  // can never disagree about what is late.
  const { overdue } = useReminders();

  // Ids mid-exit. The task stays in the store until its animation finishes,
  // otherwise the row vanishes instantly and the rows below snap upward.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  // timer id -> task id, so an unmount can finish what it started.
  const pending = useRef(new Map<number, string>());
  const deleteRef = useRef(deleteTask);
  deleteRef.current = deleteTask;

  // Leaving the view mid-animation must still delete the task. Dropping the
  // timer would make it reappear on the way back, which reads as the delete
  // having silently failed.
  useEffect(() => {
    const inFlight = pending.current;
    return () => {
      inFlight.forEach((taskId, timer) => {
        window.clearTimeout(timer);
        deleteRef.current(taskId);
      });
      inFlight.clear();
    };
  }, []);

  const requestDelete = useCallback((id: string) => {
    setRemoving((prev) => new Set(prev).add(id));
    const timer = window.setTimeout(() => {
      pending.current.delete(timer);
      deleteRef.current(id);
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, REMOVE_MS);
    pending.current.set(timer, id);
  }, []);

  // Tasks are laid onto a clock in plan order, then bucketed into parts of the
  // day. Grouping is derived rather than stored, so reordering or completing a
  // task reshapes the timeline without any migration.
  const blocks = useMemo(
    () => groupIntoBlocks(withStartTimes(scheduled)),
    [scheduled],
  );

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

          <div className={styles.blocks}>
            {blocks.map(({ block, items, minutes }) => (
              <section key={block.key} className={styles.block}>
                <div className={styles.blockHead}>
                  <span className={styles.blockLabel}>{block.label}</span>
                  <span className={styles.blockRange}>
                    {formatClock(items[0].start)} &ndash;{" "}
                    {formatClock(items[items.length - 1].end)}
                  </span>
                  <span className={styles.blockTotal}>
                    {totalDuration(minutes)}
                  </span>
                </div>

                <ol className={view.list}>
                  {items.map(({ task, start, fixed }, index) => {
                    const isDone = task.status === "done";
                    const isOverdue = overdue.has(task.id);
                    const toggle = () =>
                      isDone ? uncompleteTask(task.id) : completeTask(task.id);

                    return (
                      <li
                        key={task.id}
                        className={styles.row}
                        data-removing={removing.has(task.id) || undefined}
                        style={{ "--i": index } as React.CSSProperties}
                      >
                        <span
                          className={styles.time}
                          data-fixed={fixed || undefined}
                          data-overdue={isOverdue || undefined}
                        >
                          {formatClock(start)}
                        </span>

                        <div className={styles.chipWrap}>
                          <SwipeRow
                            title={task.title}
                            completed={isDone}
                            onComplete={toggle}
                            onDelete={() => requestDelete(task.id)}
                          >
                            <TaskChip
                              task={task}
                              today={today}
                              overdue={isOverdue}
                            />
                          </SwipeRow>
                        </div>

                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            data-on={isDone || undefined}
                            onClick={toggle}
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
                            onClick={() => requestDelete(task.id)}
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
            ))}
          </div>
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
            {deferred.map((task, index) => (
              <li
                key={task.id}
                className={styles.deferredCard}
                data-removing={removing.has(task.id) || undefined}
                style={{ "--i": index } as React.CSSProperties}
              >
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
