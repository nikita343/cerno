import type { SupabaseClient } from "@supabase/supabase-js";
import { createStore } from "zustand/vanilla";

import { addDays } from "@/lib/date";
import { DAY_CAPACITY_MINUTES, seedDayPlan, seedDump, seedTasks } from "@/lib/fixtures";
import { newId } from "@/lib/id";
import { isPlannableDump, planDump, smartAddTask } from "@/lib/planner";
import {
  deleteLabelRow,
  deleteTaskRow,
  insertLabel,
  renameLabelRow,
  saveSettings,
  updateLabelColor,
  updateTaskRow,
  uploadAvatar,
  type TaskPatch,
} from "@/lib/supabase/data";
import {
  createWorkspaceRow,
  deleteWorkspaceRow,
  loadSubscription,
  loadWorkspaces,
  removeMember,
  updateWorkspaceRow,
} from "@/lib/supabase/workspaces";
import { applyTheme, DEFAULT_THEME } from "@/lib/theme";
import {
  DEFAULT_LABELS,
  DEFAULT_SETTINGS,
  FREE_PLAN,
  isEntitled,
  type CaptureMode,
  type DayPlan,
  type Dump,
  type Label,
  type Priority,
  type Task,
  type Subscription,
  type Theme,
  type UserSettings,
  type Workspace,
} from "@/lib/types";

export interface AppState {
  /** ISO date the app considers "today". Seeded by the server, refreshed on mount. */
  today: string;

  tasks: Task[];
  dayPlans: Record<string, DayPlan>;
  dumps: Dump[];
  labels: Label[];
  settings: UserSettings;
  /**
   * The signed-in user's id, or null when signed out.
   *
   * Spread in from `InitialData` and declared here so components can read it —
   * a workspace roster has to know which row is "you" to render Leave rather
   * than Remove.
   */
  userId: string | null;

  /**
   * Workspaces the user belongs to, and their plan.
   *
   * Both are loaded with the dashboard rather than fetched per screen: the
   * sidebar lists workspaces on every page, and the plan decides whether the
   * "New workspace" affordance is even offered.
   */
  workspaces: Workspace[];
  subscription: Subscription;

  /**
   * Minutes from midnight, as the app currently believes them.
   *
   * Held in state rather than read from `Date.now()` during render, for two
   * reasons: a component that computes "now" while rendering produces different
   * server and client markup and breaks hydration, and a single ticking value
   * means every overdue badge in the tree flips on the same frame instead of
   * whenever each one happens to re-render.
   */
  nowMinutes: number;

  /* --- transient UI (never persisted) --- */
  /** Ids the user has dismissed from the notification panel this session. */
  dismissedReminders: string[];
  notificationsOpen: boolean;
  captureOpen: boolean;
  captureMode: CaptureMode;
  dumpText: string;
  planError: string | null;
  /** Set when a write reached the server and failed. */
  syncError: string | null;
  menuOpen: boolean;
  /** Anchor date for the Upcoming week strip. */
  upcomingAnchor: string;
  searchQuery: string;

  theme: Theme;
}

export interface AppActions {
  setToday: (iso: string) => void;

  /* capture */
  openCapture: () => void;
  closeCapture: () => void;
  setDumpText: (text: string) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  submitDump: (source?: "text" | "voice") => Promise<void>;
  dismissPlanError: () => void;
  dismissSyncError: () => void;

