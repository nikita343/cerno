"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/auth/Avatar";
import { useUser } from "@/components/auth/UserProvider";
import { CalendarIcon, UploadIcon } from "@/components/icons";
import { AVATAR_MAX_BYTES } from "@/lib/supabase/data";
import {
  browserTimezone,
  timezoneGroups,
  type ZoneGroup,
} from "@/lib/timezones";
import {
  DEFAULT_MODEL_CHOICE,
  isEntitled,
  isPaidModel,
  LANGUAGES,
  MODEL_CHOICES,
  type AppLanguage,
  type ModelChoice,
} from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/store/StoreProvider";
import { useRouter } from "next/navigation";

import { BillingCard } from "./BillingCard";
import type { SettingsSlug } from "@/lib/settingsNav";

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

/**
 * One section of Settings, chosen by route.
 *
 * This was a single scrolling page holding six unrelated preferences, so
 * changing a timezone meant scrolling past an avatar and a billing plan. Each
 * section now has its own URL — see `lib/settingsNav.ts`.
 *
 * Deliberately still one component rather than six files. The sections share
 * `settings` and `updateSettings`, and the two that carry real local state
 * (the profile form, the timezone list) are extracted below. Splitting the
 * rest into files would duplicate the same three store selectors six times to
 * no benefit.
 */
export function SettingsView({ section }: { section: SettingsSlug }) {
  const syncError = useAppStore((s) => s.syncError);

  return (
    <div className={`${view.view} ${view.viewWide}`}>
      {syncError && <p className={styles.error}>{syncError}</p>}
      {section === "profile" && <ProfileSection />}
      {section === "reminders" && <RemindersSection />}
      {section === "language" && <LanguageSection />}
      {section === "plan" && <PlanSection />}
      {section === "calendar" && <CalendarSection />}
      {section === "telegram" && <TelegramSection />}
      {section === "model" && <ModelSection />}
    </div>
  );
}

function ProfileSection() {
  const t = useT();
  const user = useUser();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const uploadAvatarFile = useAppStore((s) => s.uploadAvatarFile);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [name, setName] = useState(settings.display_name ?? user.name);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    // Checked here as well as by the bucket's own limit, so the user gets an
    // instant answer instead of waiting out an upload that will be rejected.
    if (file.size > AVATAR_MAX_BYTES) {
      setUploadError(t.settings.uploadTooBig);
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
    <>
      <section className={view.section}>

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
              {uploading ? t.settings.uploading : t.settings.change}
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
            <span className={styles.fieldLabel}>{t.settings.displayName}</span>
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
    </>
  );
}

