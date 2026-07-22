"use client";

import { useMemo, useState } from "react";

import { ClockIcon, FlagIcon, TagIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { TaskChip } from "@/components/task/TaskChip";
import type { Tag, Task } from "@/lib/types";
import { PRIORITY_RANK } from "@/store/createAppStore";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import { LabelEditor } from "./LabelEditor";
import styles from "./FiltersView.module.css";
import view from "./View.module.css";

type FilterKey = "priority" | "deadline" | "tag";

const FILTER_ICONS: Record<FilterKey, typeof FlagIcon> = {
  priority: FlagIcon,
  deadline: ClockIcon,
  tag: TagIcon,
};

export function FiltersView() {
  const t = useT();
  const FILTERS: Array<{ key: FilterKey; name: string; note: string; Icon: typeof FlagIcon }> = [
    { key: "priority", name: t.filters.priorityName, note: t.filters.priorityNote, Icon: FILTER_ICONS.priority },
    { key: "deadline", name: t.filters.deadlineName, note: t.filters.deadlineNote, Icon: FILTER_ICONS.deadline },
    { key: "tag", name: t.filters.tagName, note: t.filters.tagNote, Icon: FILTER_ICONS.tag },
  ];
  const today = useAppStore((s) => s.today);
  const allTasks = useAppStore((s) => s.tasks);
  const labels = useAppStoreShallow((s) => s.labels);

  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [activeTag, setActiveTag] = useState<Tag | null>(null);

  const open = useMemo(
    () => allTasks.filter((t) => t.status !== "done"),
    [allTasks],
  );

  /** Counts shown on the right of each filter card. */
  const counts = useMemo(
    () => ({
      priority: open.filter((t) => t.priority === "high").length,
      deadline: open.filter((t) => t.deadline).length,
      tag: new Set(open.flatMap((t) => t.tags)).size,
    }),
    [open],
  );

  const labelCounts = useMemo(() => {
    const map: Record<string, number> = Object.fromEntries(
      labels.map((l) => [l.name, 0]),
    );
    for (const task of open) {
      // A task can carry a tag whose label was deleted between the last read
      // and now; counting it would create a key with no pill to render it.
      for (const tag of task.tags) {
        if (tag in map) map[tag] += 1;
      }
    }
    return map;
  }, [open, labels]);

  const results = useMemo<Task[]>(() => {
    if (activeTag) return open.filter((t) => t.tags.includes(activeTag));
    if (activeFilter === "priority") {
      return [...open].sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      );
    }
    if (activeFilter === "deadline") {
      return open
        .filter((t) => t.deadline)
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
    }
    if (activeFilter === "tag") {
      return [...open].sort((a, b) =>
        (a.tags[0] ?? "").localeCompare(b.tags[0] ?? ""),
      );
    }
    return [];
  }, [activeFilter, activeTag, open]);

  const toggleFilter = (key: FilterKey) => {
    setActiveTag(null);
    setActiveFilter((current) => (current === key ? null : key));
  };

  const toggleTag = (tag: Tag) => {
    setActiveFilter(null);
    setActiveTag((current) => (current === tag ? null : tag));
  };

  const resultLabel = activeTag
    ? `${activeTag} · ${results.length}`
    : FILTERS.find((f) => f.key === activeFilter)?.name;

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      <h1 className={view.h1}>{t.filters.title}</h1>

      <section className={view.section}>
        <h2 className={view.sectionLabelMuted}>{t.filters.myFilters}</h2>
        <div className={view.list}>
          {FILTERS.map(({ key, name, note, Icon }) => (
            <button
              key={key}
              type="button"
              className={styles.filterCard}
              data-active={activeFilter === key || undefined}
              onClick={() => toggleFilter(key)}
              aria-pressed={activeFilter === key}
            >
              <span className={styles.filterIcon}>
                <Icon size="1.125rem" />
              </span>
              <span className={styles.filterText}>
                <span className={styles.filterName}>{name}</span>
                <span className={styles.filterNote}>{note}</span>
              </span>
              <span className={styles.filterCount}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={view.section}>
        <div className={view.sectionHead}>
          <h2 className={view.sectionLabelMuted}>{t.filters.labels}</h2>
          <span className={view.sectionNote}>
            {t.filters.labelsHelper}
          </span>
        </div>
        <div className={styles.labelPills}>
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              className={styles.labelPill}
              data-active={activeTag === label.name || undefined}
              onClick={() => toggleTag(label.name)}
              aria-pressed={activeTag === label.name}
            >
              <span
                className={styles.labelDot}
                style={{ background: label.color }}
              />
              <span className={styles.labelName}>{label.name}</span>
              <span className={styles.labelCount}>
                {labelCounts[label.name] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={view.section}>
        <div className={view.sectionHead}>
          <h2 className={view.sectionLabelMuted}>Edit labels</h2>
          <span className={view.sectionNote}>
            Renaming updates every task using it
          </span>
        </div>
        <LabelEditor />
      </section>

      {(activeFilter || activeTag) && (
        <section className={view.section}>
          <h2 className={view.sectionLabelSmall}>{resultLabel}</h2>
          {results.length > 0 ? (
            <div className={view.listTight}>
              {results.map((task) => (
                <TaskChip key={task.id} task={task} today={today} />
              ))}
            </div>
          ) : (
            <p className={view.emptyDashed}>Nothing matches this filter.</p>
          )}
        </section>
      )}
    </div>
  );
}
