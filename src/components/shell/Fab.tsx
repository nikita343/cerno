"use client";

import { EditIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./Fab.module.css";

/** Mobile-only entry point to Capture. Desktop uses the sidebar button. */
export function Fab() {
  const openCapture = useAppStore((s) => s.openCapture);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const t = useT();

  // The designs hide the FAB whenever the settings menu is up.
  if (menuOpen) return null;

  return (
    <button
      type="button"
      className={styles.fab}
      onClick={openCapture}
      aria-label={t.today.whatsOnYourMind}
    >
      <EditIcon size="1.5rem" />
    </button>
  );
}
