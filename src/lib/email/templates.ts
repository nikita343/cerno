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

/**
 * First email after signing up.
 *
 * Deliberately not a feature tour. Someone who just made an account wants one
 * next action, and everything else is noise they will not read. The one line
 * about what Cerno does is there because a welcome mail is often opened days
 * later, out of context.
 */
export function welcomeEmail(params: { url: string; name?: string | null }): Email {
  const greeting = params.name ? `Welcome, ${params.name}` : "Welcome to Cerno";

  return build(greeting, {
    preheader: "Dump what's on your mind and Cerno builds the day around it.",
    heading: greeting,
    body: [
      "Cerno turns a brain dump into a realistic day. Write everything you're carrying — one long sentence is fine — and it splits that into tasks, estimates the effort, and schedules what actually fits.",
      "Whatever doesn't fit gets parked with a reason, rather than quietly dropped.",
    ],
    cta: { label: "Plan your first day", url: params.url },
    footnote:
      "You're on the free plan, which covers everything personal, forever. There's nothing to set up.",
  });
}

/**
 * A card failed and Stripe will retry.
 *
 * Written to be reassuring and specific: nothing has been lost yet, retries are
 * automatic, and the one useful action is naming the card. Dunning mail that
 * leads with a threat gets deleted by people who would happily have paid.
 */
export function paymentIssueEmail(params: { url: string }): Email {
  return build("Your Cerno payment didn't go through", {
    preheader: "We'll retry automatically. Updating your card avoids any interruption.",
    heading: "Your payment didn't go through",
    body: [
      "The card on your Cerno Team subscription was declined. Stripe retries automatically over the next few days, so this often resolves itself.",
      "If it doesn't, updating your card now avoids any interruption. Your workspaces and everything in them stay exactly where they are either way.",
    ],
    cta: { label: "Update your card", url: params.url },
    footnote: "Billing is handled by Stripe — we never see your card details.",
  });
}

/**
 * The subscription ended.
 *
 * The single most important thing to say is what did *not* happen: nothing was
 * deleted. Someone cancelling a planner is worried about their data, and a mail
 * that only says "sorry to see you go" answers the wrong question.
 */
export function subscriptionEndedEmail(params: { url: string }): Email {
  return build("Your Cerno Team plan has ended", {
    preheader: "Your workspaces and tasks are all still here.",
    heading: "Your Team plan has ended",
    body: [
      "Nothing has been deleted. Your workspaces, their tasks and everyone in them are exactly as you left them, and you can still read and edit all of it.",
      "What changes: you can't create new workspaces until Team is active again. Everything personal is unaffected and stays free.",
    ],
    cta: { label: "Restart Team", url: params.url },
    footnote:
      "If you cancelled by mistake, restarting picks up where you left off — nothing was lost.",
  });
}

/**
 * The customer scheduled a cancellation — the plan is still active but will not
 * renew.
 *
 * Distinct from `subscriptionEndedEmail`, which is sent when the plan actually
 * lapses. This is the "you cancelled, here's what happens and when" note, so it
 * leads with the end date and the fact that nothing changes until then. Naming
 * the date is the point: a cancellation without one reads as "cut off now".
 */
export function subscriptionCancelScheduledEmail(params: {
  url: string;
  endsOn: string | null;
}): Email {
  const when = params.endsOn
    ? `on ${params.endsOn}`
    : "at the end of your billing period";

  return build("Your Cerno Team plan is set to end", {
    preheader: `Team stays active until ${
      params.endsOn ?? "your period ends"
    }. Nothing is deleted.`,
    heading: "Your Team plan is winding down",
    body: [
      `You've cancelled Cerno Team. It stays fully active until ${when}, so nothing changes before then — your workspaces, their tasks and everyone in them stay exactly as they are.`,
      "After that you can still read and edit everything; you just can't create new workspaces until Team is active again. Everything personal stays free.",
    ],
    cta: { label: "Keep Team", url: params.url },
    footnote:
      "Changed your mind? Reactivating before the end date keeps everything running without interruption.",
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
