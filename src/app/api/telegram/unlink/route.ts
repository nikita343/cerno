import { NextResponse } from "next/server";

import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/unlink — disconnect this account's Telegram chat.
 *
 * Done with the caller's own client, not the admin one: clearing your own
 * `telegram_chat_id` is a plain settings update your RLS policy already allows,
 * so there's no reason to reach for the service-role key. The bot side simply
 * stops finding a user for that chat.
 */
export async function POST() {
  const caller = await resolveRequestUser();
  if (!caller) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { error } = await caller.supabase
    .from("user_settings")
    .update({ telegram_chat_id: null })
    .eq("user_id", caller.userId);
  if (error) {
    console.error("[telegram/unlink]", error);
    return NextResponse.json({ error: "Couldn't disconnect." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
