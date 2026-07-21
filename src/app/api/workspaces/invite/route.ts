import { NextResponse } from "next/server";

import { devDetail } from "@/lib/apiError";
import { sendEmail } from "@/lib/email/send";
import { workspaceInviteEmail } from "@/lib/email/templates";
import { siteUrl } from "@/lib/stripe";
import { resolveRequestUser } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/invite — email an invite that already exists.
 *
 * Takes an invite id, not a workspace and an address. The invite row is created
 * client-side under RLS; this route only delivers it. That split matters: the
 * database stays the single place an invite can be *authorised*, and this route
 * cannot mint one for a workspace the caller doesn't administer.
 *
 * ---------------------------------------------------------------------------
 * Authorisation is the read itself.
 * ---------------------------------------------------------------------------
 *
 * The invite is fetched with the *caller's* client, not a privileged one. Only
 * admins of a workspace can select its invites (see 0005_workspaces.sql), so a
 * successful read is proof of admin rights. A member, or a stranger with a
 * guessed uuid, gets zero rows and a 404 — the same answer, so neither learns
 * whether the id was real.
 *
 * Rewriting this to use the service-role client would silently delete that
 * property and turn the endpoint into "email anyone about any workspace".
 */
export async function POST(request: Request) {
  const caller = await resolveRequestUser();
  if (!caller) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let inviteId: string | null = null;
  try {
    const body = (await request.json()) as { inviteId?: unknown };
    if (typeof body.inviteId === "string") inviteId = body.inviteId;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!inviteId) {
    return NextResponse.json({ error: "Missing invite." }, { status: 400 });
  }

  const { data: invite } = await caller.supabase
    .from("workspace_invites")
    .select("id, token, email, expires_at, revoked_at, workspace_id")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (!invite.email) {
    // A link invite has no recipient by definition. The admin copies it.
    return NextResponse.json(
      { error: "That invite has no email address." },
      { status: 400 },
    );
  }
  if (invite.revoked_at) {
    return NextResponse.json({ error: "That invite was revoked." }, { status: 409 });
  }

  const { data: workspace } = await caller.supabase
    .from("workspaces")
    .select("name")
    .eq("id", invite.workspace_id)
    .maybeSingle();

  // The inviter's own name, for the subject line. Falls back to their email,
  // then to something neutral — an invite from "undefined" reads as a bug.
  const { data: profile } = await caller.supabase
    .from("user_settings")
    .select("display_name")
    .eq("user_id", caller.userId)
    .maybeSingle();

  const { data: auth } = await caller.supabase.auth.getUser();
  const inviterName =
    profile?.display_name ?? auth.user?.email ?? "Someone at Cerno";

  const expiresInDays = Math.max(
    1,
    Math.ceil(
      (new Date(invite.expires_at).getTime() - Date.now()) / 86_400_000,
    ),
  );

  const result = await sendEmail(
    invite.email,
    workspaceInviteEmail({
      workspaceName: workspace?.name ?? "a workspace",
      inviterName,
      url: `${siteUrl()}/dashboard/join/${invite.token}`,
      expiresInDays,
    }),
  );

  if (!result.sent) {
    // 200, deliberately. The invite is valid and the link works; only delivery
    // failed. Returning an error would make the UI imply the invite itself
    // didn't happen, and an admin would create a second one.
    return NextResponse.json({
      sent: false,
      error: "Couldn't send the email — copy the link instead.",
      ...devDetail(new Error(result.reason ?? "unknown")),
    });
  }

  return NextResponse.json({ sent: true });
}
