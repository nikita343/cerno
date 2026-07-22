"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { normaliseTime } from "@/lib/reschedule";
import { usePresence } from "@/lib/usePresence";
import type { Priority, Task } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./TaskEditDialog.module.css";

/** Matches the exit animation in the stylesheet. */
const EXIT_MS = 180;

/** Mirrors the DB check on tasks.description. */
const MAX_DESCRIPTION = 2000;

const PRIORITY_VALUES: Priority[] = ["high", "medium", "low"];

/**
 * Edit a task's title, description, priority, start time and estimate.
 *
 * A modal rather than inline fields: the description is multi-line and the row
 * it belongs to is a single flex line by design. Everything commits on Save so
 * an abandoned edit changes nothing — unlike the settings form, where each
 * control is an independent preference.
 */
export function TaskEditDialog({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const updateTask = useAppStore((s) => s.updateTask);
  const t = useT();
  const priorityLabel: Record<Priority, string> = {
    high: t.today.high,
    medium: t.today.medium,
    low: t.today.low,
  };
  const { present, leaving } = usePresence(true, EXIT_MS);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [minutes, setMinutes] = useState(String(task.estimated_minutes));
  const [start, setStart] = useState(task.suggested_start ?? "");

  const titleRef = useRef<HTMLInputElement>(null);

  // Portals need a DOM target, which doesn't exist during the server render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const trimmedTitle = title.trim();
    // An empty title would render a blank row with no way to identify or fix
    // it, so it falls back rather than saving.
    if (!trimmedTitle) {
      titleRef.current?.focus();
      return;
    }

    const parsed = Number(minutes);
    const estimate = Number.isFinite(parsed)
      ? Math.min(480, Math.max(5, Math.round(parsed)))
      : task.estimated_minutes;

    const trimmedDescription = description.trim();

    void updateTask(task.id, {
      title: trimmedTitle,
      // Normalised rather than passed through: browsers may hand back
      // "14:30:00", and the column wants HH:MM. An unparseable value clears the
      // time instead of writing something the timeline can't read.
      suggested_start: normaliseTime(start),
      // Empty saves as null, not "": null is "never written", which is what
      // the card checks to decide whether to render the block at all.
      description: trimmedDescription === "" ? null : trimmedDescription,
      priority,
      estimated_minutes: estimate,
    });
    onClose();
  };

  if (!present || !mounted) return null;

  /*
   * Portalled to <body>.
   *
   * This dialog rendered inline, inside the task row — which put it under
   * whatever ancestors that row happened to have. A transformed ancestor makes
   * `position: fixed` resolve against *that element* rather than the viewport,
   * so the sheet was being positioned against the page wrapper instead of the
   * screen and its footer — the Save button — ended up below the fold with no
   * way to scroll to it. The sibling menu was portalled for exactly this reason
   * and this one was missed.
   *
   * The offending transform is gone now, but the portal stays: correctness here
   * should not depend on no ancestor ever gaining a transform again.
   */
  return createPortal(
    <>
      <div
        className={styles.scrim}
        data-leaving={leaving || undefined}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={styles.dialog}
        data-leaving={leaving || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={t.task.editTask}
      >
        <header className={styles.head}>
          <span className={styles.headTitle}>{t.task.editTask}</span>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t.task.close}
          >
            <CloseIcon size="1rem" />
          </button>
        </header>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>{t.task.titleLabel}</span>
            <input
              ref={titleRef}
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              maxLength={200}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t.task.descriptionLabel}</span>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.task.notesPlaceholder}
              maxLength={MAX_DESCRIPTION}
              rows={4}
            />
            {/* Only shown near the ceiling — a permanent counter on a field
                nobody fills is noise. */}
            {description.length > MAX_DESCRIPTION - 200 && (
              <span className={styles.counter}>
                {MAX_DESCRIPTION - description.length} {t.task.charsLeft}
              </span>
            )}
          </label>

          <div className={styles.split}>
            <div className={styles.field}>
              <span className={styles.label}>{t.task.priority}</span>
              <div
                className={styles.segmented}
                role="group"
                aria-label={t.task.priority}
              >
                {PRIORITY_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.segment}
                    data-priority={value}
                    data-active={priority === value || undefined}
                    onClick={() => setPriority(value)}
                    aria-pressed={priority === value}
                  >
                    {priorityLabel[value]}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.field}>
              {/* Empty means "no fixed time", which hands the task back to the
                  derived timeline rather than pinning it. That is why this
                  isn't defaulted to anything. */}
              <span className={styles.label}>{t.task.starts}</span>
              <input
                className={styles.input}
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t.task.estimate}</span>
              <span className={styles.minutesWrap}>
                <input
                  className={styles.minutes}
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={480}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
                <span className={styles.minutesUnit}>{t.task.minShort}</span>
              </span>
            </label>
          </div>
        </div>

        <footer className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="button" className={styles.save} onClick={save}>
            {t.common.save}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
