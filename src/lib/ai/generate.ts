import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

import { getClient } from "./client";
import { hasKeyFor, resolveModel, type ModelSpec } from "./models";
import type { ModelChoice } from "@/lib/types";

/**
 * One structured-output call, whichever vendor the user picked.
 *
 * This is the only file that knows there is more than one provider. Both
 * planning routes call `generateStructured` with a zod schema and get parsed,
 * validated data back — so the prompt, the schema and everything downstream
 * stay vendor-agnostic.
 *
 * Both providers are used in constrained-output mode, so malformed JSON is not
 * a failure mode either has to handle. What they don't share is *judgement*, so
 * the schema is still validated on our side rather than trusted.
 */

let openaiClient: OpenAI | null = null;

function openai(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  openaiClient ??= new OpenAI({ apiKey: key });
  return openaiClient;
}

export interface GenerateOptions<T extends z.ZodType> {
  choice: ModelChoice | null | undefined;
  system: string;
  user: string;
  schema: T;
  /** Names the JSON schema for OpenAI, which requires one. */
  schemaName: string;
  maxTokens: number;
  /**
   * Off for the quick-add path: a single short phrase needs no deliberation,
   * and thinking there is latency the user is sitting through.
   */
  thinking?: boolean;
}

export interface GenerateResult<T> {
  parsed: T;
  /** What actually ran, which may not be what was asked for — see below. */
  model: string;
  provider: string;
}

/**
 * Runs the request, falling back when the chosen provider has no key.
 *
 * The fallback matters: the model picker stores a *preference*, and a
 * deployment may hold an Anthropic key and no OpenAI one (or the reverse). A
 * user who picked GPT-5 on a deployment without an OpenAI key should get a
 * planned day from Claude, not an error — the alternative is a broken app
 * because of a dropdown.
 *
 * Returns null when neither provider is usable, which is the caller's cue to
 * fall back to the offline heuristic planner.
 */
export async function generateStructured<T extends z.ZodType>(
  options: GenerateOptions<T>,
): Promise<GenerateResult<z.infer<T>> | null> {
  const preferred = resolveModel(options.choice);
  const spec = hasKeyFor(preferred.provider) ? preferred : fallbackFrom(preferred);
  if (!spec) return null;

  const parsed =
    spec.provider === "anthropic"
      ? await viaAnthropic(spec, options)
      : await viaOpenAI(spec, options);

  return { parsed, model: spec.id, provider: spec.provider };
}

/** The other vendor's default, if we have a key for it. */
function fallbackFrom(preferred: ModelSpec): ModelSpec | null {
  const other: ModelSpec =
    preferred.provider === "anthropic"
      ? { provider: "openai", id: "gpt-5" }
      : { provider: "anthropic", id: "claude-sonnet-5" };
  return hasKeyFor(other.provider) ? other : null;
}

async function viaAnthropic<T extends z.ZodType>(
  spec: ModelSpec,
  options: GenerateOptions<T>,
): Promise<z.infer<T>> {
  const client = getClient();
  if (!client) throw new Error("Anthropic client unavailable");

  // Streamed, not a single blocking call. A planning request with adaptive
  // thinking and a high max_tokens can run tens of seconds; streaming keeps the
  // connection alive across that window so an idle-socket timeout can't kill the
  // signature demo. `finalMessage()` still returns the fully parsed output.
  const stream = client.messages.stream({
    model: spec.id,
    max_tokens: options.maxTokens,
    // Adaptive, not a token budget: `budget_tokens` is rejected outright on
    // Opus 4.8 and Sonnet 5.
    thinking: options.thinking === false ? { type: "disabled" } : { type: "adaptive" },
    output_config: { format: zodOutputFormat(options.schema) },
    system: options.system,
    messages: [{ role: "user", content: options.user }],
  });

  const message = await stream.finalMessage();
  const parsed = message.parsed_output;
  if (!parsed) throw new Error("empty parsed output");
  return parsed as z.infer<T>;
}

async function viaOpenAI<T extends z.ZodType>(
  spec: ModelSpec,
  options: GenerateOptions<T>,
): Promise<z.infer<T>> {
  const completion = await openai().chat.completions.parse({
    model: spec.id,
    // No temperature: constrained output plus a fixed schema is the whole
    // point, and the newer models reject the parameter anyway.
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    response_format: zodResponseFormat(options.schema, options.schemaName),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  // A refusal is a distinct outcome from an error, and it is the one that
  // would otherwise surface as a confusing empty plan.
  if (completion.choices[0]?.message?.refusal) {
    throw new Error(`refused: ${completion.choices[0].message.refusal}`);
  }
  if (!parsed) throw new Error("empty parsed output");
  return parsed as z.infer<T>;
}
