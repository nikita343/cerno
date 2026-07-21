import styles from "./Skeleton.module.css";

/**
 * The loading shape of a task screen.
 *
 * Rendered by `dashboard/loading.tsx`, which Next mounts inside the already-
 * painted shell — the sidebar, tab bar and header stay put, and only the column
 * swaps. That is the whole reason this exists: without a loading boundary the
 * router waits for the new segment before painting anything, so a tap on
 * "Upcoming" does nothing visible until the round trip returns.
 *
 * Not announced to screen readers as a list of anything: it is decoration
 * standing in for content that hasn't arrived. The status message carries the
 * meaning instead.
 */
export function ViewSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.view}>
      <span className="srOnly" role="status">
        Loading…
      </span>

      <div className={styles.head} aria-hidden="true">
        <div className={`${styles.bar} ${styles.eyebrow}`} />
        <div className={`${styles.bar} ${styles.title}`} />
        <div className={`${styles.bar} ${styles.subline}`} />
      </div>

      <div className={`${styles.bar} ${styles.addBar}`} aria-hidden="true" />

      <div className={styles.rows} aria-hidden="true">
        <div className={`${styles.bar} ${styles.label}`} />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${styles.bar} ${styles.row}`} />
        ))}
      </div>
    </div>
  );
}
