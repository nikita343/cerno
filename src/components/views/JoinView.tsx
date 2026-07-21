"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DASHBOARD_ROOT } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { acceptInvite } from "@/lib/supabase/workspaces";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./WorkspaceView.module.css";
import view from "./View.module.css";

type State = "working" | "failed";

/**
 * Redeems an invite link and sends you into the workspace.
 *
 * Runs on mount rather than behind an "Accept" button. The link was already a
 * deliberate act — someone sent it to you and you opened it — so a second
 * confirmation is a step that asks you to agree to what you just did.
 *
 * `accept_workspace_invite` is idempotent for someone already inside, so a
 * reload or a double-click lands you in the workspace rather than burning the
 * invite and erroring. That property is what makes running on mount safe.
 */
export function JoinView({ token }: { token: string }) {
  const router = useRouter();
  const refreshWorkspaces = useAppStore((s) => s.refreshWorkspaces);

  const [state, setState] = useState<State>("working");
  const [error, setError] = useState<string | null>(null);

  // React 18+ mounts effects twice in development. Without this guard the
  // second run redeems the invite again — harmless thanks to idempotency, but
  // it would still count a use on a link that admits several people.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      if (!hasSupabaseConfig()) {
        setError("This app isn't connected to a backend.");
        setState("failed");
        return;
      }
      try {
        const workspaceId = await acceptInvite(createClient(), token);
        // Before navigating: the sidebar and the workspace page both read the
        // store, and arriving at a workspace that isn't in it yet renders
        // "Workspace not found" for a beat.
        await refreshWorkspaces();
        router.replace(`${DASHBOARD_ROOT}/workspaces/${workspaceId}`);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "That invite didn't work.",
        );
        setState("failed");
      }
    })();
  }, [token, router, refreshWorkspaces]);

  if (state === "working") {
    return (
      <div className={view.view}>
        <h1 className={view.h1}>Joining…</h1>
        <p className={view.subline}>One moment.</p>
      </div>
    );
  }

  return (
    <div className={view.view}>
      <h1 className={view.h1}>That invite didn&rsquo;t work</h1>
      {/*
        Every server-side rejection returns the same wording on purpose —
        distinguishing "expired" from "no such invite" from "wrong email" tells
        someone probing tokens which of their guesses named a real workspace.
        So the explanation here covers all of them rather than guessing.
      */}
      <p className={view.subline}>
        {error === "invalid or expired invite"
          ? "It may have expired, already been used, been revoked, or been meant for a different email address. Ask whoever invited you for a fresh link."
          : error}
      </p>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => router.replace(DASHBOARD_ROOT)}
        >
          Go to Today
        </button>
      </div>
    </div>
  );
}
