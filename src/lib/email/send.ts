import "server-only";

import { Resend } from "resend";

import type { Email } from "./templates";

/**
 * Sending, via Resend.
 *
 * Server-only and lazy: the app must build and boot with no mail configured,
 * and every caller treats a failure to send as non-fatal. An invite whose email
 * didn't go out is still a valid invite — the link exists and can be copied by
 * hand — so a mail outage must never fail the action that triggered it.
 */

let client: Resend | null = null;

export function hasEmailConfig(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  client ??= new Resend(key);
  return client;
}

export interface SendResult {
  sent: boolean;
  /** Why not, for logs and for dev-only surfacing. Never shown in production. */
  reason?: string;
}

export async function sendEmail(to: string, email: Email): Promise<SendResult> {
  if (!hasEmailConfig()) return { sent: false, reason: "not configured" };

  try {
    const { error } = await resend().emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: email.subject,
      html: email.html,
      // Both parts, always. HTML-only mail is a strong spam signal and is
      // unreadable in text-only clients and some screen-reader setups.
      text: email.text,
      ...(process.env.EMAIL_REPLY_TO
        ? { replyTo: process.env.EMAIL_REPLY_TO }
        : {}),
    });

    if (error) {
      // Resend's message can name the domain, the key or the recipient. Logged,
      // never returned to the browser in production.
      console.error("[email] send failed", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (caught) {
    console.error("[email] send threw", caught);
    return {
      sent: false,
      reason: caught instanceof Error ? caught.message : "unknown",
    };
  }
}
