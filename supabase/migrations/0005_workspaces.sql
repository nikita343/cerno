-- Cerno — workspaces, membership, invites, roles, and billing entitlement.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run: every object is IF NOT EXISTS or dropped first.
--
-- Run 0001–0004 first if you haven't.
--
-- ============================================================================
-- READ THIS BEFORE CHANGING ANY POLICY IN THIS FILE
-- ============================================================================
--
-- Every policy before this migration said "user_id = auth.uid()". One row, one
-- owner, no ambiguity. This file introduces the first data in Cerno that more
-- than one account can read, and that changes what a mistake costs: a bad
-- policy here does not break a screen, it shows one customer another
-- customer's tasks.
--
-- Two rules follow.
--
-- 1. MEMBERSHIP IS CHECKED THROUGH A SECURITY DEFINER FUNCTION, NEVER INLINE.
--    A policy on workspace_members that queries workspace_members recurses
--    infinitely — Postgres re-enters the policy to evaluate the subquery. The
--    is_workspace_member/is_workspace_admin functions below run as the table
--    owner, so they bypass RLS and terminate. Do not "simplify" them back into
--    inline EXISTS clauses.
--
-- 2. ENTITLEMENT IS NEVER CLIENT-WRITABLE.
--    public.subscriptions has SELECT policies and no INSERT/UPDATE/DELETE
--    policies at all. Only the Stripe webhook, holding the service-role key,
--    writes it. If the browser could set status = 'active' the paid tier would
--    be a suggestion.

-- ======================================================================
-- subscriptions — who has paid
-- ======================================================================
--
-- Keyed on the user, not the workspace: the chosen model is "$12/month per
-- paying user, unlimited workspaces", so entitlement travels with the person
-- who creates workspaces, and members never pay.
--
-- Mirrors Stripe rather than deciding anything. Stripe is the source of truth
-- for billing state; this table exists so a page load doesn't have to call the
-- Stripe API to find out whether to show a workspace.

