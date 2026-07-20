"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight } from "@/components/icons";
import { TaskChip } from "@/components/task/TaskChip";
import {
  dayLetter,
  dayOfMonth,
  monthYear,
  relativeDaySub,
  relativeDayTitle,
  weekDates,
} from "@/lib/date";
import { totalDuration } from "@/lib/format";
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
  const { overdue } = useReminders();

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
                      <div className={styles.blockRows}>
                        {items.map(({ task, start, fixed }) => (
                          <div key={task.id} className={styles.timedRow}>
                            <span
                              className={styles.rowTime}
                              data-fixed={fixed || undefined}
                              data-overdue={overdue.has(task.id) || undefined}
                            >
                              {formatClock(start)}
                            </span>
                            <div className={styles.rowChip}>
                              <TaskChip
                                task={task}
                                today={today}
                                // Only today's rows can be overdue — the set is
                                // built from today's schedule, so a future day
                                // never matches.
                                overdue={overdue.has(task.id)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className={view.emptyDashed}>Nothing planned yet.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
