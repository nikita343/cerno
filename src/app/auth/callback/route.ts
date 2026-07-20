import { NextResponse } from "next/server";

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

  return NextResponse.redirect(`${origin}${next}`);
}
