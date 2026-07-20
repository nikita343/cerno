/**
 * Date helpers.
 *
 * Everything crossing the SSR boundary is an ISO `YYYY-MM-DD` string, and all
 * Date objects are built with the local-time constructor `new Date(y, m, d)`.
 * Parsing `"2026-07-20"` with `new Date(str)` would treat it as UTC midnight
 * and shift the day for anyone west of Greenwich, so we never do that.
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `YYYY-MM-DD` for a Date, in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` into a local-midnight Date. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `a` to `b`. Negative when `b` is in the past. */
export function daysBetween(a: string, b: string): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-first start of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = fromISODate(iso);
  const dow = d.getDay(); // 0 = Sunday
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return toISODate(d);
}

/** The 7 ISO dates of the Monday-first week containing `iso`. */
export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Single letter for the day strip: M T W T F S S. */
export function dayLetter(iso: string): string {
  return DAY_NAMES[fromISODate(iso).getDay()].charAt(0);
}

export function dayOfMonth(iso: string): number {
  return fromISODate(iso).getDate();
}

export function dayName(iso: string): string {
  return DAY_NAMES[fromISODate(iso).getDay()];
}

export function dayNameShort(iso: string): string {
  return DAY_SHORT[fromISODate(iso).getDay()];
}

export function monthYear(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "July 20" */
export function monthDay(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** "Saturday, July 18" — the Today header eyebrow. */
export function eyebrowDate(iso: string): string {
  const d = fromISODate(iso);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Heading for an Upcoming day group: "Today" / "Tomorrow" / weekday name for
 * the next week, then "Jul 28" beyond that.
 */
export function relativeDayTitle(iso: string, today: string): string {
  const delta = daysBetween(today, iso);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta > 1 && delta < 7) return dayName(iso);
  return monthDay(iso);
}

/** Sub-line beside the group heading — never repeats the title. */
export function relativeDaySub(iso: string, today: string): string {
  const delta = daysBetween(today, iso);
  if (delta === 0 || delta === 1 || delta === -1) return dayName(iso);
  if (delta > 1 && delta < 7) return monthDay(iso);
  return dayName(iso);
}

/**
 * The deadline pill text: "due Tue" inside the coming week, "due Jul 28"
 * beyond it, "due today" / "due tomorrow" at the edges.
 */
export function deadlineLabel(iso: string, today: string): string {
  const delta = daysBetween(today, iso);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta > 1 && delta < 7) return dayNameShort(iso);
  const d = fromISODate(iso);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}
