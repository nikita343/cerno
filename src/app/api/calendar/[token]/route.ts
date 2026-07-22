import { createClient } from "@supabase/supabase-js";

import { buildCalendar, type FeedTask } from "@/lib/ical";
import {
  hasSupabaseConfig,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rejects obvious junk before it reaches the database. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/calendar/{token} — the subscribable iCal feed.
 *
 * Deliberately unauthenticated: Google's and Apple's servers fetch this with no
 * cookies and no Authorization header. The token in the path is the entire
 * credential, which is why it is a random uuid rather than a user id, and why
 * regenerating it in Settings kills the old URL immediately.
 *
 * Reads through `tasks_for_feed`, a SECURITY DEFINER function that resolves the
 * token to a user server-side. The route therefore uses the ordinary anon key —
 * no service-role key is involved anywhere in this path.
 *
 * An unknown token returns 404, never 403: a 403 would confirm that a token is
 * *shaped* correctly, which is a small oracle for anyone guessing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!UUID.test(token)) {
    return new Response("Not found", { status: 404 });
  }
  if (!hasSupabaseConfig()) {
    return new Response("Calendar feed is not configured", { status: 503 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Tasks and the owner's timezone in parallel — both resolve the token
  // server-side through SECURITY DEFINER functions, so neither leans on RLS.
  const [tasksResult, tzResult] = await Promise.all([
    supabase.rpc("tasks_for_feed", { token }),
    supabase.rpc("feed_timezone", { token }),
  ]);

  if (tasksResult.error) {
    console.error("[calendar feed]", tasksResult.error);
    return new Response("Unable to build calendar", { status: 500 });
  }

  const tasks = (tasksResult.data ?? []) as FeedTask[];
  // A missing function (migration 0012 not yet applied) or unknown token leaves
  // this null, and the feed falls back to floating times — never an error.
  const timezone = (tzResult.data as string | null) ?? null;

  // An empty feed and an unknown token are indistinguishable from the outside,
  // which is intentional — see the note above about not confirming tokens.
  const body = buildCalendar({ tasks, timezone });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="cerno.ics"',
      // Never cached by an intermediary: the URL is a credential, and a shared
      // cache holding this body would serve one person's tasks from another's
      // request path.
      "cache-control": "private, max-age=0, no-store",
      // The URL must not leak to any site the user opens from a calendar
      // client that renders links.
      "referrer-policy": "no-referrer",
    },
  });
}
