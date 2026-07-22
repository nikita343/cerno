"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import { DASHBOARD_ROOT } from "@/lib/nav";
import { isEntitled, MAX_WORKSPACE_MEMBERS } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./WorkspaceView.module.css";
import view from "./View.module.css";

/**
 * Create a workspace.
 *
 * The entitlement check here is a courtesy — `create_workspace()` refuses
 * without a plan regardless, and that refusal is the one that counts. Showing
 * the upsell instead of the form just avoids letting someone fill in a name
 * only to be told no.
 */
export function NewWorkspaceView() {
  const router = useRouter();
  const t = useT();
  const entitled = useAppStore((s) => isEntitled(s.subscription));
  const createWorkspace = useAppStore((s) => s.createWorkspace);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  if (!entitled) {
    return (
      <div className={view.view}>
        <h1 className={view.h1}>{t.workspace.partOfTeam}</h1>
        <p className={view.subline}>
          {t.workspace.partOfTeamPrefix} {MAX_WORKSPACE_MEMBERS}{" "}
          {t.workspace.partOfTeamSuffix}
        </p>
        <div className={styles.card}>
          <button
            type="button"
            className={styles.primary}
            // Straight to the plan section, not the settings index. This
            // button makes a promise ("See the plan") and the index shows a
            // list of section links instead — on desktop it opens Profile,
            // which has nothing to do with what was clicked.
            onClick={() => router.push(`${DASHBOARD_ROOT}/settings/plan`)}
          >
            {t.workspace.seeThePlan}
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // A ref, not the `busy` state.
    //
    // `setBusy(true)` doesn't take effect until the next render, so two calls
    // in the same tick both sail past a state check — and there are two ways to
    // fire this: Enter in the name field, and the button. Pressing Enter while
    // the button also receives the event created two workspaces, which is
    // exactly what happened. A ref flips synchronously.
    //
    // Creating a workspace is not idempotent server-side (each call mints a new
    // id), so this guard is the only thing preventing duplicates.
    if (submitting.current) return;
    submitting.current = true;

    setBusy(true);
    setError(null);
    try {
      const id = await createWorkspace(
        trimmed,
        description.trim() || null,
      );
      // `replace`, not `push`: going Back from the new workspace should return
      // to wherever you were, not to a form that would create a second one.
      router.replace(`${DASHBOARD_ROOT}/workspaces/${id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t.workspace.couldntCreate,
      );
      setBusy(false);
      // Only released on failure. On success we navigate away, and re-enabling
      // would let a double-tap during the transition create a second one.
      submitting.current = false;
    }
  };

  return (
    <div className={view.view}>
      <h1 className={view.h1}>{t.workspace.newWorkspace}</h1>
      <p className={view.subline}>{t.workspace.newWorkspaceSubline}</p>

      <div className={styles.card}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.workspace.nameLabel}</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder={t.workspace.namePlaceholder}
            maxLength={60}
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t.workspace.descriptionLabel} <span className={styles.optional}>{t.workspace.optional}</span>
          </span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.workspace.descriptionPlaceholder}
            maxLength={500}
            rows={3}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => router.back()}
            disabled={busy}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void submit()}
            disabled={busy || name.trim() === ""}
          >
            {busy ? t.workspace.creating : t.workspace.createWorkspace}
          </button>
        </div>
      </div>
    </div>
  );
}
