"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CloseIcon, MicIcon } from "@/components/icons";
import {
  isRecordingSupported,
  startRecording,
  transcribe,
  VoiceUnavailableError,
  type RecorderHandle,
} from "@/lib/recorder";
import { ensureMicAccess, type MicStatus } from "@/lib/speech";
import { usePresence } from "@/lib/usePresence";
import { useAppStore } from "@/store/StoreProvider";

import { MicPermissionDialog } from "./MicPermissionDialog";
import styles from "./CaptureOverlay.module.css";

const PLACEHOLDER =
  "Everything on your mind — one long sentence is fine.";

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
        void submitDump(dictatedRef.current ? "voice" : "text");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isThinking, closeCapture, submitDump]);

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

        const text = await transcribe(recording);
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
          error instanceof Error
            ? error.message
            : "Couldn't transcribe that. Try again.",
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
        aria-label="Close brain dump"
        tabIndex={-1}
      />

      <div
        data-leaving={leaving || undefined}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Brain dump"
      >
        <div className={styles.header}>
          <span className={styles.headerDot} />
          <span className={styles.headerTitle}>Brain dump</span>
          <button
            type="button"
            className={styles.close}
            onClick={closeCapture}
            disabled={isThinking}
            aria-label="Close"
          >
            <CloseIcon size="0.9375rem" />
          </button>
        </div>

        <div className={styles.body}>
          <label htmlFor="dump" className="srOnly">
            What&rsquo;s on your mind?
          </label>
          <textarea
            id="dump"
            ref={textareaRef}
            className={styles.textarea}
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            placeholder={PLACEHOLDER}
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
                Planning your day — sorting priority, effort and deadlines…
              </span>
            </div>
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
                isListening ? "Stop recording" : "Record your dump"
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
                Recording — tap the mic to stop
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
              <span className={styles.listeningText}>Transcribing…</span>
            </div>
          )}

          <span className={styles.footerSpacer} />

          <button
            type="button"
            className={styles.cancel}
            onClick={closeCapture}
            disabled={isThinking}
          >
            Cancel
          </button>

          <button
            type="button"
            className={styles.plan}
            data-thinking={isThinking || undefined}
            onClick={handlePlan}
            disabled={isThinking}
          >
            {isThinking ? "Planning…" : "Plan it"}
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
