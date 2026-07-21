import { addDays } from "./date";

/**
 * iCalendar (RFC 5545) serialisation.
 *
 * Hand-written rather than pulled from a library: the spec's fiddly parts are
 * few and well-defined, and a dependency here would be far larger than the
 * subset a task feed needs. The fiddly parts are exactly three — CRLF endings,
 * 75-octet line folding, and text escaping — and each is handled below.
 */

export interface FeedTask {
  id: string;
  title: string;
  description: string | null;
  /** `YYYY-MM-DD`. */
  plan_date: string;
  /** `HH:MM[:SS]`, or null for an all-day entry. */
  suggested_start: string | null;
  estimated_minutes: number;
}

/**
 * Escapes a TEXT value.
 *
 * Order matters: backslashes must be escaped first, or the escapes added for
 * the other characters would themselves be escaped again.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line to 75 octets, per RFC 5545 §3.1.
 *
 * Measured in UTF-8 *bytes*, not characters — a line of emoji or Cyrillic is
 * well under 75 characters while being far over 75 octets, and folding on
 * character count would produce a file some parsers reject. Continuations are
 * split on byte boundaries that don't sever a multi-byte sequence.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  // 74 on continuation lines: the leading space counts toward the limit.
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Walk back off a continuation byte (10xxxxxx) so a code point is never
    // split across two folded lines.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74;
  }

  return parts.join("\r\n ");
}

/** `2026-07-21` -> `20260721`. */
function dateOnly(iso: string): string {
  return iso.replace(/-/g, "");
}

/**
 * Local date+time as a floating value: `20260721T103000`.
 *
 * Deliberately without a `Z` and without a TZID. A floating time means "10:30
 * wherever the viewer is", which is what a planner wants — a task planned for
 * 10:30 should read 10:30 after you fly somewhere, not shift by the offset.
 * Anchoring to UTC would require knowing the user's zone at write time and
 * would silently move every entry when they travel.
 */
function localDateTime(iso: string, clock: string): string {
  const [h = "00", m = "00"] = clock.split(":");
  return `${dateOnly(iso)}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
}

function addMinutes(iso: string, clock: string, minutes: number): string {
  const [h, m] = clock.split(":").map(Number);
  const base = new Date(2000, 0, 1, h || 0, m || 0);
  base.setMinutes(base.getMinutes() + minutes);

  // A task can run past midnight; roll the date with it rather than clamping,
  // or the event would end before it starts and clients would drop it.
  const dayShift = Math.floor(
    (h * 60 + m + minutes) / (24 * 60),
  );
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + dayShift);

  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(base.getHours()).padStart(2, "0");
  const mm = String(base.getMinutes()).padStart(2, "0");
  return `${y}${mo}${d}T${hh}${mm}00`;
}

/** UTC stamp: `20260721T103000Z`. */
function utcStamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export function buildCalendar({
  tasks,
  name = "Cerno",
  now = new Date(),
}: {
  tasks: FeedTask[];
  name?: string;
  now?: Date;
}): string {
  const stamp = utcStamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cerno//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    // Hints to Google/Apple how often to re-poll. Advisory only — clients
    // routinely ignore it and refresh on their own schedule.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const task of tasks) {
    lines.push("BEGIN:VEVENT");
    // Stable per task, so re-fetching updates the existing event instead of
    // creating a duplicate every refresh.
    lines.push(`UID:${task.id}@cerno`);
    lines.push(`DTSTAMP:${stamp}`);

    if (task.suggested_start) {
      const clock = task.suggested_start.slice(0, 5);
      lines.push(`DTSTART:${localDateTime(task.plan_date, clock)}`);
      lines.push(
        `DTEND:${addMinutes(task.plan_date, clock, task.estimated_minutes)}`,
      );
    } else {
      // No time of day: an all-day entry. DTEND is exclusive in the DATE form,
      // so it is the following day — using the same date yields a zero-length
      // event that several clients refuse to render.
      //
      // `addDays` rather than Date arithmetic: building a Date and calling
      // toISOString() shifts to UTC, so east of Greenwich local midnight on the
      // 23rd serialises as the 22nd and every all-day event ends a day early.
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(task.plan_date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateOnly(addDays(task.plan_date, 1))}`);
    }

    lines.push(`SUMMARY:${escapeText(task.title)}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${escapeText(task.description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF is required by the spec, not a stylistic choice — some parsers reject
  // bare LF outright.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
