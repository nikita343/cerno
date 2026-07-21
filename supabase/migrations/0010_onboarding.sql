-- Cerno — remember that the language choice has been made.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0002_labels_and_settings.sql.
--
-- `language` already defaults to 'en', so it cannot distinguish "chose English"
-- from "never asked" — without a separate flag the onboarding screen would
-- either reappear for every English speaker forever, or never appear for
-- anyone. A boolean is the smallest thing that separates the two.
--
-- Defaults to false so existing accounts see the screen once. That is the
-- right way round: showing it to someone who has been using the app for a
-- month is mildly odd, whereas skipping it for new accounts means Ukrainian
-- speakers never find the setting.

alter table public.user_settings
  add column if not exists onboarded boolean not null default false;

comment on column public.user_settings.onboarded is
  'True once the user has been through first-run language selection. Distinct from language, which has a default and so cannot signal "asked".';
