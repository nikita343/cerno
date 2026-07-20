"use client";

import { useEffect, useRef } from "react";

import { AlertIcon, CheckIcon, ClockIcon, CloseIcon } from "@/components/icons";
import { formatLateness } from "@/lib/reminders";
import { formatClock } from "@/lib/schedule";
import type { Reminder } from "@/lib/types";
import { usePresence } from "@/lib/usePresence";
import { useReminders } from "@/lib/useReminders";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./NotificationCenter.module.css";

/** Matches the panel's exit animation in the stylesheet. */
const EXIT_MS = 180;

/**
 * The notification panel.
 *
 * Rendered exactly once, by AppShell — not alongside each bell. The sidebar and
 * the mobile top bar are both always in the DOM (swapped by CSS at 960px), so a
 * panel rendered next to each trigger would exist twice, with two Escape
 * handlers and two elements competing for focus.
 *
 * One panel serves both breakpoints: it is a dropdown anchored top-right on
 * desktop and a bottom sheet on mobile, decided entirely in CSS.
 */
export function NotificationCenter() {
  const open = useAppStore((s) => s.notificationsOpen);
  const setOpen = useAppStore((s) => s.setNotificationsOpen);
  const { visible } = useReminders();
  const { present, leaving } = usePresence(open, EXIT_MS);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!present) return null;

  return (
    <>
      <div
        className={styles.scrim}
        data-leaving={leaving || undefined}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={styles.panel}
        data-leaving={leaving || undefined}
        role="dialog"
        aria-label="Notifications"
        tabIndex={-1}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>Notifications</h2>
          <button
            type="button"
            className={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          >
            <CloseIcon size="1rem" />
          </button>
        </header>

        {visible.length === 0 ? (
          <p className={styles.empty}>Nothing needs you right now.</p>
        ) : (
          <ul className={styles.list}>
            {visible.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ReminderRow({ reminder }: { reminder: Reminder }) {
  const completeTask = useAppStore((s) => s.completeTask);
  const dismissReminder = useAppStore((s) => s.dismissReminder);
  const overdue = reminder.kind === "overdue";

  return (
    <li className={styles.row} data-kind={reminder.kind}>
      <span className={styles.rowIcon} aria-hidden="true">
        {overdue ? <AlertIcon size="1rem" /> : <ClockIcon size="1rem" />}
      </span>

      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{reminder.task.title}</span>
        <span className={styles.rowMeta}>
          {formatClock(reminder.start)}
          <span className={styles.rowDot} aria-hidden="true" />
          {formatLateness(reminder.minutesUntil)}
        </span>
      </span>

      <span className={styles.rowActions}>
        <button
          type="button"
          className={styles.rowAction}
          onClick={() => void completeTask(reminder.task.id)}
          aria-label={`Mark "${reminder.task.title}" done`}
          title="Mark done"
        >
          <CheckIcon size="0.9375rem" />
        </button>
        {/* Overdue rows have no dismiss: the only way to clear one is to
            complete or reschedule the task. A dismissable overdue warning is
            just a warning that goes away when it's inconvenient. */}
        {!overdue && (
          <button
            type="button"
            className={styles.rowAction}
            onClick={() => dismissReminder(reminder.id)}
            aria-label={`Dismiss reminder for "${reminder.task.title}"`}
            title="Dismiss"
          >
            <CloseIcon size="0.9375rem" />
          </button>
        )}
      </span>
    </li>
  );
}