  /* tasks */
  completeTask: (id: string) => Promise<void>;
  uncompleteTask: (id: string) => Promise<void>;
  moveToToday: (id: string) => Promise<void>;
  deferTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTask: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "priority"
        | "estimated_minutes"
        | "deadline"
        // `null` clears the time and hands the task back to the derived
        // timeline, which is a meaningfully different state from "09:00".
        | "suggested_start"
      >
    >,
  ) => Promise<void>;
  /**
   * Moves a task to a day. `null` sends it to the Inbox.
   *
   * Separate from `updateTask` because it also has to fix `status`: a task
   * moved off the calendar has to leave the timeline, and one moved onto a day
   * has to rejoin it. Patching `plan_date` alone would leave a "deferred" task
   * rendering on a day it was explicitly rescheduled to.
   */
  rescheduleTask: (id: string, date: string | null) => Promise<void>;
  /**
   * Schedules a task onto a day *and* pins its start time, in one write.
   *
   * The drag-onto-a-time-block gesture: dropping into Afternoon both moves the
   * task to that day and sets it to start when the afternoon does. Separate
   * from `rescheduleTask` (which never touches the time) and from `updateTask`
   * (which deliberately can't touch `plan_date`/`status`), so neither has to
   * grow a second responsibility.
   */
  scheduleTaskAt: (
    id: string,
    date: string,
    suggestedStart: string,
  ) => Promise<void>;
  /** Same, for every id at once — the bulk overdue action. */
  rescheduleMany: (ids: string[], date: string | null) => Promise<void>;
  /**
   * Parse one phrase into a structured task.
   *
   * `date` pins it to a specific day, overriding whatever the parser inferred —
   * adding from Thursday's row means Thursday, even if the text says nothing
   * about a date. Omit it to let the parser decide (the Today quick-add).
   */
  addTaskSmart: (
    text: string,
    date?: string,
    /** Adds into a workspace's shared list rather than your own. */
    workspaceId?: string | null,
    /** Assigns the task to a workspace member. Null / omitted is unassigned. */
    assigneeId?: string | null,
  ) => Promise<void>;
  /** Roll unfinished tasks from past days onto today. */
  carryOver: () => Promise<void>;

  /* --- workspaces --- */
  createWorkspace: (name: string, description: string | null) => Promise<string>;
  updateWorkspace: (
    id: string,
    patch: { name?: string; description?: string | null },
  ) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  /** Removing yourself; the same call an admin uses to remove someone else. */
  leaveWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  /**
   * Re-reads the plan from the server.
   *
   * Needed because entitlement is granted by a Stripe *webhook*, which is a
   * separate request from the one that redirects the customer back. The two
   * race, and the redirect usually wins — so the page that says "thanks for
   * paying" is often rendered before the payment has been recorded.
   */
  refreshSubscription: () => Promise<boolean>;

  /* labels */
  addLabel: (name: string, color: string) => Promise<void>;
  renameLabel: (id: string, name: string) => Promise<void>;
  recolorLabel: (id: string, color: string) => Promise<void>;
  removeLabel: (id: string) => Promise<void>;

  /* settings */
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  uploadAvatarFile: (file: File) => Promise<void>;
  /**
   * Mints a new calendar feed token, or clears it.
   *
   * Regenerating is also how you revoke: the old URL stops resolving the moment
   * the new token is written, because the lookup is by exact token.
   */
  rotateFeedToken: (enabled: boolean) => Promise<void>;

  /* reminders */
  setNowMinutes: (minutes: number) => void;
  setNotificationsOpen: (open: boolean) => void;
  dismissReminder: (id: string) => void;
  clearDismissedReminders: () => void;

  /* ui */
  setMenuOpen: (open: boolean) => void;
  setUpcomingAnchor: (iso: string) => void;
  stepUpcomingWeek: (direction: -1 | 1) => void;
  setSearchQuery: (q: string) => void;
  setTheme: (theme: Theme) => void;
}

export type AppStore = AppState & AppActions;

export interface InitialData {
  today: string;
  tasks: Task[];
  dayPlans: Record<string, DayPlan>;
  dumps: Dump[];
  labels: Label[];
  settings: UserSettings;
  workspaces: Workspace[];
  subscription: Subscription;
  /** The user id, for writes that must state it. Null when signed out. */
  userId: string | null;
}

/**
 * Fallback data for when Supabase isn't configured.
 *
 * Kept as a pure function of the date so the server and the first client render
 * produce byte-identical markup.
 */
