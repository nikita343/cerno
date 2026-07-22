import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { upsertTasks } from "@/lib/supabase/data";
import { DEFAULT_LABELS, type ModelChoice, type Task } from "@/lib/types";

/**
 * The database side of the Telegram bot, all through the service-role client.
 *
 * The bot's webhook has no session, so — exactly like the Stripe webhook — it
 * reads and writes with the admin key. The discipline that keeps that safe: the
 * user id is never taken from the Telegram message. It is either looked up from
 * the linked `telegram_chat_id` (set earlier by a signed-in user), or resolved
 * from a one-time code that a signed-in user minted. The chat can only ever act
 * as the account it proved it owns.
 *
 * Because the admin client bypasses RLS, every query here is *explicitly* scoped
 * by `user_id`. A helper that leaned on a policy would read across tenants.
 */

/** The Cerno user linked to a chat, or null. */
export async function findUserByChatId(chatId: number): Promise<string | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_settings")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (error) {
    console.error("[telegram] chat lookup failed", error);
    return null;
  }
  return (data as { user_id: string } | null)?.user_id ?? null;
}

/**
 * Trades a one-time code for the account it belongs to and links the chat.
 *
 * Returns the linked user id, or null if the code is unknown or expired. The
 * chat is first released from any account it was previously on, so re-linking a
 * phone to a different Cerno account just works rather than colliding with the
 * unique constraint.
 */
export async function linkChatWithCode(
  code: string,
  chatId: number,
): Promise<string | null> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("telegram_link_codes")
    .select("user_id, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as { user_id: string; expires_at: string };
  if (new Date(row.expires_at) < new Date()) {
    // Expired: burn it so a leaked-but-stale code can't be retried.
    await db.from("telegram_link_codes").delete().eq("code", code);
    return null;
  }

  // Release the chat from any previous account (unique constraint), then bind it
  // to this one. Two statements rather than an upsert because the release
  // targets a *different* row than the bind.
  await db
    .from("user_settings")
    .update({ telegram_chat_id: null })
    .eq("telegram_chat_id", chatId);

  const { error: bindError } = await db
    .from("user_settings")
    .upsert(
      { user_id: row.user_id, telegram_chat_id: chatId },
      { onConflict: "user_id" },
    );
  if (bindError) {
    console.error("[telegram] link bind failed", bindError);
    return null;
  }

  // One code, one use.
  await db.from("telegram_link_codes").delete().eq("code", code);
  return row.user_id;
}

/** The parsing context a user's tasks are built with. */
export interface UserContext {
  timezone: string;
  modelChoice: ModelChoice | null;
  labelNames: string[];
}

/**
 * A user's timezone, model preference and label names — scoped by user_id.
 *
 * Deliberately *not* the shared `loadLabelNames`/`loadModelChoice`: those read
 * with the caller's RLS-scoped client, and the label read has no `user_id`
 * filter because it relies on the policy. Run through the admin client that
 * would return every user's labels, so this scopes the query itself.
 */
export async function loadUserContext(userId: string): Promise<UserContext> {
  const db = createAdminClient();

  const [settings, labels] = await Promise.all([
    db
      .from("user_settings")
      .select("timezone, model")
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("labels").select("name").eq("user_id", userId).order("sort_order"),
  ]);

  const settingsRow = settings.data as { timezone?: string; model?: ModelChoice } | null;
  const labelRows = (labels.data ?? []) as { name: string }[];

  return {
    timezone: settingsRow?.timezone ?? "UTC",
    // NOTE: unlike the web path (loadModelChoice), this does not gate Opus/GPT-5
    // behind the Team plan — Telegram is hidden for now. If it ships, downgrade
    // a paid model here for users without has_active_plan(), or this is a way to
    // run a paid model on a free account.
    modelChoice: settingsRow?.model ?? null,
    labelNames:
      labelRows.length > 0
        ? labelRows.map((l) => l.name)
        : DEFAULT_LABELS.map((l) => l.name),
  };
}

/** Persists tasks for a user through the admin client. */
export async function insertTasksFor(userId: string, tasks: Task[]): Promise<void> {
  await upsertTasks(createAdminClient(), tasks, userId);
}

/** Today's still-open tasks for a user, for the /today command and the brief. */
export async function loadTodaysTasks(
  userId: string,
  today: string,
): Promise<{ title: string; suggested_start: string | null }[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tasks")
    .select("title, suggested_start, status, plan_date")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .neq("status", "done")
    .order("suggested_start", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[telegram] today load failed", error);
    return [];
  }
  return (data ?? []) as { title: string; suggested_start: string | null }[];
}

/** Every linked chat, for the reminder cron. */
export async function loadLinkedChats(): Promise<
  { user_id: string; telegram_chat_id: number; timezone: string; reminders_enabled: boolean }[]
> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_settings")
    .select("user_id, telegram_chat_id, timezone, reminders_enabled")
    .not("telegram_chat_id", "is", null);
  if (error) {
    console.error("[telegram] linked chats load failed", error);
    return [];
  }
  return (data ?? []) as {
    user_id: string;
    telegram_chat_id: number;
    timezone: string;
    reminders_enabled: boolean;
  }[];
}
