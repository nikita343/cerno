"use client";

import { useEffect } from "react";

import { MicIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import type { MicStatus } from "@/lib/speech";

import styles from "./MicPermissionDialog.module.css";

export function MicPermissionDialog({
  status,
  onClose,
}: {
  status: Exclude<MicStatus, "granted">;
  onClose: () => void;
}) {
  const t = useT();
  const copy: Record<Exclude<MicStatus, "granted">, { title: string; body: string }> = {
    denied: { title: t.mic.blockedTitle, body: t.mic.blockedBody },
    "no-device": { title: t.mic.notFoundTitle, body: t.mic.notFoundBody },
    unavailable: { title: t.mic.unavailableTitle, body: t.mic.unavailableBody },
  };
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

  const { title, body } = copy[status];

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
          {t.mic.gotIt}
        </button>
      </div>
    </div>
  );
}
