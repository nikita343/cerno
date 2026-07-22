"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  ListIcon,
  SparkIcon,
  SunIcon,
} from "@/components/icons";
import { monthYear } from "@/lib/date";
import { useT } from "@/lib/i18n";
import {
  buildPresets,
  monthGrid,
  normaliseTime,
  shiftMonth,
  TIME_PRESETS,
  type PresetKey,
} from "@/lib/reschedule";

import styles from "./DatePicker.module.css";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const PRESET_ICONS: Record<PresetKey, typeof CalendarIcon> = {
  today: CalendarIcon,
  tomorrow: SunIcon,
  weekend: SparkIcon,
  nextWeek: ChevronRight,
  noDate: ListIcon,
};

/**
 * Preset + calendar date picker.
 *
 * Used for rescheduling a single task and for moving every overdue task at
 * once, so it takes a plain `onPick` rather than reaching into the store — the
 * two callers do very different things with the answer.
 *
 * `null` from `onPick` means "no date", which the caller interprets. This
 * component does not know what that means for a task.
 */
export function DatePicker({
  today,
  /** The task's current date, highlighted in the grid. */
  selected,
  onPick,
  onClose,
  title,
  /**
   * The task's current start time, `HH:MM` or null. Passing `onPickTime` is
   * what turns the time section on — the bulk overdue action omits it, because
   * "everything at 15:00" is a stack, not a schedule.
   */
  time,
  onPickTime,
  /**
   * Drops the picker's own card so it can sit directly on a surface that is
   * already glass — the mobile task sheet. Without it you get a panel inside a
   * panel, with two borders and two blurs stacked.
   */
  flat = false,
}: {
  today: string;
  selected?: string | null;
  onPick: (date: string | null) => void;
  onClose: () => void;
  title?: string;
  time?: string | null;
  onPickTime?: (time: string | null) => void;
  flat?: boolean;
}) {
  // Opens on the selected date's month, so the current value is visible rather
  // than requiring the user to navigate back to find it.
  const [anchor, setAnchor] = useState(selected ?? today);
  const rootRef = useRef<HTMLDivElement>(null);

  const t = useT();
  const presets = useMemo(
    () =>
      buildPresets(today, {
        today: t.date.today,
        tomorrow: t.date.tomorrow,
        weekend: t.task.thisWeekend,
        nextWeek: t.task.nextWeek,
        noDate: t.task.noDate,
      }),
    [today, t],
  );
  // Translated label for each time preset, keyed off its fixed value.
  const timeLabel: Record<string, string> = {
    "09:00": t.today.morning,
    "12:00": t.task.midday,
    "15:00": t.today.afternoon,
    "18:00": t.today.evening,
  };
  const cells = useMemo(() => monthGrid(anchor), [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Stopped so a picker inside another popover doesn't close both.
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.picker}
      data-flat={flat || undefined}
      role="dialog"
      aria-label={title ?? t.task.pickDate}
      tabIndex={-1}
    >
      {title && (
        <header className={styles.head}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t.task.close}
          >
            <CloseIcon size="0.9375rem" />
          </button>
        </header>
      )}

      <div className={styles.presets}>
        {presets.map((preset) => {
          const Icon = PRESET_ICONS[preset.key];
          return (
            <button
              key={preset.key}
              type="button"
              className={styles.preset}
              data-kind={preset.key}
              onClick={() => onPick(preset.date)}
            >
              <Icon size="1rem" className={styles.presetIcon} />
              <span className={styles.presetLabel}>{preset.label}</span>
              <span className={styles.presetHint}>{preset.hint}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.calendar}>
        <div className={styles.monthHead}>
          <span className={styles.month}>{monthYear(anchor)}</span>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setAnchor(shiftMonth(anchor, -1))}
            aria-label={t.task.previousMonth}
          >
            <ChevronLeft size="0.9375rem" />
          </button>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setAnchor(today)}
            aria-label={t.task.backToThisMonth}
            title={t.task.thisMonth}
          >
            <span className={styles.dot} />
          </button>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setAnchor(shiftMonth(anchor, 1))}
            aria-label={t.task.nextMonth}
          >
            <ChevronRight size="0.9375rem" />
          </button>
        </div>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAY_LETTERS.map((letter, i) => (
            <span key={i} className={styles.weekday}>
              {letter}
            </span>
          ))}
        </div>

        <div className={styles.grid} role="grid">
          {cells.map((cell, i) =>
            cell.date === null ? (
              <span key={`blank-${i}`} className={styles.blank} />
            ) : (
              <button
                key={cell.date}
                type="button"
                className={styles.day}
                data-today={cell.date === today || undefined}
                data-selected={cell.date === selected || undefined}
                data-past={cell.date < today || undefined}
                onClick={() => onPick(cell.date)}
                aria-label={cell.date}
                aria-current={cell.date === today ? "date" : undefined}
              >
                {cell.day}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Time is a separate commitment from the day, so it sits below the
          calendar rather than beside the presets. Whether picking one closes
          the panel is the caller's business — see TaskMenu. */}
      {onPickTime && (
        <div className={styles.times}>
          <span className={styles.timesLabel}>{t.task.time}</span>

          <div className={styles.timeRow} role="group" aria-label={t.task.startTime}>
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={styles.timeChip}
                data-active={time === preset.value || undefined}
                aria-pressed={time === preset.value}
                onClick={() => onPickTime(preset.value)}
              >
                {timeLabel[preset.value] ?? preset.label}
              </button>
            ))}
          </div>

          <div className={styles.timeExact}>
            <label className={styles.timeFieldLabel} htmlFor="task-start-time">
              At
            </label>
            <input
              id="task-start-time"
              type="time"
              className={styles.timeInput}
              value={time ?? ""}
              onChange={(e) => onPickTime(normaliseTime(e.target.value))}
            />
            {/* Clearing hands the task back to the derived timeline, where it
                is laid end-to-end after whatever precedes it. That is a real
                state, not an empty one, so it gets its own control rather than
                relying on the user emptying the field. */}
            <button
              type="button"
              className={styles.timeClear}
              onClick={() => onPickTime(null)}
              disabled={time == null}
            >
              No time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
