-- Cerno — secret iCal feed.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run.
--
-- Run 0001–0003 first if you haven't.

-- ------------------------------------------------------------ feed token
--
-- The token IS the credential. A calendar client fetches the feed from a
-- server with no cookies and no Authorization header, so the URL is the only
-- thing proving who is asking — anyone holding it can read every task title.
--
-- Consequences, all deliberate:
--   - Random uuid, never the user id. A predictable path would let anyone
--     enumerate feeds from a known account id.
--   - Revocable: regenerating writes a new uuid and the old URL dies at once.
--   - Nullable and null by default. No feed exists until the user asks for one,
--     so an account that never touches this never has a live public URL.

alter table public.user_settings
  add column if not exists feed_token uuid;

create unique index if not exists user_settings_feed_token_idx
  on public.user_settings (feed_token)
  where feed_token is not null;

-- ------------------------------------------------------- the feed reader
--
-- SECURITY DEFINER, and this is the one place in the schema that uses it.
--
-- The alternative is handing the app a service-role key so the route can read
-- across users. That key bypasses RLS on *every* table for *every* row; this
-- function bypasses it for exactly one query, returns only the five columns a
-- calendar needs, and cannot be called without a valid token. A narrow hole
-- beats a master key.
--
-- `search_path` is pinned: without it, a caller who can create objects could
-- shadow `public.tasks` with their own table and have this function read that
-- instead — the classic SECURITY DEFINER escalation.

create or replace function public.tasks_for_feed(token uuid)
returns table (
  id uuid,
  title text,
  description text,
  plan_date date,
  suggested_start time,
  estimated_minutes integer,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  owner uuid;
begin
  -- A null token must never match a null column. Postgres would compare
  -- null = null as null (not true), but the guard makes that explicit rather
  -- than relying on it.
  if token is null then
    return;
  end if;

  select user_id into owner
  from public.user_settings s
  where s.feed_token = token;

  if owner is null then
    return;
  end if;

  return query
  select t.id, t.title, t.description, t.plan_date, t.suggested_start,
         t.estimated_minutes, t.status
  from public.tasks t
  where t.user_id = owner
    and t.plan_date is not null
    -- Completed work is not useful in a calendar, and a feed that grows
    -- forever eventually times out on the client.
    and t.status <> 'done'
    and t.plan_date >= current_date - interval '30 days'
    and t.plan_date <= current_date + interval '180 days';
end;
$fn$;

-- `anon` deliberately: the feed is fetched by Google's and Apple's servers,
-- which have no session. The token inside the function is what authorises it.
grant execute on function public.tasks_for_feed(uuid) to anon, authenticated;
