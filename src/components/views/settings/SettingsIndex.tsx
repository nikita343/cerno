"use client";

import Link from "next/link";

import { ChevronRight } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { SETTINGS_SECTIONS, settingsHref } from "@/lib/settingsNav";

import { SettingsView } from "../SettingsView";
import styles from "./SettingsNav.module.css";
import view from "../View.module.css";

/**
 * What `/dashboard/settings` shows.
 *
 * Two different things by design, because the nav is in two different places.
 * On a desktop the section list already sits beside the content in the layout,
 * so an index that repeated it would be a menu pointing at a menu — the first
 * section is shown instead. On a phone there is no room for a persistent nav,
 * so the index *is* the menu, the way a phone settings app works.
 *
 * Done with CSS rather than a media query hook: both are rendered and one is
 * hidden, so there is no flash of the wrong one while JavaScript works out how
 * wide the screen is.
 */
export function SettingsIndex() {
  const t = useT();

  return (
    <>
      <nav className={styles.indexList} aria-label="Settings sections">
        <h1 className={`${view.h1} ${styles.indexTitle}`}>{t.settings.title}</h1>
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.slug}
            href={settingsHref(section.slug)}
            className={styles.indexRow}
          >
            <span className={styles.indexText}>
              <span className={styles.indexLabel}>
                {sectionLabel(t, section.slug)}
              </span>
              <span className={styles.indexNote}>
                {sectionNote(t, section.slug)}
              </span>
            </span>
            <ChevronRight size="1rem" className={styles.indexChevron} />
          </Link>
        ))}
      </nav>

      <div className={styles.indexFallback}>
        <SettingsView section="profile" />
      </div>
    </>
  );
}

function sectionLabel(t: ReturnType<typeof useT>, slug: string): string {
  switch (slug) {
    case "profile": return t.settings.profile;
    case "plan": return t.settings.plan;
    case "reminders": return t.settings.reminders;
    case "language": return t.settings.language;
    case "calendar": return t.settings.calendar;
    case "telegram": return t.settings.telegram;
    case "model": return t.settings.model;
    default: return slug;
  }
}

function sectionNote(t: ReturnType<typeof useT>, slug: string): string {
  switch (slug) {
    case "profile": return t.settings.profileNote;
    case "plan": return t.settings.planNote;
    case "reminders": return t.settings.remindersNote;
    case "language": return t.settings.languageNote;
    case "calendar": return t.settings.calendarNote;
    case "telegram": return t.settings.telegramNote;
    case "model": return t.settings.modelNote;
    default: return "";
  }
}
