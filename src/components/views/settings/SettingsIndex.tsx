"use client";

import Link from "next/link";

import { ChevronRight } from "@/components/icons";
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
  return (
    <>
      <nav className={styles.indexList} aria-label="Settings sections">
        <h1 className={`${view.h1} ${styles.indexTitle}`}>Settings</h1>
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.slug}
            href={settingsHref(section.slug)}
            className={styles.indexRow}
          >
            <span className={styles.indexText}>
              <span className={styles.indexLabel}>{section.label}</span>
              <span className={styles.indexNote}>{section.note}</span>
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
