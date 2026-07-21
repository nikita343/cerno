import { NextResponse } from "next/server";

import { newId } from "@/lib/id";
import { getBotUsername, hasTelegramConfig } from "@/lib/telegram/api";
import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long a link code is good for. Long enough to switch apps, no longer. */
const CODE_TTL_MINUTES = 15;

/**
 * POST /api/telegram/link — mint a one-time code and return the deep link.
 *
 * This is the signed-in half of account linking: the code is written with the
 * caller's own client (so RLS stamps it with their id), and the bot later
 * trades it back for that id. The code is the only thing that ties the two
 * sides together, which is why it's short-lived and single-use.
 */
export async function POST() {
  if (!hasTelegramConfig()) {
    return NextResponse.json({ error: "Telegram isn't set up." }, { status: 503 });
  }

  const caller = await resolveRequestUser();
  if (!caller) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const username = await getBotUsername();
  if (!username) {
    return NextResponse.json(
      { error: "Couldn't reach Telegram. Try again." },
      { status: 502 },
    );
  }

  const code = newId();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error } = await caller.supabase.from("telegram_link_codes").insert({
    code,
    user_id: caller.userId,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("[telegram/link]", error);
    return NextResponse.json(
      { error: "Couldn't start linking. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: `https://t.me/${username}?start=${code}`,
    expiresInMinutes: CODE_TTL_MINUTES,
  });
}