function RemindersSection() {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  return (
    <>
      <section className={view.section}>

        <div className={styles.card}>
          <ToggleRow
            label={t.settings.remindersLabel}
            description={t.settings.remindersToggle}
            checked={settings.reminders_enabled}
            onChange={(reminders_enabled) =>
              void updateSettings({ reminders_enabled })
            }
          />

          <div className={styles.field} data-disabled={!settings.reminders_enabled || undefined}>
            <span className={styles.fieldLabel}>{t.settings.warnAhead}</span>
            <div className={styles.segmented} role="group" aria-label={t.settings.reminderLeadTime}>
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
                  {hours}{t.settings.hours}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function LanguageSection() {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

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
   * for each.
   */
  const [zoneGroups, setZoneGroups] = useState<ZoneGroup[]>([]);

  useEffect(() => {
    setZoneGroups(timezoneGroups(settings.timezone));
  }, [settings.timezone]);

  return (
    <>
      <section className={view.section}>

        <div className={styles.card}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t.settings.languageLabel}</span>
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
            <span className={styles.fieldLabel}>{t.settings.timezone}</span>
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
            <span className={styles.fieldNote}>{t.settings.timezoneNote}</span>
          </label>
        </div>
      </section>
    </>
  );
}

function PlanSection() {
  return (
    <>
      <section className={view.section}>
        <BillingCard />
      </section>
    </>
  );
}

function CalendarSection() {
  return (
    <>
      <section className={view.section}>
        <div className={styles.card}>
          <CalendarFeed />
        </div>
      </section>
    </>
  );
}

function ModelSection() {
  const t = useT();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const subscription = useAppStore((s) => s.subscription);
  const entitled = isEntitled(subscription);

  // What actually runs. A stored paid model on a free plan is downgraded to the
  // default server-side, so the picker highlights the default rather than a
  // locked row — showing the truth about which model plans the day.
  const effectiveModel =
    !entitled && isPaidModel(settings.model)
      ? DEFAULT_MODEL_CHOICE
      : settings.model;

  return (
    <>
      <section className={view.section}>

        <div className={styles.card}>
          <div className={styles.modelList}>
            {MODEL_CHOICES.map((choice, i) => {
              // Opus and GPT-5 are Team-only. For a free user they don't select
              // — they route to the upgrade page. The server enforces this too
              // (see loadModelChoice); the lock is just so the picker doesn't
              // offer something that would silently fall back to the default.
              const locked = choice.paid && !entitled;
              const active = !locked && effectiveModel === choice.value;
              return (
              <Fragment key={choice.value}>
              {/* Vendor heading before the first model of each group — two
                  providers in one flat list reads as five interchangeable
                  options, which they are not. */}
              {(i === 0 || MODEL_CHOICES[i - 1].vendor !== choice.vendor) && (
                <span className={styles.modelVendor}>{choice.vendor}</span>
              )}
              <button
                type="button"
                className={styles.modelRow}
                data-active={active || undefined}
                data-locked={locked || undefined}
                onClick={() =>
                  locked
                    ? router.push("/dashboard/settings/plan")
                    : void updateSettings({ model: choice.value as ModelChoice })
                }
                aria-pressed={active}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.modelText}>
                  <span className={styles.modelName}>
                    {choice.label}
                    {locked && (
                      <span className={styles.modelTeamTag}>
                        {t.settings.teamOnly}
                      </span>
                    )}
                  </span>
                  <span className={styles.modelNote}>
                    {locked ? t.settings.upgradeToUnlock : choice.note}
                  </span>
                </span>
              </button>
              </Fragment>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function TelegramSection() {
  const t = useT();
  const linked = useAppStore((s) => s.settings.telegram_linked);
  const refreshTelegramLinked = useAppStore((s) => s.refreshTelegramLinked);
  const disconnectTelegram = useAppStore((s) => s.disconnectTelegram);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once we've opened Telegram, so the card can prompt "come back and
  // confirm" — linking finishes over there, out of the app's sight.
  const [awaiting, setAwaiting] = useState(false);

  // Catch the moment they return from Telegram: re-read the link status when the
  // tab regains focus, so a successful connect reflects without a manual reload.
  useEffect(() => {
    if (!awaiting) return;
    const check = () => void refreshTelegramLinked();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [awaiting, refreshTelegramLinked]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        throw new Error(body.error ?? t.settings.couldntLink);
      }
      setAwaiting(true);
      window.open(body.url, "_blank", "noopener");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.settings.couldntLink);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={view.section}>
      <div className={styles.card}>
        {linked ? (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t.settings.telegramConnected}</span>
            <span className={styles.fieldNote}>
              {t.settings.telegramConnectedDesc}
            </span>
            <button
              type="button"
              className={styles.feedAction}
              onClick={() => void disconnectTelegram()}
            >
              {t.settings.disconnect}
            </button>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.fieldNote}>
              {t.settings.connectTelegramDesc}
            </span>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => void connect()}
              disabled={busy}
            >
              {busy ? t.settings.openingTelegram : t.settings.connectTelegram}
            </button>

            {awaiting && (
              <span className={styles.fieldNote}>
                {t.settings.tapStart}{" "}
                <button
                  type="button"
                  className={styles.feedAction}
                  onClick={() => void refreshTelegramLinked()}
                >
                  {t.settings.checkNow}
                </button>
              </span>
            )}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function CalendarFeed() {
  const t = useT();
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
          {t.settings.createFeedDesc}
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
          {t.settings.createFeed}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{t.settings.feedUrl}</span>

      <div className={styles.feedRow}>
        <input
          className={styles.input}
          value={revealed ? url : url.replace(/\/[^/]+$/, "/••••••••")}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t.settings.calendarFeedUrl}
        />
        <button
          type="button"
          className={styles.feedAction}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? t.settings.hide : t.settings.show}
        </button>
        <button type="button" className={styles.feedAction} onClick={copy}>
          {copied ? t.settings.copied : t.settings.copy}
        </button>
      </div>

      <span className={styles.fieldNote}>
        <strong>{t.settings.feedWarning}</strong> {t.settings.feedWarningRest}
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
          {t.settings.regenerate}
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
          {t.settings.turnOff}
        </button>
      </div>
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
