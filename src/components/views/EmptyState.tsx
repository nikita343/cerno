"use client";

import type { ReactNode } from "react";

import { SparkIcon } from "@/components/icons";

import styles from "./EmptyState.module.css";

/**
 * The centred empty state from section 08 of the design canvas:
 * icon tile → headline → helper line, with an optional action.
 */
export function EmptyState({
  title = "Nothing to plan yet",
  helper,
  action,
  icon,
}: {
  title?: string;
  helper?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.tile}>{icon ?? <SparkIcon size="1.25rem" />}</div>
      <p className={styles.title}>{title}</p>
      {helper && <p className={styles.helper}>{helper}</p>}
      {action}
    </div>
  );
}
