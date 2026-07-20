-- Cerno — initial schema (DEVELOPMENT.md §5)
--
-- Run this in the Supabase SQL editor, or `supabase db push` if you use the CLI.
-- Safe to re-run: every object is created with IF NOT EXISTS or dropped first.
--
-- The column set mirrors src/lib/types.ts field-for-field. If you change one,
-- change the other in the same commit.

-- ---------------------------------------------------------------- dumps

create table if not exists public.dumps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  raw_text    text not null,
  source      text not null default 'text' check (source in ('text', 'voice')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- tasks

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  -- A task outlives the dump it came from; quick-adds have no dump at all.
  dump_id           uuid references public.dumps (id) on delete set null,
  title             text not null,
  priority          text not null default 'medium'
                      check (priority in ('high', 'medium', 'low')),
  estimated_minutes integer not null default 30
                      check (estimated_minutes between 5 and 480),
  deadline          date,
  suggested_start   time,
  status            text not null default 'inbox'
                      check (status in ('inbox', 'today', 'deferred', 'done')),
  plan_date         date,
  -- Fixed 5-label taxonomy. Enforced here as well as in the prompt, because a
  -- schema is the only place a constraint actually holds.
  tags              text[] not null default '{}'
                      check (tags <@ array['work','home','errand','comms','health']::text[]),
  reasoning         text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

-- Today and Upcoming both query by (user, plan_date); Inbox queries by status.
create index if not exists tasks_user_plan_date_idx
  on public.tasks (user_id, plan_date);
create index if not exists tasks_user_status_idx
  on public.tasks (user_id, status);

-- ------------------------------------------------------------ day_plans

create table if not exists public.day_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  plan_date     date not null,
  summary       text not null default '',
  capacity_note text not null default '',
  created_at    timestamptz not null default now(),
  -- One plan per user per day. Lets a replan upsert instead of accumulating
  -- duplicate rows for the same date.
  unique (user_id, plan_date)
);

-- ------------------------------------------------------------------ RLS
--
-- "Every table filtered by auth.uid() = user_id. No exceptions."
--
-- Note the separate with-check on insert/update: `using` decides which rows you
-- may read or target, `with check` decides what the row is allowed to look like
-- afterwards. Without the latter, a user could update a row and reassign its
-- user_id to someone else.

alter table public.dumps     enable row level security;
alter table public.tasks     enable row level security;
alter table public.day_plans enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['dumps', 'tasks', 'day_plans'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      t || '_delete', t);
  end loop;
end $$;
