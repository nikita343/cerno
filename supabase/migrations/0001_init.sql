-- Cerno — initial schema (DEVELOPMENT.md §5)
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run: every object is IF NOT EXISTS or dropped first.
--
-- The column set mirrors src/lib/types.ts field-for-field. If you change one,
-- change the other in the same commit.
--
-- Policies are written out one by one rather than generated in a DO block:
-- dollar-quoted blocks break in editors that split statements on semicolons,
-- and 12 explicit policies are easier to audit than a loop that writes them.

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

-- Today and Upcoming query by (user, plan_date); Inbox queries by status.
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
  -- One plan per user per day, so a replan upserts instead of accumulating
  -- duplicate rows for the same date.
  unique (user_id, plan_date)
);

-- ------------------------------------------------------------------ RLS
--
-- "Every table filtered by auth.uid() = user_id. No exceptions."
--
-- `using` decides which rows you may read or target.
-- `with check` decides what the row is allowed to look like afterwards.
-- Both are needed on update: without `with check`, a user could update their
-- own row and reassign its user_id to someone else.

alter table public.dumps     enable row level security;
alter table public.tasks     enable row level security;
alter table public.day_plans enable row level security;

-- dumps ---------------------------------------------------------------

drop policy if exists dumps_select on public.dumps;
drop policy if exists dumps_insert on public.dumps;
drop policy if exists dumps_update on public.dumps;
drop policy if exists dumps_delete on public.dumps;

create policy dumps_select on public.dumps
  for select to authenticated using (auth.uid() = user_id);
create policy dumps_insert on public.dumps
  for insert to authenticated with check (auth.uid() = user_id);
create policy dumps_update on public.dumps
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dumps_delete on public.dumps
  for delete to authenticated using (auth.uid() = user_id);

-- tasks ---------------------------------------------------------------

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

create policy tasks_select on public.tasks
  for select to authenticated using (auth.uid() = user_id);
create policy tasks_insert on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);
create policy tasks_update on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_delete on public.tasks
  for delete to authenticated using (auth.uid() = user_id);

-- day_plans -----------------------------------------------------------

drop policy if exists day_plans_select on public.day_plans;
drop policy if exists day_plans_insert on public.day_plans;
drop policy if exists day_plans_update on public.day_plans;
drop policy if exists day_plans_delete on public.day_plans;

create policy day_plans_select on public.day_plans
  for select to authenticated using (auth.uid() = user_id);
create policy day_plans_insert on public.day_plans
  for insert to authenticated with check (auth.uid() = user_id);
create policy day_plans_update on public.day_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy day_plans_delete on public.day_plans
  for delete to authenticated using (auth.uid() = user_id);
