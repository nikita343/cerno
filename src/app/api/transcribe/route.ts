import { NextResponse } from "next/server";

import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Matches the client-side guard in `lib/recorder.ts`. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Containers `MediaRecorder` can produce that Whisper accepts. */
const ALLOWED_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/m4a",
];

const WHISPER_MODEL = "whisper-1";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * POST /api/transcribe — audio in, text out.
 *
 * Exists because Claude has no audio input: the recording is transcribed here
 * and only the resulting *text* is ever sent to the planner. This is the one
 * place in Cerno that talks to a second AI vendor, and the audio is not stored
 * anywhere — it is streamed to the transcription API and discarded with the
 * request.
 *
 * Sign-in is required. Without it this is an open, uncapped proxy to a paid
 * API that anyone could point a script at.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 501, not 500: the feature is absent rather than broken, and the client
    // uses this to fall back to typing rather than showing an error.
    return NextResponse.json(
      { error: "Voice transcription isn't configured." },
      { status: 501 },
    );
  }

  const caller = await resolveRequestUser();
  if (!caller) {
    return NextResponse.json({ error: "Sign in to use voice." }, { status: 401 });
  }

  let file: File | null = null;
  let language: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("audio");
    if (value instanceof File) file = value;
    // Cerno ships English and Ukrainian; pinning Whisper to the user's chosen
    // language stops Ukrainian audio being misdetected as Polish or Russian.
    const lang = form.get("language");
    if (lang === "en" || lang === "uk") language = lang;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That recording was empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  }

  // The browser appends codec parameters ("audio/webm;codecs=opus"), so the
  // check is on the base type.
  const baseType = file.type.split(";")[0].trim().toLowerCase();
  if (baseType && !ALLOWED_TYPES.includes(baseType)) {
    return NextResponse.json(
      { error: "That audio format isn't supported." },
      { status: 415 },
    );
  }

  try {
    const upstream = new FormData();
    upstream.append("file", file, file.name || "audio.webm");
    upstream.append("model", WHISPER_MODEL);
    // Pin to the user's language when we know it (en/uk) — Whisper's own
    // detection otherwise mistakes Ukrainian for Polish or Russian. Falls back
    // to auto-detect when the client didn't send a supported language.
    if (language) upstream.append("language", language);
    upstream.append("response_format", "json");

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!response.ok) {
      // The upstream body can name the model, quota, or account. Logged for
      // us, never echoed to the browser.
      console.error("[/api/transcribe] upstream", response.status, await response.text());
      return NextResponse.json(
        { error: "Couldn't transcribe that. Try again." },
        { status: 502 },
      );
    }

    const body = (await response.json()) as { text?: string };
    const text = (body.text ?? "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "I didn't catch anything. Try again." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[/api/transcribe]", error);
    return NextResponse.json(
      { error: "Couldn't transcribe that. Try again." },
      { status: 502 },
    );
  }
}
