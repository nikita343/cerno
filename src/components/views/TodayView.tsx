"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarIcon } from "@/components/icons";
import { Droppable } from "@/components/dnd/Droppable";
import { dropId } from "@/components/dnd/dropTarget";
import { useDragActive } from "@/components/dnd/TaskDndProvider";
import { DatePicker } from "@/components/task/DatePicker";
import { PickerModal } from "@/components/task/PickerModal";
import { SmartAddBar } from "@/components/task/SmartAddBar";
import { TaskRow } from "@/components/task/TaskRow";
import { eyebrowDate } from "@/lib/date";
import { taskDuration, totalDuration, pluralize } from "@/lib/format";
import {
  derivedDayStart,
  formatClock,
  groupIntoBlocks,
  withStartTimes,
} from "@/lib/schedule";
import { useReminders } from "@/lib/useReminders";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { deferredFor, scheduledFor, totalMinutes } from "@/store/createAppStore";
import { useT } from "@/lib/i18n";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./TodayView.module.css";
import view from "./View.module.css";

/** Must match the .row exit animation duration in TodayView.module.css. */
const REMOVE_MS = 260;

export function TodayView() {
  const today = useAppStore((s) => s.today);
  const t = useT();
  const nowMinutes = useAppStore((s) => s.nowMinutes);
  // The clock is client-only: `nowMinutes` is 0 on the server, so rendering it
  // during SSR would print 00:00 and mismatch the real time on hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dayPlan = useAppStore((s) => s.dayPlans[s.today]);
  const scheduled = useAppStoreShallow((s) => scheduledFor(s.tasks, s.today));
  const deferred = useAppStoreShallow((s) => deferredFor(s.tasks, s.today));

  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const moveToToday = useAppStore((s) => s.moveToToday);
  const openCapture = useAppStore((s) => s.openCapture);

  const rescheduleMany = useAppStore((s) => s.rescheduleMany);

  // Same derivation the notification bell uses, so a row's badge and the panel
  // can never disagree about what is late.
  const { overdue } = useReminders();

  // id -> name, so a shared task on Today can say which team it came from.
  const workspaceNames = useAppStoreShallow(
    (s) => new Map(s.workspaces.map((w) => [w.id, w.name])),
  );

  const [bulkOpen, setBulkOpen] = useState(false);
  // The picker is a phone sheet below this width; it also decides whether the
  // picker drops its own card (the sheet already supplies one).
  const isPhone = useMediaQuery(PHONE_QUERY);

  // Lifted out of TaskMenu because the menu can be opened three ways here: the
  // ⋯ button, the swipe tray, and tapping the card on touch.
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const openMenuFor = useCallback((id: string) => setMenuTaskId(id), []);

  // Overdue ids in the order they appear on the timeline, so the bulk action
  // and the count in its label always describe the same set.
  const overdueIdList = useMemo(
    () => scheduled.filter((t) => overdue.has(t.id)).map((t) => t.id),
    [scheduled, overdue],
  );

  // The button disappears once nothing is overdue; leaving it open would
  // strand a picker that no longer has anything to act on.
  useEffect(() => {
    if (overdueIdList.length === 0) setBulkOpen(false);
  }, [overdueIdList.length]);

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
    () =>
      groupIntoBlocks(
        withStartTimes(scheduled, derivedDayStart(today, today, nowMinutes)),
      ),
    [scheduled, today, nowMinutes],
  );

  const open = scheduled.filter((t) => t.status !== "done");
  const remaining = totalMinutes(open);
  const hasAnything = scheduled.length > 0 || deferred.length > 0;

  // The header narrative is regenerated only on a full replan, so its numbers
  // drift as soon as you add, complete or edit a task. This capacity line is
  // derived from the live list instead, so it can never contradict what's on
  // screen. (The qualitative headline above it stays from the last plan.)
  const capacityNote = useMemo(() => {
    if (scheduled.length === 0) return null;
    if (open.length === 0) return t.today.allDoneNote;
    const parts = [
      t.today.toGo.replace("{n}", String(open.length)),
      `~ ${totalDuration(remaining)}`,
    ];
    if (deferred.length > 0) {
      parts.push(t.today.parkedCount.replace("{n}", String(deferred.length)));
    }
    return parts.join(" · ");
  }, [scheduled.length, open.length, remaining, deferred.length, t]);

  // The postpone bar only appears while something is being dragged — see
  // useDragActive. A permanent "drop here for tomorrow" strip would be noise.
  const dragActive = useDragActive();

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      <header className={styles.header}>
        <span className={view.eyebrow}>
          {eyebrowDate(today)}
          {mounted && (
            <time className={styles.clock} aria-live="off">
              {formatClock(nowMinutes)}
            </time>
          )}
        </span>
        <h1 className={`${view.h1} ${view.h1Long}`}>
          {dayPlan?.summary ?? "Nothing planned yet."}
        </h1>
        {capacityNote && <p className={view.subline}>{capacityNote}</p>}
      </header>

      <SmartAddBar />

      {!hasAnything && (
        <EmptyState
          title={t.today.nothingToPlan}
          helper={t.today.nothingHelper}
          action={
            <button
              type="button"
              className={styles.emptyAction}
              onClick={openCapture}
            >
              {t.today.whatsOnYourMind}
            </button>
          }
        />
      )}

      {scheduled.length > 0 && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>{t.today.scheduled}</h2>
            <span className={view.sectionMeta}>
              {open.length} {pluralize(open.length, "task")}
            </span>

            {overdueIdList.length > 0 && (
              <>
                <button
                  type="button"
                  className={styles.bulkButton}
                  onClick={() => setBulkOpen(!bulkOpen)}
                  aria-haspopup="dialog"
                  aria-expanded={bulkOpen}
                >
                  <CalendarIcon size="0.875rem" />
                  {t.today.reschedule} {overdueIdList.length}
                </button>

                {bulkOpen && (
                  <PickerModal
                    label="Reschedule overdue tasks"
                    onClose={() => setBulkOpen(false)}
                  >
                    <DatePicker
                      today={today}
                      title={`Move ${overdueIdList.length} overdue ${pluralize(
                        overdueIdList.length,
                        "task",
                      )}`}
                      flat={isPhone}
                      onClose={() => setBulkOpen(false)}
                      onPick={(date) => {
                        void rescheduleMany(overdueIdList, date);
                        setBulkOpen(false);
                      }}
                    />
                  </PickerModal>
                )}
              </>
            )}

            <span className={view.sectionMetaRight}>
              &asymp; {totalDuration(remaining)}
            </span>
          </div>

          <div className={styles.blocks}>
            {blocks.map(({ block, items, minutes }) => (
              <Droppable
                key={block.key}
                as="section"
                id={dropId.block(today, block.key)}
                target={{ kind: "block", date: today, blockKey: block.key }}
                className={styles.block}
              >
                <div className={styles.blockHead}>
                  <span className={styles.blockLabel}>{t.today[block.key]}</span>
                  <span className={styles.blockRange}>
                    {formatClock(items[0].start)} &ndash;{" "}
                    {formatClock(items[items.length - 1].end)}
                  </span>
                  <span className={styles.blockTotal}>
                    {totalDuration(minutes)}
                  </span>
                </div>

                <ol className={styles.timeline}>
                  {items.map(({ task, start, fixed }, index) => {
                    const isDone = task.status === "done";
                    const isOverdue = overdue.has(task.id);
                    const toggle = () =>
                      isDone ? uncompleteTask(task.id) : completeTask(task.id);

                    // Consecutive tasks landing on the same minute print the
                    // time once. Repeating "10:45" down a column says nothing
                    // and reads as a rendering fault.
                    const clock = formatClock(start);
                    const repeats =
                      index > 0 && formatClock(items[index - 1].start) === clock;

                    return (
                      <TaskRow
                        key={task.id}
                        task={task}
                        today={today}
                        clock={repeats ? null : clock}
                        fixed={fixed}
                        overdue={isOverdue}
                        onToggle={toggle}
                        onDelete={requestDelete}
                        workspaceName={workspaceNames.get(task.workspace_id ?? "") ?? null}
                        removing={removing.has(task.id)}
                        index={index}
                        menuOpen={menuTaskId === task.id}
                        onMenuOpenChange={(next) =>
                          setMenuTaskId(next ? task.id : null)
                        }
                        draggable
                      />
                    );
                  })}
                </ol>
              </Droppable>
            ))}
          </div>
        </section>
      )}

      {deferred.length > 0 && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>{t.today.deferred}</h2>
            <span className={view.sectionMeta}>
              {deferred.length} · {t.today.parkedForTomorrow}
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
                    {t.today.moveToToday}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Appears only mid-drag. Dropping a today task here parks it on tomorrow
          — the "drop to postpone" gesture, made explicit rather than requiring
          a trip to Upcoming's week strip. */}
      {dragActive && (
        <Droppable
          id={dropId.tomorrow}
          target={{ kind: "tomorrow" }}
          className={styles.postpone}
        >
          <CalendarIcon size="1rem" />
          <span>{t.today.postponeToTomorrow}</span>
        </Droppable>
      )}
    </div>
  );
}
