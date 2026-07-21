import { DASHBOARD_ROOT } from "./nav";

/**
 * The Settings sections, as routes.
 *
 * One long scrolling page put six unrelated preferences in one place, so
 * changing your timezone meant scrolling past your avatar and your plan. Each
 * section is now its own URL — which also means a link can point straight at
 * one ("your plan is here"), and the browser Back button behaves.
 *
 * The order is by how often it is touched, not alphabetically or by how much
 * work each was to build.
 */
export interface SettingsSection {
  slug: SettingsSlug;
  label: string;
  /** One line under the label in the menu, so a section says what it holds. */
  note: string;
  /**
   * Caveat shown under the section heading, where one applies.
   *
   * These used to live on a per-section header inside the content. Now that the
   * shell renders the heading, keeping them there would print the section name
   * twice — so the caveat moved and the header went.
   */
  hint?: string;
}

export type SettingsSlug =
  | "profile"
  | "plan"
  | "reminders"
  | "language"
  | "calendar"
  | "model";

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { slug: "profile", label: "Profile", note: "Name and photo" },
  {
    slug: "plan",
    label: "Plan & billing",
    note: "Team, invoices, cancellation",
    hint: "Workspaces need Team",
  },
  {
    slug: "reminders",
    label: "Reminders",
    note: "What the bell warns you about",
    hint: "Warns you about high-priority work before it starts",
  },
  {
    slug: "language",
    label: "Language & region",
    note: "Language and timezone",
    hint: "Language is saved but not applied yet",
  },
  {
    slug: "calendar",
    label: "Calendar feed",
    note: "Subscribe from Google or Apple",
    hint: "Subscribe from Google, Apple or Outlook",
  },
  {
    slug: "model",
    label: "Planning model",
    note: "Which Claude plans your day",
    hint: "Saved but not applied yet",
  },
] as const;

export const SETTINGS_ROOT = `${DASHBOARD_ROOT}/settings`;

export function settingsHref(slug: string): string {
  return `${SETTINGS_ROOT}/${slug}`;
}

/** The active section for a pathname, or null on the index. */
export function sectionFromPath(pathname: string): SettingsSection | null {
  const slug = pathname.split("/").filter(Boolean).pop();
  return SETTINGS_SECTIONS.find((s) => s.slug === slug) ?? null;
}
