# Branded Supabase Auth emails

These are the sign-up / magic-link / reset emails **Supabase Auth** sends. They
are separate from Cerno's own five emails (`src/lib/email/`), which already look
like this — Supabase's can't import that code, so the markup is duplicated here
to match.

Getting a branded email in the inbox is **two settings**, and they're
independent — doing one without the other is why you still see an unbranded
message:

## 1. Branding (the look) — paste these templates

Supabase → **Authentication → Email Templates**. For each tab, switch to the
HTML/source view and replace the body with the matching file:

| Supabase template | File |
| --- | --- |
| Confirm signup | `confirm-signup.html` |
| Magic Link | `magic-link.html` |
| Reset Password | `reset-password.html` |

`{{ .ConfirmationURL }}` is Supabase's own variable — leave it exactly as-is,
never escape or wrap it. (Other Supabase variables, if you want them:
`{{ .Token }}`, `{{ .SiteURL }}`, `{{ .Email }}`.)

## 2. Sender (the "from") — custom SMTP

Even with branded HTML, the **sender** is still `noreply@mail.app.supabase.io`
until you point Supabase's SMTP at Resend. Without this, the mail also stays on
Supabase's tiny dev rate limit. Full steps are in `../../EMAIL.md` → "Routing the
auth emails through Resend" — in short:

Supabase → **Project Settings → Authentication → SMTP Settings → Enable custom
SMTP**, host `smtp.resend.com`, port `465`, user `resend`, password = a Resend
API key, sender = an address on your verified domain.

## Check it

Trigger a real signup and look at the inbox: the sender should be your domain
(not `mail.app.supabase.io`) **and** the message should carry the Cerno card and
red mark. If the look is right but the sender is still Supabase, you did step 1
but not step 2.
