"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight } from "@/components/icons";
import { dropId } from "@/components/dnd/dropTarget";
import { useDragActive } from "@/components/dnd/TaskDndProvider";
import { useDropZone } from "@/components/dnd/useDrag";
import { DayAddTask } from "@/components/task/DayAddTask";
import { TaskRow } from "@/components/task/TaskRow";
import {
  dayLetter,
  dayOfMonth,
  monthYear,
  relativeDaySub,
  relativeDayTitle,
  weekDates,
} from "@/lib/date";
import { totalDuration } from "@/lib/format";
import type { Task } from "@/lib/types";
import {
  derivedDayStart,
  formatClock,
  groupIntoBlocks,
  withStartTimes,
} from "@/lib/schedule";
import { useReminders } from "@/lib/useReminders";
import { tasksOn } from "@/store/createAppStore";
import { taskCount, useLocale, useT } from "@/lib/i18n";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./UpcomingView.module.css";
import view from "./View.module.css";

export function UpcomingView() {
  const today = useAppStore((s) => s.today);
  const nowMinutes = useAppStore((s) => s.nowMinutes);
  const t = useT();
  const locale = useLocale();
  // While a task is in flight the week strip pins to the top of the scroll
  // area, so every day stays a reachable drop target no matter how far down the
  // agenda you've dragged — no hunting, no scrolling to find the right day.
  const dragActive = useDragActive();
  const anchor = useAppStore((s) => s.upcomingAnchor);
  const tasks = useAppStore((s) => s.tasks);
  const stepWeek = useAppStore((s) => s.stepUpcomingWeek);
  const setAnchor = useAppStore((s) => s.setUpcomingAnchor);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const { overdue } = useReminders();

  // Lifted for the same reason as Today: the menu opens from the ⋯, the swipe
  // tray, and a tap on the card.
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  const toggle = (task: Task) =>
    task.status === "done"
      ? void uncompleteTask(task.id)
      : void completeTask(task.id);

  // Selecting a day scrolls its group into view rather than filtering the
  // agenda down — the week stays readable as context.
  const [selected, setSelected] = useState<string | null>(null);

  const week = useMemo(() => weekDates(anchor), [anchor]);

  const groups = useMemo(
    () => week.map((date) => ({ date, tasks: tasksOn(tasks, date) })),
    [week, tasks],
  );

  const showingThisWeek = week.includes(today);

  const selectDay = (date: string) => {
    setSelected(date);
    document
      .getElementById(`day-${date}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={view.view}>
      <div className={styles.header}>
        <h1 className={view.h1}>{t.upcoming.title}</h1>
        <span className={styles.monthLabel}>{monthYear(anchor, locale)}</span>

        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => stepWeek(-1)}
            aria-label={t.upcoming.previousWeek}
          >
            <ChevronLeft size="0.9375rem" />
          </button>
          <button
            type="button"
            className={styles.stepLabel}
            onClick={() => {
              setAnchor(today);
              setSelected(today);
            }}
            disabled={showingThisWeek}
            aria-label={t.upcoming.jumpToThisWeek}
          >
            {t.nav.today}
          </button>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => stepWeek(1)}
            aria-label={t.upcoming.nextWeek}
          >
            <ChevronRight size="0.9375rem" />
          </button>
        </div>
      </div>

      <div
        className={styles.strip}
        data-dragging={dragActive || undefined}
        role="group"
        aria-label={t.upcoming.week}
      >
        {week.map((date) => (
          <StripDay
            key={date}
            date={date}
            today={today}
            count={groups.find((g) => g.date === date)?.tasks.length ?? 0}
            selected={selected === date}
            label={relativeDayTitle(date, today, t.date, locale)}
            onSelect={selectDay}
          />
        ))}
      </div>

      <div className={styles.groups}>
        {groups.map(({ date, tasks: dayTasks }) => (
          <DayGroup key={date} date={date}>
            <div className={styles.groupHead}>
              <h2 className={styles.groupTitle}>
                {relativeDayTitle(date, today, t.date, locale)}
              </h2>
              <span className={view.sectionMeta}>
                &middot; {relativeDaySub(date, today, locale)}
              </span>
            </div>

            {dayTasks.length > 0 ? (
              <div className={styles.blocks}>
                {groupIntoBlocks(
                  withStartTimes(dayTasks, derivedDayStart(date, today, nowMinutes)),
                ).map(
                  ({ block, items, minutes }) => (
                    <div key={block.key} className={styles.block}>
                      <div className={styles.blockHead}>
                        <span className={styles.blockLabel}>{t.today[block.key]}</span>
                        <span className={styles.blockTotal}>
                          {totalDuration(minutes)}
                        </span>
                      </div>
                      <ul className={styles.blockRows}>
                        {items.map(({ task, start, fixed }, i) => {
                          // Same rule as Today: consecutive tasks on the same
                          // minute print the time once.
                          const clock = formatClock(start);
                          const repeats =
                            i > 0 && formatClock(items[i - 1].start) === clock;

                          return (
                            <TaskRow
                              key={task.id}
                              task={task}
                              today={today}
                              clock={repeats ? null : clock}
                              fixed={fixed}
                              // Only today's rows can be overdue — the set is
                              // built from today's schedule, so a future day
                              // never matches.
                              overdue={overdue.has(task.id)}
                              onToggle={() => toggle(task)}
                              onDelete={(id) => void deleteTask(id)}
                              menuOpen={menuTaskId === task.id}
                              onMenuOpenChange={(next) =>
                                setMenuTaskId(next ? task.id : null)
                              }
                              draggable
                            />
                          );
                        })}
                      </ul>
                    </div>
                  ),
                )}
                <DayAddTask date={date} today={today} />
              </div>
            ) : (
              <>
                <p className={view.emptyDashed}>{t.upcoming.nothingPlanned}</p>
                <DayAddTask date={date} today={today} />
              </>
            )}
          </DayGroup>
        ))}
      </div>
    </div>
  );
}

/**
 * A day in the week strip that is also a drop target.
 *
 * Dropping a task here reschedules it onto this day even when the day's section
 * is scrolled out of view — the strip is always visible, so it's the fast way
 * to move something several days out.
 */
function StripDay({
  date,
  today,
  count,
  selected,
  label,
  onSelect,
}: {
  date: string;
  today: string;
  count: number;
  selected: boolean;
  label: string;
  onSelect: (date: string) => void;
}) {
  const isToday = date === today;
  const locale = useLocale();
  const t = useT();
  const drop = useDropZone(dropId.stripDay(date), { kind: "day", date });
  return (
    <button
      {...drop}
      type="button"
      className={styles.day}
      data-today={isToday || undefined}
      data-selected={selected || undefined}
      onClick={() => onSelect(date)}
      aria-label={`${label}, ${taskCount(count, locale, t)}`}
      aria-current={isToday ? "date" : undefined}
    >
      <span className={styles.dayLetter}>{dayLetter(date, locale)}</span>
      <span className={styles.dayNumber} data-today={isToday || undefined}>
        {dayOfMonth(date)}
      </span>
      <span
        className={styles.dayMarker}
        data-has={count > 0 || undefined}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * A day's agenda section, and the larger of its two drop targets.
 *
 * Keeps the `day-${date}` DOM id the week strip scrolls to; `dropId.day`
 * produces the same string, so the drag system and `getElementById` share one
 * identifier.
 */
function DayGroup({
  date,
  children,
}: {
  date: string;
  children: React.ReactNode;
}) {
  const drop = useDropZone(dropId.day(date), { kind: "day", date });
  return (
    <section {...drop} id={dropId.day(date)} className={styles.group}>
      {children}
    </section>
  );
}
