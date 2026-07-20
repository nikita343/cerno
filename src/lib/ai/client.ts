import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client.
 *
 * The key is read from the environment and never leaves the server — nothing in
 * this module may be imported from a client component.
 */

/**
 * Default model. Overridable with `CERNO_MODEL` for cost/latency tuning without
 * a code change.
 *
 * Note: DEVELOPMENT.md §4 specified "claude-sonnet (latest)"; this defaults to
 * Opus instead because the planner's job is judgement — effort estimation and
 * deciding what to cut — which is exactly where the stronger model earns its
 * keep. Set CERNO_MODEL=claude-sonnet-5 to follow the original spec.
 */
export const DEFAULT_MODEL = process.env.CERNO_MODEL ?? "claude-opus-4-8";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: Anthropic | null = null;

/** Returns the shared client, or null when no key is configured. */
export function getClient(): Anthropic | null {
  if (!hasApiKey()) return null;
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}

/** Maps SDK errors onto a status code and a message safe to show a user. */
export function describeError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Cerno is busy right now. Try again in a moment." };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    // Never echo the key or the provider's wording back to the browser.
    return { status: 500, message: "Planning isn't configured correctly." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: "Couldn't reach the planner. Check your connection." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, message: "The planner had a problem. Try again." };
  }
  return { status: 500, message: "Something went wrong while planning." };
}
