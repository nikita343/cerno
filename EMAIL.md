# Email

Cerno sends mail from two different places, and only one of them is our code.
That is why "I set up Resend but the confirmation email still comes from
Supabase" is the expected result rather than a bug.

| Email | Sent by | Template lives in |
| --- | --- | --- |
| Confirm your email address | **Supabase Auth** | Supabase dashboard |
| Reset password | **Supabase Auth** | Supabase dashboard |
| Magic link | **Supabase Auth** | Supabase dashboard |
| Welcome | Cerno | `src/lib/email/templates.ts` |
| Workspace invite | Cerno | `src/lib/email/templates.ts` |
| Team welcome | Cerno | `src/lib/email/templates.ts` |
| Payment issue | Cerno | `src/lib/email/templates.ts` |
| Subscription ended | Cerno | `src/lib/email/templates.ts` |

`RESEND_API_KEY` only affects the bottom five. Supabase Auth never sees it — it
sends through its own SMTP relay (`noreply@mail.app.supabase.io`), which is what
puts that sender in the inbox.

## Routing the auth emails through Resend

Supabase Auth will use any SMTP server you give it. Resend exposes one, so the
fix is configuration, not code.

1. **Resend → API Keys → Create.** Sending permission is enough. This can be the
   same key as `RESEND_API_KEY` or a separate one; a separate one is better,
   because revoking Supabase's access then doesn't take the app's mail down with
   it.
2. **Supabase → Project Settings → Authentication → SMTP Settings → Enable
   custom SMTP.**

   | Field | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the Resend API key |
   | Sender email | the same address as `EMAIL_FROM` |
   | Sender name | `Cerno` |

   Port 465 is implicit TLS. Use 587 only if 465 is blocked; `2465`/`2587` exist
   for hosts that block both.

3. **Send yourself a test signup.** The sender in the inbox is the check — it
   should now be your domain, not `mail.app.supabase.io`.

The sender address must be on the domain you verified in Resend. Resend rejects
anything else, and Supabase surfaces that rejection as a generic "error sending
confirmation email" at signup — so if signups start failing after this change,
the sender address is the first thing to check.

### Rate limits

Supabase's built-in relay is capped low (a handful of emails per hour) and is
documented as being for development only. Custom SMTP replaces that cap with
Resend's, which is the other reason to do this before launch — not just
branding.

## Branding the auth emails

They are edited separately, in **Supabase → Authentication → Email Templates**.
Our five templates share `src/lib/email/layout.ts`; the Supabase ones can't
import it, so keeping them consistent means pasting the same markup.

Two constraints carry over:

- **Inline styles and tables.** No flexbox, no grid, no `<style>` block you can
  rely on — Outlook drops or mangles all three.
- **No external images or web fonts.** Blocked by default in most clients, so
  anything load-bearing has to be text or a table cell with a background colour.

Supabase's template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`,
`{{ .SiteURL }}`) are Go template syntax and are not interchangeable with
anything in our templates.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Vercel + `.env.local` | Cerno's five emails |
| `EMAIL_FROM` | Vercel + `.env.local` | Sender, must be on the verified domain |
| `EMAIL_REPLY_TO` | optional | Where replies land, if not the sender |

Mail is optional by design: with none of these set, `hasEmailConfig()` is false
and every send is skipped rather than throwing. An invite whose email didn't go
out is still a valid invite — the link is copied to the clipboard regardless.
