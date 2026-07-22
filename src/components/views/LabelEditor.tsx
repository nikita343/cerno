"use client";

import { useState } from "react";

import { CheckIcon, CloseIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { validateLabelName } from "@/lib/labels";
import { LABEL_PALETTE, type Label } from "@/lib/types";
import { useAppStore, useAppStoreShallow } from "@/store/StoreProvider";

import styles from "./LabelEditor.module.css";

/**
 * Create, rename, recolour, and delete labels.
 *
 * Deleting a label also strips it from every task carrying it — that happens in
 * one database transaction (see `delete_label` in the migration), but it is
 * still a change the user can't undo, so it asks first and says how many tasks
 * are affected.
 */
export function LabelEditor() {
  const t = useT();
  const labels = useAppStoreShallow((s) => s.labels);
  const tasks = useAppStoreShallow((s) => s.tasks);
  const addLabel = useAppStore((s) => s.addLabel);

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(LABEL_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const problem = validateLabelName(draftName, labels);
    if (problem) {
      setError(problem);
      return;
    }
    void addLabel(draftName, draftColor);
    setDraftName("");
    // Cycle the swatch so consecutive labels don't all come out the same
    // colour, which is the most likely outcome of a fixed default.
    setDraftColor(LABEL_PALETTE[(labels.length + 1) % LABEL_PALETTE.length]);
    setError(null);
    setAdding(false);
  };

  const cancel = () => {
    setAdding(false);
    setDraftName("");
    setError(null);
  };

  return (
    <div className={styles.editor}>
      <ul className={styles.list}>
        {labels.map((label) => (
          <LabelRow
            key={label.id}
            label={label}
            usage={tasks.filter((t) => t.tags.includes(label.name)).length}
            siblings={labels}
          />
        ))}
      </ul>

      {adding ? (
        <div className={styles.draft}>
          <div className={styles.swatches} role="group" aria-label={t.labelEditor.labelColour}>
            {LABEL_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={styles.swatch}
                style={{ background: color }}
                data-active={draftColor === color || undefined}
                onClick={() => setDraftColor(color)}
                aria-label={`Colour ${color}`}
                aria-pressed={draftColor === color}
              />
            ))}
          </div>

          <div className={styles.draftRow}>
            <input
              className={styles.draftInput}
              value={draftName}
              onChange={(e) => {
                setDraftName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") cancel();
              }}
              placeholder={t.labelEditor.labelName}
              maxLength={24}
              autoFocus
            />
            <button
              type="button"
              className={styles.iconButton}
              onClick={submit}
              aria-label={t.labelEditor.saveLabel}
            >
              <CheckIcon size="1rem" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={cancel}
              aria-label={t.labelEditor.cancel}
            >
              <CloseIcon size="1rem" />
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      ) : (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => setAdding(true)}
        >
          <PlusIcon size="1rem" />
          New label
        </button>
      )}
    </div>
  );
}

function LabelRow({
  label,
  usage,
  siblings,
}: {
  label: Label;
  usage: number;
  siblings: Label[];
}) {
  const renameLabel = useAppStore((s) => s.renameLabel);
  const recolorLabel = useAppStore((s) => s.recolorLabel);
  const removeLabel = useAppStore((s) => s.removeLabel);

  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = () => {
    const trimmed = name.trim();
    if (trimmed === label.name) {
      setEditing(false);
      return;
    }
    const problem = validateLabelName(trimmed, siblings, label.id);
    if (problem) {
      setError(problem);
      return;
    }
    void renameLabel(label.id, trimmed);
    setEditing(false);
    setError(null);
  };

  const cancel = () => {
    setName(label.name);
    setEditing(false);
    setError(null);
  };

  if (confirming) {
    return (
      <li className={styles.row} data-confirming>
        <span className={styles.confirmText}>
          Delete &ldquo;{label.name}&rdquo;?
          {usage > 0 && (
            <span className={styles.confirmNote}>
              {" "}
              It will be removed from {usage} {usage === 1 ? "task" : "tasks"}.
            </span>
          )}
        </span>
        <button
          type="button"
          className={styles.danger}
          onClick={() => void removeLabel(label.id)}
        >
          Delete
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className={styles.row}>
      {/* A native colour input: the OS picker is better than anything worth
          building here, and it's one tap on mobile. */}
      <label className={styles.dotWrap}>
        <span className={styles.dot} style={{ background: label.color }} />
        <input
          type="color"
          className={styles.colorInput}
          value={label.color}
          onChange={(e) => void recolorLabel(label.id, e.target.value)}
          aria-label={`Colour for ${label.name}`}
        />
      </label>

      {editing ? (
        <input
          className={styles.rowInput}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          onBlur={save}
          maxLength={24}
          autoFocus
        />
      ) : (
        <span className={styles.name}>{label.name}</span>
      )}

      <span className={styles.count}>{usage}</span>

      <span className={styles.actions}>
        {!editing && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setEditing(true)}
            aria-label={`Rename ${label.name}`}
          >
            <EditIcon size="0.9375rem" />
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${label.name}`}
        >
          <TrashIcon size="0.9375rem" />
        </button>
      </span>

      {error && <p className={styles.rowError}>{error}</p>}
    </li>
  );
}
