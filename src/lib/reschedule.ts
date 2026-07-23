import {
  addDays,
  dayNameShort,
  fromISODate,
  monthDayShort,
  toISODate,
  type DateLocale,
} from "./date";

/**
 * The quick date choices offered when rescheduling.
 *
 * Mirrors the vocabulary people already know from other planners — Today,
 * Tomorrow, This weekend, Next week — because a date picker is the last place
 * to be original.
 */

export type PresetKey =
  | "today"
  | "tomorrow"
  | "weekend"
  | "nextWeek"
  | "noDate";

export interface Preset {
  key: PresetKey;
  label: string;
  /** The resolved date, or null for "no date". */
  date: string | null;
  /** Right-aligned hint: "Tue", "Mon 27 Jul". */
  hint: string;
}

const SATURDAY = 6;

/**
 * The coming Saturday.
 *
 * On a Saturday this returns *today*, not next week — "this weekend" on a
 * Saturday means today. On a Sunday it returns the Sunday itself, because the
 * weekend the person means is the one they are standing in, not the next one.
 */
export function thisWeekend(today: string): string {
  const day = fromISODate(today).getDay();
  if (day === 0 || day === SATURDAY) return today;
  return addDays(today, SATURDAY - day);
}

/**
 * The next Monday.
 *
 * Always strictly in the future: asked on a Monday, it means the Monday a week
 * out, not this morning — "next week" that resolves to today is never what
 * someone rescheduling meant.
 */
export function nextWeek(today: string): string {
  const day = fromISODate(today).getDay();
  const untilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  return addDays(today, untilMonday);
}

/** Preset labels, passed in so this module stays usable outside React. */
export interface PresetLabels {
  today: string;
  tomorrow: string;
  weekend: string;
  nextWeek: string;
  noDate: string;
}

const EN_PRESET_LABELS: PresetLabels = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  nextWeek: "Next week",
  noDate: "No date",
};

export function buildPresets(
  today: string,
  labels: PresetLabels = EN_PRESET_LABELS,
  locale?: DateLocale,
): Preset[] {
  const tomorrow = addDays(today, 1);
  const weekend = thisWeekend(today);
  const week = nextWeek(today);

  return [
    {
      key: "today",
      label: labels.today,
      date: today,
      hint: dayNameShort(today, locale),
    },
    {
      key: "tomorrow",
      label: labels.tomorrow,
      date: tomorrow,
      hint: dayNameShort(tomorrow, locale),
    },
    {
      key: "weekend",
      label: labels.weekend,
      date: weekend,
      hint: dayNameShort(weekend, locale),
    },
    {
      key: "nextWeek",
      label: labels.nextWeek,
      date: week,
      // Further out than the others, so a bare weekday would be ambiguous.
      hint: `${dayNameShort(week, locale)} ${monthDayShort(week, locale)}`,
    },
    { key: "noDate", label: labels.noDate, date: null, hint: "" },
  ];
}

/* -------------------------------------------------------------------------- */
/* Month grid                                                                  */
/* -------------------------------------------------------------------------- */

export interface MonthCell {
  /** ISO date, or null for the blank leading cells before the 1st. */
  date: string | null;
  day: number;
}

/**
 * A Monday-first month grid.
 *
 * Leading blanks rather than trailing days from the previous month: a greyed
 * neighbouring day invites a click that then silently changes month, and this
 * grid is small enough that the empty cells read fine.
 */
export function monthGrid(anchorISO: string): MonthCell[] {
  const anchor = fromISODate(anchorISO);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // getDay() is Sunday-first; the grid is Monday-first.
  const lead = (first.getDay() + 6) % 7;

  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ date: null, day: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toISODate(new Date(year, month, d)), day: d });
  }
  return cells;
}

/** Same month, shifted by whole months. Clamped to the 1st to avoid overflow. */
export function shiftMonth(anchorISO: string, delta: number): string {
  const anchor = fromISODate(anchorISO);
  // Day 1, not the anchor's own day: shifting 31 Jan by one month would
  // otherwise land on 2 or 3 March.
  return toISODate(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
}

/* ------------------------------------------------------------------- times */

export interface TimePreset {
  /** `HH:MM`. */
  value: string;
  label: string;
}

/**
 * The four times worth one tap.
 *
 * Anchored to the parts of the day the timeline already groups by (see
 * `TIME_BLOCKS`), so picking "Afternoon" here lands the task in the Afternoon
 * block rather than somewhere near it. Anything else is a job for the exact
 * time field — presets are for the common case, not for expressing everything.
 */
export const TIME_PRESETS: readonly TimePreset[] = [
  { value: "09:00", label: "Morning" },
  { value: "12:00", label: "Midday" },
  { value: "15:00", label: "Afternoon" },
  { value: "18:00", label: "Evening" },
] as const;

/**
 * Normalises what an `<input type="time">` gives back.
 *
 * Empty means cleared. Browsers may include seconds (`14:30:00`), which the
 * column does not want and which would make an equality check against a preset
 * fail — so it is trimmed to `HH:MM`.
 */
export function normaliseTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
