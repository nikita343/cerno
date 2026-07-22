"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ChevronLeft } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { DASHBOARD_ROOT } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { loadMembers } from "@/lib/supabase/workspaces";
import type { WorkspaceMember } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import { WorkspaceMembers } from "./WorkspaceMembers";
import styles from "./WorkspaceView.module.css";
import view from "./View.module.css";

/**
 * Everything about a workspace that isn't its tasks.
 *
 * Split out because the workspace page is somewhere you go many times a day to
 * look at work, and the roster and invite form are things you touch once a
 * month. Keeping them on the same screen meant scrolling past administration
 * to reach the reason you opened it.
 */
export function WorkspaceSettingsView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const t = useT();
  const workspace = useAppStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId),
  );
  const userId = useAppStore((s) => s.userId);
  const updateWorkspace = useAppStore((s) => s.updateWorkspace);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [name, setName] = useState(workspace?.name ?? "");
  const [description, setDescription] = useState(workspace?.description ?? "");

  const loadRoster = useCallback(async () => {
    if (!hasSupabaseConfig()) return;
    try {
      setMembers(await loadMembers(createClient(), workspaceId));
    } catch (error) {
      console.error("[workspace settings] roster load failed", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  if (!workspace) {
    return (
      <div className={view.view}>
        <EmptyState
          title={t.workspace.notFound}
          helper={t.workspace.notFoundHelper}
        />
      </div>
    );
  }

  const isAdmin = workspace.role === "admin";
  const isOwner = workspace.owner_id === userId;

  const saveDetails = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void updateWorkspace(workspace.id, {
      name: trimmed,
      description: description.trim() || null,
    });
  };

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      <Link
        href={`${DASHBOARD_ROOT}/workspaces/${workspace.id}`}
        className={styles.backLink}
      >
        <ChevronLeft size="0.875rem" />
        {workspace.name}
      </Link>

      <h1 className={view.h1}>{t.workspace.settingsTitle}</h1>

      {/* Only admins can write these — the policy enforces it either way, but
          showing a form that always fails is worse than showing the values. */}
      {isAdmin && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>{t.workspace.details}</h2>
          </div>
          <div className={styles.card}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.workspace.nameLabel}</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveDetails}
                maxLength={60}
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
                onBlur={saveDetails}
                maxLength={500}
                rows={3}
              />
            </label>
            {/* Saved on blur, like the rest of Settings — each field is an
                independent preference, not a form you submit. */}
            <p className={styles.fieldNote}>{t.workspace.saved}</p>
          </div>
        </section>
      )}

      <WorkspaceMembers
        workspace={workspace}
        members={members}
        isAdmin={isAdmin}
        currentUserId={userId}
        onChanged={loadRoster}
      />

      {isOwner && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>{t.workspace.dangerZone}</h2>
          </div>
          <div className={styles.card}>
            <p className={styles.fieldNote}>
              {t.workspace.deleteHelperPrefix} <strong>{workspace.name}</strong>{" "}
              {t.workspace.deleteHelperSuffix}
            </p>
            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.miniButton} ${styles.danger}`}
                onClick={() => {
                  // Typed confirmation, not a yes/no: this destroys other
                  // people's work, not just the owner's.
                  const typed = window.prompt(
                    `${t.workspace.deletePrompt}\n\n${workspace.name}`,
                  );
                  if (typed?.trim() !== workspace.name) return;
                  void deleteWorkspace(workspace.id);
                  router.replace(`${DASHBOARD_ROOT}/workspaces`);
                }}
              >
                {t.workspace.deleteThis}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
