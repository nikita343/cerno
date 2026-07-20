"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { safeNextPath, type AuthFormState } from "./types";

/**
 * This module may only export async functions — that is a hard constraint of
 * `"use server"`, and violating it fails at request time with a 500 rather than
 * at build. Shared types and constants live in ./types.ts.
 */

const NOT_CONFIGURED: AuthFormState = {
  error: "Sign-in isn't set up yet. Add the Supabase keys and try again.",
  notice: null,
};

/**
 * Maps provider errors to copy written in our voice.
 *
 * Passing `error.message` straight through leaks the provider's wording into
 * the product — "email rate limit exceeded" tells a user nothing about what
 * they should do next, and reads like something broke rather than a limit that
 * will clear.
 */
function describeAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many sign-up emails just went out. Wait an hour and try again, or continue with Google.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "There's already an account with that email. Try signing in.";
  }
  if (m.includes("password")) {
    return "That password isn't strong enough. Use at least 8 characters.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "That doesn't look like a valid email address.";
  }
  return "That didn't work. Try again in a moment.";
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!hasSupabaseConfig()) return NOT_CONFIGURED;

  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password.", notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately generic: distinguishing "no such account" from "wrong
    // password" turns the login form into an account-existence oracle.
    return { error: "That email and password don't match.", notice: null };
  }

  revalidatePath("/", "layout");
  // redirect() signals by throwing — it must not sit inside a try/catch.
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!hasSupabaseConfig()) return NOT_CONFIGURED;

  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password.", notice: null };
  }
  // Supabase enforces its own minimum, but failing here avoids a round trip
  // and lets us word it in our own voice.
  if (password.length < 8) {
    return { error: "Use at least 8 characters.", notice: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error("[auth/signUp]", error);
    return { error: describeAuthError(error.message), notice: null };
  }

  // With email confirmation on, signUp returns a user but no session.
  if (!data.session) {
    return {
      error: null,
      notice: "Check your email to confirm your address, then sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
