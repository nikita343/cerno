"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { GoogleIcon } from "@/components/icons";
import { LogoMark } from "@/components/brand/Logo";
import { signIn, signUp } from "@/lib/auth/actions";
import {
  EMPTY_AUTH_STATE,
  safeNextPath,
  type AuthFormState,
} from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

import styles from "./AuthForm.module.css";

export type AuthMode = "login" | "signup";

const COPY = {
  login: {
    title: "Welcome back",
    helper: "Pick up where your day left off.",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
    autoComplete: "current-password",
  },
  signup: {
    title: "Create your account",
    helper: "Dump what's on your mind. Cerno builds the day around it.",
    submit: "Create account",
    pending: "Creating…",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
    autoComplete: "new-password",
  },
} as const;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];
  const params = useSearchParams();
  // Sanitised here too, so a hostile ?next never reaches the form or the
  // OAuth redirectTo. The server re-checks; this is defence in depth.
  const next = safeNextPath(params.get("next"));

  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signIn : signUp,
    EMPTY_AUTH_STATE,
  );

  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  /**
   * OAuth has to start in the browser — Supabase needs to set the PKCE verifier
   * on this origin before handing off to Google, which a server action can't do.
   */
  const signInWithGoogle = async () => {
    setOauthError(null);
    setOauthPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      // On success the browser navigates to Google; nothing below runs.
    } catch {
      setOauthError("Couldn't reach Google. Try again.");
      setOauthPending(false);
    }
  };

  // A callback failure comes back as a query param, not through the action.
  const callbackError = params.get("error")
    ? "That sign-in link didn't work. Try again."
    : null;

  const error = state.error ?? oauthError ?? callbackError;
  const busy = pending || oauthPending;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <LogoMark size={30} className={styles.mark} />
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.helper}>{copy.helper}</p>
      </div>

      <button
        type="button"
        className={styles.google}
        onClick={signInWithGoogle}
        disabled={busy}
      >
        <GoogleIcon size="1.125rem" />
        Continue with Google
      </button>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <form className={styles.form} action={action}>
        <input type="hidden" name="next" value={next} />

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            required
            disabled={busy}
            placeholder="you@example.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            <span className={styles.label}>Password</span>
            {mode === "login" && (
              <Link href="/forgot" className={styles.forgot}>
                Forgot password?
              </Link>
            )}
          </span>
          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete={copy.autoComplete}
            required
            minLength={mode === "signup" ? 8 : undefined}
            disabled={busy}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {state.notice && (
          <p className={styles.notice} role="status">
            {state.notice}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={busy}>
          {pending ? copy.pending : copy.submit}
        </button>
      </form>

      <p className={styles.switch}>
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className={styles.switchLink}>
          {copy.switchLabel}
        </Link>
      </p>

      {mode === "signup" && (
        <p className={styles.legal}>
          By creating an account you agree to our{" "}
          <Link href="/terms">Terms of Use</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      )}
    </div>
  );
}
