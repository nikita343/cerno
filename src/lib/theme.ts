import type { Theme } from "./types";

/**
 * Light is the product default. The designs only specify dark, so the light
 * palette is derived in `globals.css` — see the comment there.
 */
export const DEFAULT_THEME: Theme = "light";

/**
 * Theme lives in its own localStorage key rather than inside the persisted
 * Zustand blob, so the no-flash script in the document head can read it with a
 * single synchronous lookup instead of parsing the whole store.
 */
export const THEME_STORAGE_KEY = "cerno-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Reads the persisted theme. Returns the default on the server. */
export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Applies the theme to <html> and persists it. Safe to call on the server. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode — the theme still applies for this session */
  }
}
