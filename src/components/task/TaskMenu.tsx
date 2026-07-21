"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  CalendarIcon,
  EditIcon,
  FlagIcon,
  MoreIcon,
  TrashIcon,
} from "@/components/icons";
import type { Priority, Task } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import { DatePicker } from "./DatePicker";
import { TaskEditDialog } from "./TaskEditDialog";
import styles from "./TaskMenu.module.css";

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

type Panel = "menu" | "date" | "confirmDelete";

/**
 * The per-task `⋯` menu: Edit, Date, Priority, Delete.
 *
 * Delete lives here rather than as an inline icon so it can't be hit by
 * mistake while reaching for the complete button, and so it can carry a
 * confirmation step. The inline ✓ stays where it is — completing is the most
 * common action on a row and shouldn't cost two taps.
 */
export function TaskMenu({
  task,
  today,
  onDelete,
  open: controlledOpen,
  onOpenChange,
  /** Hides the ⋯ button, for callers that open the menu some other way. */
  hideTrigger = false,
}: {
  task: Task;
  today: string;
  /** Deferred by the caller so the row can play its exit animation. */
  onDelete: (id: string) => void;
  /**
   * Controlled mode. Omit both to let the menu manage its own state.
   *
   * Today needs control because the menu can also be opened from the swipe
   * tray and by tapping the card — affordances that live outside this
   * component.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const updateTask = useAppStore((s) => s.updateTask);
  const rescheduleTask = useAppStore((s) => s.rescheduleTask);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [panel, setPanel] = useState<Panel>("menu");
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const popRef = useRef<HTMLDivElement>(null);

  // Portals need a DOM target, which doesn't exist during the server render.
  useEffect(() => setMounted(true), []);

  const close = () => {
    setOpen(false);
    setPanel("menu");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus moves into the dialog so keyboard users land inside it.
  useEffect(() => {
    if (open) popRef.current?.focus();
  }, [open]);

  return (
    <div className={styles.wrap}>
      {!hideTrigger && (
        <button
          type="button"
          className={styles.trigger}
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`More actions for "${task.title}"`}
        >
          <MoreIcon size="1rem" />
        </button>
      )}

      {/* Portalled to <body>: an ancestor `transform` (PageTransition has one)
          makes `position: fixed` resolve against that element instead of the
          viewport, and traps it in that element's stacking context. */}
      {open && mounted && createPortal(
        <>
          <div
            className={styles.scrim}
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={popRef}
            className={styles.pop}
            data-wide={panel === "date" || undefined}
            role="menu"
            aria-label={`Actions for "${task.title}"`}
            tabIndex={-1}
          >
          {panel === "menu" && (
            <div className={styles.menu}>
              <button
                type="button"
                className={styles.row}
                role="menuitem"
                onClick={() => {
                  setEditing(true);
                  close();
                }}
              >
                <EditIcon size="1rem" className={styles.rowIcon} />
                <span>Edit</span>
              </button>

              <button
                type="button"
                className={styles.row}
                role="menuitem"
                onClick={() => setPanel("date")}
              >
                <CalendarIcon size="1rem" className={styles.rowIcon} />
                <span>Date</span>
                <span className={styles.rowHint}>
                  {task.plan_date ?? "None"}
                </span>
              </button>

              <div className={styles.divider} />

              <span className={styles.groupLabel}>Priority</span>
              <div className={styles.flags} role="group" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={styles.flag}
                    data-priority={p.value}
                    data-active={task.priority === p.value || undefined}
                    onClick={() => {
                      void updateTask(task.id, { priority: p.value });
                      close();
                    }}
                    aria-label={`${p.label} priority`}
                    aria-pressed={task.priority === p.value}
                    title={p.label}
                  >
                    <FlagIcon size="1rem" />
                  </button>
                ))}
              </div>

              <div className={styles.divider} />

              <button
                type="button"
                className={`${styles.row} ${styles.danger}`}
                role="menuitem"
                onClick={() => setPanel("confirmDelete")}
              >
                <TrashIcon size="1rem" className={styles.rowIcon} />
                <span>Delete</span>
              </button>
            </div>
          )}

          {panel === "date" && (
            <DatePicker
              today={today}
              selected={task.plan_date}
              title="Reschedule"
              onClose={close}
              onPick={(date) => {
                void rescheduleTask(task.id, date);
                close();
              }}
            />
          )}

          {panel === "confirmDelete" && (
            <div className={styles.confirm}>
              <p className={styles.confirmText}>
                Delete &ldquo;{task.title}&rdquo;?
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmDelete}
                  onClick={() => {
                    close();
                    onDelete(task.id);
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className={styles.confirmCancel}
                  onClick={() => setPanel("menu")}
                >
                  Cancel
                </button>
              </div>
              </div>
            )}
          </div>
        </>,
        document.body,
      )}

      {editing && (
        <TaskEditDialog task={task} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
