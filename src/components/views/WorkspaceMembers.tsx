"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/auth/Avatar";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import {
  createInvite,
  loadInvites,
  removeMember,
  revokeInvite,
  setMemberRole,
  transferOwnership,
} from "@/lib/supabase/workspaces";
import {
  MAX_WORKSPACE_MEMBERS,
  type Workspace,
  type WorkspaceInvite,
  type WorkspaceMember,
} from "@/lib/types";
import { useT } from "@/lib/i18n";
import { memberProfile } from "@/lib/user";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./WorkspaceView.module.css";
import view from "./View.module.css";

/**
 * The roster and the invites.
 *
 * Every control here is also enforced in the database — an admin who edits the
 * DOM to reveal the Remove button still cannot remove the owner, because the
 * policy says so. This component decides what is *worth showing*, not what is
 * allowed. That is why failures surface as messages rather than being
 * prevented by disabling everything: the server's answer is the real one.
 */
export function WorkspaceMembers({
  workspace,
  members,
  isAdmin,
  currentUserId,
  onChanged,
}: {
  workspace: Workspace;
  members: WorkspaceMember[];
  isAdmin: boolean;
  currentUserId: string | null;
  onChanged: () => void;
}) {
  const t = useT();
  const refreshWorkspaces = useAppStore((s) => s.refreshWorkspaces);
  const leaveWorkspace = useAppStore((s) => s.leaveWorkspace);

  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** What just happened, in the admin's terms — sent, or created but not sent. */
  const [notice, setNotice] = useState<string | null>(null);
  const running = useRef(false);

  const seatsLeft = MAX_WORKSPACE_MEMBERS - workspace.member_count;
  const full = seatsLeft <= 0;

  const db = useCallback(
    () => (hasSupabaseConfig() ? createClient() : null),
    [],
  );

  const refreshInvites = useCallback(async () => {
    const client = db();
    if (!client || !isAdmin) return;
    try {
      setInvites(await loadInvites(client, workspace.id));
    } catch (error) {
      // Members can't read invites at all — that's the policy working, not a
      // failure worth showing them.
      console.error("[workspace] invite load failed", error);
    }
  }, [db, isAdmin, workspace.id]);

  useEffect(() => {
    void refreshInvites();
  }, [refreshInvites]);

  const run = async (work: () => Promise<void>) => {
    // Same reason as NewWorkspaceView: `busy` is state and lags a render, and
    // `disabled={busy}` lags with it. Creating an invite twice is harmless but
    // untidy; promoting or removing twice races the server for no reason.
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      onChanged();
      await refreshWorkspaces();
    } catch (caught) {
      // The database's message is the useful one here — "this workspace is
      // full", "the owner is always an admin" — and all of them are written to
      // be read by a person.
      setError(messageFor(caught));
    } finally {
      setBusy(false);
      running.current = false;
    }
  };

  const invite = (addressed: boolean) =>
    run(async () => {
      const client = db();
      if (!client || !currentUserId) throw new Error(t.workspace.signInFirst);
      const created = await createInvite(
        client,
        workspace.id,
        currentUserId,
        addressed ? email : null,
      );
      const recipient = email;
      setEmail("");
      await refreshInvites();

      if (!addressed) {
        await copyLink(created.token);
        setNotice(t.workspace.linkCopied);
        return;
      }

      // The invite exists either way; only delivery can fail. So the link is
      // copied first, and the email is a bonus on top — an admin whose mail
      // provider is down still has something to paste.
      await copyLink(created.token);
      const response = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: created.id }),
      });
      const body = (await response.json().catch(() => null)) as {
        sent?: boolean;
        error?: string;
        detail?: string;
      } | null;

      setNotice(
        body?.sent
          ? `${t.workspace.invitedEmailedPrefix} ${recipient}. ${t.workspace.invitedEmailedSuffix}`
          : `${t.workspace.inviteCreatedPrefix} ${body?.error ?? t.workspace.emailDidntSend}.`,
      );
    });

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/dashboard/join/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be denied outright. Falling back to showing the
      // URL beats a button that silently does nothing.
      window.prompt(t.workspace.copyThisLink, url);
    }
  };

  return (
    <section className={view.section}>
      <div className={view.sectionHead}>
        <h2 className={view.sectionLabel}>{t.workspace.people}</h2>
        <span className={view.sectionMeta}>
          {workspace.member_count} {t.workspace.ofSeats} {MAX_WORKSPACE_MEMBERS} {t.workspace.seatsWord}
        </span>
      </div>

      <div className={styles.card}>
        {members.length === 0 && (
          <p className={styles.fieldNote}>
            {t.workspace.rosterError}
          </p>
        )}

        <ul className={styles.memberList}>
          {members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            const isOwner = member.user_id === workspace.owner_id;
            return (
              <li key={member.user_id} className={styles.memberRow}>
                {/* The same <Avatar> the app uses for you, so a teammate with
                    a Google photo shows it rather than a grey initial. */}
                <Avatar
                  profile={memberProfile(member)}
                  size="1.75rem"
                  className={styles.memberAvatar}
                />
                <span className={styles.memberText}>
                  <span className={styles.memberName}>
                    {memberProfile(member).name}
                    {isSelf && <span className={styles.you}> {t.workspace.you}</span>}
                  </span>
                  {member.email && (
                    <span className={styles.memberEmail}>{member.email}</span>
                  )}
                </span>

                <span className={styles.roleBadge} data-owner={isOwner || undefined}>
                  {isOwner ? t.workspace.owner : member.role === "admin" ? t.workspace.admin : t.workspace.member}
                </span>

                {/* The owner has no controls at all: they cannot be removed or
                    demoted, so offering either would be offering a button that
                    always fails. */}
                {isAdmin && !isOwner && (
                  <span className={styles.memberActions}>
                    <button
                      type="button"
                      className={styles.miniButton}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const client = db();
                          if (!client) return;
                          await setMemberRole(
                            client,
                            workspace.id,
                            member.user_id,
                            member.role === "admin" ? "member" : "admin",
                          );
                        })
                      }
                    >
                      {member.role === "admin" ? t.workspace.makeMember : t.workspace.makeAdmin}
                    </button>

                    {currentUserId === workspace.owner_id && (
                      <button
                        type="button"
                        className={styles.miniButton}
                        disabled={busy}
                        onClick={() => {
                          // Irreversible by the person doing it — only the new
                          // owner can hand it back.
                          if (
                            !window.confirm(
                              `${t.workspace.makeOwnerConfirmPrefix} ${memberProfile(member).name} ${t.workspace.makeOwnerConfirm}`,
                            )
                          ) {
                            return;
                          }
                          void run(async () => {
                            const client = db();
                            if (!client) return;
                            await transferOwnership(
                              client,
                              workspace.id,
                              member.user_id,
                            );
                          });
                        }}
                      >
                        {t.workspace.makeOwner}
                      </button>
                    )}

                    <button
                      type="button"
                      className={`${styles.miniButton} ${styles.danger}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `${t.workspace.removeConfirmPrefix} ${memberProfile(member).name} ${t.workspace.removeConfirmMid} ${workspace.name}?`,
                          )
                        ) {
                          return;
                        }
                        void run(async () => {
                          const client = db();
                          if (!client) return;
                          await removeMember(client, workspace.id, member.user_id);
                        });
                      }}
                    >
                      {t.workspace.remove}
                    </button>
                  </span>
                )}

                {isSelf && !isOwner && (
                  <button
                    type="button"
                    className={`${styles.miniButton} ${styles.danger}`}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`${t.workspace.leaveConfirm} ${workspace.name}?`)) return;
                      void leaveWorkspace(workspace.id);
                    }}
                  >
                    {t.workspace.leave}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {isAdmin && (
          <div className={styles.inviteBox}>
            {full ? (
              <p className={styles.fullNote}>
                {t.workspace.fullPrefix} {MAX_WORKSPACE_MEMBERS} {t.workspace.fullSuffix}{" "}
                <a
                  className={styles.inlineLink}
                  href={`mailto:hello@usecerno.xyz?subject=${encodeURIComponent("Cerno Enterprise")}`}
                >
                  {t.workspace.talkEnterprise}
                </a>{" "}
                {t.workspace.forBiggerTeam}
              </p>
            ) : (
              <>
                <label className={styles.inviteLabel} htmlFor="invite-email">
                  {t.workspace.inviteSomeone} &mdash; {seatsLeft}{" "}
                  {seatsLeft === 1 ? t.workspace.seatWord : t.workspace.seatsWord} {t.workspace.leftWord}
                </label>
                <div className={styles.inviteRow}>
                  <input
                    id="invite-email"
                    className={styles.inviteInput}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.workspace.emailPlaceholder}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={styles.invitePrimary}
                    disabled={busy || !email.includes("@")}
                    onClick={() => void invite(true)}
                  >
                    {t.workspace.invite}
                  </button>
                  <button
                    type="button"
                    className={styles.inviteSecondary}
                    disabled={busy}
                    onClick={() => void invite(false)}
                  >
                    {t.workspace.copyLink}
                  </button>
                </div>
                {/* The distinction that matters: "Invite" emails them AND
                    copies the link; "Copy link" only copies. Both are stated
                    because an admin who assumes an email went out would sit
                    waiting for someone who was never contacted. */}
                <p className={styles.fieldNote}>{t.workspace.inviteExplain}</p>

                {notice && (
                  <p className={styles.notice} role="status">
                    {notice}
                  </p>
                )}
              </>
            )}

            {invites.length > 0 && (
              <ul className={styles.inviteList}>
                {invites.map((item) => (
                  <li key={item.id} className={styles.inviteItem}>
                    <span className={styles.inviteWho}>
                      {item.email ?? t.workspace.anyoneWithLink}
                    </span>
                    <span className={styles.inviteMeta}>
                      {item.uses >= item.max_uses
                        ? t.workspace.used
                        : new Date(item.expires_at) < new Date()
                          ? t.workspace.expired
                          : `${t.workspace.expires} ${new Date(item.expires_at).toLocaleDateString()}`}
                    </span>
                    <button
                      type="button"
                      className={styles.miniButton}
                      onClick={() => void copyLink(item.token)}
                    >
                      {copied === item.token ? t.workspace.copied : t.workspace.copy}
                    </button>
                    <button
                      type="button"
                      className={`${styles.miniButton} ${styles.danger}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const client = db();
                          if (!client) return;
                          await revokeInvite(client, item.id);
                          await refreshInvites();
                        })
                      }
                    >
                      {t.workspace.revoke}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Postgres raises these with messages written for people ("this workspace is
 * full", "the owner is always an admin"), so they are shown as-is. The fallback
 * covers network errors, which are not.
 */
function messageFor(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  return message || "That didn't work. Try again.";
}