export function buildInitialData(today: string): InitialData {
  const plan = seedDayPlan(today);
  return {
    today,
    tasks: seedTasks(today),
    dayPlans: { [plan.plan_date]: plan },
    dumps: [seedDump()],
    labels: DEFAULT_LABELS.map((label, i) => ({
      id: `seed-${label.name}`,
      name: label.name,
      color: label.color,
      sort_order: i,
      created_at: `${today}T00:00:00.000Z`,
    })),
    settings: DEFAULT_SETTINGS,
    // No backend means no workspaces and no plan. The fixtures deliberately
    // don't invent a team: a keyless demo showing a fake workspace you cannot
    // open is worse than showing none.
    workspaces: [],
    subscription: FREE_PLAN,
    userId: null,
  };
}

/**
 * Supplies the browser Supabase client, or null when unconfigured.
 *
 * Injected rather than imported so the store stays testable and so a keyless
 * dev environment degrades to in-memory state instead of throwing on every
 * mutation.
 */
export type DbGetter = () => SupabaseClient | null;

const SYNC_FAILED = "That didn't save. Check your connection and try again.";

/**
 * The fields a reschedule touches.
 *
 * `status` moves with the date, which is the whole reason this isn't a plain
 * `plan_date` patch:
 *
 *   - A date makes the task scheduled work again, so a previously deferred or
 *     inboxed task rejoins the timeline. Without this, rescheduling a deferred
 *     task to today would set the date and leave it sitting in Deferred.
 *   - No date means it has no day at all, which is exactly what `inbox`
 *     already means. Reusing that state keeps the task visible in Inbox rather
 *     than inventing a fourth place for work to hide.
 *
 * A completed task is deliberately not special-cased: rescheduling one is a
 * reasonable way to reopen it, and `status` moving to `today` does that.
 */
function reschedulePatch(date: string | null): TaskPatch {
  return date === null
    ? { plan_date: null, status: "inbox" }
    : { plan_date: date, status: "today" };
}

