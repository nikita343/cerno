import type { SupabaseClient } from "@supabase/supabase-js";
import { createStore } from "zustand/vanilla";

import { addDays } from "@/lib/date";
import { DAY_CAPACITY_MINUTES, seedDayPlan, seedDump, seedTasks } from "@/lib/fixtures";
import { isPlannableDump, planDump, smartAddTask } from "@/lib/planner";
import {
  deleteTaskRow,
  updateTaskRow,
  type TaskPatch,
} from "@/lib/supabase/data";
import { applyTheme, DEFAULT_THEME } from "@/lib/theme";
import type {
  CaptureMode,
  DayPlan,
  Dump,
  Priority,
  Task,
  Theme,
} from "@/lib/types";

export interface AppState {
  /** ISO date the app considers "today". Seeded by the server, refreshed on mount. */
  today: string;

  tasks: Task[];
  dayPlans: Record<string, DayPlan>;
  dumps: Dump[];

  /* --- transient UI (never persisted) --- */
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
    patch: Partial<Pick<Task, "title" | "priority" | "estimated_minutes" | "deadline">>,
  ) => Promise<void>;
  /** Parse one phrase into a structured task and drop it on today. */
  addTaskSmart: (text: string) => Promise<void>;
  /** Roll unfinished tasks from past days onto today. */
  carryOver: () => Promise<void>;

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

      addTaskSmart: async (text) => {
        const { today } = get();
        try {
          // Persisted server-side by /api/tasks/parse; the returned task
          // already has its database id.
          const task = await smartAddTask(text, today);
          set((state) => {
            // New quick-adds go to the end of today's list rather than
            // reshuffling a plan the user has already seen.
            const lastOrder = state.tasks
              .filter((t) => t.status === "today" && t.plan_date === today)
              .reduce((max, t) => Math.max(max, t.sort_order), -1);
            return {
              tasks: [...state.tasks, { ...task, sort_order: lastOrder + 1 }],
              syncError: null,
            };
          });
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
