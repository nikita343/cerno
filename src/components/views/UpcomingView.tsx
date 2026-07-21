"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight } from "@/components/icons";
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
import { formatClock, groupIntoBlocks, withStartTimes } from "@/lib/schedule";
import { useReminders } from "@/lib/useReminders";
import { tasksOn } from "@/store/createAppStore";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./UpcomingView.module.css";
import view from "./View.module.css";

export function UpcomingView() {
  const today = useAppStore((s) => s.today);
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
        <h1 className={view.h1}>Upcoming</h1>
        <span className={styles.monthLabel}>{monthYear(anchor)}</span>

        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => stepWeek(-1)}
            aria-label="Previous week"
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
            aria-label="Jump to this week"
          >
            Today
          </button>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => stepWeek(1)}
            aria-label="Next week"
          >
            <ChevronRight size="0.9375rem" />
          </button>
        </div>
      </div>

      <div className={styles.strip} role="group" aria-label="Week">
        {week.map((date) => {
          const isToday = date === today;
          const count = groups.find((g) => g.date === date)?.tasks.length ?? 0;
          return (
            <button
              key={date}
              type="button"
              className={styles.day}
              data-today={isToday || undefined}
              data-selected={selected === date || undefined}
              onClick={() => selectDay(date)}
              aria-label={`${relativeDayTitle(date, today)}, ${count} ${
                count === 1 ? "task" : "tasks"
              }`}
              aria-current={isToday ? "date" : undefined}
            >
              <span className={styles.dayLetter}>{dayLetter(date)}</span>
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
        })}
      </div>

      <div className={styles.groups}>
        {groups.map(({ date, tasks: dayTasks }) => (
          <section key={date} id={`day-${date}`} className={styles.group}>
            <div className={styles.groupHead}>
              <h2 className={styles.groupTitle}>
                {relativeDayTitle(date, today)}
              </h2>
              <span className={view.sectionMeta}>
                &middot; {relativeDaySub(date, today)}
              </span>
            </div>

            {dayTasks.length > 0 ? (
              <div className={styles.blocks}>
                {groupIntoBlocks(withStartTimes(dayTasks)).map(
                  ({ block, items, minutes }) => (
                    <div key={block.key} className={styles.block}>
                      <div className={styles.blockHead}>
                        <span className={styles.blockLabel}>{block.label}</span>
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
                <p className={view.emptyDashed}>Nothing planned yet.</p>
                <DayAddTask date={date} today={today} />
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