export function createAppStore(initial: InitialData, getDb: DbGetter = () => null) {
  return createStore<AppStore>()((set, get) => {
    /**
     * Applies an optimistic change, then writes it.
     *
     * On failure the previous task list is restored. Leaving the optimistic
     * state in place would show the user a change that does not exist on the
     * server, and they'd only discover it on the next reload.
     */
    const writeThrough = async (
      optimistic: (tasks: Task[]) => Task[],
      persist: (db: SupabaseClient) => Promise<void>,
    ) => {
      const previous = get().tasks;
      set({ tasks: optimistic(previous), syncError: null });

      const db = getDb();
      if (!db) return; // No backend configured: in-memory only.

      try {
        await persist(db);
      } catch {
        set({ tasks: previous, syncError: SYNC_FAILED });
      }
    };

    /**
     * The same optimistic-then-rollback contract, for labels.
     *
     * Kept separate from `writeThrough` rather than generalised over a key:
     * a label rename also rewrites task tags, so some of these have to restore
     * both slices on failure, and a single generic helper would either not
     * support that or would need a parameter for every case.
     */
    const writeLabels = async (
      optimistic: (labels: Label[]) => Label[],
      persist: (db: SupabaseClient) => Promise<void>,
      /** Applied alongside, for changes that also touch tasks. */
      optimisticTasks?: (tasks: Task[]) => Task[],
    ) => {
      const previousLabels = get().labels;
      const previousTasks = get().tasks;
      set({
        labels: optimistic(previousLabels),
        ...(optimisticTasks ? { tasks: optimisticTasks(previousTasks) } : {}),
        syncError: null,
      });

      const db = getDb();
      if (!db) return;

      try {
        await persist(db);
      } catch {
        set({
          labels: previousLabels,
          tasks: previousTasks,
          syncError: SYNC_FAILED,
        });
      }
    };

    return {
      ...initial,

      captureOpen: false,
      captureMode: "ready",
      dumpText: "",
      planError: null,
      syncError: null,
      menuOpen: false,
      upcomingAnchor: initial.today,
      searchQuery: "",
      theme: DEFAULT_THEME,
      // Zero until the client ticks it. The server has no meaningful "now" for
      // the viewer's timezone, and guessing one would render an overdue badge
      // on the server that the client immediately contradicts.
      nowMinutes: 0,
      dismissedReminders: [],
      notificationsOpen: false,

      setToday: (iso) => set({ today: iso }),

      /* ---------------------------------------------------------------- */
      /* Capture                                                          */
      /* ---------------------------------------------------------------- */

      openCapture: () =>
        set({
          captureOpen: true,
          captureMode: "ready",
          planError: null,
          menuOpen: false,
        }),

      closeCapture: () =>
        set({
          captureOpen: false,
          captureMode: "ready",
          dumpText: "",
          planError: null,
        }),

      setDumpText: (dumpText) => set({ dumpText }),

      setCaptureMode: (captureMode) => set({ captureMode }),

      submitDump: async (source = "text") => {
        const { dumpText, today } = get();

        // Empty/junk dump: no API call, just surface the message inline.
        if (!isPlannableDump(dumpText)) {
          set({ planError: "Add a few words and I'll plan them." });
          return;
        }

        set({ captureMode: "thinking", planError: null });

        // Everything still outstanding is replanned together with the new
        // dump: today's open items and anything previously parked. Done
        // tasks and work dated further out are left alone.
        const carryIn = get().tasks.filter(
          (t) =>
            (t.status === "today" && t.plan_date === today) ||
            t.status === "deferred" ||
            t.status === "inbox",
        );
        const carriedIds = new Set(carryIn.map((t) => t.id));

        try {
          // /api/plan persists the result server-side before returning, so the
          // tasks below already carry their database ids. No write here.
          const result = await planDump({
            dumpText,
            source,
            today,
            capacityMinutes: DAY_CAPACITY_MINUTES,
            carryIn,
            // Only consulted if the route is unreachable and planning falls
            // back to the local heuristic; the server reads labels itself.
            labelNames: get().labels.map((l) => l.name),
          });

          set((state) => ({
            // The replanned tasks come back with the same ids, so this
            // swaps them in place rather than duplicating them.
            tasks: [
              ...state.tasks.filter((t) => !carriedIds.has(t.id)),
              ...result.tasks,
            ],
            dayPlans: {
              ...state.dayPlans,
              [result.dayPlan.plan_date]: result.dayPlan,
            },
            dumps: [result.dump, ...state.dumps],
            captureOpen: false,
            captureMode: "ready",
            dumpText: "",
          }));
        } catch {
          set({
            captureMode: "ready",
            planError: "That didn't go through. Try again.",
          });
        }
      },

      dismissPlanError: () => set({ planError: null }),
      dismissSyncError: () => set({ syncError: null }),

      /* ---------------------------------------------------------------- */
      /* Tasks                                                            */
      /* ---------------------------------------------------------------- */

      completeTask: (id) =>
        writeThrough(
          (tasks) =>
            tasks.map((t) => (t.id === id ? { ...t, status: "done" as const } : t)),
          (db) => updateTaskRow(db, id, { status: "done" }),
        ),

      uncompleteTask: (id) => {
        const today = get().today;
        return writeThrough(
          (tasks) =>
            tasks.map((t) =>
              t.id === id
                ? { ...t, status: "today" as const, plan_date: today }
                : t,
            ),
          (db) => updateTaskRow(db, id, { status: "today", plan_date: today }),
        );
      },

      moveToToday: (id) => {
        const today = get().today;
        return writeThrough(
          (tasks) =>
            tasks.map((t) =>
              t.id === id
                ? { ...t, status: "today" as const, plan_date: today }
                : t,
            ),
          (db) => updateTaskRow(db, id, { status: "today", plan_date: today }),
        );
      },

      deferTask: (id) => {
        const tomorrow = addDays(get().today, 1);
        const existing = get().tasks.find((t) => t.id === id);
        const reasoning = existing?.reasoning ?? "Parked for tomorrow.";
        return writeThrough(
          (tasks) =>
            tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: "deferred" as const,
                    plan_date: tomorrow,
                    reasoning,
                  }
                : t,
            ),
          (db) =>
            updateTaskRow(db, id, {
              status: "deferred",
              plan_date: tomorrow,
              reasoning,
            }),
        );
      },

      deleteTask: (id) =>
        writeThrough(
          (tasks) => tasks.filter((t) => t.id !== id),
          (db) => deleteTaskRow(db, id),
        ),

      updateTask: (id, patch) =>
        writeThrough(
          (tasks) => tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          (db) => updateTaskRow(db, id, patch as TaskPatch),
        ),

      rescheduleTask: (id, date) => {
        const patch = reschedulePatch(date);
        return writeThrough(
          (tasks) => tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          (db) => updateTaskRow(db, id, patch),
        );
      },

      scheduleTaskAt: (id, date, suggestedStart) => {
        const patch = {
          plan_date: date,
          status: "today" as const,
          suggested_start: suggestedStart,
        };
        return writeThrough(
          (tasks) => tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          (db) => updateTaskRow(db, id, patch),
        );
      },

      rescheduleMany: (ids, date) => {
        if (ids.length === 0) return Promise.resolve();
        const patch = reschedulePatch(date);
        const target = new Set(ids);
        return writeThrough(
          (tasks) => tasks.map((t) => (target.has(t.id) ? { ...t, ...patch } : t)),
          async (db) => {
            // Sequential, not Promise.all: a bulk reschedule of a badly
            // overdue day can be a dozen rows, and firing them together makes
            // a partial failure much harder to reason about — the rollback
            // restores everything, so a burst buys nothing.
            for (const id of ids) {
              await updateTaskRow(db, id, patch);
            }
          },
        );
      },

      addTaskSmart: async (text, date, workspaceId = null, assigneeId = null) => {
        const { today } = get();
        try {
          // Persisted server-side by /api/tasks/parse; the returned task
          // already has its database id.
          const parsed = await smartAddTask(
            text,
            today,
            get().labels.map((l) => l.name),
            workspaceId,
            assigneeId,
          );

          // An explicit day wins over whatever the parser inferred. Added from
          // Thursday's row, it goes on Thursday.
          const task: Task =
            date === undefined
              ? parsed
              : { ...parsed, plan_date: date, status: "today" };
          const targetDate = task.plan_date ?? today;

          set((state) => {
            // New quick-adds go to the end of that day's list rather than
            // reshuffling a plan the user has already seen.
            const lastOrder = state.tasks
              .filter((t) => t.status === "today" && t.plan_date === targetDate)
              .reduce((max, t) => Math.max(max, t.sort_order), -1);
            return {
              tasks: [...state.tasks, { ...task, sort_order: lastOrder + 1 }],
              syncError: null,
            };
          });

          // The route already persisted the parser's own date, so a pinned day
          // needs a follow-up write. Skipped when the parser's answer stood.
          const db = getDb();
          if (db && date !== undefined && parsed.plan_date !== date) {
            try {
              await updateTaskRow(db, task.id, {
                plan_date: date,
                status: "today",
              });
            } catch {
              set({ syncError: SYNC_FAILED });
            }
          }
        } catch {
          set({ syncError: SYNC_FAILED });
        }
      },

      carryOver: async () => {
        const { tasks, today } = get();
        const stale = tasks.filter(
          (t) => t.status === "today" && t.plan_date && t.plan_date < today,
        );
        if (stale.length === 0) return;

        set({
          tasks: tasks.map((t) =>
            stale.some((s) => s.id === t.id) ? { ...t, plan_date: today } : t,
          ),
        });

        const db = getDb();
        if (!db) return;
        try {
          // Sequential rather than parallel: this runs once on mount and a
          // burst of writes is worse than a few extra milliseconds.
          for (const task of stale) {
            await updateTaskRow(db, task.id, { plan_date: today });
          }
        } catch {
          // The rollover is recomputed on every mount, so a failure here
          // simply retries next time. Not worth interrupting the user.
        }
      },

      /* ---------------------------------------------------------------- */
      /* Labels                                                           */
      /* ---------------------------------------------------------------- */

      /* --------------------------------------------------------- workspaces */
      //
      // Not routed through `writeThrough`: that helper optimistically patches
      // `tasks` and rolls that array back. Workspace mutations either carry
      // server-side invariants (entitlement, the seat cap, the founding admin
      // row) or need the server's generated id, so each waits for the write and
      // then reconciles. A workspace that appears instantly and vanishes a
      // moment later because the plan had lapsed is worse than a brief wait.

      createWorkspace: async (name, description) => {
        const db = getDb();
        if (!db) throw new Error("Workspaces need a backend.");
        const workspace = await createWorkspaceRow(db, name.trim(), description);
        set((state) => ({ workspaces: [...state.workspaces, workspace] }));
        return workspace.id;
      },

      updateWorkspace: async (id, patch) => {
        const db = getDb();
        const previous = get().workspaces;
        set({
          workspaces: previous.map((w) => (w.id === id ? { ...w, ...patch } : w)),
          syncError: null,
        });
        if (!db) return;
        try {
          await updateWorkspaceRow(db, id, patch);
        } catch (error) {
          console.error("[store] workspace update failed", error);
          set({ workspaces: previous, syncError: SYNC_FAILED });
        }
      },

      deleteWorkspace: async (id) => {
        const db = getDb();
        const previous = get().workspaces;
        const previousTasks = get().tasks;
        // Its tasks go too — `on delete cascade` on tasks.workspace_id. They are
        // dropped locally as well, or the timeline keeps rendering rows that no
        // longer exist on the server.
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          tasks: state.tasks.filter((t) => t.workspace_id !== id),
          syncError: null,
        }));
        if (!db) return;
        try {
          await deleteWorkspaceRow(db, id);
        } catch (error) {
          console.error("[store] workspace delete failed", error);
          set({ workspaces: previous, tasks: previousTasks, syncError: SYNC_FAILED });
        }
      },

      leaveWorkspace: async (id) => {
        const db = getDb();
        const userId = initial.userId;
        if (!db || !userId) return;
        const previous = get().workspaces;
        const previousTasks = get().tasks;
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          tasks: state.tasks.filter((t) => t.workspace_id !== id),
          syncError: null,
        }));
        try {
          await removeMember(db, id, userId);
        } catch (error) {
          console.error("[store] leave workspace failed", error);
          set({ workspaces: previous, tasks: previousTasks, syncError: SYNC_FAILED });
        }
      },

      refreshSubscription: async () => {
        const db = getDb();
        if (!db) return false;
        try {
          const subscription = await loadSubscription(db);
          set({ subscription });
          return isEntitled(subscription);
        } catch (error) {
          console.error("[store] subscription refresh failed", error);
          return false;
        }
      },

      // Called after joining, or when a seat count may have moved. Cheap enough
      // to re-read on the workspace screen rather than track membership deltas.
      refreshWorkspaces: async () => {
        const db = getDb();
        if (!db) return;
        try {
          set({ workspaces: await loadWorkspaces(db) });
        } catch (error) {
          console.error("[store] workspace refresh failed", error);
        }
      },

      addLabel: async (name, color) => {
        const userId = initial.userId;
        const trimmed = name.trim();
        const sortOrder = get().labels.length;

        // The optimistic row carries a client id that the database will
        // replace. It is swapped for the real row below rather than left in
        // place, so a later rename targets an id the server recognises.
        const optimisticId = newId();
        const optimistic: Label = {
          id: optimisticId,
          name: trimmed,
          color,
          sort_order: sortOrder,
          created_at: new Date().toISOString(),
        };

        const previous = get().labels;
        set({ labels: [...previous, optimistic], syncError: null });

        const db = getDb();
        if (!db || !userId) return;

        try {
          const saved = await insertLabel(
            db,
            { name: trimmed, color, sort_order: sortOrder },
            userId,
          );
          set((state) => ({
            labels: state.labels.map((l) => (l.id === optimisticId ? saved : l)),
          }));
        } catch {
          set({ labels: previous, syncError: SYNC_FAILED });
        }
      },

      renameLabel: (id, name) => {
        const trimmed = name.trim();
        const previousName = get().labels.find((l) => l.id === id)?.name;
        return writeLabels(
          (labels) =>
            labels.map((l) => (l.id === id ? { ...l, name: trimmed } : l)),
          (db) => renameLabelRow(db, id, trimmed),
          // Tasks store label names, so a rename has to move with them or every
          // tagged task renders against a label that no longer exists.
          (tasks) =>
            previousName === undefined
              ? tasks
              : tasks.map((t) =>
                  t.tags.includes(previousName)
                    ? {
                        ...t,
                        tags: t.tags.map((tag) =>
                          tag === previousName ? trimmed : tag,
                        ),
                      }
                    : t,
                ),
        );
      },

      recolorLabel: (id, color) =>
        writeLabels(
          (labels) => labels.map((l) => (l.id === id ? { ...l, color } : l)),
          (db) => updateLabelColor(db, id, color),
        ),

      removeLabel: (id) => {
        const name = get().labels.find((l) => l.id === id)?.name;
        return writeLabels(
          (labels) => labels.filter((l) => l.id !== id),
          (db) => deleteLabelRow(db, id),
          (tasks) =>
            name === undefined
              ? tasks
              : tasks.map((t) =>
                  t.tags.includes(name)
                    ? { ...t, tags: t.tags.filter((tag) => tag !== name) }
                    : t,
                ),
        );
      },

      /* ---------------------------------------------------------------- */
      /* Settings                                                         */
      /* ---------------------------------------------------------------- */

      updateSettings: async (patch) => {
        const previous = get().settings;
        set({ settings: { ...previous, ...patch }, syncError: null });

        const db = getDb();
        const userId = initial.userId;
        if (!db || !userId) return;

        try {
          await saveSettings(db, patch, userId);
        } catch {
          set({ settings: previous, syncError: SYNC_FAILED });
        }
      },

      rotateFeedToken: async (enabled) => {
        // Generated client-side with crypto.randomUUID so the value never has
        // to round-trip before the URL can be shown.
        const feed_token = enabled ? newId() : null;
        const previous = get().settings;
        set({ settings: { ...previous, feed_token }, syncError: null });

        const db = getDb();
        const userId = initial.userId;
        if (!db || !userId) return;

        try {
          await saveSettings(db, { feed_token }, userId);
        } catch {
          set({ settings: previous, syncError: SYNC_FAILED });
        }
      },

      uploadAvatarFile: async (file) => {
        const db = getDb();
        const userId = initial.userId;
        if (!db || !userId) return;

        // Not optimistic: there is nothing to show until the upload finishes,
        // and a local object URL would be revoked on navigation and leave a
        // broken image behind.
        try {
          const url = await uploadAvatar(db, file, userId);
          set((state) => ({
            settings: { ...state.settings, avatar_url: url },
            syncError: null,
          }));
          await saveSettings(db, { avatar_url: url }, userId);
        } catch {
          set({ syncError: "That image didn't upload. Try a smaller one." });
        }
      },

      /* ---------------------------------------------------------------- */
      /* Reminders                                                        */
      /* ---------------------------------------------------------------- */

      setNowMinutes: (nowMinutes) => set({ nowMinutes }),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
      dismissReminder: (id) =>
        set((state) =>
          state.dismissedReminders.includes(id)
            ? state
            : { dismissedReminders: [...state.dismissedReminders, id] },
        ),
      clearDismissedReminders: () => set({ dismissedReminders: [] }),

      /* ---------------------------------------------------------------- */
      /* UI                                                               */
      /* ---------------------------------------------------------------- */

      setMenuOpen: (menuOpen) => set({ menuOpen }),
      setUpcomingAnchor: (upcomingAnchor) => set({ upcomingAnchor }),
      stepUpcomingWeek: (direction) =>
        set((state) => ({
          upcomingAnchor: addDays(state.upcomingAnchor, direction * 7),
        })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setTheme: (theme) => {
        // The <html> attribute is the source of truth for the CSS; the store
        // mirrors it so components can read the current theme in render.
        applyTheme(theme);
        set({ theme });
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Derived selectors — pure, so they can be reused server-side                */
/* -------------------------------------------------------------------------- */

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function scheduledFor(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((t) => t.plan_date === date && (t.status === "today" || t.status === "done"))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function deferredFor(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((t) => t.status === "deferred" && t.plan_date === addDays(date, 1))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function inboxTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return rank !== 0 ? rank : a.sort_order - b.sort_order;
    });
}

export function tasksOn(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((t) => t.plan_date === date && t.status !== "done")
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function totalMinutes(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + t.estimated_minutes, 0);
}
