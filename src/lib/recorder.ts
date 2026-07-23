"use client";

/**
 * Microphone recording for server-side transcription.
 *
 * Replaces the Web Speech API path, which only really works in Chrome: Firefox
 * has no `SpeechRecognition` at all and Safari's is unreliable. `MediaRecorder`
 * is supported everywhere, so recording the audio and transcribing it on the
 * server gives one code path that behaves the same in every browser — at the
 * cost of a round trip, and of the audio leaving the device.
 */

/**
 * The first container the browser actually supports.
 *
 * Ordered by transcription quality per byte. Safari only produces MP4/AAC;
 * Chrome and Firefox prefer WebM/Opus. Passing an unsupported type to
 * `MediaRecorder` throws, so this is feature-detected rather than assumed.
 */
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  // An empty string is valid: it tells MediaRecorder to choose for itself.
  return "";
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export interface Recording {
  blob: Blob;
  /** File extension matching the blob's container, for the upload filename. */
  extension: string;
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export interface RecorderHandle {
  /** Resolves with the recording, or null if nothing was captured. */
  stop: () => Promise<Recording | null>;
  /** Aborts and releases the microphone without producing a blob. */
  cancel: () => void;
}

/**
 * Starts recording. Throws if the microphone is unavailable or denied — the
 * caller is expected to have checked permission first so it can explain why.
 */
export async function startRecording(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Speech, not music: these clean up room noise and level differences
      // that would otherwise cost transcription accuracy.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  // Every track must be stopped explicitly. Stopping the recorder alone leaves
  // the microphone open and the browser's recording indicator lit, which looks
  // exactly like an app that is still listening to you.
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  recorder.start();

  return {
    stop: () =>
      new Promise<Recording | null>((resolve) => {
        if (recorder.state === "inactive") {
          release();
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          release();
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          const type = recorder.mimeType || mimeType || "audio/webm";
          resolve({
            blob: new Blob(chunks, { type }),
            extension: extensionFor(type),
          });
        };
        recorder.stop();
      }),

    cancel: () => {
      // Cleared first so the pending stop promise can never resolve with audio
      // the user asked to discard.
      chunks.length = 0;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

/** Rejected client-side before upload; mirrors the route's own limit. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/**
 * Thrown when the server has no transcription key configured.
 *
 * Distinguished from an ordinary failure so the caller can hide the mic for the
 * rest of the session instead of offering a button that can never work. The
 * browser cannot know this up front — it is a server-side env var — so the
 * first attempt is what discovers it.
 */
export class VoiceUnavailableError extends Error {}

/**
 * Uploads a recording and returns the transcript.
 *
 * Throws with a user-safe message; the caller surfaces it inline.
 */
export async function transcribe(
  recording: Recording,
  language?: string,
): Promise<string> {
  if (recording.blob.size > MAX_AUDIO_BYTES) {
    throw new Error("That recording is too long.");
  }

  const form = new FormData();
  form.append("audio", recording.blob, `dump.${recording.extension}`);
  if (language) form.append("language", language);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    const message = body?.error ?? "Couldn't transcribe that. Try again.";
    if (response.status === 501) throw new VoiceUnavailableError(message);
    throw new Error(message);
  }

  const body = (await response.json()) as { text?: string };
  return (body.text ?? "").trim();
}
