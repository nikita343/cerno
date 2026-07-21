-- Cerno — Telegram bot: link a chat to an account, and hold the one-time
-- codes that establish the link.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0002_labels_and_settings.sql.
--
-- ---------------------------------------------------------------------------
-- How linking works, and why it needs a codes table
-- ---------------------------------------------------------------------------
--
-- The bot's webhook has no Cerno session — it is Telegram's server talking to
-- ours about a chat, exactly like the Stripe webhook. So it cannot derive
-- `auth.uid()`, and it must not take a user id from the message (anyone could
-- send one). The link is proven the other way round: the signed-in user mints a
-- short-lived code in the app, opens `t.me/<bot>?start=<code>`, and the webhook
-- trades that code for the user it belongs to. The code is the only thing that
-- ties a Telegram chat to a Cerno account, so it lives in a table the webhook
-- (service role) can read and delete.

-- The linked chat. bigint because Telegram chat ids exceed int4. Unique so one
-- Telegram account maps to exactly one Cerno user — re-linking elsewhere first
-- releases it from the previous account (the webhook does this explicitly).
alter table public.user_settings
  add column if not exists telegram_chat_id bigint unique;

comment on column public.user_settings.telegram_chat_id is
  'Linked Telegram chat id, or null. Set by the bot webhook (service role) after a valid link code; never written by the client.';

-- One-time codes that a signed-in user creates and then presents to the bot.
create table if not exists public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Short-lived on purpose: a code is a bearer credential for linking an
  -- account, so a stale one shouldn't sit around being guessable.
  expires_at timestamptz not null
);

create index if not exists telegram_link_codes_user_idx
  on public.telegram_link_codes (user_id);

alter table public.telegram_link_codes enable row level security;

-- The owner can create and read their own codes; that is all the client ever
-- needs. The webhook reads and deletes them with the service-role key, which
-- bypasses RLS — so there is deliberately no policy granting anyone else access.
drop policy if exists telegram_link_codes_insert on public.telegram_link_codes;
drop policy if exists telegram_link_codes_select on public.telegram_link_codes;
drop policy if exists telegram_link_codes_delete on public.telegram_link_codes;

create policy telegram_link_codes_insert on public.telegram_link_codes
  for insert with check (user_id = auth.uid());

create policy telegram_link_codes_select on public.telegram_link_codes
  for select using (user_id = auth.uid());

create policy telegram_link_codes_delete on public.telegram_link_codes
  for delete using (user_id = auth.uid());

comment on table public.telegram_link_codes is
  'Short-lived codes trading a signed-in session for a Telegram chat link. Created by the user (RLS), consumed by the bot webhook (service role).';
