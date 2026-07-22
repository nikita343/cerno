"use client";

import { createContext, useContext, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { CalendarIcon } from "@/components/icons";
import { addDays } from "@/lib/date";
import { useT } from "@/lib/i18n";
import { DAY_START_MINUTES, TIME_BLOCKS, formatClock } from "@/lib/schedule";
import { useAppStore } from "@/store/StoreProvider";

import { Droppable } from "./Droppable";
import { asDropTarget, dropId } from "./dropTarget";
import styles from "./TaskDndProvider.module.css";

/**
 * Whether a task is currently being dragged.
 *
 * Views read this to reveal drop targets that only make sense mid-drag — the
 * "postpone to tomorrow" bar on Today would be clutter the rest of the time.
 */
const DragActiveContext = createContext(false);

/** True while a task is in flight. Safe to call outside the provider (false). */
export function useDragActive(): boolean {
  return useContext(DragActiveContext);
}

/**
 * The one place a drag becomes a change.
 *
 * Every draggable task and every drop zone lives inside this. A drop carries a
 * `DropTarget` describing what it means (see dropTarget.ts); `onDragEnd` reads
 * that and calls the matching store action, so the resolution is a single
 * `switch` rather than logic scattered across the views.
 *
 * Mouse and Touch as two *separate* sensors, not one PointerSensor — and that
 * is the load-bearing decision. A PointerSensor receives pointer events for
 * touch as well, so its distance constraint would fire on any 8px finger drag
 * and swallow the swipe-to-reveal gesture whole. Splitting them lets each input
 * have its own activation rule:
 *
 *  - **Mouse** activates after 8px of movement. Below that it's a click, so the
 *    checkbox, the ⋯ menu and tapping a card all keep working — a drag and a
 *    click are told apart by distance.
 *  - **Touch** activates only after a 220ms hold. This is what lets drag coexist
 *    with the swipe tray: a quick horizontal flick moves past the tolerance
 *    before the hold completes and stays a swipe; a deliberate press-and-hold
 *    becomes a drag. Once the drag is live dnd-kit suppresses scrolling itself,
 *    so no `touch-action: none` (which would break both scroll and swipe) is
 *    needed on the rows.
 */
export function TaskDndProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const tasks = useAppStore((s) => s.tasks);
  const rescheduleTask = useAppStore((s) => s.rescheduleTask);
  const scheduleTaskAt = useAppStore((s) => s.scheduleTaskAt);
  const moveToToday = useAppStore((s) => s.moveToToday);
  const today = useAppStore((s) => s.today);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const id = String(event.active.id);
    const target = asDropTarget(event.over?.data.current);
    if (!target) return;

    switch (target.kind) {
      case "day":
        void rescheduleTask(id, target.date);
        break;
      case "block": {
        // Morning starts at the working-day start rather than midnight; the
        // other blocks start when they say they do. This is the "update the
        // time" half of dropping onto today.
        const block = TIME_BLOCKS.find((b) => b.key === target.blockKey);
        const start = Math.max(block?.from ?? 0, DAY_START_MINUTES);
        void scheduleTaskAt(id, target.date, formatClock(start));
        break;
      }
      case "tomorrow":
        void rescheduleTask(id, addDays(today, 1));
        break;
      case "today":
        void moveToToday(id);
        break;
      case "inbox":
        void rescheduleTask(id, null);
        break;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      // pointerWithin over the default rectangle intersection: our drop zones
      // nest (a block sits inside a day sits inside the scroll area), and
      // "whichever zone the cursor is actually over" resolves the innermost one
      // the way a person expects.
      collisionDetection={pointerWithin}
      // Gentle edge auto-scroll. It has to stay on: reaching a day several rows
      // down the Upcoming agenda means the list must scroll under the drag. But
      // the default is twitchy — a wide hot zone that starts racing the moment
      // you near an edge, which is what made the drop target feel like it was
      // running away. A narrow activation band (only the outer ~12%) and a
      // softer acceleration keep the scroll deliberate and easy to aim past.
      autoScroll={{ threshold: { x: 0, y: 0.12 }, acceleration: 6 }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <DragActiveContext.Provider value={activeId !== null}>
        {children}
      </DragActiveContext.Provider>
      {/* The postpone-to-tomorrow target, pinned to the viewport rather than the
          page. It used to live inside Today as a sticky strip, but once a drag
          freezes the scroll (see AppShell) a sticky element parked below the
          fold is simply gone — there's no scrolling to it. Fixed to the bottom
          here it's always in reach, on any view, for the whole drag. Rendered
          only while something is in flight, so it never clutters the idle UI. */}
      {activeId !== null && (
        <Droppable
          id={dropId.tomorrow}
          target={{ kind: "tomorrow" }}
          className={styles.postpone}
        >
          <CalendarIcon size="1rem" />
          <span>{t.today.postponeToTomorrow}</span>
        </Droppable>
      )}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className={styles.overlay}>
            <span className={styles.overlayTitle}>{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
