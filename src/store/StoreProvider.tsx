"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { todayISO } from "@/lib/date";
import { readStoredTheme } from "@/lib/theme";
import {
  createAppStore,
  type AppStore,
  type InitialData,
} from "./createAppStore";

type StoreApi = ReturnType<typeof createAppStore>;

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({
  initialData,
  children,
}: {
  initialData: InitialData;
  children: ReactNode;
}) {
  const storeRef = useRef<StoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createAppStore(initialData);
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    // Persistence is rehydrated only after mount: the server and the first
    // client render both use `initialData`, so the markup matches exactly and
    // React never reports a hydration mismatch.
    void store.persist.rehydrate()?.then?.(() => {
      // The server's date can be stale by the time a tab is reopened, and a
      // persisted state can be days old. Re-anchor to the real local date,
      // then roll anything unfinished onto it.
      const actualToday = todayISO();
      if (actualToday !== store.getState().today) {
        store.getState().setToday(actualToday);
        store.getState().setUpcomingAnchor(actualToday);
      }
      store.getState().carryOver();
    });

    // The no-flash script already applied the stored theme to <html>; mirror it
    // into the store so components render the matching state. Setting it
    // directly (rather than via setTheme) avoids a redundant write back to
    // localStorage on every mount.
    store.setState({ theme: readStoredTheme() });
  }, []);

  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
}

export function useAppStore<T>(selector: (state: AppStore) => T): T {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useAppStore must be used inside <StoreProvider>");
  }
  return useStore(store, selector);
}

/**
 * For selectors that derive a *new* array or object on every call.
 *
 * Zustand v5 compares snapshots by reference, so an un-memoised derived
 * selector returns a fresh value each render and React warns that
 * `getServerSnapshot` should be cached — then re-renders in a loop. Comparing
 * shallowly fixes it: the derived array is only "new" when its members are.
 */
export function useAppStoreShallow<T>(selector: (state: AppStore) => T): T {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useAppStoreShallow must be used inside <StoreProvider>");
  }
  return useStore(store, useShallow(selector));
}

/** Escape hatch for imperative reads/writes outside render. */
export function useStoreApi(): StoreApi {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStoreApi must be used inside <StoreProvider>");
  }
  return store;
}
