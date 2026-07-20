# UpcomingView

Route `/upcoming`. A week agenda grouped by day — deliberately **not** a time
grid (that's Tier 3 in DEVELOPMENT.md).

## The calendar is live

- 7-day strip, Monday-first, from `weekDates(upcomingAnchor)`
- `‹` / `›` step the anchor by a week (`stepUpcomingWeek`)
- "Today" jumps back to the current week; disabled when already there
- Today's cell gets the red circle; days with work get a marker dot
- Clicking a day scrolls its group into view (it does **not** filter — the week
  stays visible as context)

## Day groups

Headings come from `relativeDayTitle`: "Today" / "Tomorrow" / weekday name
within the week / "Jul 28" beyond. Empty days render the dashed
"Nothing planned yet." card rather than being hidden — an empty Thursday is
information.

## Gotchas

- `upcomingAnchor` is transient store state, reset to today on mount.
- All date maths goes through `src/lib/date.ts`, which builds Dates with the
  local-time constructor. Never `new Date("2026-07-20")` — that parses as UTC
  and shifts the day for anyone west of Greenwich.
