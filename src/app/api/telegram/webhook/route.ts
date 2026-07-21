import { NextResponse } from "next/server";

import { buildSmartTask } from "@/lib/ai/smartTask";
import {
  escapeHtml,
  hasTelegramConfig,
  sendTelegramMessage,
} from "@/lib/telegram/api";
import {
  findUserByChatId,
  insertTasksFor,
  linkChatWithCode,
  loadTodaysTasks,
  loadUserContext,
} from "@/lib/telegram/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/webhook — everything the bot receives.
 *
 * ---------------------------------------------------------------------------
 * Three rules, the same shape as the Stripe webhook.
 * ---------------------------------------------------------------------------
 *
 *  1. The secret token *is* the authentication. `setWebhook` registers a secret
 *     that Telegram echoes in `X-Telegram-Bot-Api-Secret-Token` on every call;
 *     a request without it isn't from Telegram and is refused. This is the whole
 *     access check — there is no session here.
 *
 *  2. The user id never comes from the message. It is looked up from the linked
 *     `telegram_chat_id`, or resolved from a one-time code a signed-in user
 *     minted. A chat can only act as the account it proved it owns.
 *
 *  3. Always answer 200 once the secret checks out — even on an internal error,
 *     after apologising to the user. A non-200 makes Telegram redeliver the same
 *     update, which for a task-creating handler means duplicates.
 */

/** How many task lines one message may create, so a paste can't run up a bill. */
const MAX_TASKS = 10;

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}
interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export async function POST(request: Request) {
  if (!hasTelegramConfig()) {
    // Nothing to serve, but 200 so Telegram doesn't retry against a bot that
    // isn't configured on this deployment.
    return NextResponse.json({ ok: true });
  }

  // Rule 1: the secret token is the door.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  // Only text messages do anything; stickers, photos and joins are ignored.
  if (!chatId || !text) return NextResponse.json({ ok: true });

  try {
    await handle(chatId, text);
  } catch (error) {
    // Rule 3: never let a failure become a redelivery.
    console.error("[telegram/webhook]", error);
    await sendTelegramMessage(
      chatId,
      "Something went wrong on my end. Try again in a moment.",
    );
  }

  return NextResponse.json({ ok: true });
}

async function handle(chatId: number, text: string): Promise<void> {
  // /start <code> — the account link.
  if (text.startsWith("/start")) {
    const code = text.slice("/start".length).trim();
    if (!code) return void (await sendUnlinkedHelp(chatId));

    const userId = await linkChatWithCode(code, chatId);
    if (!userId) {
      await sendTelegramMessage(
        chatId,
        "That link expired or isn't valid. Open Cerno → Settings → Telegram and tap <b>Connect</b> again.",
      );
      return;
    }
    await sendTelegramMessage(
      chatId,
      "✅ <b>Connected to Cerno.</b>\n\nSend me anything you need to do and it lands in your day. One task per line — I'll sort out the priority and timing.",
    );
    return;
  }

  if (text === "/help") return void (await sendHelp(chatId));

  // Everything past here needs a linked account.
  const userId = await findUserByChatId(chatId);
  if (!userId) return void (await sendUnlinkedHelp(chatId));

  if (text === "/today" || text === "/tasks") {
    await sendToday(chatId, userId);
    return;
  }

  await createTasks(chatId, userId, text);
}

/** Turns a message into one or more tasks and confirms what landed. */
async function createTasks(
  chatId: number,
  userId: string,
  text: string,
): Promise<void> {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_TASKS);

  if (lines.length === 0) return;

  const { timezone, modelChoice, labelNames } = await loadUserContext(userId);
  const today = todayIn(timezone);

  // Parsed in parallel — a handful of short phrases, each its own model call,
  // is fine and keeps a multi-line message from feeling sequential.
  const tasks = await Promise.all(
    lines.map((line) =>
      buildSmartTask({ text: line, today, timezone, labelNames, modelChoice }),
    ),
  );

  await insertTasksFor(userId, tasks);

  const list = tasks
    .map((t) => `• ${escapeHtml(t.title)}`)
    .join("\n");
  const header =
    tasks.length === 1 ? "Added to your day:" : `Added ${tasks.length} to your day:`;
  await sendTelegramMessage(chatId, `✅ <b>${header}</b>\n${list}`);
}

/** The /today digest. */
async function sendToday(chatId: number, userId: string): Promise<void> {
  const { timezone } = await loadUserContext(userId);
  const tasks = await loadTodaysTasks(userId, todayIn(timezone));
  if (tasks.length === 0) {
    await sendTelegramMessage(chatId, "Nothing left on today. 🎉");
    return;
  }
  const list = tasks
    .map((t) => {
      const time = t.suggested_start ? `<b>${t.suggested_start}</b> ` : "";
      return `• ${time}${escapeHtml(t.title)}`;
    })
    .join("\n");
  await sendTelegramMessage(chatId, `<b>Today</b>\n${list}`);
}

function sendHelp(chatId: number): Promise<boolean> {
  return sendTelegramMessage(
    chatId,
    [
      "<b>Cerno bot</b>",
      "",
      "Send me tasks and they appear in your Cerno day — one per line.",
      "",
      "<b>/today</b> — what's left on today",
      "<b>/help</b> — this message",
    ].join("\n"),
  );
}

function sendUnlinkedHelp(chatId: number): Promise<boolean> {
  return sendTelegramMessage(
    chatId,
    "👋 <b>Welcome to Cerno.</b>\n\nTo connect this chat to your account, open Cerno → <b>Settings → Telegram</b> and tap <b>Connect</b>. Once linked, anything you send here becomes a task.",
  );
}

/** Today's date in the user's timezone, as YYYY-MM-DD. */
function todayIn(timezone: string): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return new Date().toLocaleDateString("en-CA");
  }
}
