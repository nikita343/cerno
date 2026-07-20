# NotificationCenter / NotificationBell

The in-app reminder surface: a bell with a count, and a panel listing what is
overdue or about to start.

## Split, and why

| | |
|---|---|
| `NotificationBell` | The trigger. Rendered **twice** — once in `Sidebar`, once in `MobileTopBar`. |
| `NotificationCenter` | The panel. Rendered **once**, by `AppShell`. |

Both bars are always in the DOM and swapped by CSS at 960px, so anything placed
in both exists twice. For a button that is harmless. For the panel it is not:
two `role="dialog"` elements with the same label, two Escape handlers, and two
`focus()` calls competing on open. That bug was shipped and caught in testing —
don't reunify them.

They share one stylesheet, because the badge and the panel belong to the same
visual object.

## State

Everything lives in the store, so both bells agree:

- `notificationsOpen` — panel visibility
- `dismissedReminders` — ids hidden this session, cleared on reload
- `nowMinutes` — the ticking clock, driven by `useNowTicker` in `AppShell`

## Reminders

Derived, never stored — see `lib/reminders.ts` and `lib/useReminders.ts`. The
same hook feeds `TodayView`'s row badges, so the panel and the timeline cannot
disagree about what is late.

Two kinds:

- **`overdue`** — the task's scheduled *finish* has passed. Not its start: a
  task flagged the moment it comes up would be "overdue" while you're sitting
  down to do it, which is technically true and useless.
- **`soon`** — starts within `reminder_lead_hours`, **high priority only**. A
  reminder for every task in the next two hours is just the timeline again.

**Overdue rows have no dismiss button.** The only way to clear one is to
complete or reschedule the task. A dismissable overdue warning is a warning that
goes away when it's inconvenient. Dismissals are also filtered *after* the list
is built, so dismissing "starts in 20 minutes" doesn't also silence "40 minutes
late" when that same task goes late.

## Layout

One panel, two shapes, decided in CSS:

- **Desktop** — dropdown anchored top-left, under the sidebar bell. It is left-
  anchored because the bell is; a right-anchored panel opened across the screen
  from its own trigger.
- **Mobile** — bottom sheet. The bell is in the top bar, but a panel anchored to
  it would sit out of thumb reach on a tall phone.

## Gotchas

- The panel is `position: fixed`, so it needs no positioned ancestor and is free
  to render from `AppShell` rather than beside a bell.
- `usePresence` keeps it mounted through the exit animation; `EXIT_MS` must stay
  in step with the stylesheet.
- `env(safe-area-inset-bottom)` padding on the sheet is **untested** — it
  resolves to 0 in headless Chrome and needs a real device with a home
  indicator.
