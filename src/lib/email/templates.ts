import "server-only";

import { renderEmail, renderText, type EmailContent } from "./layout";

/**
 * The messages Cerno sends.
 *
 * Each returns a subject and both bodies. Content lives here as data rather
 * than markup so the wording is reviewable without reading table layout, and so
 * the HTML and plain-text parts are generated from one source and cannot drift.
 */

export interface Email {
  subject: string;
  html: string;
  text: string;
}

function build(subject: string, content: EmailContent): Email {
  return { subject, html: renderEmail(content), text: renderText(content) };
}

/**
 * Workspace invite.
 *
 * The inviter is named because "you've been invited to a workspace" from an app
 * you may not have heard of reads as spam. A person's name and the workspace
 * name are what make it legible — and they are the two things the recipient can
 * check against what they were expecting.
 */
export function workspaceInviteEmail(params: {
  workspaceName: string;
  inviterName: string;
  url: string;
  /** Days until the link stops working. */
  expiresInDays: number;
}): Email {
  const { workspaceName, inviterName, url, expiresInDays } = params;

  return build(`${inviterName} invited you to ${workspaceName} on Cerno`, {
    preheader: `Join ${workspaceName} and share the team's task list.`,
    heading: `Join ${workspaceName}`,
    body: [
      `${inviterName} added you to ${workspaceName}, a shared workspace on Cerno.`,
      "You'll see the team's tasks alongside your own, and anything assigned to you shows up in your day.",
      "Cerno is free for you — only the person who set up the workspace pays.",
    ],
    cta: { label: "Join the workspace", url },
    footnote: `This link expires in ${expiresInDays} days and works once. If you weren't expecting it, you can ignore this email — nothing happens until you open the link.`,
  });
}

/** Sent to the payer once Stripe confirms. Receipts come from Stripe itself. */
export function teamWelcomeEmail(params: { url: string }): Email {
  return build("You're on Cerno Team", {
    preheader: "Workspaces are unlocked. Here's how to start one.",
    heading: "You're on Team",
    body: [
      "Workspaces are unlocked on your account.",
      "Create one, invite up to nine other people, and share a task list with assignees. They don't need to pay — your subscription covers everyone you invite.",
    ],
    cta: { label: "Create a workspace", url: params.url },
    footnote:
      "Your receipt comes separately from Stripe. You can cancel any time from Settings, and your workspaces stay readable if you do.",
  });
}
