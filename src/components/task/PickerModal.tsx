"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

import styles from "./PickerModal.module.css";

/**
 * Centred modal on a pointer device, bottom sheet on a phone.
 *
 * Extracted because the bulk "Reschedule N" action tried to be an anchored
 * popover and had no styles at all after a refactor — so on a phone it rendered
 * as raw inline content wedged inside a section header, pushing the whole
 * layout apart.
 *
 * Anchored popovers keep failing on this screen for the same reasons the task
 * menu already learned: they have to measure a trigger, flip when they run out
 * of room, and still lose to the FAB. Centring removes all of it.
 *
 * Portalled to <body> so an ancestor `transform` can't capture its
 * `position: fixed`.
 */
export function PickerModal({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const isPhone = useMediaQuery(PHONE_QUERY);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.panel}
        data-sheet={isPhone || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
