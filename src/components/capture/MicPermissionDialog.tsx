"use client";

import { useEffect } from "react";

import { MicIcon } from "@/components/icons";
import type { MicStatus } from "@/lib/speech";

import styles from "./MicPermissionDialog.module.css";

/**
 * Shown when dictation can't start. A browser will not re-prompt once the user
 * has blocked the microphone, so the only useful thing to do is explain where
 * the setting lives — the copy is per-reason rather than one generic error.
 */
const COPY: Record<
  Exclude<MicStatus, "granted">,
  { title: string; body: string }
> = {
  denied: {
    title: "Microphone is blocked",
    body: "Your browser is blocking the mic for this site. Open the padlock in the address bar, allow microphone access, then try again. You can keep typing in the meantime.",
  },
  "no-device": {
    title: "No microphone found",
    body: "Nothing is plugged in that Cerno can record from. Connect a mic and try again — typing works either way.",
  },
  unavailable: {
    title: "Microphone unavailable",
    body: "Recording needs a secure (https) connection and a browser that supports it. Typing works everywhere.",
  },
};

export function MicPermissionDialog({
  status,
  onClose,
}: {
  status: Exclude<MicStatus, "granted">;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Stop the capture overlay's own Escape handler from also firing and
        // closing the dump behind this dialog.
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const { title, body } = COPY[status];

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mic-dialog-title"
        aria-describedby="mic-dialog-body"
      >
        <span className={styles.icon} aria-hidden="true">
          <MicIcon size="1.25rem" />
        </span>
        <h2 id="mic-dialog-title" className={styles.title}>
          {title}
        </h2>
        <p id="mic-dialog-body" className={styles.body}>
          {body}
        </p>
        <button type="button" className={styles.action} onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}
