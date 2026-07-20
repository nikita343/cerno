import type { Tag } from "./types";

/**
 * Label colours live on the client, not the DB (DEVELOPMENT.md §5).
 * Unknown tags fall back to muted.
 */
export const LABEL_COLORS: Record<Tag, string> = {
  work: "#5B8DEF",
  home: "#F2A93B",
  errand: "#3FB98A",
  comms: "#9B7BFF",
  health: "#E8618C",
};

export const LABEL_FALLBACK = "#9B9BA1";

export function labelColor(tag: string | undefined | null): string {
  if (!tag) return LABEL_FALLBACK;
  return LABEL_COLORS[tag as Tag] ?? LABEL_FALLBACK;
}
