"use client";

import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import {
  BellIcon,
  CalendarIcon,
  GlobeIcon,
  SparkIcon,
  UploadIcon,
  UserIcon,
} from "@/components/icons";
import { AVATAR_MAX_BYTES } from "@/lib/supabase/data";
import {
  browserTimezone,
  timezoneGroups,
  type ZoneGroup,
} from "@/lib/timezones";
import {
  LANGUAGES,
  MODEL_CHOICES,
  type AppLanguage,
  type ModelChoice,
} from "@/lib/types";
import { useAppStore } from "@/store/StoreProvider";

import styles from "./SettingsView.module.css";
import view from "./View.module.css";

/**
 * Reminder lead times, in hours.
 *
 * A fixed set rather than a number input: the value only has to be roughly
 * right, and a stepper invites someone to set 47 minutes and then wonder why
 * nothing looks different.
 */
const LEAD_OPTIONS = [1, 2, 4, 8];

export function SettingsView() {
  const user = useUser();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const uploadAvatarFile = useAppStore((s) => s.uploadAvatarFile);
  const syncError = useAppStore((s) => s.syncError);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [name, setName] = useState(settings.display_name ?? user.name);

  // The browser's zone is only a *default* for someone who has never chosen
  // one. Overwriting a saved preference on every mount would make the picker
  // impossible to change from a different machine.
  useEffect(() => {
    if (settings.timezone !== "UTC") return;
    const local = browserTimezone();
    if (local !== "UTC") void updateSettings({ timezone: local });
    // Runs once: this is a one-time migration of an unset value, not a sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Built after mount, never during render.
   *
   * The list is derived from the *browser's* Intl data and the current instant:
   * the server resolves offsets in its own zone (UTC on Vercel) and the client
   * in the viewer's, so computing it in render makes the two disagree and React
   * throws a hydration mismatch. Until the effect runs, the select holds only
   * the stored value — which is what both sides can agree on.
   *
   * Also kept out of render because it walks 400+ zones and formats an offset
   * for each; redoing that on every keystroke in the name field above would be
   * wasteful even if it were correct.
   */
  const [zoneGroups, setZoneGroups] = useState<ZoneGroup[]>([]);

  useEffect(() => {
    setZoneGroups(timezoneGroups(settings.timezone));
  }, [settings.timezone]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    // Checked here as well as by the bucket's own limit, so the user gets an
    // instant answer instead of waiting out an upload that will be rejected.
    if (file.size > AVATAR_MAX_BYTES) {
      setUploadError("That image is over 2 MB. Pick a smaller one.");
      return;
    }

    setUploading(true);
    await uploadAvatarFile(file);
    setUploading(false);
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed === (settings.display_name ?? user.name)) return;
    void updateSettings({ display_name: trimmed || null });
  };

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      <h1 className={view.h1}>Settings</h1>

      {syncError && <p className={styles.error}>{syncError}</p>}

      {/* ------------------------------------------------------------ profile */}

      <section className={view.section}>
        <SectionHead Icon={UserIcon} label="Profile" />

        <div className={styles.card}>
          <div className={styles.avatarRow}>
            <Avatar profile={user} size="3.75rem" />
            <div className={styles.avatarText}>
              <span className={styles.avatarName}>{user.name}</span>
              <span className={styles.avatarEmail}>{user.email}</span>
            </div>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <UploadIcon size="1rem" />
              {uploading ? "Uploading…" : "Change"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.fileInput}
              onChange={(e) => {
                void onPickFile(e.target.files?.[0]);
                // Reset so picking the same file twice still fires onChange.
                e.target.value = "";
              }}
            />
          </div>

          {uploadError && <p className={styles.fieldError}>{uploadError}</p>}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Display name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              // Saved on blur, not per keystroke: one write per edit instead of
              // one per character.
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              maxLength={60}
              placeholder={user.name}
            />
          </label>
        </div>
      </section>

      {/* ---------------------------------------------------------- reminders */}

      <section className={view.section}>
        <SectionHead
          Icon={BellIcon}
          label="Reminders"
          note="Warns you about high-priority work before it starts"
        />

        <div className={styles.card}>
          <ToggleRow
            label="Reminders"
            description="Show overdue and upcoming tasks in the bell."
            checked={settings.reminders_enabled}
            onChange={(reminders_enabled) =>
              void updateSettings({ reminders_enabled })
            }
          />

          <div className={styles.field} data-disabled={!settings.reminders_enabled || undefined}>
            <span className={styles.fieldLabel}>Warn me this far ahead</span>
            <div className={styles.segmented} role="group" aria-label="Reminder lead time">
              {LEAD_OPTIONS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  className={styles.segment}
                  data-active={settings.reminder_lead_hours === hours || undefined}
                  disabled={!settings.reminders_enabled}
                  onClick={() =>
                    void updateSettings({ reminder_lead_hours: hours })
                  }
                  aria-pressed={settings.reminder_lead_hours === hours}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- language */}

      <section className={view.section}>
        <SectionHead
          Icon={GlobeIcon}
          label="Language & region"
          note="Language is saved but not applied yet"
        />

        <div className={styles.card}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Language</span>
            <select
              className={styles.select}
              value={settings.language}
              onChange={(e) =>
                void updateSettings({ language: e.target.value as AppLanguage })
              }
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.native}
                  {lang.native !== lang.label ? ` — ${lang.label}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Timezone</span>
            {/* A native select, deliberately: 400+ options get the OS's own
                scrollable picker with type-ahead, which beats any listbox worth
                building here and is a single tap on mobile. */}
            <select
              className={styles.select}
              value={settings.timezone}
              onChange={(e) => void updateSettings({ timezone: e.target.value })}
            >
              {zoneGroups.length === 0 ? (
                // Pre-hydration: the stored value alone, so the select is never
                // empty and the server and client render the same markup.
                <option value={settings.timezone}>
                  {settings.timezone.replace(/_/g, " ")}
                </option>
              ) : (
                zoneGroups.map((group) => (
                  <optgroup key={group.region} label={group.region}>
                    {group.zones.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label} ({zone.offset})
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
            <span className={styles.fieldNote}>
              Used when Cerno resolves &ldquo;tomorrow&rdquo; and
              &ldquo;Friday&rdquo; in a dump.
            </span>
          </label>
        </div>
      </section>

      {/* -------------------------------------------------------- calendar */}

      <section className={view.section}>
        <SectionHead
          Icon={CalendarIcon}
          label="Calendar feed"
          note="Subscribe from Google, Apple or Outlook"
        />
        <div className={styles.card}>
          <CalendarFeed />
        </div>
      </section>

      {/* ------------------------------------------------------------- model */}

      <section className={view.section}>
        <SectionHead
          Icon={SparkIcon}
          label="Planning model"
          note="Saved but not applied yet"
        />

        <div className={styles.card}>
          <div className={styles.modelList}>
            {MODEL_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={styles.modelRow}
                data-active={settings.model === choice.value || undefined}
                onClick={() =>
                  void updateSettings({ model: choice.value as ModelChoice })
                }
                aria-pressed={settings.model === choice.value}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.modelText}>
                  <span className={styles.modelName}>{choice.label}</span>
                  <span className={styles.modelNote}>{choice.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * The iCal subscribe URL.
 *
 * Treated as a credential throughout: it is hidden until revealed, the copy
 * action is the primary affordance rather than reading it off the screen, and
 * the warning about what the link exposes sits next to the button that hands it
 * out — not buried in docs nobody opens.
 */
function CalendarFeed() {
  const feedToken = useAppStore((s) => s.settings.feed_token);
  const rotateFeedToken = useAppStore((s) => s.rotateFeedToken);

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Built in the browser: the origin is whatever host the user is actually on,
  // so this works on localhost, a preview deploy and the real domain without
  // any configuration.
  const url = feedToken
    ? `${typeof window === "undefined" ? "" : window.location.origin}/api/calendar/${feedToken}`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions).
      // Revealing the URL lets the user select it by hand instead.
      setRevealed(true);
    }
  };

  if (!feedToken) {
    return (
      <div className={styles.field}>
        <span className={styles.fieldNote}>
          Creates a private link your calendar app can subscribe to. Your
          scheduled tasks appear as events, updated automatically.
        </span>
        <button
          type="button"
          className={styles.uploadButton}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await rotateFeedToken(true);
            setBusy(false);
          }}
        >
          <CalendarIcon size="1rem" />
          Create feed link
        </button>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Your private feed URL</span>

      <div className={styles.feedRow}>
        <input
          className={styles.input}
          value={revealed ? url : url.replace(/\/[^/]+$/, "/••••••••")}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Calendar feed URL"
        />
        <button
          type="button"
          className={styles.feedAction}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? "Hide" : "Show"}
        </button>
        <button type="button" className={styles.feedAction} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <span className={styles.fieldNote}>
        <strong>Anyone with this link can read your task titles</strong> without
        signing in. Don&rsquo;t post it anywhere public. If it leaks, regenerate
        it — the old link stops working immediately.
      </span>

      <div className={styles.feedRow}>
        <button
          type="button"
          className={styles.feedAction}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await rotateFeedToken(true);
            setRevealed(false);
            setBusy(false);
          }}
        >
          Regenerate
        </button>
        <button
          type="button"
          className={`${styles.feedAction} ${styles.feedDanger}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await rotateFeedToken(false);
            setBusy(false);
          }}
        >
          Turn off
        </button>
      </div>
    </div>
  );
}

function SectionHead({
  Icon,
  label,
  note,
}: {
  Icon: typeof BellIcon;
  label: string;
  note?: string;
}) {
  return (
    <div className={styles.head}>
      <Icon size="1rem" className={styles.headIcon} />
      <h2 className={view.sectionLabelMuted}>{label}</h2>
      {note && <span className={view.sectionNote}>{note}</span>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleText}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldNote}>{description}</span>
      </span>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.switch} aria-hidden="true">
        <span className={styles.knob} />
      </span>
    </label>
  );
}
