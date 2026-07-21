"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { Avatar } from "@/components/auth/Avatar";
import { SmartAddBar } from "@/components/task/SmartAddBar";
import { TaskRow } from "@/components/task/TaskRow";
import { eyebrowDate } from "@/lib/date";
import { DASHBOARD_ROOT } from "@/lib/nav";
import { memberProfile } from "@/lib/user";
import { pluralize, totalDuration } from "@/lib/format";
import { formatClock, withStartTimes } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { loadMembers } from "@/lib/supabase/workspaces";
import { useReminders } from "@/lib/useReminders";
import {
  MAX_WORKSPACE_MEMBERS,
  type WorkspaceMember,
} from "@/lib/types";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { EmptyState } from "./EmptyState";
import styles from "./WorkspaceView.module.css";
import view from "./View.module.css";

/**
 * One workspace: what it is, who is in it, and what the team is doing today.
 *
 * Ordered the way it is asked about. The shared day comes first because that is
 * what you open a workspace *for*; the roster and the invites are administration
 * and sit underneath. An admin screen at the top would put the least-used
 * controls in the most valuable space.
 */
export function WorkspaceView({ workspaceId }: { workspaceId: string }) {
  const today = useAppStore((s) => s.today);
  const userId = useAppStore((s) => s.userId);
  const workspace = useAppStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId),
  );
  const tasks = useAppStoreShallow((s) =>
    s.tasks.filter((t) => t.workspace_id === workspaceId),
  );

  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const { overdue } = useReminders();

  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const loadRoster = useCallback(async () => {
    if (!hasSupabaseConfig()) return;
    try {
      setMembers(await loadMembers(createClient(), workspaceId));
    } catch (error) {
      // A roster that fails to load must not take the shared day with it —
      // seeing your team's tasks matters more than seeing their names.
      console.error("[workspace] roster load failed", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const todays = useMemo(
    () => tasks.filter((t) => t.plan_date === today),
    [tasks, today],
  );
  const later = useMemo(
    () => tasks.filter((t) => t.plan_date !== today),
    [tasks, today],
  );

  const timed = useMemo(() => withStartTimes(todays), [todays]);
  const openCount = todays.filter((t) => t.status !== "done").length;

  if (!workspace) {
    return (
      <div className={view.view}>
        <EmptyState
          title="Workspace not found"
          helper="It may have been deleted, or you may have been removed from it."
        />
      </div>
    );
  }

  const isAdmin = workspace.role === "admin";

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      <header className={styles.header}>
        <span className={view.eyebrow}>{eyebrowDate(today)}</span>
        <div className={styles.titleRow}>
          <span className={styles.glyph} aria-hidden="true">
            {workspace.name.trim().charAt(0).toUpperCase() || "#"}
          </span>
          <h1 className={view.h1}>{workspace.name}</h1>
          <span className={styles.seats}>
            {workspace.member_count}/{MAX_WORKSPACE_MEMBERS}
          </span>
        </div>
        {workspace.description && (
          <p className={view.subline}>{workspace.description}</p>
        )}

        {/* Faces plus one link, rather than the full roster. Who is in here is
            worth seeing constantly; managing who is in here is not. */}
        <div className={styles.peopleStrip}>
          <span className={styles.faces}>
            {members.slice(0, 5).map((member) => (
              <Avatar
                key={member.user_id}
                profile={memberProfile(member)}
                size="1.625rem"
                className={styles.face}
              />
            ))}
            {members.length > 5 && (
              <span className={styles.face} data-more>
                +{members.length - 5}
              </span>
            )}
          </span>
          <Link
            href={`${DASHBOARD_ROOT}/workspaces/${workspace.id}/settings`}
            className={styles.manageLink}
          >
            {isAdmin ? "Manage & invite" : "People"}
          </Link>
        </div>
      </header>

      {/* Adds to the workspace, not to you. Without this a new workspace was
          a room with no door — nothing in the app could create a task with a
          workspace_id, so it stayed permanently empty. */}
      <SmartAddBar
        workspaceId={workspaceId}
        placeholder={`Add to ${workspace.name} — everyone here sees it`}
      />

      {/* ------------------------------------------------------------ today */}

      <section className={view.section}>
        <div className={view.sectionHead}>
          <h2 className={view.sectionLabel}>Today</h2>
          <span className={view.sectionMeta}>
            {openCount} {pluralize(openCount, "task")}
          </span>
          <span className={view.sectionMetaRight}>
            &asymp;{" "}
            {totalDuration(
              todays
                .filter((t) => t.status !== "done")
                .reduce((sum, t) => sum + t.estimated_minutes, 0),
            )}
          </span>
        </div>

        {timed.length === 0 ? (
          <p className={view.emptyDashed}>
            Nothing planned here today. Anyone in the workspace can add
            something.
          </p>
        ) : (
          <ol className={styles.timeline}>
            {timed.map(({ task, start, fixed }, index) => {
              const clock = formatClock(start);
              const repeats =
                index > 0 && formatClock(timed[index - 1].start) === clock;
              const isDone = task.status === "done";
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  clock={repeats ? null : clock}
                  fixed={fixed}
                  overdue={overdue.has(task.id)}
                  index={index}
                  onToggle={() =>
                    isDone ? uncompleteTask(task.id) : completeTask(task.id)
                  }
                  onDelete={(id) => void deleteTask(id)}
                  menuOpen={menuTaskId === task.id}
                  onMenuOpenChange={(next) =>
                    setMenuTaskId(next ? task.id : null)
                  }
                />
              );
            })}
          </ol>
        )}
      </section>

      {/* --------------------------------------------------------- upcoming */}

      {later.length > 0 && (
        <section className={view.section}>
          <div className={view.sectionHead}>
            <h2 className={view.sectionLabel}>Later</h2>
            <span className={view.sectionMeta}>
              {later.length} {pluralize(later.length, "task")}
            </span>
          </div>
          <ol className={styles.timeline}>
            {later.map((task, index) => {
              const isDone = task.status === "done";
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  // Dated rather than clocked: on this list the useful
                  // distinction is which day, not which minute.
                  clock={task.plan_date}
                  onToggle={() =>
                    isDone ? uncompleteTask(task.id) : completeTask(task.id)
                  }
                  onDelete={(id) => void deleteTask(id)}
                  menuOpen={menuTaskId === task.id}
                  onMenuOpenChange={(next) =>
                    setMenuTaskId(next ? task.id : null)
                  }
                  index={index}
                />
              );
            })}
          </ol>
        </section>
      )}


    </div>
  );
}
