"use client";

import { useDropZone } from "./useDrag";
import type { DropTarget } from "./dropTarget";

/**
 * A drop zone rendered *as* the element the view was already going to draw.
 *
 * Exists for the `.map()` call sites — a day in the week strip, a time block —
 * where the drop hook can't be called inline. It renders the given tag rather
 * than wrapping in a div, so no node is inserted into the flex/grid layouts
 * these zones live in. The `data-drop-over` attribute it sets while a task is
 * above it is what the view's CSS lights up.
 */
export function Droppable({
  id,
  target,
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  id: string;
  target: DropTarget;
  as?: "div" | "li" | "section" | "button";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const drop = useDropZone(id, target);
  return (
    <Tag className={className} {...rest} {...drop}>
      {children}
    </Tag>
  );
}
