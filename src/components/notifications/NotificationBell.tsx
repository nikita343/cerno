"use client";

import { BellIcon } from "@/components/icons";
import { useReminders } from "@/lib/useReminders";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./NotificationCenter.module.css";

/**
 * The bell, without the panel.
 *
 * Both the sidebar and the mobile top bar are always in the DOM — they're
 * swapped by CSS at 960px, not by JS — so anything rendered in both appears
 * twice. For a button that's harmless. For the panel it is not: two dialogs
 * with the same label, two Escape handlers, and two elements calling focus()
 * on each other. So the panel is rendered once by AppShell and only the
 * trigger lives here.
 */
export function NotificationBell() {
  const open = useAppStore((s) => s.notificationsOpen);
  const setOpen = useAppStore((s) => s.setNotificationsOpen);
  const { visible } = useReminders();

  const overdueCount = visible.filter((r) => r.kind === "overdue").length;
  const count = visible.length;

  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={() => setOpen(!open)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={
        count === 0 ? "Notifications" : `Notifications, ${count} needing attention`
      }
    >
      <BellIcon size="1.1875rem" />
      {count > 0 && (
        <span
          className={styles.badge}
          // Overdue is the more serious state, so it wins the colour when both
          // kinds are present.
          data-tone={overdueCount > 0 ? "overdue" : "soon"}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
