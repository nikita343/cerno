"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
}: {
  task: Task;
  today: string;
  /** Deferred by the caller so the row can play its exit animation. */
  onDelete: (id: string) => void;
}) {
  const updateTask = useAppStore((s) => s.updateTask);
  const rescheduleTask = useAppStore((s) => s.rescheduleTask);

  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");
  const [editing, setEditing] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Portals need a DOM target, which doesn't exist during the server render.
  useEffect(() => setMounted(true), []);

  const close = () => {
    setOpen(false);
    setPanel("menu");
  };

  // Pointer-down rather than click: a click listener fires after the target's
  // own handler, so clicking a second row's trigger would close this menu and
  // immediately reopen it on the same frame.
  //
  // Both refs are checked because the popover is portalled to <body> and is
  // therefore NOT inside the wrapper.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Positions the popover against the trigger, in viewport coordinates.
   *
   * The popover is portalled to <body> rather than rendered in the row, because
   * an ancestor with a `transform` (PageTransition has one) makes
   * `position: fixed` resolve against *that element* instead of the viewport,
   * and traps it in that element's stacking context — the FAB then paints over
   * it whatever z-index it is given. A portal escapes both problems, at the
   * cost of having to compute the anchor position by hand.
   *
   * Ignored on mobile, where CSS pins the panel to the bottom as a sheet.
   */
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) return;
    if (window.matchMedia("(max-width: 599px)").matches) {
      setCoords(null);
      return;
    }

    const trigger = triggerRef.current.getBoundingClientRect();
    const pop = popRef.current.getBoundingClientRect();
    const margin = 8;

    // Right-aligned to the trigger, then pulled back inside the viewport.
    let left = trigger.right - pop.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - pop.width - margin));

    // Below by default; above when that would overflow and there is room.
    let top = trigger.bottom + 6;
    if (top + pop.height > window.innerHeight - margin) {
      const above = trigger.top - pop.height - 6;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - pop.height - margin);
    }

    setCoords({ top, left });
  }, [open, panel]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for "${task.title}"`}
      >
        <MoreIcon size="1rem" />
      </button>

      {open && mounted && createPortal(
        <div
          ref={popRef}
          className={styles.pop}
          data-wide={panel === "date" || undefined}
          // Hidden until measured, so it never paints at 0,0 first. Mobile has
          // no coords — CSS pins it to the bottom edge instead.
          style={coords ? { top: coords.top, left: coords.left } : undefined}
          data-unpositioned={coords === null || undefined}
          role="menu"
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
        </div>,
        document.body,
      )}

      {editing && (
        <TaskEditDialog task={task} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
