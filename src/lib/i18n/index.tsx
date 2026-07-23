"use client";

import { createContext, useContext, useMemo } from "react";

import type { AppLanguage } from "@/lib/types";
import { localeFor, type DateLocale } from "@/lib/date";
import { useAppStore } from "@/store/StoreProvider";

import { DICTIONARIES, en, type Dictionary } from "./dictionary";

/**
 * Translation, read from the user's stored setting.
 *
 * No context provider of its own: the language already lives in the app store,
 * loaded server-side with the rest of settings, so the first render is already
 * in the right language. A separate provider would be a second source of truth
 * for the same value.
 *
 * There is no locale in the URL. Cerno is behind a login and the language is a
 * per-account preference, so routing on it would mean every link carrying a
 * prefix that is already known from the session.
 */

const LanguageContext = createContext<AppLanguage | null>(null);

/** Overrides the stored language, for screens shown before it is chosen. */
export function LanguageOverride({
  language,
  children,
}: {
  language: AppLanguage;
  children: React.ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): AppLanguage {
  const override = useContext(LanguageContext);
  const stored = useAppStore((s) => s.settings.language);
  return override ?? stored;
}

/** BCP-47 locale for the active language — for `Intl`-based date formatting. */
export function useLocale(): DateLocale {
  return localeFor(useLanguage());
}

/**
 * "{n} task(s)" in the active language, with correct plural agreement.
 *
 * `Intl.PluralRules` picks the grammatical category for the locale — English
 * only distinguishes one/other, Ukrainian needs one/few/many — and the matching
 * word comes from the dictionary. Not a hook, so it can be called inside loops
 * and callbacks; the caller passes the locale and dictionary it already has.
 */
export function taskCount(n: number, locale: DateLocale, t: Dictionary): string {
  const category = new Intl.PluralRules(locale).select(n);
  const word =
    category === "one"
      ? t.common.taskOne
      : category === "few"
        ? t.common.taskFew
        : t.common.taskMany;
  return `${n} ${word}`;
}

/**
 * The dictionary for the active language.
 *
 * Returns the whole thing rather than a `t("a.b.c")` function: dotted string
 * keys can't be checked by the compiler, so a typo renders the key itself in
 * production. `t.nav.today` is a property access — a typo is a build failure.
 */
export function useT(): Dictionary {
  const language = useLanguage();
  return useMemo(() => DICTIONARIES[language] ?? en, [language]);
}
