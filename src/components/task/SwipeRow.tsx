"use client";

import { useRef, useState } from "react";

import { CheckIcon, TrashIcon } from "@/components/icons";

import styles from "./SwipeRow.module.css";

export interface SwipeRowProps {
  /** Used to phrase the action labels for screen readers. */
  title: string;
  completed?: boolean;
  onComplete: () => void;
  onDelete: () => void;
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
 * Swipe-right-to-reveal actions, for touch only.
 *
 * The desktop row exposes complete/delete on hover, which touch devices have no
 * equivalent for — this is that affordance. Nothing here fires on a mouse, so
 * the desktop row is untouched: pointer devices never dispatch touch events and
 * the tray is hidden outright at hover-capable widths.
 *
 * The axis lock is the important part. Without it, a mostly-vertical scroll
 * with a few pixels of horizontal drift would drag the row sideways and fight
 * the scroll container. We wait for the gesture to declare itself, then commit.
 */
export function SwipeRow({
  title,
  completed = false,
  onComplete,
  onDelete,
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
    const next = origin.current.base + dx;
    // Closed is a hard stop; past fully-open the row keeps moving but with
    // resistance, so overshoot feels elastic rather than broken.
    setOffset(next < 0 ? 0 : next > max ? max + (next - max) * 0.25 : next);
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
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
