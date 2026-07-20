"use client";

import { useMemo } from "react";

import { buildReminders, overdueIds } from "@/lib/reminders";
import type { Reminder } from "@/lib/types";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

/**
 * The live reminder list, and the set of task ids that are late.
 *
 * Derived here rather than stored, so it can never disagree with the tasks it
 * describes. `buildReminders` is a pure function of four inputs, and each is
 * subscribed to individually — a change to any unrelated slice of the store
 * won't recompute the list.
 *
 * Dismissals are filtered *after* the build so that a dismissed task which
 * later becomes overdue reappears: dismissing "starts in 20 minutes" shouldn't
 * also silence "40 minutes late".
 */
export function useReminders(): {
  reminders: Reminder[];
  visible: Reminder[];
  overdue: Set<string>;
} {
  const tasks = useAppStoreShallow((s) => s.tasks);
  const today = useAppStore((s) => s.today);
  const now = useAppStore((s) => s.nowMinutes);
  const settings = useAppStore((s) => s.settings);
  const dismissed = useAppStoreShallow((s) => s.dismissedReminders);

  const reminders = useMemo(
    () => buildReminders({ tasks, today, now, settings }),
    [tasks, today, now, settings],
  );

  const visible = useMemo(() => {
    if (dismissed.length === 0) return reminders;
    const hidden = new Set(dismissed);
    // Overdue always shows through a dismissal — see the note above.
    return reminders.filter((r) => r.kind === "overdue" || !hidden.has(r.id));
  }, [reminders, dismissed]);

  const overdue = useMemo(() => overdueIds(reminders), [reminders]);

  return { reminders, visible, overdue };
}
