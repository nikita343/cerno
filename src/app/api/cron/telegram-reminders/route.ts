import { NextResponse } from "next/server";

import { escapeHtml, hasTelegramConfig, sendTelegramMessage } from "@/lib/telegram/api";
import { loadLinkedChats, loadTodaysTasks } from "@/lib/telegram/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local hour to send the brief. 8am reads as "start of the day" most places. */
const BRIEF_HOUR = 8;

/**
 * GET /api/cron/telegram-reminders — the morning brief.
 *
 * Meant to be called hourly by a scheduler (see vercel.json). Rather than fire
 * at one fixed UTC time and reach everyone at odd local hours, it runs every
 * hour and only messages the users for whom it is *locally* ~8am — so the timing
 * is right per timezone, and because it only matches one hour a day there's no
 * need to track "already sent".
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
    if (localHour(chat.timezone) !== BRIEF_HOUR) continue;

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

function localHour(timezone: string): number {
  try {
    return Number(
      new Date().toLocaleString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false,
      }),
    );
  } catch {
    return new Date().getUTCHours();
  }
}

function todayIn(timezone: string): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return new Date().toLocaleDateString("en-CA");
  }
}
