/**
 * Web Speech API wrapper.
 *
 * `SpeechRecognition` is not in the DOM lib types and is still prefixed in
 * WebKit, so the surface is typed narrowly here rather than pulling in a
 * dependency. Everything is feature-detected — where it is unsupported the mic
 * button is hidden entirely and text input still works (DEVELOPMENT.md §8).
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getConstructor() !== null;
}

/* -------------------------------------------------------------------------- */
/* Microphone availability                                                    */
/* -------------------------------------------------------------------------- */

export type MicStatus =
  /** Ready to record — permission already granted, or the prompt was accepted. */
  | "granted"
  /** The user (or browser policy) has blocked the microphone. */
  | "denied"
  /** No microphone hardware found. */
  | "no-device"
  /** getUserMedia is unavailable — typically an insecure (non-HTTPS) origin. */
  | "unavailable";

/**
 * Checks the microphone *without* prompting, where the browser supports it.
 *
 * The Permissions API is not universally implemented for `microphone`
 * (notably Safari), so a `null` return means "unknown — you'll have to ask".
 */
export async function queryMicPermission(): Promise<MicStatus | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return null;
  }
  try {
    const status = await navigator.permissions.query({
      // `microphone` is valid but missing from TypeScript's PermissionName union.
      name: "microphone" as PermissionName,
    });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return null; // "prompt" — we have to actually ask
  } catch {
    return null;
  }
}

/**
 * Ensures the microphone is usable, prompting if necessary.
 *
 * `SpeechRecognition.start()` triggers its own permission prompt, but it
 * reports failure asynchronously through `onerror` with a coarse error string —
 * too late and too vague to show a helpful message. Acquiring the stream first
 * gives a precise, awaitable answer, and the track is released immediately so
 * nothing holds the mic open.
 */
export async function ensureMicAccess(): Promise<MicStatus> {
  const preflight = await queryMicPermission();
  if (preflight === "granted" || preflight === "denied") return preflight;

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unavailable";
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Release immediately — recognition opens its own capture.
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "no-device";
    }
    return "unavailable";
  }
}

/* -------------------------------------------------------------------------- */
/* Dictation session                                                          */
/* -------------------------------------------------------------------------- */

export interface SpeechSession {
  stop: () => void;
}

/**
 * Starts dictation and keeps it running until `stop()` is called.
 *
 * Browsers end a recognition run on their own after a pause in speech, which
 * would make recording stop halfway through a thought. To honour
 * click-to-start / click-to-stop, an `onend` that we did not ask for restarts
 * recognition transparently; only `stop()` ends the session for good.
 *
 * `onTranscript` receives the full text so far — committed results plus the
 * current interim guess — so the caller can just assign it.
 */
export function startDictation({
  onTranscript,
  onEnd,
  onError,
  lang = "en-US",
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  lang?: string;
}): SpeechSession | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;

  let committed = "";
  let stopped = false;
  let recognition: SpeechRecognitionLike | null = null;

  const build = (): SpeechRecognitionLike => {
    const instance = new Ctor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = lang;

    instance.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          committed += text;
        } else {
          interim += text;
        }
      }
      onTranscript((committed + interim).trimStart(), interim === "");
    };

    instance.onerror = (event) => {
      // `no-speech` fires during ordinary pauses and `aborted` on our own
      // stop() — neither is a failure worth surfacing. Anything else ends
      // the session so the caller can reset the UI.
      if (event.error === "no-speech" || event.error === "aborted") return;
      stopped = true;
      onError?.(event.error);
    };

    instance.onend = () => {
      if (stopped) {
        onEnd?.();
        return;
      }
      // The browser gave up on a silence — pick straight back up.
      try {
        recognition = build();
        recognition.start();
      } catch {
        stopped = true;
        onEnd?.();
      }
    };

    return instance;
  };

  try {
    recognition = build();
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recognition?.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
