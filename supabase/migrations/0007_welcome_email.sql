-- Cerno — remember that the welcome email has been sent.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0002_labels_and_settings.sql.
--
-- Without a marker the only available signal is "this user just signed in",
-- which is true on every login — so a welcome mail would arrive every time
-- somebody came back. A timestamp is the smallest thing that makes sending
-- exactly once possible, and it doubles as a record of when it went out.
--
-- Nullable with no default: NULL means "never sent", which is the correct
-- state for every account that predates this column.

alter table public.user_settings
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.user_settings.welcome_email_sent_at is
  'When the welcome email was sent. NULL means never. Set by the auth callback, which is the only place that should write it.';
