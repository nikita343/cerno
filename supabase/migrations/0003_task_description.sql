-- Cerno — user-written task descriptions.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run.
--
-- Run 0001 and 0002 first if you haven't.

-- `description` is the user's own note. It is deliberately NOT the same field as
-- `reasoning`, which is Cerno's one-line explanation of why a task sits where it
-- does. Merging them would mean editing your own note destroys the planner's
-- rationale, and a replan overwriting a note you typed.
--
-- Nullable with no default: null means "never written", which the card uses to
-- decide whether to render the block at all. An empty string would be
-- indistinguishable from a description the user deliberately cleared.

alter table public.tasks
  add column if not exists description text;

-- Long enough for real notes, bounded so a paste can't put a megabyte in a row
-- that gets loaded on every dashboard render.
alter table public.tasks drop constraint if exists tasks_description_len_check;
alter table public.tasks add constraint tasks_description_len_check
  check (description is null or length(description) <= 2000);
