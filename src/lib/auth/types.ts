/**
 * Auth form state.
 *
 * Deliberately *not* in `actions.ts`: a `"use server"` module may only export
 * async functions, so exporting this interface and constant from there breaks
 * the whole module at runtime ("can only export async functions, found
 * object") — and the failure surfaces as a 500 on submit, not a build error.
 */
export interface AuthFormState {
  error: string | null;
  /** Set when signup succeeded but the address still needs confirming. */
  notice: string | null;
}

export const EMPTY_AUTH_STATE: AuthFormState = { error: null, notice: null };

/**
 * Only allow relative, single-slash paths as a post-login destination.
 *
 * Without this, `/login?next=https://evil.example` turns the redirect into an
 * open redirect off a trusted domain. Applied on both sides: the client so the
 * hostile value never reaches the form, the server because that is the check
 * that actually holds.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}
