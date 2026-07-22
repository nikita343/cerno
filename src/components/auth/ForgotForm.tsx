"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/lib/auth/actions";
import { EMPTY_AUTH_STATE, type AuthFormState } from "@/lib/auth/types";

import styles from "./AuthForm.module.css";

/**
 * Step one of a password reset: ask for the email.
 *
 * Reuses the login card's styling so the flow feels like one surface. On
 * success it shows the same notice regardless of whether the address exists —
 * see `requestPasswordReset`.
 */
export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    EMPTY_AUTH_STATE,
  );

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.mark} aria-hidden="true" />
        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.helper}>
          Enter your email and we&rsquo;ll send you a link to set a new one.
        </p>
      </div>

      <form className={styles.form} action={action}>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            required
            disabled={pending || Boolean(state.notice)}
            placeholder="you@example.com"
          />
        </label>

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        {state.notice && (
          <p className={styles.notice} role="status">
            {state.notice}
          </p>
        )}

        <button
          type="submit"
          className={styles.submit}
          disabled={pending || Boolean(state.notice)}
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className={styles.switch}>
        Remembered it?{" "}
        <Link href="/login" className={styles.switchLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
