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
import {
  buildPresets,
  monthGrid,
  shiftMonth,
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
  flat?: boolean;
}) {
  // Opens on the selected date's month, so the current value is visible rather
  // than requiring the user to navigate back to find it.
  const [anchor, setAnchor] = useState(selected ?? today);
  const rootRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => buildPresets(today), [today]);
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
      aria-label={title ?? "Pick a date"}
      tabIndex={-1}
    >
      {title && (
        <header className={styles.head}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
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
            aria-label="Previous month"
          >
            <ChevronLeft size="0.9375rem" />
          </button>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setAnchor(today)}
            aria-label="Back to this month"
            title="This month"
          >
            <span className={styles.dot} />
          </button>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setAnchor(shiftMonth(anchor, 1))}
            aria-label="Next month"
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
    </div>
  );
}
