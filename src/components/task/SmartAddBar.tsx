"use client";

import { useState } from "react";

import { PlusIcon, SparkIcon } from "@/components/icons";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SmartAddBar.module.css";

/**
 * Quick add for a single task.
 *
 * Distinct from the brain dump: this never replans the day. You type one
 * phrase, Cerno infers the title, effort, tag and deadline, and the task lands
 * on today untouched. Use the dump when you want the day rebuilt; use this when
 * you just remembered one thing.
 */
export function SmartAddBar({
  placeholder = "Add one thing — Cerno fills in the rest",
  /**
   * Adds into a workspace's shared list instead of your own.
   *
   * Passed rather than read from the route, so the same bar is unambiguous
   * wherever it appears: the workspace page always adds to that workspace,
   * Today always adds to you.
   */
  workspaceId = null,
}: {
  placeholder?: string;
  workspaceId?: string | null;
}) {
  const [text, setText] = useState("");
  const addTaskSmart = useAppStore((s) => s.addTaskSmart);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    // Clear immediately — the field should feel instant even while the parse
    // is in flight, and the task appears in the list when it resolves.
    setText("");
    try {
      await addTaskSmart(trimmed, undefined, workspaceId);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className={styles.bar}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        <SparkIcon size="1.0625rem" />
      </span>
      <label htmlFor="smart-add" className="srOnly">
        Add a task
      </label>
      <input
        id="smart-add"
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={pending}
      />
      <button
        type="submit"
        className={styles.submit}
        disabled={!text.trim() || pending}
        aria-label="Add task"
      >
        {pending ? (
          <span className={styles.dots} aria-hidden="true">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
        ) : (
          <PlusIcon size="1rem" />
        )}
      </button>
    </form>
  );
}
