import type { Label } from "./types";

/**
 * Label colour lookup.
 *
 * Colours used to be a compile-time constant keyed by a fixed 5-value union.
 * Labels are user-defined now, so the colour has to be looked up in the user's
 * own label list, which means every call site needs that list in hand.
 *
 * Lookups are case-insensitive because the database treats "Work" and "work" as
 * the same label, and a task tagged before a rename can differ in case from the
 * label row it points at.
 */

/** Shown for a tag with no matching label — a leftover from a deleted one. */
export const LABEL_FALLBACK = "#9B9BA1";

export function labelColor(
  labels: Label[],
  name: string | undefined | null,
): string {
  if (!name) return LABEL_FALLBACK;
  const needle = name.trim().toLowerCase();
  return (
    labels.find((l) => l.name.trim().toLowerCase() === needle)?.color ??
    LABEL_FALLBACK
  );
}

/**
 * Validates a proposed label name against the ones that exist.
 *
 * Mirrors the database constraints (1–24 chars, case-insensitive unique per
 * user) so the user gets an inline message instead of a failed round trip.
 * The database still enforces both — this is the courtesy, not the guarantee.
 */
export function validateLabelName(
  raw: string,
  existing: Label[],
  /** Ignored when renaming, so a label doesn't collide with itself. */
  selfId?: string,
): string | null {
  const name = raw.trim();
  if (name.length === 0) return "Give the label a name.";
  if (name.length > 24) return "Keep it under 24 characters.";
  const clash = existing.some(
    (l) => l.id !== selfId && l.name.trim().toLowerCase() === name.toLowerCase(),
  );
  return clash ? "You already have a label with that name." : null;
}
