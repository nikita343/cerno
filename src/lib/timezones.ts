import { DEFAULT_SETTINGS } from "./types";

/**
 * The full IANA timezone list, grouped for a picker.
 *
 * Sourced from `Intl.supportedValuesOf("timeZone")` rather than a bundled
 * table: the tz database changes several times a year (political boundaries,
 * DST rule changes), and a hardcoded list silently rots. The browser's copy is
 * maintained by the platform.
 */

/** Regions are the first path segment: "Europe/Kyiv" -> "Europe". */
export interface ZoneGroup {
  region: string;
  zones: ZoneOption[];
}

export interface ZoneOption {
  value: string;
  /** "Kyiv" or "North Dakota / Center" — the zone without its region. */
  label: string;
  /** "UTC+03:00" at the moment of computation. */
  offset: string;
  /** Minutes east of UTC, for sorting. */
  offsetMinutes: number;
}

/**
 * A conservative fallback for engines without `supportedValuesOf`.
 *
 * Only reached on older browsers. It must still contain the user's own zone,
 * which the caller adds, or the picker would silently show the wrong value.
 */
const FALLBACK_ZONES = [
  "UTC",
  "Europe/Kyiv",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Warsaw",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

/**
 * Modern display names for zones the tz database has renamed.
 *
 * Many ICU builds still enumerate the legacy identifiers — Chrome and Node both
 * return `Europe/Kiev`, not `Europe/Kyiv`. Two things go wrong without this:
 *
 *   - The city is shown under an outdated name. For Kyiv specifically that is
 *     not a cosmetic detail, and this app ships a Ukrainian locale.
 *   - A user whose OS reports the modern name gets *two* entries for the same
 *     place, because the modern one is folded in separately below.
 *
 * Only the label is rewritten. The stored value stays whatever the platform
 * enumerated, so it is always a zone this engine accepts.
 */
const RENAMED: Record<string, string> = {
  "Europe/Kiev": "Kyiv",
  "Asia/Katmandu": "Kathmandu",
  "Asia/Calcutta": "Kolkata",
  "Asia/Saigon": "Ho Chi Minh City",
  "Asia/Rangoon": "Yangon",
  "Asia/Ulan_Bator": "Ulaanbaatar",
  "Africa/Asmera": "Asmara",
  "America/Godthab": "Nuuk",
  "Atlantic/Faeroe": "Tórshavn",
  "Pacific/Ponape": "Pohnpei",
  "Pacific/Truk": "Chuuk",
};

/**
 * The zone an engine actually resolves an identifier to.
 *
 * Used to collapse aliases: `Europe/Kyiv` and `Europe/Kiev` are the same place,
 * and listing both would be confusing rather than thorough.
 */
function canonicalZone(zone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions()
        .timeZone || zone
    );
  } catch {
    return zone;
  }
}

function listZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    const values = intl.supportedValuesOf?.("timeZone");
    if (values && values.length > 0) return values;
  } catch {
    // Falls through — some engines throw rather than returning undefined.
  }
  return FALLBACK_ZONES;
}

/**
 * The zone's current UTC offset, in minutes.
 *
 * Computed via `formatToParts` with `timeZoneName: "longOffset"` because there
 * is no direct API for it. Returns 0 when the engine can't resolve the zone,
 * which only affects sort position — never correctness of the stored value.
 */
function offsetMinutesFor(zone: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(now);

    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // "GMT+03:00", "GMT-05:30", or bare "GMT" at exactly UTC.
    const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
    if (!match) return 0;

    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? 0);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

/** The browser's own zone, or UTC when it can't be determined. */
export function browserTimezone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      DEFAULT_SETTINGS.timezone
    );
  } catch {
    return DEFAULT_SETTINGS.timezone;
  }
}

/**
 * Every zone, grouped by region and sorted west-to-east within each.
 *
 * `current` is folded in so a value stored on another device still appears even
 * if this engine doesn't list it — otherwise the select would fall back to its
 * first option and silently rewrite the user's setting on the next save.
 */
export function timezoneGroups(current?: string): ZoneGroup[] {
  const now = new Date();
  const all = listZones();

  const groups = new Map<string, ZoneOption[]>();
  // Aliases collapse to one entry. The user's own zone is added first below so
  // that when it collides with a legacy alias, the value we keep is the one
  // their system actually reported.
  const seen = new Set<string>();

  // UTC is added explicitly: `supportedValuesOf` enumerates only region-based
  // zones, so without this the neutral option is missing entirely and someone
  // could never switch *to* it — only away from it, one way.
  const ordered = [current, browserTimezone(), "UTC", ...all].filter(
    (z): z is string => Boolean(z),
  );

  for (const zone of ordered) {
    const canonical = canonicalZone(zone);
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const slash = zone.indexOf("/");
    // Zones with no region ("UTC", "GMT") get their own bucket rather than
    // being dropped or filed under a region they don't belong to.
    const region = slash === -1 ? "Other" : zone.slice(0, slash);
    const label =
      RENAMED[zone] ??
      (slash === -1 ? zone : zone.slice(slash + 1)).replace(/[_/]/g, (c) =>
        c === "_" ? " " : " / ",
      );

    const offsetMinutes = offsetMinutesFor(zone, now);
    const list = groups.get(region) ?? [];
    list.push({
      value: zone,
      label,
      offset: formatOffset(offsetMinutes),
      offsetMinutes,
    });
    groups.set(region, list);
  }

  return [...groups.entries()]
    .map(([region, zones]) => ({
      region,
      zones: zones.sort(
        (a, b) =>
          a.offsetMinutes - b.offsetMinutes || a.label.localeCompare(b.label),
      ),
    }))
    .sort((a, b) => {
      // "Other" holds UTC/GMT and belongs at the top as the neutral choice.
      if (a.region === "Other") return -1;
      if (b.region === "Other") return 1;
      return a.region.localeCompare(b.region);
    });
}
