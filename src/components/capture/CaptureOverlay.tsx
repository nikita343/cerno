"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CloseIcon, MicIcon } from "@/components/icons";
import { DASHBOARD_ROOT } from "@/lib/nav";
import {
  isRecordingSupported,
  startRecording,
  transcribe,
  VoiceUnavailableError,
  type RecorderHandle,
} from "@/lib/recorder";
import { useLanguage, useT } from "@/lib/i18n";
import { ensureMicAccess, type MicStatus } from "@/lib/speech";
import { usePresence } from "@/lib/usePresence";
import { useAppStore } from "@/store/StoreProvider";

import { MicPermissionDialog } from "./MicPermissionDialog";
import styles from "./CaptureOverlay.module.css";

/** Must match the exit animation duration in CaptureOverlay.module.css. */
const CAPTURE_EXIT_MS = 180;

export function CaptureOverlay() {
  const open = useAppStore((s) => s.captureOpen);
  const mode = useAppStore((s) => s.captureMode);
  const dumpText = useAppStore((s) => s.dumpText);
  const planError = useAppStore((s) => s.planError);
  const setDumpText = useAppStore((s) => s.setDumpText);
  const setCaptureMode = useAppStore((s) => s.setCaptureMode);
  const closeCapture = useAppStore((s) => s.closeCapture);
  const submitDump = useAppStore((s) => s.submitDump);
  const streamingTasks = useAppStore((s) => s.streamingTasks);
  const t = useT();
  const language = useLanguage();
  const router = useRouter();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const dictatedRef = useRef(false);

  // Feature detection has to run on the client, so the mic starts hidden and
  // appears after mount where supported. That keeps SSR markup stable.
  const [speechReady, setSpeechReady] = useState(false);
  useEffect(() => setSpeechReady(isRecordingSupported()), []);

  /** True while audio is uploading and being transcribed. */
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  /** Non-null while a mic problem needs explaining. */
  const [micIssue, setMicIssue] = useState<Exclude<MicStatus, "granted"> | null>(
    null,
  );
  /** True while the permission check is in flight, to debounce double clicks. */
  const [checkingMic, setCheckingMic] = useState(false);

  const isListening = mode === "listening";
  const isThinking = mode === "thinking";

  // While planning, rotate through progress lines so a slow request still
  // feels like it's moving. Resets to the first line each time it starts.
  const [thinkingStep, setThinkingStep] = useState(0);
  useEffect(() => {
    if (!isThinking) {
      setThinkingStep(0);
      return;
    }
    const steps = t.capture.thinkingSteps;
    const id = window.setInterval(() => {
      // Keep cycling for as long as planning runs — a slow request should never
      // look frozen, so the lines loop until the plan lands and the popup closes.
      setThinkingStep((s) => (s + 1) % steps.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [isThinking, t.capture.thinkingSteps]);

  // Keeps the card mounted through its exit animation — see CAPTURE_EXIT_MS.
  const { present, leaving } = usePresence(open, CAPTURE_EXIT_MS);

  /** Discards any in-flight recording and releases the microphone. */
  const stopListening = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
  }, []);

  // Always release the microphone when the overlay goes away.
  useEffect(() => {
    if (!open) stopListening();
    return stopListening;
  }, [open, stopListening]);

  // Focus the field on open, and keep the caret at the end.
  useEffect(() => {
    if (!open || isThinking) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [open, isThinking]);

  // Escape cancels, Cmd/Ctrl+Enter submits.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isThinking) {
        closeCapture();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isThinking) {
        router.push(DASHBOARD_ROOT);
        void submitDump(dictatedRef.current ? "voice" : "text");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isThinking, closeCapture, submitDump, router]);

  /**
   * First click records, second click stops and transcribes.
   *
   * The recording is sent to `/api/transcribe` rather than decoded in the
   * browser: the Web Speech API this replaced only works properly in Chrome,
   * and server transcription behaves identically everywhere.
   *
   * Availability is confirmed *before* switching to the listening state, so the
   * mic never appears to be recording when it isn't — a blocked microphone
   * surfaces as an explanatory dialog instead of silently doing nothing.
   */
  const toggleMic = async () => {
    if (isListening) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setCaptureMode("ready");
      if (!recorder) return;

      setTranscribing(true);
      try {
        const recording = await recorder.stop();
        if (!recording) return;

        const text = await transcribe(recording, language);
        // Appended, not replaced: a second recording should extend the dump
        // rather than wipe what was already typed or said.
        const existing = dumpText.trim();
        setDumpText(existing ? `${existing} ${text}` : text);
        dictatedRef.current = true;
      } catch (error) {
        // Not configured on the server: hide the mic for the rest of the
        // session rather than leaving a button that can never succeed.
        if (error instanceof VoiceUnavailableError) setSpeechReady(false);
        setVoiceError(
          error instanceof Error ? error.message : t.capture.transcribeError,
        );
      } finally {
        setTranscribing(false);
      }
      return;
    }

    if (checkingMic || transcribing) return;
    setVoiceError(null);
    setCheckingMic(true);
    const status = await ensureMicAccess();
    setCheckingMic(false);

    if (status !== "granted") {
      setMicIssue(status);
      return;
    }

    try {
      recorderRef.current = await startRecording();
      setCaptureMode("listening");
    } catch {
      setMicIssue("unavailable");
    }
  };

  const handlePlan = () => {
    stopListening();
    // Jump to Today so the plan visibly lands on the timeline the moment the
    // modal closes; the modal covers the transition while items stream in.
    router.push(DASHBOARD_ROOT);
    void submitDump(dictatedRef.current ? "voice" : "text");
  };

  if (!present) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      data-leaving={leaving || undefined}
    >
      <button
        type="button"
        className={styles.backdropDismiss}
        onClick={isThinking ? undefined : closeCapture}
        aria-label={t.capture.title}
        tabIndex={-1}
      />

      <div
        data-leaving={leaving || undefined}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={t.capture.title}
      >
        <div className={styles.header}>
          <span className={styles.headerDot} />
          <span className={styles.headerTitle}>{t.capture.title}</span>
          <button
            type="button"
            className={styles.close}
            onClick={closeCapture}
            disabled={isThinking}
            aria-label={t.capture.close}
          >
            <CloseIcon size="0.9375rem" />
          </button>
        </div>

        <div className={styles.body}>
          <label htmlFor="dump" className="srOnly">
            {t.today.whatsOnYourMind}
          </label>
          <textarea
            id="dump"
            ref={textareaRef}
            className={styles.textarea}
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            placeholder={t.capture.placeholder}
            disabled={isThinking}
            rows={3}
            spellCheck={false}
          />

          {isThinking && (
            <div className={styles.thinking} role="status" aria-live="polite">
              <span className={styles.dots} aria-hidden="true">
                <span className={styles.thinkDot} />
                <span className={styles.thinkDot} />
                <span className={styles.thinkDot} />
              </span>
              <span className={styles.thinkingText}>
                {streamingTasks.length > 0
                  ? t.capture.planningCount.replace(
                      "{count}",
                      String(streamingTasks.length),
                    )
                  : t.capture.thinkingSteps[thinkingStep] ?? t.capture.thinking}
              </span>
            </div>
          )}

          {isThinking && streamingTasks.length > 0 && (
            <ul className={styles.streamList} aria-live="polite">
              {streamingTasks.map((task) => (
                <li key={task.id} className={styles.streamRow}>
                  <span className={styles.streamDot} aria-hidden="true" />
                  <span className={styles.streamRowTitle}>{task.title}</span>
                  <span className={styles.streamRowMeta}>
                    {task.status === "today" ? t.capture.streamToday : t.capture.streamLater}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {planError && !isThinking && (
            <p className={styles.error} role="alert">
              {planError}
            </p>
          )}

          {voiceError && !isThinking && (
            <p className={styles.error} role="alert">
              {voiceError}
            </p>
          )}
        </div>

        <div className={styles.footer}>
          {speechReady && (
            <button
              type="button"
              className={styles.mic}
              data-listening={isListening || undefined}
              data-checking={checkingMic || transcribing || undefined}
              onClick={() => void toggleMic()}
              disabled={isThinking || checkingMic || transcribing}
              aria-label={
                isListening ? t.capture.stopRecording : t.capture.recordDump
              }
              aria-pressed={isListening}
            >
              <MicIcon size="1.25rem" />
            </button>
          )}

          {isListening && (
            <div className={styles.listening} aria-live="polite">
              <span className={styles.bars} aria-hidden="true">
                <span className={styles.bar} />
                <span className={styles.bar} />
                <span className={styles.bar} />
                <span className={styles.bar} />
                <span className={styles.bar} />
              </span>
              <span className={styles.listeningText}>
                {t.capture.recording}
              </span>
            </div>
          )}

          {transcribing && (
            <div className={styles.listening} aria-live="polite">
              <span className={styles.dots} aria-hidden="true">
                <span className={styles.thinkDot} />
                <span className={styles.thinkDot} />
                <span className={styles.thinkDot} />
              </span>
              <span className={styles.listeningText}>{t.capture.transcribing}</span>
            </div>
          )}

          <span className={styles.footerSpacer} />

          <button
            type="button"
            className={styles.cancel}
            onClick={closeCapture}
            disabled={isThinking}
          >
            {t.common.cancel}
          </button>

          <button
            type="button"
            className={styles.plan}
            data-thinking={isThinking || undefined}
            onClick={handlePlan}
            disabled={isThinking}
          >
            {isThinking ? t.capture.planning : t.capture.planIt}
          </button>
        </div>
      </div>

      {micIssue && (
        <MicPermissionDialog
          status={micIssue}
          onClose={() => setMicIssue(null)}
        />
      )}
    </div>
  );
}
