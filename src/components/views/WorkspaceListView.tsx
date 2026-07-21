"use client";

import Link from "next/link";

import { DASHBOARD_ROOT } from "@/lib/nav";
import { isEntitled, MAX_WORKSPACE_MEMBERS } from "@/lib/types";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./WorkspaceView.module.css";
import view from "./View.module.css";

/**
 * All your workspaces. The Workspaces tab lands here.
 *
 * Exists mainly for phones: the sidebar lists workspaces by name, and there is
 * no sidebar on a phone, so without this screen a workspace was reachable only
 * by URL. That was the actual complaint — "I can't access workspaces on mobile"
 * — and it was true.
 */
export function WorkspaceListView() {
  const workspaces = useAppStoreShallow((s) => s.workspaces);
  const entitled = useAppStore((s) => isEntitled(s.subscription));
  const tasks = useAppStoreShallow((s) => s.tasks);

  if (!entitled && workspaces.length === 0) {
    return (
      <div className={view.view}>
        <h1 className={view.h1}>Workspaces</h1>
        <EmptyState
          title="Share a list with your team"
          helper={`Team adds shared workspaces for up to ${MAX_WORKSPACE_MEMBERS} people. You pay; the people you invite don't.`}
          action={
            <Link
              href={`${DASHBOARD_ROOT}/settings/plan`}
              className={styles.primary}
            >
              See the plan
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={view.view}>
      <div className={view.titleRow}>
        <h1 className={view.h1}>Workspaces</h1>
        {entitled && (
          <Link
            href={`${DASHBOARD_ROOT}/workspaces/new`}
            className={styles.newLink}
          >
            New
          </Link>
        )}
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          helper="A workspace is a shared task list — one per team or project."
          action={
            <Link
              href={`${DASHBOARD_ROOT}/workspaces/new`}
              className={styles.primary}
            >
              Create a workspace
            </Link>
          }
        />
      ) : (
        <ul className={styles.wsList}>
          {workspaces.map((workspace) => {
            const open = tasks.filter(
              (t) => t.workspace_id === workspace.id && t.status !== "done",
            ).length;
            return (
              <li key={workspace.id}>
                <Link
                  href={`${DASHBOARD_ROOT}/workspaces/${workspace.id}`}
                  className={styles.wsRow}
                >
                  <span className={styles.glyph} aria-hidden="true">
                    {workspace.name.trim().charAt(0).toUpperCase() || "#"}
                  </span>
                  <span className={styles.wsText}>
                    <span className={styles.wsName}>{workspace.name}</span>
                    <span className={styles.wsMeta}>
                      {workspace.member_count}{" "}
                      {workspace.member_count === 1 ? "person" : "people"}
                      {open > 0 && ` · ${open} open`}
                      {workspace.role === "admin" && " · admin"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
