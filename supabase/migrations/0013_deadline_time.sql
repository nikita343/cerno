-- Cerno — a clock time on the deadline.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run.
--
-- Run the earlier migrations first if you haven't.

-- `deadline` is a date (YYYY-MM-DD) — the day something is due BY. This adds the
-- optional time of day, so "submit the deck by 18:00 today" keeps the 18:00.
--
-- Separate nullable column rather than turning `deadline` into a timestamp: most
-- deadlines are a plain day with no time, and a null here means exactly that —
-- "due that day, no particular time" — which the pill uses to decide whether to
-- show a clock time at all.

alter table public.tasks
  add column if not exists deadline_time text;

-- Stored as HH:MM (24h). Bounded so a bad value can't slip past the app layer.
alter table public.tasks drop constraint if exists tasks_deadline_time_fmt_check;
alter table public.tasks add constraint tasks_deadline_time_fmt_check
  check (deadline_time is null or deadline_time ~ '^[0-2][0-9]:[0-5][0-9]$');
