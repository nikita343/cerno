"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updatePassword } from "@/lib/auth/actions";
import { EMPTY_AUTH_STATE, type AuthFormState } from "@/lib/auth/types";

import styles from "./AuthForm.module.css";

/**
 * Step two of a password reset: set the new password.
 *
 * Reached only through the emailed link, which lands the user here with a live
 * recovery session (the callback exchanged the code). `updatePassword` writes
 * against that session and redirects into the app on success; if the session
 * has expired it returns a message pointing back to the request page.
 */
export function ResetForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    updatePassword,
    EMPTY_AUTH_STATE,
  );

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.mark} aria-hidden="true" />
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.helper}>
          Pick something at least 8 characters long.
        </p>
      </div>

      <form className={styles.form} action={action}>
        <label className={styles.field}>
          <span className={styles.label}>New password</span>
          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            placeholder="At least 8 characters"
            autoFocus
          />
        </label>

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Saving…" : "Set new password"}
        </button>
      </form>

      <p className={styles.switch}>
        <Link href="/forgot" className={styles.switchLink}>
          Request a new link
        </Link>
      </p>
    </div>
  );
}
