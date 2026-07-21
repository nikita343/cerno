import "server-only";

import type { ModelChoice } from "@/lib/types";

/**
 * The model catalogue, and how a stored preference becomes a request.
 *
 * ---------------------------------------------------------------------------
 * On supporting two vendors
 * ---------------------------------------------------------------------------
 *
 * This is not free. Anthropic and OpenAI both do constrained JSON output, but
 * through different APIs — `output_config.format` with `zodOutputFormat` versus
 * `response_format` with `zodResponseFormat` — so every planning route needs two
 * code paths, two error shapes and two sets of failure modes to keep working.
 *
 * The abstraction is kept as thin as possible in `generate.ts`: one function,
 * one zod schema, one parsed result. Everything vendor-specific stops there. If
 * a third provider is ever added, it goes in the same place and nowhere else.
 *
 * Cerno's planning quality depends on judgement — what to cut, what an hour of
 * work actually costs — which is why Claude remains the default. OpenAI is
 * offered because people have preferences and existing keys, not because the
 * output is interchangeable.
 */

export type Provider = "anthropic" | "openai";

export interface ModelSpec {
  provider: Provider;
  /** The exact id sent to the API. */
  id: string;
}

/**
 * Every selectable model.
 *
 * Keys are the values stored in `user_settings.model`, so adding one here means
 * widening the CHECK constraint in the database too — see 0009.
 */
export const MODELS: Record<ModelChoice, ModelSpec> = {
  opus: { provider: "anthropic", id: "claude-opus-4-8" },
  sonnet: { provider: "anthropic", id: "claude-sonnet-5" },
  haiku: { provider: "anthropic", id: "claude-haiku-4-5" },
  "gpt-5": { provider: "openai", id: "gpt-5" },
  "gpt-5-mini": { provider: "openai", id: "gpt-5-mini" },
};

/** The fallback, and what an unrecognised stored value resolves to. */
export const DEFAULT_CHOICE: ModelChoice = "sonnet";

/**
 * Resolves a stored preference to a model.
 *
 * `CERNO_MODEL` still wins, as an operator override for cost or latency tuning
 * without a deploy. It names an Anthropic id directly, which is why it bypasses
 * the catalogue.
 */
export function resolveModel(choice: ModelChoice | null | undefined): ModelSpec {
  const override = process.env.CERNO_MODEL;
  if (override) return { provider: "anthropic", id: override };
  return MODELS[choice ?? DEFAULT_CHOICE] ?? MODELS[DEFAULT_CHOICE];
}

/**
 * True when the key for that provider is present.
 *
 * A user can select a model whose key the deployment doesn't have — the picker
 * is a stored preference, not a capability check — so every call site has to be
 * able to fall back rather than fail.
 */
export function hasKeyFor(provider: Provider): boolean {
  return provider === "anthropic"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}
