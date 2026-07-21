"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { usePresence } from "@/lib/usePresence";
import type { Priority, Task } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./TaskEditDialog.module.css";

/** Matches the exit animation in the stylesheet. */
const EXIT_MS = 180;

/** Mirrors the DB check on tasks.description. */
const MAX_DESCRIPTION = 2000;

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/**
 * Edit a task's title, description, priority and estimate.
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
  const { present, leaving } = usePresence(true, EXIT_MS);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [minutes, setMinutes] = useState(String(task.estimated_minutes));

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
        aria-label="Edit task"
      >
        <header className={styles.head}>
          <span className={styles.headTitle}>Edit task</span>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size="1rem" />
          </button>
        </header>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>Title</span>
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
            <span className={styles.label}>Description</span>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, links, sub-steps…"
              maxLength={MAX_DESCRIPTION}
              rows={4}
            />
            {/* Only shown near the ceiling — a permanent counter on a field
                nobody fills is noise. */}
            {description.length > MAX_DESCRIPTION - 200 && (
              <span className={styles.counter}>
                {MAX_DESCRIPTION - description.length} left
              </span>
            )}
          </label>

          <div className={styles.split}>
            <div className={styles.field}>
              <span className={styles.label}>Priority</span>
              <div
                className={styles.segmented}
                role="group"
                aria-label="Priority"
              >
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={styles.segment}
                    data-priority={p.value}
                    data-active={priority === p.value || undefined}
                    onClick={() => setPriority(p.value)}
                    aria-pressed={priority === p.value}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Estimate</span>
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
                <span className={styles.minutesUnit}>min</span>
              </span>
            </label>
          </div>
        </div>

        <footer className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.save} onClick={save}>
            Save
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
