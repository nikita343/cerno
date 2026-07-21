import { NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { hasEmailConfig, sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { siteUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth / email-confirmation landing point.
 *
 * Supabase redirects here with a one-time `code`, which we exchange for a
 * session. The exchange sets the auth cookies via the server client, so the
 * user is signed in by the time we redirect onward.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Same open-redirect guard as the credential actions: only relative paths.
  const raw = searchParams.get("next") ?? "/dashboard";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // Fire-and-forget: a welcome email must never delay, or fail, a sign-in.
  await sendWelcomeOnce(supabase).catch((caught) =>
    console.error("[auth/callback] welcome email failed", caught),
  );

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * Sends the welcome email the first time an account reaches this route.
 *
 * This callback runs on *every* OAuth sign-in and every email confirmation, so
 * "we just exchanged a code" is not a signal that somebody is new. The marker
 * in `user_settings` is, and it is written before the send rather than after:
 * two tabs completing sign-in at once would otherwise both read NULL and both
 * send. Losing a welcome email to a mail outage is better than sending two.
 */
async function sendWelcomeOnce(supabase: SupabaseClient): Promise<void> {
  if (!hasEmailConfig()) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("welcome_email_sent_at, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // A row that already carries a timestamp has had its welcome. A missing row
  // means a brand-new account that hasn't opened Settings yet — still new.
  if (settings?.welcome_email_sent_at) return;

  const { error: claimError } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, welcome_email_sent_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (claimError) {
    console.error("[auth/callback] could not claim welcome send", claimError);
    return;
  }

  await sendEmail(
    user.email,
    welcomeEmail({
      url: `${siteUrl()}/dashboard`,
      name: settings?.display_name ?? user.user_metadata?.full_name ?? null,
    }),
  );
}
