import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

/**
 * Resend inbound-email webhook.
 *
 * When mail arrives at a receiving address on the domain (e.g.
 * privacy@usecerno.xyz once Receiving is enabled in Resend), Resend POSTs the
 * parsed message here. We verify the Svix signature, then forward it to a
 * monitored inbox so a human can read and reply.
 *
 * Env:
 *   RESEND_INBOUND_SECRET  the webhook signing secret from Resend (whsec_…).
 *                          If unset, verification is skipped (dev only).
 *   INBOUND_FORWARD_TO     where to forward received mail (e.g. your Gmail).
 *                          If unset, the message is only logged.
 *   RESEND_API_KEY, EMAIL_FROM  reused for the outbound forward.
 */
export const runtime = "nodejs";

/** Verify a Svix-signed webhook (the scheme Resend uses). */
function verifySignature(
  secret: string,
  req: NextRequest,
  payload: string,
): boolean {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");

  // The header is a space-separated list of `v1,<base64sig>` entries.
  return signature.split(" ").some((part) => {
    const provided = part.split(",")[1];
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

interface InboundEmail {
  from?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
}

/** Pull a bare email address out of a "Name <addr@x>" string. */
function bareAddress(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

export async function POST(req: NextRequest) {
  const payload = await req.text();

  const secret = process.env.RESEND_INBOUND_SECRET;
  if (secret && !verifySignature(secret, req, payload)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: InboundEmail };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const mail = event.data ?? {};
  const forwardTo = process.env.INBOUND_FORWARD_TO;
  const from = process.env.EMAIL_FROM;
  const apiKey = process.env.RESEND_API_KEY;

  // Nothing to forward with — acknowledge so Resend doesn't retry, and log it.
  if (!forwardTo || !from || !apiKey) {
    console.log("[inbound] received", {
      type: event.type,
      from: mail.from,
      subject: mail.subject,
    });
    return NextResponse.json({ ok: true });
  }

  const sender = bareAddress(mail.from);
  const subject = `[Cerno inbox] ${mail.subject ?? "(no subject)"}`;
  const lead = `Forwarded from ${mail.from ?? "unknown"} — to: ${
    Array.isArray(mail.to) ? mail.to.join(", ") : mail.to ?? ""
  }`;

  try {
    await new Resend(apiKey).emails.send({
      from,
      to: forwardTo,
      subject,
      text: `${lead}\n\n${mail.text ?? "(no text body)"}`,
      html: mail.html
        ? `<p style="color:#6e6e75;font-size:13px">${lead}</p><hr/>${mail.html}`
        : undefined,
      // Reply goes straight to the original sender.
      ...(sender ? { replyTo: sender } : {}),
    });
  } catch (caught) {
    console.error("[inbound] forward failed", caught);
    // Still 200: a forward failure shouldn't make Resend hammer us with retries.
  }

  return NextResponse.json({ ok: true });
}
