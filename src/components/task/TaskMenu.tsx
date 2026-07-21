"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";

import {
  CalendarIcon,
  EditIcon,
  FlagIcon,
  MoreIcon,
  TrashIcon,
} from "@/components/icons";
import type { Priority, Task } from "@/lib/types";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
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
 * Two presentations of one set of panels. On a pointer device it is a centred
 * modal; on a phone it is a drag-to-dismiss bottom sheet, because the panels
 * open from a card you just tapped with your thumb and flicking one away is
 * cheaper than reaching for a close button at the top of the screen.
 *
 * The sheet is `vaul` rather than hand-rolled. The gesture is not the hard part
 * — the surrounding behaviour is: velocity-based dismiss, scroll inside the
 * sheet not fighting the drag, focus trapping, restoring focus on close, inert
 * background. That is a lot of subtle work to get wrong, and it is exactly what
 * the library already does.
 *
 * Delete lives in here rather than as an inline icon so it can't be hit by
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

  const isPhone = useMediaQuery(PHONE_QUERY);

  const popRef = useRef<HTMLDivElement>(null);

  // Portals need a DOM target, which doesn't exist during the server render.
  useEffect(() => setMounted(true), []);

  const close = () => {
    setOpen(false);
    setPanel("menu");
  };

  // The sheet handles its own Escape and focus; only the modal needs these.
  useEffect(() => {
    if (!open || isPhone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPhone]);

  useEffect(() => {
    if (open && !isPhone) popRef.current?.focus();
  }, [open, isPhone]);

  const label = `Actions for "${task.title}"`;

  // Shared by both presentations. Identical markup either way, so a change to
  // an action can't land on one form factor and not the other.
  const panels = (
    <>
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
            {/* Shows the time too, now that this panel sets it — otherwise the
                only way to see a task's start is to open the panel. */}
            <span className={styles.rowHint}>
              {task.plan_date ?? "None"}
              {task.suggested_start ? ` · ${task.suggested_start}` : ""}
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
          flat={isPhone}
          onClose={close}
          onPick={(date) => {
            void rescheduleTask(task.id, date);
            close();
          }}
          time={task.suggested_start}
          /*
           * Closes, like picking a date does.
           *
           * The intent was to leave it open so a day and a time could be set in
           * one visit — but setting a time re-sorts the timeline, and if the
           * task crosses a part-of-day boundary its row moves to a different
           * block, unmounting this menu with it. That made the panel survive a
           * 09:00 → 09:30 change and vanish on 09:00 → 15:00, which is worse
           * than always closing.
           *
           * Keeping it open would mean hoisting the menu to a per-view
           * singleton so it outlives its row. Worth doing; not worth doing
           * quietly in the middle of this. Setting both at once has a home in
           * the meantime: the edit dialog.
           */
          onPickTime={(next) => {
            void updateTask(task.id, { suggested_start: next });
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
    </>
  );

  return (
    <div className={styles.wrap}>
      {!hideTrigger && (
        <button
          type="button"
          className={styles.trigger}
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
        >
          <MoreIcon size="1rem" />
        </button>
      )}

      {isPhone ? (
        <Drawer.Root
          open={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          // The app shell is `100dvh; overflow: hidden` and scrolls in an inner
          // element, so the body never scrolls — vaul's body lock has nothing
          // to fix here, and its iOS `position: fixed` variant would fight the
          // shell's own layout. The overlay already swallows background touches.
          noBodyStyles
          repositionInputs={false}
        >
          <Drawer.Portal>
            <Drawer.Overlay className={styles.sheetOverlay} />
            <Drawer.Content className={styles.sheet} aria-describedby={undefined}>
              {/* Radix requires a title on every dialog. It is visually
                  redundant next to the task's own row, so it is read-only. */}
              <Drawer.Title className="srOnly">{label}</Drawer.Title>
              <Drawer.Handle className={styles.sheetHandle} />
              <div className={styles.sheetBody}>{panels}</div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        open &&
        mounted &&
        createPortal(
          <>
            <div className={styles.scrim} onClick={close} aria-hidden="true" />
            <div
              ref={popRef}
              className={styles.pop}
              data-wide={panel === "date" || undefined}
              role="menu"
              aria-label={label}
              tabIndex={-1}
            >
              {panels}
            </div>
          </>,
          document.body,
        )
      )}

      {editing && (
        <TaskEditDialog task={task} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