create table if not exists public.subscriptions (
  user_id                uuid primary key
                           references auth.users (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- Stripe's own vocabulary, kept verbatim so the webhook is a straight copy
  -- and there is no mapping layer to get subtly wrong.
  status                 text not null default 'inactive'
                           check (status in ('inactive', 'trialing', 'active',
                                             'past_due', 'canceled', 'unpaid',
                                             'incomplete', 'incomplete_expired')),
  -- Access survives to the end of a paid period even after cancellation, which
  -- is what the customer paid for.
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (user_id = auth.uid());

-- Deliberately no insert/update/delete policies. See rule 2 above.

-- ======================================================================
-- workspaces
-- ======================================================================

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  -- The owner is the billed party and the one account that cannot be removed.
  -- Distinct from "admin": there can be several admins, but exactly one owner.
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  description text check (length(description) <= 500),
  created_at  timestamptz not null default now()
);

create index if not exists workspaces_owner_idx
  on public.workspaces (owner_id);

-- ======================================================================
-- workspace_members
-- ======================================================================
--
-- Roles, v1:
--   admin  — invite, kick, edit the workspace, transfer ownership
--   member — read and write the workspace's tasks, nothing structural
--
-- The composite primary key is what makes double-joining impossible; there is
-- no application-level check anywhere for it.

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  invited_by   uuid references auth.users (id) on delete set null,
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

-- ======================================================================
-- membership predicates
-- ======================================================================
--
-- SECURITY DEFINER, so they read workspace_members with RLS bypassed. This is
-- what stops the recursion described in rule 1.
--
-- They are safe to expose despite that power because neither takes the user as
-- an argument — both are hard-wired to auth.uid(). A caller can ask "am I a
-- member of X", never "is someone else a member of X".
--
-- search_path is pinned. Without it a caller could create a `workspace_members`
-- table in a schema earlier on their own search_path and have this function
-- read that instead — a definer function with a mutable search_path is a
-- privilege escalation, not a convenience.

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

-- The Team plan's ceiling. A function rather than a literal so the number lives
-- in exactly one place — the acceptance check, the "seats left" the UI shows,
-- and any future Enterprise override all read the same value. Changing the cap
-- is then a `create or replace` rather than a hunt.
create or replace function public.max_workspace_members()
returns integer
language sql
immutable
as $$ select 10 $$;

grant execute on function public.max_workspace_members() to authenticated;

-- Entitlement. 'active' and 'trialing' are the two Stripe states that mean
-- "currently paid for"; past_due deliberately still counts until the period
-- ends, so a failed card retry doesn't lock a team out of their work mid-day.
create or replace function public.has_active_plan()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and (
        s.status in ('active', 'trialing')
        or (s.status = 'past_due' and s.current_period_end > now())
      )
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.has_active_plan() from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.has_active_plan() to authenticated;

-- ======================================================================
-- workspace policies
-- ======================================================================

alter table public.workspaces enable row level security;

drop policy if exists "read workspaces you belong to" on public.workspaces;
create policy "read workspaces you belong to" on public.workspaces
  for select using (public.is_workspace_member(id));

-- No INSERT policy: workspaces are created only through create_workspace(),
-- which has to check entitlement and add the founding admin row in the same
-- transaction. A direct insert would leave a workspace with no members —
-- unreadable even by the person who made it, since the read policy is
-- membership-based.

drop policy if exists "admins update their workspace" on public.workspaces;
create policy "admins update their workspace" on public.workspaces
  for update using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

-- Deleting is the owner's alone. An admin who could delete the workspace could
-- destroy the billed party's data without being the billed party.
drop policy if exists "owner deletes their workspace" on public.workspaces;
create policy "owner deletes their workspace" on public.workspaces
  for delete using (owner_id = auth.uid());

-- ======================================================================
-- membership policies
-- ======================================================================

alter table public.workspace_members enable row level security;

drop policy if exists "read members of your workspaces" on public.workspace_members;
create policy "read members of your workspaces" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

-- No INSERT policy: joining happens through accept_workspace_invite(). An
-- admin cannot add an arbitrary user id directly, which means there is no path
-- to adding someone to a workspace without them holding an invite.
--
-- No UPDATE policy: role changes go through set_member_role() and
-- transfer_workspace_ownership(), both of which enforce the "at least one
-- admin" and "owner is always admin" invariants that a bare UPDATE cannot.

-- Leaving, and being removed, are the same operation with different actors.
drop policy if exists "leave or be removed" on public.workspace_members;
create policy "leave or be removed" on public.workspace_members
  for delete using (
    (
      -- Yourself, always. Nobody is trapped in a workspace.
      user_id = auth.uid()
      -- ...or an admin removing someone else.
      or public.is_workspace_admin(workspace_id)
    )
    -- ...but never the owner. Removing the billed party would orphan the
    -- workspace, and an admin doing it to the owner is a coup.
    and user_id <> (
      select w.owner_id from public.workspaces w where w.id = workspace_id
    )
  );

-- ======================================================================
-- invites
-- ======================================================================
--
-- One table serves both invite styles:
--   email is null  -> a shareable link, usable by whoever holds it
--   email is set   -> addressed to one person, and only that address may accept
--
-- The token is a credential, exactly like the calendar feed token: whoever has
-- it can join. So it expires, it can be revoked, and a link invite is
-- single-use by default — an invite link pasted into a group chat should not
-- keep letting people in a month later.

create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Lowercased on write so acceptance can compare exactly.
  email        text check (email is null or email = lower(email)),
  token        uuid not null unique default gen_random_uuid(),
  role         text not null default 'member' check (role in ('admin', 'member')),
  created_by   uuid references auth.users (id) on delete set null,
  -- Link invites admit one person; email invites admit their one addressee.
  max_uses     integer not null default 1 check (max_uses between 1 and 100),
  uses         integer not null default 0 check (uses >= 0),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists workspace_invites_ws_idx
  on public.workspace_invites (workspace_id);

alter table public.workspace_invites enable row level security;

-- Admins manage invites for their own workspace. Note this policy is what
-- keeps a *member* from reading the token and inviting people themselves.
drop policy if exists "admins read invites" on public.workspace_invites;
create policy "admins read invites" on public.workspace_invites
  for select using (public.is_workspace_admin(workspace_id));

drop policy if exists "admins create invites" on public.workspace_invites;
create policy "admins create invites" on public.workspace_invites
  for insert with check (
    public.is_workspace_admin(workspace_id)
    and created_by = auth.uid()
  );

drop policy if exists "admins revoke invites" on public.workspace_invites;
create policy "admins revoke invites" on public.workspace_invites
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "admins delete invites" on public.workspace_invites;
create policy "admins delete invites" on public.workspace_invites
  for delete using (public.is_workspace_admin(workspace_id));

-- ======================================================================
-- tasks — the shared pool
-- ======================================================================
--
-- workspace_id null  -> a personal task, exactly as before this migration
-- workspace_id set   -> a workspace task, readable and writable by every member
--
-- Nullable rather than a separate table: a task is the same shape either way,
-- the planner produces both, and Today has to interleave them. Two tables would
-- mean every query and every AI path forked.

alter table public.tasks
  add column if not exists workspace_id uuid
    references public.workspaces (id) on delete cascade;

-- The person responsible, not the person who typed it (that stays user_id).
-- Null means "nobody yet", which is a real and common state on a shared list.
alter table public.tasks
  add column if not exists assignee_id uuid
    references auth.users (id) on delete set null;

create index if not exists tasks_workspace_idx
  on public.tasks (workspace_id, plan_date);
create index if not exists tasks_assignee_idx
  on public.tasks (assignee_id, plan_date);

-- An assignee must actually be in the workspace, and a personal task cannot
-- have one. Enforced by trigger rather than a CHECK because it reads another
-- table, which CHECK constraints may not do.
create or replace function public.tasks_validate_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.assignee_id is not null then
    if new.workspace_id is null then
      raise exception 'a personal task cannot have an assignee';
    end if;
    if not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = new.workspace_id
        and m.user_id = new.assignee_id
    ) then
      raise exception 'assignee is not a member of that workspace';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_validate_assignment_trg on public.tasks;
