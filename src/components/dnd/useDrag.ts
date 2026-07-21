"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import type { DropTarget } from "./dropTarget";

/**
 * A hook, not a wrapper component, on purpose.
 *
 * The drop zones sit on elements that already carry layout meaning — a day
 * button in a flex strip, a `<section>` in the blocks grid, a tab. Wrapping
 * each in a `<DropZone>` div would insert a node into those grids and reopen
 * spacing bugs. Instead the view spreads these onto the element it already
 * draws, and styles the `data-drop-over` attribute the hook sets.
 */
export function useDropZone(id: string, target: DropTarget, disabled = false) {
  const { setNodeRef, isOver } = useDroppable({ id, data: target, disabled });
  return {
    ref: setNodeRef,
    "data-drop-over": isOver || undefined,
  };
}

/**
 * Makes an element a draggable task.
 *
 * Returns the pointer/touch listeners to spread onto the row, plus `isDragging`
 * so the source can dim while its copy rides the cursor in the overlay.
 *
 * Only `listeners` are spread, not dnd-kit's `attributes`: those put
 * `role="button"` and a tabindex on the element, and the row is an `<li>` that
 * already contains buttons — nesting a button role around them is invalid and
 * floods the tab order. Keyboard users reschedule through the ⋯ menu's date
 * picker instead, which is the better path for them anyway.
 *
 * Safe to call where there is no drag provider — views that don't opt in pass
 * `enabled: false` and get inert props.
 */
export function useTaskDrag(id: string, enabled: boolean) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id,
    disabled: !enabled,
  });
  return {
    ref: setNodeRef,
    isDragging,
    handleProps: enabled ? listeners ?? {} : {},
  };
}
