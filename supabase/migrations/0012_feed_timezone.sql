-- Cerno — expose the feed owner's timezone to the iCal route.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0004_calendar_feed.sql and 0002 (timezone column).
--
-- The calendar feed is fetched with the anon key and no session (Google/Apple
-- fetch it), so it can't read `user_settings` under RLS. `tasks_for_feed`
-- already resolves the token to a user server-side via SECURITY DEFINER; this
-- is its sibling for one more field — the timezone — so timed events can be
-- anchored to the owner's zone instead of floating. Returns exactly the
-- timezone and nothing else, and only for a token that matches.

create or replace function public.feed_timezone(token uuid)
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select s.timezone
  from public.user_settings s
  where s.feed_token = token;
$$;

revoke all on function public.feed_timezone(uuid) from public;
grant execute on function public.feed_timezone(uuid) to anon, authenticated;

comment on function public.feed_timezone(uuid) is
  'Resolves a calendar feed token to its owner''s timezone. SECURITY DEFINER so the unauthenticated feed route can anchor event times; returns nothing for an unknown token.';
