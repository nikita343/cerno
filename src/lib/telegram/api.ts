import "server-only";

/**
 * The Telegram Bot API, the two calls Cerno actually makes.
 *
 * Server-only and lazy: like email, the app must build and run with no bot
 * configured, and every caller treats a send failure as non-fatal. A reminder
 * that didn't reach Telegram is a missed nicety, never a reason to fail the
 * request that triggered it.
 *
 * The token is a master credential for the bot — anyone holding it can post as
 * Cerno — so it stays server-side and is never returned to a browser.
 */

const API = "https://api.telegram.org";

export function hasTelegramConfig(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  return value;
}

async function call<T>(method: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${API}/bot${token()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      // Telegram's description can name the chat or the token. Logged, never
      // surfaced to a browser.
      console.error(`[telegram] ${method} failed`, data.description);
      return null;
    }
    return data.result ?? null;
  } catch (error) {
    console.error(`[telegram] ${method} threw`, error);
    return null;
  }
}

/**
 * Sends a message to a chat. Returns whether it went out.
 *
 * HTML parse mode, because our messages use light formatting (bold headers,
 * task lists) and HTML is the mode that doesn't need every `.`, `-` and `!`
 * escaped the way MarkdownV2 does.
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<boolean> {
  const result = await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    // These messages are self-contained; a link preview would just add a card
    // for whatever URL happened to appear in a task title.
    disable_web_page_preview: true,
  });
  return result !== null;
}

/** Escapes the three characters that are markup in Telegram's HTML mode. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let cachedUsername: string | null = null;

/**
 * The bot's @username, for building `t.me/<bot>?start=<code>` deep links.
 *
 * Fetched from `getMe` and memoised rather than kept as a second env var, so
 * configuring the bot is just the one token. Falls back to the env override if
 * you'd rather pin it.
 */
export async function getBotUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME;
  if (cachedUsername) return cachedUsername;
  const me = await call<{ username?: string }>("getMe", {});
  cachedUsername = me?.username ?? null;
  return cachedUsername;
}
