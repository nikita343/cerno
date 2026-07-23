/**
 * Date helpers.
 *
 * Everything crossing the SSR boundary is an ISO `YYYY-MM-DD` string, and all
 * Date objects are built with the local-time constructor `new Date(y, m, d)`.
 * Parsing `"2026-07-20"` with `new Date(str)` would treat it as UTC midnight
 * and shift the day for anyone west of Greenwich, so we never do that.
 */

/**
 * Weekday and month names are localised through `Intl.DateTimeFormat`. Every
 * name-producing function below takes a BCP-47 `locale` (default `"en-US"`),
 * so a Ukrainian account gets "понеділок" / "липня" where an English one gets
 * "Monday" / "July". The `locale` is passed in rather than read from a hook
 * because this module also runs outside React (the iCal serialiser, tests).
 */
export type DateLocale = string;

const DEFAULT_LOCALE: DateLocale = "en-US";

/** Maps the app language enum to a BCP-47 locale for `Intl`. */
export function localeFor(language: string): DateLocale {
  return language === "uk" ? "uk-UA" : "en-US";
}

/** Formats a local-midnight ISO date with the given Intl options. */
function fmt(
  iso: string,
  locale: DateLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(fromISODate(iso));
}

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

/**
 * Today's date (`YYYY-MM-DD`) in a specific IANA timezone.
 *
 * The whole point of the timezone setting: a user in Kyiv at 00:30 is already
 * on tomorrow even though it's still yesterday in UTC. Computed from the same
 * absolute instant on server and client, so both agree and there's no hydration
 * flip. Falls back to the device date on an invalid zone.
 */
export function todayInZone(timezone: string, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return now.toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return toISODate(now);
  }
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

/** Single letter for the day strip: M T W T F S S (localised). */
export function dayLetter(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { weekday: "narrow" });
}

export function dayOfMonth(iso: string): number {
  return fromISODate(iso).getDate();
}

/** The seven Monday-first weekday narrow letters, localised — for grid headers. */
export function weekdayLetters(locale: DateLocale = DEFAULT_LOCALE): string[] {
  // 2024-01-01 was a Monday; format it and the six days that follow.
  return Array.from({ length: 7 }, (_, i) =>
    fmt(addDays("2024-01-01", i), locale, { weekday: "narrow" }),
  );
}

export function dayName(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { weekday: "long" });
}

export function dayNameShort(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { weekday: "short" });
}

export function monthYear(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { month: "long", year: "numeric" });
}

/** "July 20" */
export function monthDay(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { month: "long", day: "numeric" });
}

/** "Jul 20" — for rows too narrow for the full month name. */
export function monthDayShort(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { month: "short", day: "numeric" });
}

/** "Saturday, July 18" — the Today header eyebrow. */
export function eyebrowDate(iso: string, locale: DateLocale = DEFAULT_LOCALE): string {
  return fmt(iso, locale, { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Heading for an Upcoming day group: "Today" / "Tomorrow" / weekday name for
 * the next week, then "Jul 28" beyond that.
 */
export function relativeDayTitle(
  iso: string,
  today: string,
  /**
   * Translations for the three relative days.
   *
   * Passed in rather than imported: this module is used outside React — by the
   * iCal serialiser and by tests — where a hook can't be called. Callers inside
   * a component pass `t.date`; everything else gets English.
   */
  labels: RelativeDayLabels = EN_RELATIVE_DAYS,
  locale: DateLocale = DEFAULT_LOCALE,
): string {
  const delta = daysBetween(today, iso);
  if (delta === 0) return labels.today;
  if (delta === 1) return labels.tomorrow;
  if (delta === -1) return labels.yesterday;
  if (delta > 1 && delta < 7) return dayName(iso, locale);
  return monthDay(iso, locale);
}

export interface RelativeDayLabels {
  today: string;
  tomorrow: string;
  yesterday: string;
}

const EN_RELATIVE_DAYS: RelativeDayLabels = {
  today: "Today",
  tomorrow: "Tomorrow",
  yesterday: "Yesterday",
};

/** Sub-line beside the group heading — never repeats the title. */
export function relativeDaySub(
  iso: string,
  today: string,
  locale: DateLocale = DEFAULT_LOCALE,
): string {
  const delta = daysBetween(today, iso);
  if (delta === 0 || delta === 1 || delta === -1) return dayName(iso, locale);
  if (delta > 1 && delta < 7) return monthDay(iso, locale);
  return dayName(iso, locale);
}

/**
 * The deadline pill text: "due Tue" inside the coming week, "due Jul 28"
 * beyond it, "due today" / "due tomorrow" at the edges. The "today"/"tomorrow"
 * words come from the caller's dictionary; everything else from Intl.
 */
export function deadlineLabel(
  iso: string,
  today: string,
  labels: RelativeDayLabels = EN_RELATIVE_DAYS,
  locale: DateLocale = DEFAULT_LOCALE,
): string {
  const delta = daysBetween(today, iso);
  if (delta === 0) return labels.today.toLowerCase();
  if (delta === 1) return labels.tomorrow.toLowerCase();
  if (delta > 1 && delta < 7) return dayNameShort(iso, locale);
  return monthDayShort(iso, locale);
}
