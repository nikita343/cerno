"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronLeft } from "@/components/icons";
import {
  SETTINGS_ROOT,
  SETTINGS_SECTIONS,
  sectionFromPath,
  settingsHref,
} from "@/lib/settingsNav";

import styles from "./SettingsNav.module.css";

/**
 * Settings chrome: a persistent section list on desktop, a back link on phones.
 *
 * The two are exclusive by width. A phone gets the index as its menu (see
 * SettingsIndex) and each section as a full screen with a way back — the
 * pattern every phone settings app uses, and the only one that fits. A desktop
 * keeps the list beside the content, because there is room and because
 * scanning six labels beats navigating back and forth.
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = sectionFromPath(pathname);

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Settings">
        <span className={styles.navHeading}>Settings</span>
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.slug}
            href={settingsHref(section.slug)}
            className={styles.navRow}
            data-active={active?.slug === section.slug || undefined}
            aria-current={active?.slug === section.slug ? "page" : undefined}
          >
            {section.label}
          </Link>
        ))}
      </nav>

      <div className={styles.content}>
        {/* Only on a section, and only on a phone: on the index there is
            nowhere to go back to within Settings, and on desktop the list is
            already on screen. */}
        {active && (
          <Link href={SETTINGS_ROOT} className={styles.back}>
            <ChevronLeft size="0.875rem" />
            Settings
          </Link>
        )}
        {active && (
          <header className={styles.sectionHead}>
            <h1 className={styles.sectionTitle}>{active.label}</h1>
            {active.hint && <p className={styles.sectionHint}>{active.hint}</p>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
