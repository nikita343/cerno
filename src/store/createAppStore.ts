import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";

import { addDays } from "@/lib/date";
import { DAY_CAPACITY_MINUTES, seedDayPlan, seedDump, seedTasks } from "@/lib/fixtures";
import { isPlannableDump, planDump, smartAddTask } from "@/lib/planner";
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

  /* tasks */
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  moveToToday: (id: string) => void;
  deferTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (
    id: string,
    patch: Partial<Pick<Task, "title" | "priority" | "estimated_minutes" | "deadline">>,
  ) => void;
  /** Parse one phrase into a structured task and drop it on today. */
  addTaskSmart: (text: string) => Promise<void>;
  /** Roll unfinished tasks from past days onto today. */
  carryOver: () => void;

  /* ui */
  setMenuOpen: (open: boolean) => void;
  setUpcomingAnchor: (iso: string) => void;
  stepUpcomingWeek: (direction: -1 | 1) => void;
  setSearchQuery: (q: string) => void;
  setTheme: (theme: Theme) => void;

  resetToSeed: () => void;
}

export type AppStore = AppState & AppActions;

export interface InitialData {
  today: string;
  tasks: Task[];
  dayPlans: Record<string, DayPlan>;
  dumps: Dump[];
}

/**
 * Server-rendered starting point. Kept as a pure function of the date so the
 * server and the first client render produce byte-identical markup.
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

const PERSIST_KEY = "cerno-store";
const PERSIST_VERSION = 1;

export function createAppStore(initial: InitialData) {
  return createStore<AppStore>()(
    persist(
      (set, get) => ({
        ...initial,

        captureOpen: false,
        captureMode: "ready",
        dumpText: "",
        planError: null,
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

        /* ---------------------------------------------------------------- */
        /* Tasks                                                            */
        /* ---------------------------------------------------------------- */

        completeTask: (id) =>
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, status: "done" as const } : t,
            ),
          })),

        uncompleteTask: (id) =>
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, status: "today" as const, plan_date: state.today }
                : t,
            ),
          })),

        moveToToday: (id) =>
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, status: "today" as const, plan_date: state.today }
                : t,
            ),
          })),

        deferTask: (id) =>
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: "deferred" as const,
                    plan_date: addDays(state.today, 1),
                    reasoning: t.reasoning ?? "Parked for tomorrow.",
                  }
                : t,
            ),
          })),

        deleteTask: (id) =>
          set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

        updateTask: (id, patch) =>
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          })),

        addTaskSmart: async (text) => {
          const { today } = get();
          const task = await smartAddTask(text, today);
          set((state) => {
            // New quick-adds go to the end of today's list rather than
            // reshuffling a plan the user has already seen.
            const lastOrder = state.tasks
              .filter((t) => t.status === "today" && t.plan_date === today)
              .reduce((max, t) => Math.max(max, t.sort_order), -1);
            return {
              tasks: [...state.tasks, { ...task, sort_order: lastOrder + 1 }],
            };
          });
        },

        carryOver: () =>
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.status === "today" && t.plan_date && t.plan_date < state.today
                ? { ...t, plan_date: state.today }
                : t,
            ),
          })),

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

        resetToSeed: () =>
          set(() => ({ ...buildInitialData(get().today), upcomingAnchor: get().today })),
      }),
      {
        name: PERSIST_KEY,
        version: PERSIST_VERSION,
        storage: createJSONStorage(() => localStorage),
        // Rehydration is triggered manually after mount so server and client
        // render the same markup — see StoreProvider.
        skipHydration: true,
        // Only durable data is persisted; transient UI always starts fresh.
        // Theme is persisted separately under `cerno-theme` so the no-flash
        // script can read it without parsing this blob.
        partialize: (state) => ({
          tasks: state.tasks,
          dayPlans: state.dayPlans,
          dumps: state.dumps,
        }),
      },
    ),
  );
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
