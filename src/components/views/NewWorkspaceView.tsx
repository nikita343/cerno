"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const entitled = useAppStore((s) => isEntitled(s.subscription));
  const createWorkspace = useAppStore((s) => s.createWorkspace);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entitled) {
    return (
      <div className={view.view}>
        <h1 className={view.h1}>Workspaces are part of Team</h1>
        <p className={view.subline}>
          Share a task list with up to {MAX_WORKSPACE_MEMBERS} people for $12 a
          month. You pay; the people you invite don&rsquo;t.
        </p>
        <div className={styles.card}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push(`${DASHBOARD_ROOT}/settings`)}
          >
            See the plan
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
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
          : "Couldn't create that workspace.",
      );
      setBusy(false);
    }
  };

  return (
    <div className={view.view}>
      <h1 className={view.h1}>New workspace</h1>
      <p className={view.subline}>
        A shared list for one team or project. You can rename it later.
      </p>

      <div className={styles.card}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Design team"
            maxLength={60}
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Description <span className={styles.optional}>optional</span>
          </span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this workspace is for."
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
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void submit()}
            disabled={busy || name.trim() === ""}
          >
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