create trigger tasks_validate_assignment_trg
  before insert or update of workspace_id, assignee_id on public.tasks
  for each row execute function public.tasks_validate_assignment();

-- Replace the four personal-only policies from 0001 with membership-aware ones.
drop policy if exists "tasks are private" on public.tasks;
drop policy if exists "read own tasks" on public.tasks;
drop policy if exists "insert own tasks" on public.tasks;
drop policy if exists "update own tasks" on public.tasks;
drop policy if exists "delete own tasks" on public.tasks;
drop policy if exists "read own or workspace tasks" on public.tasks;
drop policy if exists "insert own or workspace tasks" on public.tasks;
drop policy if exists "update own or workspace tasks" on public.tasks;
drop policy if exists "delete own or workspace tasks" on public.tasks;

create policy "read own or workspace tasks" on public.tasks
  for select using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

-- user_id = auth.uid() on insert regardless of workspace: you always create
-- tasks as yourself. Claiming a row for another user is not a thing the UI
-- needs and not a thing this policy will allow.
create policy "insert own or workspace tasks" on public.tasks
  for insert with check (
    user_id = auth.uid()
    and (
      workspace_id is null
      or public.is_workspace_member(workspace_id)
    )
  );

-- Both USING and WITH CHECK. USING alone would let a member move a workspace
-- task into a workspace they aren't in — or into their personal list, quietly
-- removing it from the team's.
create policy "update own or workspace tasks" on public.tasks
  for update using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "delete own or workspace tasks" on public.tasks
  for delete using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

-- ======================================================================
-- create_workspace
-- ======================================================================
--
-- The workspace row and its founding admin membership must exist together or
-- not at all, and entitlement has to be checked before either. That is three
-- things in one transaction, which is a function, not a policy.
--
-- CALL IT AS `select * from create_workspace(...)`, NEVER `select
-- (create_workspace(...)).*`. The second form expands the composite by calling
-- the function once per output column — five columns, five workspaces. It cost
-- an hour of chasing a phantom RLS bug in the test suite for this file, and it
-- would be five real workspaces and five audit rows in production.
--
-- supabase-js `.rpc('create_workspace', ...)` is the safe form.

create or replace function public.create_workspace(
  p_name        text,
  p_description text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_ws   public.workspaces;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.has_active_plan() then
    raise exception 'a paid plan is required to create a workspace'
      using errcode = 'check_violation';
  end if;

  -- A soft guard, not a product limit. The chosen billing model is one seat
  -- for unlimited workspaces, so nothing else stops one subscriber hosting an
  -- entire company for $12 — this caps the blast radius while that is
  -- deliberate rather than discovered. Raise it freely; it is one number.
  select count(*) into v_count
  from public.workspaces w where w.owner_id = v_user;
  if v_count >= 20 then
    raise exception 'workspace limit reached';
  end if;

  insert into public.workspaces (owner_id, name, description)
  values (v_user, trim(p_name), nullif(trim(coalesce(p_description, '')), ''))
  returning * into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_ws.id, v_user, 'admin', v_user);

  return v_ws;
end;
$$;

