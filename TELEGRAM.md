# Telegram bot

Add tasks to Cerno from Telegram, and get a short brief each morning. The bot is
already built — this is the setup you run once.

## What it does

- **Send tasks.** Any message you send the bot becomes tasks in your Cerno day —
  one task per line, up to ten a message. Cerno parses each line for priority,
  effort, tag and timing, exactly like the in-app quick add.
- **`/today`** — replies with what's still on today.
- **Morning brief.** Around 8am *in your timezone*, the bot messages you the
  day's list (only if you have reminders on and something planned).

The whole thing is off until `TELEGRAM_BOT_TOKEN` is set — no token, no bot, and
the rest of the app is unaffected.

## Setup

### 1. Env vars

Add to `.env.local` (local) and to Vercel (Project → Settings → Environment
Variables) for production:

| Variable | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | the token BotFather gave you |
| `TELEGRAM_WEBHOOK_SECRET` | a random string you pick — `openssl rand -hex 32` |
| `CRON_SECRET` | another random string — `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | already needed for Stripe; the bot uses it too |

`TELEGRAM_BOT_USERNAME` is optional — the app fetches the username itself.

### 2. Run the migration

Paste `supabase/migrations/0011_telegram.sql` into the Supabase SQL editor and
Run. It adds the linked-chat column and the link-code table.

### 3. Register the webhook (once)

Tell Telegram where to send updates, and hand it the secret. Replace the token
and secret, and use your real domain:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://www.usecerno.xyz/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

Expected reply: `{"ok":true,"result":true,"description":"Webhook was set"}`.

Check it any time with:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

`url` should be your endpoint and `pending_update_count` should stay near zero.
Use the **`www.`** host — the same canonical domain as the Stripe webhook.
Telegram does not follow redirects, so the apex would 308 and drop every update.

### 4. Connect an account

In Cerno: **Settings → Telegram → Connect Telegram**. It opens the bot with a
one-time code; tap **Start**. The card confirms on its own when you come back.

## How linking is secured

The webhook has no Cerno session, so it authenticates two ways, both mirroring
the Stripe webhook:

- **The request is Telegram.** Every update carries the secret token in
  `X-Telegram-Bot-Api-Secret-Token`; a request without the matching secret is
  refused. That is the whole access check.
- **The chat is an account.** The user id is never read from the message. It's
  looked up from the linked chat id, which was set earlier when a *signed-in*
  user minted a one-time code and presented it via `/start <code>`. A chat can
  only ever act as the account it proved it owns.

The service-role key is confined to the webhook and the cron, and every query
there is scoped by `user_id` by hand — see `src/lib/supabase/admin.ts`.

## The morning brief (cron)

`vercel.json` schedules `/api/cron/telegram-reminders` hourly. It runs every
hour but only messages users for whom it's locally ~8am, so timing is right per
timezone without tracking "already sent". Vercel passes `CRON_SECRET` as a
bearer token; the route refuses without it, so the URL isn't an open trigger.

Nothing else is needed — Vercel picks up the schedule from `vercel.json` on
deploy. To change the hour, edit `BRIEF_HOUR` in the route.

## Local testing

Telegram can't reach `localhost`, so point the webhook at a tunnel:

```bash
# e.g. cloudflared tunnel --url http://localhost:3000
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-tunnel>/api/telegram/webhook" \
  -d "secret_token=<SECRET>"
```

Remember to point the webhook back at production when you're done.
