"use client";

import { useRef, useState } from "react";

import { CheckIcon, MoreIcon, TrashIcon } from "@/components/icons";

import styles from "./SwipeRow.module.css";

export interface SwipeRowProps {
  /** Used to phrase the action labels for screen readers. */
  title: string;
  completed?: boolean;
  onComplete: () => void;
  onDelete: () => void;
  /**
   * Opens the task menu. Adds a ⋯ to the tray, and makes a tap on the closed
   * row open the menu — on touch there is no hover, so without these the menu's
   * Edit / Date / Priority actions have no way in.
   */
  onMenu?: () => void;
  children: React.ReactNode;
}

/** Below this fraction of the action tray the row springs shut again. */
const SNAP_FRACTION = 0.45;
/** Movement in px before we commit to treating a touch as a swipe. */
const AXIS_LOCK = 6;
/** Fallback tray width if the element hasn't measured yet. */
const FALLBACK_WIDTH = 140;

type Axis = "undecided" | "horizontal" | "vertical";

/**
 * Swipe-left-to-reveal actions, for touch only.
 *
 * The desktop row exposes complete/delete on hover, which touch devices have no
 * equivalent for — this is that affordance. Nothing here fires on a mouse, so
 * the desktop row is untouched: pointer devices never dispatch touch events and
 * the tray is hidden outright at hover-capable widths.
 *
 * The axis lock is the important part. Without it, a mostly-vertical scroll
 * with a few pixels of horizontal drift would drag the row sideways and fight
 * the scroll container. We wait for the gesture to declare itself, then commit.
 *
 * `offset` is always a positive "how far open" value; the direction lives only
 * in the sign of the transform. Keeps the clamping arithmetic readable.
 */
export function SwipeRow({
  title,
  completed = false,
  onComplete,
  onDelete,
  onMenu,
  children,
}: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const trayRef = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; base: number } | null>(null);
  const axis = useRef<Axis>("undecided");

  const trayWidth = () => trayRef.current?.offsetWidth || FALLBACK_WIDTH;

  const close = () => setOffset(0);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    origin.current = { x: touch.clientX, y: touch.clientY, base: offset };
    axis.current = "undecided";
    setDragging(true);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!origin.current) return;
    const touch = event.touches[0];
    const dx = touch.clientX - origin.current.x;
    const dy = touch.clientY - origin.current.y;

    if (axis.current === "undecided") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    // A vertical gesture belongs to the scroll container, not to us.
    if (axis.current !== "horizontal") return;

    const max = trayWidth();
    // Dragging left opens, so leftward travel (negative dx) increases offset.
    const next = origin.current.base - dx;
    // Hard stops at both ends. This used to let the row overshoot with elastic
    // resistance, which felt nice but pulled the card further left than the
    // tray is wide — opening a gap of bare page between the card and the first
    // action. Since the tray can't stretch to follow, the honest fix is to stop
    // the row where the actions end.
    setOffset(Math.min(Math.max(next, 0), max));
  };

  const handleTouchEnd = () => {
    setDragging(false);
    origin.current = null;
    if (axis.current !== "horizontal") return;
    const max = trayWidth();
    setOffset(offset > max * SNAP_FRACTION ? max : 0);
  };

  const runAction = (action: () => void) => {
    close();
    action();
  };

  const isOpen = offset > 0;

  return (
    <div className={styles.wrap} data-open={isOpen || undefined}>
      <div className={styles.tray} ref={trayRef} aria-hidden={!isOpen}>
        <button
          type="button"
          className={`${styles.action} ${styles.complete}`}
          tabIndex={isOpen ? 0 : -1}
          onClick={() => runAction(onComplete)}
          aria-label={
            completed ? `Mark "${title}" as not done` : `Mark "${title}" as done`
          }
        >
          <CheckIcon size="1.125rem" />
          <span className={styles.actionLabel}>{completed ? "Undo" : "Done"}</span>
        </button>
        {onMenu && (
          <button
            type="button"
            className={`${styles.action} ${styles.more}`}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => runAction(onMenu)}
            aria-label={`More actions for "${title}"`}
          >
            <MoreIcon size="1.125rem" />
            <span className={styles.actionLabel}>More</span>
          </button>
        )}
        <button
          type="button"
          className={`${styles.action} ${styles.delete}`}
          tabIndex={isOpen ? 0 : -1}
          onClick={() => runAction(onDelete)}
          aria-label={`Delete "${title}"`}
        >
          <TrashIcon size="1.125rem" />
          <span className={styles.actionLabel}>Delete</span>
        </button>
      </div>

      <div
        className={styles.content}
        data-dragging={dragging || undefined}
        style={{ transform: `translate3d(${-offset}px, 0, 0)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        // A tap on the closed row opens the menu. Guarded on the axis lock and
        // on the row being closed, so it can't fire at the end of a swipe or
        // while the tray is showing — where the tap means "close".
        onClick={(e) => {
          if (!onMenu) return;
          // Touch only. On a pointer device the ⋯ is already visible on hover,
          // and making the whole card open a menu on click would hijack every
          // stray click in the list.
          if (!window.matchMedia("(hover: none)").matches) return;
          if (axis.current === "horizontal") return;
          if (isOpen) {
            close();
            return;
          }
          // The checkbox and any other control inside the card own their taps.
          if ((e.target as HTMLElement).closest("button")) return;
          onMenu();
        }}
      >
        {children}
      </div>
    </div>
  );
}