-- ======================================================================
-- accept_workspace_invite
-- ======================================================================
--
-- The only path into a workspace. Runs as definer because the joiner is by
-- definition not yet a member, so no membership-based policy can let them read
-- the invite or write the membership row.
--
-- Every failure returns the same message. Distinguishing "expired" from "no
-- such token" from "wrong email" tells an attacker probing tokens which of
-- their guesses named a real workspace.

create or replace function public.accept_workspace_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_email   text;
  v_invite  public.workspace_invites;
  v_members integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_user;

  -- FOR UPDATE: two people opening the same single-use link at once would
  -- otherwise both read uses = 0 and both join.
  select * into v_invite
  from public.workspace_invites i
  where i.token = p_token
  for update;

  if v_invite.id is null then
    raise exception 'invalid or expired invite';
  end if;

  -- Already a member: succeed quietly, BEFORE the validity checks below.
  --
  -- This ordering is the whole point. A single-use invite is spent the moment
  -- it is accepted, so if this ran after the `uses >= max_uses` check, the
  -- person who just joined would get "invalid or expired invite" for merely
  -- reloading the page they landed on. They are already in the workspace;
  -- telling them so reveals nothing they cannot already see.
  if exists (
    select 1 from public.workspace_members m
    where m.workspace_id = v_invite.workspace_id and m.user_id = v_user
  ) then
    return v_invite.workspace_id;
  end if;

  if v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.uses >= v_invite.max_uses
     or (v_invite.email is not null and v_invite.email <> v_email)
  then
    raise exception 'invalid or expired invite';
  end if;

  -- Team plans cap at MAX_WORKSPACE_MEMBERS; past that is Enterprise, which is
  -- a conversation rather than a checkout.
  --
  -- Enforced here rather than at invite *creation* because invites outlive the
  -- moment they were made: an admin can hand out fifteen links while the
  -- workspace has three members, and the eleventh person to click is the one
  -- who has to be turned away.
  --
  -- The row lock is what makes the count trustworthy. Without it, ten people
  -- opening their links at the same second all read "9 members" and all pass.
  -- Locking the workspace row serialises acceptance for that workspace only —
  -- two different workspaces still admit people concurrently.
  perform 1 from public.workspaces w where w.id = v_invite.workspace_id for update;

  select count(*) into v_members
  from public.workspace_members m
  where m.workspace_id = v_invite.workspace_id;

  if v_members >= public.max_workspace_members() then
    raise exception 'this workspace is full (% members)', v_members
      using errcode = 'check_violation',
            hint = 'Contact us about an Enterprise plan for larger teams.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_invite.workspace_id, v_user, v_invite.role, v_invite.created_by);

  update public.workspace_invites
  set uses = uses + 1
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

-- ======================================================================
-- set_member_role / transfer_workspace_ownership
-- ======================================================================

create or replace function public.set_member_role(
  p_workspace uuid,
  p_user      uuid,
  p_role      text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  if not public.is_workspace_admin(p_workspace) then
    raise exception 'only an admin can change roles';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'unknown role';
  end if;

  select w.owner_id into v_owner
  from public.workspaces w where w.id = p_workspace;

  -- The owner is the billed party; demoting them would leave the person paying
  -- unable to administer what they pay for.
  if p_user = v_owner and p_role <> 'admin' then
    raise exception 'the owner is always an admin';
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace and user_id = p_user;

  if not found then
    raise exception 'not a member of that workspace';
  end if;
end;
$$;

-- Ownership and the admin role move together: the new owner is made admin, and
-- the old owner stays an admin rather than being silently demoted out of a
-- workspace they built.
create or replace function public.transfer_workspace_ownership(
  p_workspace uuid,
  p_new_owner uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select w.owner_id into v_owner
  from public.workspaces w where w.id = p_workspace;

  if v_owner is null then
    raise exception 'no such workspace';
  end if;
  -- Only the owner, not any admin: this hands over the billed relationship.
  if v_owner <> auth.uid() then
    raise exception 'only the owner can transfer ownership';
  end if;
  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = p_new_owner
  ) then
    raise exception 'the new owner must already be a member';
  end if;

  update public.workspaces set owner_id = p_new_owner where id = p_workspace;

  update public.workspace_members
  set role = 'admin'
  where workspace_id = p_workspace and user_id in (p_new_owner, v_owner);
end;
$$;

revoke all on function public.create_workspace(text, text) from public;
revoke all on function public.accept_workspace_invite(uuid) from public;
revoke all on function public.set_member_role(uuid, uuid, text) from public;
revoke all on function public.transfer_workspace_ownership(uuid, uuid) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated;
