import { NextResponse } from "next/server";

import { escapeHtml, hasTelegramConfig, sendTelegramMessage } from "@/lib/telegram/api";
import { loadLinkedChats, loadTodaysTasks } from "@/lib/telegram/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/telegram-reminders — the morning brief.
 *
 * Fired once a day by the scheduler (see vercel.json — 06:00 UTC, which is
 * mid-morning across the EU/Kyiv audience). A single daily fire can't be "8am
 * everywhere", so it simply messages every linked user who has reminders on and
 * something planned today, in their own timezone's sense of "today".
 *
 * Why once a day and not hourly-with-a-per-timezone-gate: Vercel's Hobby plan
 * caps cron jobs at once per day, and an hourly schedule fails the deploy. If
 * this runs on a Pro plan later, an hourly schedule plus a `localHour === 8`
 * check would restore per-timezone timing — the git history has that version.
 *
 * Guarded by CRON_SECRET: the scheduler sends it as a bearer token, and without
 * a match the route refuses. Otherwise this would be an open endpoint that
 * messages every linked user on demand.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasTelegramConfig()) return NextResponse.json({ ok: true, sent: 0 });

  const chats = await loadLinkedChats();
  let sent = 0;

  for (const chat of chats) {
    if (!chat.reminders_enabled) continue;

    const today = todayIn(chat.timezone);
    const tasks = await loadTodaysTasks(chat.user_id, today);
    if (tasks.length === 0) continue;

    const list = tasks
      .map((t) => {
        const time = t.suggested_start ? `<b>${t.suggested_start}</b> ` : "";
        return `• ${time}${escapeHtml(t.title)}`;
      })
      .join("\n");
    const header =
      tasks.length === 1
        ? "1 thing on today"
        : `${tasks.length} things on today`;

    const ok = await sendTelegramMessage(
      chat.telegram_chat_id,
      `☀️ <b>Good morning</b> — ${header}:\n${list}`,
    );
    if (ok) sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}

function todayIn(timezone: string): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return new Date().toLocaleDateString("en-CA");
  }
}
