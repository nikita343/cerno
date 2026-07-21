/**
 * Microphone permission.
 *
 * Recording and transcription live in `lib/recorder.ts`; this file is only the
 * permission handshake, which both paths need.
 *
 * The Web Speech API wrapper that used to live here is gone. It worked
 * properly only in Chrome — Firefox has no `SpeechRecognition` at all and
 * Safari's is unreliable — so dictation now records audio and transcribes it
 * server-side, which behaves the same everywhere.
 */

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
