-- Cerno — allow OpenAI models in the planning-model preference.
--
-- Paste the WHOLE file into the Supabase SQL editor and Run.
-- Safe to re-run. Requires 0002_labels_and_settings.sql.
--
-- The column carried a CHECK listing only the three Claude tiers, so saving
-- "gpt-5" from the picker failed at the database with a constraint violation —
-- the setting would appear to change and then revert on reload.
--
-- Widened rather than dropped. An unconstrained text column here means a typo
-- in the client silently stores a model id that no code path can resolve, and
-- the failure surfaces later as "planning stopped working".

alter table public.user_settings
  drop constraint if exists user_settings_model_check;

alter table public.user_settings
  add constraint user_settings_model_check
  check (model in ('opus', 'sonnet', 'haiku', 'gpt-5', 'gpt-5-mini'));

comment on column public.user_settings.model is
  'Planning model preference. Values must match ModelChoice in src/lib/types.ts and the catalogue in src/lib/ai/models.ts.';
