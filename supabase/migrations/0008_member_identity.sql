-- Cerno — teammates should have names and faces, not "Unknown".
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0006_member_profiles.sql.
--
-- ---------------------------------------------------------------------------
-- What was wrong
-- ---------------------------------------------------------------------------
--
-- `workspace_member_profiles` read display_name and avatar_url from
-- `user_settings` only. Those columns are populated when somebody edits their
-- profile in Settings — which most people never do.
--
-- Anyone who signed in with Google already has a real name and a real photo,
-- but they live in `auth.users.raw_user_meta_data`, not in user_settings. So a
-- roster of people who had all signed in perfectly normally rendered as
-- "Unknown" with a "?" avatar.
--
-- `src/lib/user.ts` has always resolved identity correctly for the *signed-in*
-- user: settings first, then provider metadata, then the email local part. The
-- bug was that the roster used a different, worse rule for everyone else. This
-- makes the two agree.

create or replace function public.workspace_member_profiles(ws uuid)
returns table (
  user_id      uuid,
  role         text,
  joined_at    timestamptz,
  display_name text,
  avatar_url   text,
  email        text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- THIS CHECK IS THE ENTIRE ACCESS CONTROL — see 0006. It must stay first.
  if not public.is_workspace_member(ws) then
    raise exception 'not a member of that workspace';
  end if;

  return query
    select
      m.user_id,
      m.role,
      m.joined_at,
      -- Same precedence as toProfile() in the app: a name chosen in Settings is
      -- a deliberate override and wins; otherwise whatever the identity
      -- provider gave us; otherwise the local part of the address, which is at
      -- least recognisable to colleagues.
      coalesce(
        nullif(trim(s.display_name), ''),
        nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(u.email::text, '@', 1), '')
      ) as display_name,
      -- Google uses 'picture', most others 'avatar_url'. An uploaded avatar
      -- wins over both.
      coalesce(
        nullif(trim(s.avatar_url), ''),
        nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'picture'), '')
      ) as avatar_url,
      u.email::text
    from public.workspace_members m
    left join public.user_settings s on s.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.workspace_id = ws
    order by m.joined_at asc;
end;
$$;

revoke all on function public.workspace_member_profiles(uuid) from public;
grant execute on function public.workspace_member_profiles(uuid) to authenticated;

comment on function public.workspace_member_profiles(uuid) is
  'Roster for one workspace, callable only by its members. Resolves name and avatar the same way src/lib/user.ts does: settings, then provider metadata, then the email local part. Returns name, avatar and email only — never the rest of user_settings.';
