# TaskChip

The atomic task row. Every screen that shows a task composes this — Today,
Inbox, Upcoming, Filters results, Search results.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `task` | `Task` | — | Full domain object (see `src/lib/types.ts`) |
| `today` | `string` | — | ISO date. Required, because the deadline pill is phrased *relative* to it ("due Wed" vs "due Jul 28") |
| `showReasoning` | `boolean` | `false` | Renders the indented rule + reasoning line beneath the row |
| `showTag` | `boolean` | `true` | Hides the label pill when a view already groups by tag |
| `showPriority` | `boolean` | `true` | Hides the priority badge where the surrounding UI already conveys it |
| `done` | `boolean` | `task.status === "done"` | Explicit override; otherwise derived |
| `onClick` | `() => void` | — | When present the chip renders as a `<button>` instead of a `<div>` |

## Behaviour

- **Priority dot** — coloured from the `--prio-*` ramp, and pulsing
  (`cernoPulse`) when `priority === "high"` and not done. A done task's dot
  reverts to `--dot-neutral`.
- **Priority badge** — HIGH / MED / LOW. Only high reaches a solid accent fill;
  medium is a 16% tint and low is a plain outline. A row can already carry a
  duration, a deadline pill and a tag pill, and three solid fills in one line is
  noise. A done task's badge drops to the neutral outline — a finished task
  shouldn't still be shouting its priority.
- **Done state** — dot goes neutral, title becomes `--text-muted` with
  `line-through`.
- **Tags** — `task.tags` is an array to match the Supabase column, but the chip
  only ever renders `tags[0]`; the design has room for one pill. Colour comes
  from `labelColor()`, never from the database.
- **Narrow screens** (≤479px) — the meta pills wrap to a second line rather
  than squeezing the title, which is the thing you scan.

## Gotchas

- Don't pass `today` from `new Date()` inside this component. It must come from
  the store so server and client render identical markup.
- Adding a second tag pill means changing the layout, not just the map — the
  row is a single flex line by design.
