-- Cerno — user-defined labels, settings, and avatar storage.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run: every object is IF NOT EXISTS or dropped first.
--
-- Run 0001_init.sql first if you haven't.

-- --------------------------------------------------------------- labels
--
-- Why tasks keep storing label *names* in tasks.tags (text[]) rather than
-- foreign keys to this table:
--
--   - The planner speaks in names. Claude returns "work", not a uuid, and
--     mapping names to ids on every response adds a lookup that can fail
--     halfway through a plan.
--   - Every existing row keeps working. A uuid[] column would need a backfill
--     and a rewrite of the whole AI layer for referential integrity we can get
--     another way.
--
-- The cost is that a rename or delete has to cascade into tasks.tags by hand.
-- That's what the two functions at the bottom of this file are for, and they
-- are the ONLY supported way to rename or delete a label — a bare UPDATE on
-- this table will leave every tagged task pointing at a name that's gone.

create table if not exists public.labels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 24),
  -- #rrggbb. Validated here because the value is interpolated into a style
  -- attribute, and a check constraint is the last place it can be caught.
  color       text not null default '#9B9BA1'
                check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness per user: "Work" and "work" are the same label,
-- and allowing both would make tasks.tags ambiguous.
create unique index if not exists labels_user_name_idx
  on public.labels (user_id, lower(name));

-- -------------------------------------------------------- user_settings
--
-- One row per user, created lazily on first load rather than by a trigger on
-- auth.users — a trigger would only cover accounts created after this
-- migration, and existing accounts would silently have no settings.

create table if not exists public.user_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  -- Frontend-only for now: the choice is stored, nothing reads it yet.
  language            text not null default 'en' check (language in ('en', 'uk')),
  -- IANA name, e.g. "Europe/Kyiv". Not constrained: the tz database changes
  -- faster than this schema does.
  timezone            text not null default 'UTC',
  model               text not null default 'sonnet'
                        check (model in ('opus', 'sonnet', 'haiku')),
  -- How far ahead of a task's start time to warn about it.
  reminder_lead_hours integer not null default 2
                        check (reminder_lead_hours between 0 and 24),
  reminders_enabled   boolean not null default true,
  display_name        text,
  avatar_url          text,
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------------ RLS

alter table public.labels        enable row level security;
alter table public.user_settings enable row level security;

-- labels ---------------------------------------------------------------

drop policy if exists labels_select on public.labels;
drop policy if exists labels_insert on public.labels;
drop policy if exists labels_update on public.labels;
drop policy if exists labels_delete on public.labels;

create policy labels_select on public.labels
  for select to authenticated using (auth.uid() = user_id);
create policy labels_insert on public.labels
  for insert to authenticated with check (auth.uid() = user_id);
create policy labels_update on public.labels
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy labels_delete on public.labels
  for delete to authenticated using (auth.uid() = user_id);

-- user_settings --------------------------------------------------------

drop policy if exists user_settings_select on public.user_settings;
drop policy if exists user_settings_insert on public.user_settings;
drop policy if exists user_settings_update on public.user_settings;
drop policy if exists user_settings_delete on public.user_settings;

create policy user_settings_select on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
create policy user_settings_insert on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_settings_update on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_settings_delete on public.user_settings
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------- free the tags column
--
-- 0001 pinned tags to the fixed 5-label taxonomy. Labels are user-defined now,
-- so that constraint has to go. Length and emptiness are still worth enforcing:
-- dropping one constraint is not a reason to accept anything at all.

alter table public.tasks drop constraint if exists tasks_tags_check;

alter table public.tasks drop constraint if exists tasks_tags_shape_check;
alter table public.tasks add constraint tasks_tags_shape_check check (
  array_length(tags, 1) is null or (
    array_length(tags, 1) <= 10
    and array_position(tags, null) is null
    and array_position(tags, '') is null
  )
);

-- --------------------------------------------------- cascading mutations
--
-- Both run as SECURITY INVOKER (the default), so RLS still applies and a user
-- can only ever touch their own rows. Both are atomic: the label change and the
-- task rewrite either both land or neither does, which is the entire point of
-- doing this in the database rather than as two round trips from the browser.

create or replace function public.rename_label(label_id uuid, new_name text)
returns void
language plpgsql
as $fn$
declare
  old_name text;
begin
  select name into old_name from public.labels where id = label_id;
  if old_name is null then
    raise exception 'label not found';
  end if;

  update public.labels set name = new_name where id = label_id;

  -- Only rows the caller owns are visible here, so this cannot rewrite
  -- another user's tasks even though it filters on the name alone.
  update public.tasks
     set tags = array_replace(tags, old_name, new_name)
   where tags @> array[old_name];
end;
$fn$;

create or replace function public.delete_label(label_id uuid)
returns void
language plpgsql
as $fn$
declare
  old_name text;
begin
  select name into old_name from public.labels where id = label_id;
  if old_name is null then
    raise exception 'label not found';
  end if;

  delete from public.labels where id = label_id;

  update public.tasks
     set tags = array_remove(tags, old_name)
   where tags @> array[old_name];
end;
$fn$;

grant execute on function public.rename_label(uuid, text) to authenticated;
grant execute on function public.delete_label(uuid) to authenticated;

-- ------------------------------------------------------- avatar storage
--
-- Public-read bucket: avatars render in an <img>, and signing every URL would
-- mean a round trip before the sidebar can paint.
--
-- Writes are restricted to a folder named after the user's uid, so the object
-- path is what enforces ownership. Without the folder check any authenticated
-- user could overwrite any other user's avatar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;
drop policy if exists avatars_delete on storage.objects;

create policy avatars_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
