-- Cerno — readable names for the people you share a workspace with.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0005_workspaces.sql.
--
-- ---------------------------------------------------------------------------
-- The problem this solves
-- ---------------------------------------------------------------------------
--
-- `user_settings` holds display_name and avatar_url, and its RLS is strictly
-- `user_id = auth.uid()`. Correct — it also holds timezone, planning model and
-- reminder preferences, none of which are a teammate's business. But it means a
-- member list can prove somebody is in a workspace and not say who they are.
--
-- Two ways to fix it, and the obvious one is wrong:
--
--   ✗ Loosen the user_settings policy to "or shares a workspace with me".
--     That exposes every column, so joining a workspace would hand your
--     colleagues your timezone and which model you pay for.
--
--   ✗ A separate `profiles` table synced by trigger. A second copy of the same
--     two fields, which then has to be kept in step forever, and drifts the
--     first time someone writes to one and not the other.
--
--   ✓ One SECURITY DEFINER function that returns *only* the three fields a
--     teammate needs, and only to people who are already in the workspace.
--
-- No new table, no duplication, no sync, and the exposed surface is three
-- columns rather than nine.

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
  -- THIS CHECK IS THE ENTIRE ACCESS CONTROL.
  --
  -- The function is SECURITY DEFINER, so everything below runs with RLS
  -- bypassed. Without this line any authenticated user could pass any
  -- workspace id and read its roster. It must stay the first statement.
  if not public.is_workspace_member(ws) then
    raise exception 'not a member of that workspace';
  end if;

  return query
    select
      m.user_id,
      m.role,
      m.joined_at,
      s.display_name,
      s.avatar_url,
      -- Email is how you recognise a colleague who never set a display name.
      -- It is already what they typed to be invited, so it reveals nothing to
      -- the people who invited them.
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

-- Assignee names on shared tasks need the same treatment: a task assigned to
-- someone whose name you cannot read is a task assigned to a uuid.
-- Deliberately scoped by workspace rather than "anyone I share any workspace
-- with", so one screen's query cannot enumerate your whole org.
comment on function public.workspace_member_profiles(uuid) is
  'Roster for one workspace, callable only by its members. Returns name, avatar and email only — never the rest of user_settings.';
