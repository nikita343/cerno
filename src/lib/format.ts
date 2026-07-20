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
