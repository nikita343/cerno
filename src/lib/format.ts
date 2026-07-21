/**
 * Per-task time text. The designs render "90 min" rather than "1h 30m", so
 * single tasks always read in whole minutes.
 */
export function taskDuration(minutes: number): string {
  return `${minutes} min`;
}

/**
 * Aggregate duration for section totals and capacity notes: "2h 35m".
 * Falls back to "45m" under an hour and "3h" on the hour.
 */
export function totalDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/**
 * Ukrainian plural selection.
 *
 * Ukrainian has three forms where English has two: 1 задача, 2–4 задачі,
 * 5+ задач — and the rule is on the last digits, not the magnitude, so 21 takes
 * the singular and 11 does not. `Intl.PluralRules` knows this; hand-rolled
 * `n === 1 ? a : b` does not, which is why counts must not be interpolated into
 * translated strings directly.
 */
export function plural(
  count: number,
  language: string,
  forms: { one: string; few?: string; many: string },
): string {
  const category = new Intl.PluralRules(language).select(count);
  if (category === "one") return forms.one;
  if (category === "few") return forms.few ?? forms.many;
  return forms.many;
}
