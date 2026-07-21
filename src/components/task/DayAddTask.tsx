"use client";

import { useEffect, useRef, useState } from "react";

import { PlusIcon } from "@/components/icons";
import { relativeDayTitle } from "@/lib/date";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./DayAddTask.module.css";

/**
 * "Add task" under a day in the Upcoming agenda.
 *
 * Collapsed to a single row until clicked — one of these renders per day, and
 * seven permanently-open input fields would drown the agenda they sit in.
 *
 * The phrase still goes through the smart parser (so effort, priority and tag
 * are inferred), but the day is pinned by the caller: adding from Thursday's
 * row means Thursday, whatever the text says.
 */
export function DayAddTask({ date, today }: { date: string; today: string }) {
  const addTaskSmart = useAppStore((s) => s.addTaskSmart);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    // Cleared immediately so the field is ready for the next item; the row
    // stays open because adding several things to one day is the common case.
    setText("");
    try {
      await addTaskSmart(trimmed, date);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const close = () => {
    setOpen(false);
    setText("");
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
      >
        <PlusIcon size="0.9375rem" />
        <span>Add task</span>
      </button>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={`add-${date}`} className="srOnly">
        Add a task on {relativeDayTitle(date, today)}
      </label>
      <input
        id={`add-${date}`}
        ref={inputRef}
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Blur closes it, but only when nothing has been typed — otherwise
        // clicking the submit button would dismiss the row before it fires.
        onBlur={() => {
          if (!text.trim()) close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        placeholder="Add one thing — Cerno fills in the rest"
        autoComplete="off"
        disabled={pending}
      />
      <button
        type="submit"
        className={styles.submit}
        disabled={!text.trim() || pending}
        aria-label="Add task"
      >
        <PlusIcon size="0.9375rem" />
      </button>
    </form>
  );
}
