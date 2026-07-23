"use client";

import { useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/auth/Avatar";
import { PlusIcon, SparkIcon } from "@/components/icons";
import { memberProfile } from "@/lib/user";
import type { WorkspaceMember } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SmartAddBar.module.css";

/** The `@query` the caret is currently sitting inside, if any. */
function activeMention(text: string, caret: number): { query: string; at: number } | null {
  // Look back from the caret to the nearest `@`, and only treat it as a mention
  // if what follows is an unbroken run of name characters — a space ends it, so
  // "email @ me" never opens the picker.
  const upToCaret = text.slice(0, caret);
  const match = /(?:^|\s)@([\p{L}\p{N}._-]*)$/u.exec(upToCaret);
  if (!match) return null;
  return { query: match[1], at: caret - match[1].length - 1 };
}

/**
 * Quick add for a single task.
 *
 * Distinct from the brain dump: this never replans the day. You type one
 * phrase, Cerno infers the title, effort, tag and deadline, and the task lands
 * on today untouched. Use the dump when you want the day rebuilt; use this when
 * you just remembered one thing.
 *
 * Inside a workspace it also understands `@name` to assign the task to a
 * teammate — the mention is stripped from the title, so "@Ada ship the deck"
 * becomes "ship the deck" assigned to Ada.
 */
export function SmartAddBar({
  placeholder,
  /**
   * Adds into a workspace's shared list instead of your own.
   *
   * Passed rather than read from the route, so the same bar is unambiguous
   * wherever it appears: the workspace page always adds to that workspace,
   * Today always adds to you.
   */
  workspaceId = null,
  /**
   * The workspace's members, which turns on `@name` assignment. Empty or
   * omitted (the personal Today/Inbox bars) leaves it a plain add bar.
   */
  members = [],
  /**
   * When true, adds land in the inbox (unscheduled) rather than on today. Set
   * by the Inbox view so "add to inbox" actually means it.
   */
  toInbox = false,
}: {
  placeholder?: string;
  workspaceId?: string | null;
  members?: WorkspaceMember[];
  toInbox?: boolean;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const addTaskSmart = useAppStore((s) => s.addTaskSmart);
  const [pending, setPending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [assignee, setAssignee] = useState<WorkspaceMember | null>(null);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const canAssign = members.length > 0;

  // Members matching the active `@query`, capped so the menu stays a glance.
  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members
      .filter((m) => {
        const p = memberProfile(m);
        return (
          !q ||
          p.name.toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [mention, members]);

  const menuOpen = canAssign && mention !== null && matches.length > 0;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    if (!canAssign) return;
    const found = activeMention(value, e.target.selectionStart ?? value.length);
    setMention(found);
    setHighlight(0);
  };

  const pick = (member: WorkspaceMember) => {
    setAssignee(member);
    // Strip the `@query` from the title — the assignment is shown as a chip, so
    // leaving "@Ada" in the text would double it up and end up in the title.
    if (mention) {
      const caret = mention.at + 1 + mention.query.length;
      setText((t) => t.slice(0, mention.at) + t.slice(caret));
    }
    setMention(null);
    inputRef.current?.focus();
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    const forAssignee = assignee;
    // Clear immediately — the field should feel instant even while the parse
    // is in flight, and the task appears in the list when it resolves.
    setText("");
    setAssignee(null);
    setMention(null);
    try {
      await addTaskSmart(
        trimmed,
        undefined,
        workspaceId,
        forAssignee?.user_id ?? null,
        toInbox,
      );
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!menuOpen) return;
    // While the picker is open the arrow keys and Enter drive it, not the form.
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(matches[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  };

  return (
    <div className={styles.wrap}>
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
          {t.task.addTask}
        </label>

        {assignee && (
          <span className={styles.assignee}>
            <Avatar profile={memberProfile(assignee)} size="1.125rem" />
            <span className={styles.assigneeName}>{memberProfile(assignee).name}</span>
            <button
              type="button"
              className={styles.assigneeClear}
              onClick={() => setAssignee(null)}
              aria-label={t.task.clearAssignee}
            >
              &times;
            </button>
          </span>
        )}

        <input
          id="smart-add"
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t.task.addPlaceholder}
          autoComplete="off"
          disabled={pending}
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={!text.trim() || pending}
          aria-label={t.task.addTask}
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

      {menuOpen && (
        <ul className={styles.mentionMenu} role="listbox" aria-label={t.task.assignTo}>
          {matches.map((member, i) => {
            const p = memberProfile(member);
            return (
              <li key={member.user_id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={styles.mentionItem}
                  data-active={i === highlight || undefined}
                  // Mouse down, not click: click fires after the input's blur,
                  // which would close the menu before the selection lands.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(member);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <Avatar profile={p} size="1.5rem" />
                  <span className={styles.mentionText}>
                    <span className={styles.mentionName}>{p.name}</span>
                    {member.email && (
                      <span className={styles.mentionEmail}>{member.email}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
