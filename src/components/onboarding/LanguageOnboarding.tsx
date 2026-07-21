"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { LanguageOverride } from "@/lib/i18n";
import { DICTIONARIES } from "@/lib/i18n/dictionary";
import { LANGUAGES, type AppLanguage } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./LanguageOnboarding.module.css";

/**
 * Shown once, on first run, before anything else.
 *
 * Deliberately the *only* onboarding step. Every screen between somebody
 * arriving and seeing their day is a chance to leave, and language is the one
 * choice that changes what the rest of the app says — so it is the one worth
 * asking before they read anything.
 *
 * Each option previews itself in its own language and updates the heading live,
 * because the point of the choice is what the app will look like afterwards.
 */
export function LanguageOnboarding() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [choice, setChoice] = useState<AppLanguage>(settings.language);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM target, and rendering this during SSR would flash the
  // dialog for people who have already been through it.
  useEffect(() => setMounted(true), []);

  if (!mounted || dismissed || settings.onboarded) return null;

  const t = DICTIONARIES[choice];

  return createPortal(
    <LanguageOverride language={choice}>
      <div className={styles.scrim} aria-hidden="true" />
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <span className={styles.mark} aria-hidden="true" />
        <h1 id="onboarding-title" className={styles.title}>
          {t.onboarding.title}
        </h1>
        <p className={styles.subtitle}>{t.onboarding.subtitle}</p>

        <div
          className={styles.options}
          role="radiogroup"
          aria-label={t.settings.languageLabel}
        >
          {LANGUAGES.map((language) => (
            <button
              key={language.value}
              type="button"
              role="radio"
              aria-checked={choice === language.value}
              className={styles.option}
              data-active={choice === language.value || undefined}
              onClick={() => setChoice(language.value)}
            >
              {/* The endonym is the label. Someone looking for Ukrainian is
                  looking for "Українська", not for the word "Ukrainian" in a
                  language they may not read. */}
              <span className={styles.native}>{language.native}</span>
              <span className={styles.english}>{language.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.continue}
          onClick={() => {
            // Dismissed locally first so the dialog closes instantly; the write
            // is what stops it coming back, and is allowed to be slower.
            setDismissed(true);
            // Written even when the language is unchanged: that write is what
            // records the choice as *made*.
            void updateSettings({ language: choice, onboarded: true });
          }}
        >
          {t.onboarding.continue}
        </button>
      </div>
    </LanguageOverride>,
    document.body,
  );
}
