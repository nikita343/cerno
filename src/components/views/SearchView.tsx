"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { ClockIcon, SearchIcon } from "@/components/icons";
import { TaskChip } from "@/components/task/TaskChip";
import { relativeDayTitle, relativeDaySub } from "@/lib/date";
import { DASHBOARD_ROOT, NAV_ITEMS } from "@/lib/nav";
import { pluralize } from "@/lib/format";
import type { Task } from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SearchView.module.css";
import view from "./View.module.css";

const JUMP_TARGETS = NAV_ITEMS.filter((n) =>
  ["today", "upcoming", "inbox"].includes(n.key),
);

export function SearchView({ initialQuery }: { initialQuery?: string | null }) {
  const router = useRouter();
  const today = useAppStore((s) => s.today);
  const query = useAppStore((s) => s.searchQuery);
  const setQuery = useAppStore((s) => s.setSearchQuery);
  const tasks = useAppStore((s) => s.tasks);
  const inputRef = useRef<HTMLInputElement>(null);

  // Seeds the store from ?tag=. The sidebar also sets the query directly on
  // click, but that only covers in-app navigation — a hard refresh or a shared
  // link arrives with nothing in the store, and without this the tag is lost.
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery, setQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo<Task[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.reasoning ?? "",
        ...task.tags,
        task.priority,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, tasks]);

  /** Results are grouped by the day they sit on, like the Upcoming agenda. */
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of results) {
      const key = task.plan_date ?? "unplanned";
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [results]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) setQuery("");
      else router.push(DASHBOARD_ROOT);
    }
  };

  return (
    <div className={view.view}>
      <div className={styles.field}>
        <SearchIcon size="1.1875rem" className={styles.fieldIcon} />
        <label htmlFor="search" className="srOnly">
          Search tasks
        </label>
        <input
          id="search"
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks, labels, reasoning…"
          autoComplete="off"
          spellCheck={false}
          type="search"
        />
        <kbd className={styles.esc}>esc</kbd>
      </div>

      {query.trim() !== "" && (
        <>
          {grouped.length > 0 ? (
            grouped.map(([date, dayTasks]) => (
              <section key={date} className={view.section}>
                <h2 className={view.sectionLabelSmall}>
                  {date === "unplanned"
                    ? "Task results · Unplanned"
                    : `Task results · ${relativeDayTitle(date, today)} · ${relativeDaySub(date, today)}`}
                </h2>
                <div className={view.listTight}>
                  {dayTasks.map((task) => (
                    <TaskChip key={task.id} task={task} today={today} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className={view.emptyDashed}>
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}
        </>
      )}

      {query.trim() === "" && (
        <section className={view.section}>
          <h2 className={view.sectionLabelSmall}>Recently viewed</h2>
          <div className={styles.recentList}>
            <RecentRow
              title="Today's plan"
              meta={`${tasks.filter((t) => t.plan_date === today && t.status === "today").length} ${pluralize(
                tasks.filter((t) => t.plan_date === today && t.status === "today").length,
                "task",
              )}`}
              href={DASHBOARD_ROOT}
            />
            <RecentRow
              title="Inbox"
              meta={`${tasks.filter((t) => t.status !== "done").length} open`}
              href={`${DASHBOARD_ROOT}/inbox`}
            />
            <RecentRow
              title="Upcoming"
              meta="this week"
              href={`${DASHBOARD_ROOT}/upcoming`}
            />
          </div>
        </section>
      )}

      <section className={view.section}>
        <h2 className={view.sectionLabelSmall}>Jump to</h2>
        <div className={styles.jumpRow}>
          {JUMP_TARGETS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={styles.jumpPill}
              onClick={() => router.push(item.href)}
            >
              <span>{item.label}</span>
              <span className={styles.jumpHint} aria-hidden="true">
                ↵
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecentRow({
  title,
  meta,
  href,
}: {
  title: string;
  meta: string;
  href: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.recentRow}
      onClick={() => router.push(href)}
    >
      <ClockIcon size="1rem" className={styles.recentIcon} />
      <span className={styles.recentTitle}>{title}</span>
      <span className={styles.recentMeta}>{meta}</span>
    </button>
  );
}
