import "server-only";

/**
 * Cerno's email shell.
 *
 * ---------------------------------------------------------------------------
 * Email is not the web. Read this before "improving" the markup.
 * ---------------------------------------------------------------------------
 *
 * Every constraint below is a client that will break otherwise:
 *
 *   - TABLES, NOT FLEX OR GRID. Outlook on Windows renders through Word's
 *     engine, which supports neither. A flex row silently stacks.
 *   - INLINE STYLES. Gmail strips <style> blocks in several contexts, including
 *     the mobile apps and forwarded mail. Anything that must survive is on the
 *     element.
 *   - NO CSS VARIABLES. The app's tokens don't exist here, so the palette is
 *     duplicated below as literals. That duplication is deliberate — see
 *     PALETTE.
 *   - NO WEB FONTS. Most clients ignore @font-face; the stack falls back to
 *     whatever the OS has, so it is written to look intentional either way.
 *   - NO EXTERNAL IMAGES. Almost every client blocks remote images until the
 *     reader clicks "show images", so a logo <img> is an empty box on first
 *     open. The mark here is drawn with a styled table cell instead, which
 *     always renders.
 *   - 600px MAX. The width every client has handled since Outlook 2007.
 *
 * A plain-text alternative is not optional: `send.ts` requires one. Sending
 * HTML alone is a strong spam signal and unreadable in text-only clients.
 */

/**
 * The brand, restated as literals.
 *
 * Kept in step with `globals.css` by hand. Importing the CSS is not possible —
 * these have to be inlined into a string at send time — and a build step to
 * extract them would be more machinery than six colours justify.
 */
const PALETTE = {
  accent: "#ff003d",
  onAccent: "#ffffff",
  bg: "#fafaf9",
  surface: "#ffffff",
  border: "#e7e5e4",
  text: "#1c1917",
  textMuted: "#78716c",
  textFaint: "#a8a29e",
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Absolute URL of the logo, served from `public/Logo.png`.
 *
 * Email needs an absolute HTTPS URL — a relative path has no origin in an inbox
 * — and most clients block remote images until the reader clicks "show images",
 * so the `<img>` carries `alt="Cerno"` and the whole thing is wrapped so the
 * word "Cerno" still reads when the picture doesn't load. Point it at the
 * canonical host; a preview deploy's logo simply won't render, which is fine
 * because real mail is sent from production.
 */
const LOGO_URL =
  (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://www.usecerno.xyz") + "/Logo.png";

/** Escapes text interpolated into HTML. Every caller passes user-supplied data. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  /** Shown in the inbox list under the subject, before the body is opened. */
  preheader: string;
  heading: string;
  /** Paragraphs, in order. Escaped for you. */
  body: string[];
  cta?: { label: string; url: string };
  /** Small print under the button — the "if you weren't expecting this" line. */
  footnote?: string;
}

export function renderEmail(content: EmailContent): string {
  const { preheader, heading, body, cta, footnote } = content;

  const paragraphs = body
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${PALETTE.text};">${escapeHtml(text)}</p>`,
    )
    .join("");

  // Bulletproof button: a table cell with the background, not a styled <a>.
  // Outlook ignores padding and background on inline elements, so a plain
  // anchor renders as bare blue underlined text.
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
         <tr>
           <td align="center" bgcolor="${PALETTE.accent}" style="border-radius:10px;">
             <a href="${escapeHtml(cta.url)}"
                style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${PALETTE.onAccent};text-decoration:none;border-radius:10px;">
               ${escapeHtml(cta.label)}
             </a>
           </td>
         </tr>
       </table>
       <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${PALETTE.textFaint};word-break:break-all;">
         Or paste this into your browser:<br />${escapeHtml(cta.url)}
       </p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.bg};">
<!-- Preheader: shown in the inbox preview, hidden in the body. The trailing
     entities stop clients padding the preview with the first line of markup. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <!-- wordmark: the logo image, with the drawn mark + name as the
             fallback clients see before "show images" is clicked. -->
        <tr>
          <td style="padding:0 4px 20px;font-family:${FONT_STACK};">
            <img src="${LOGO_URL}" alt="Cerno" height="28" style="height:28px;width:auto;border:0;display:block;" />
          </td>
        </tr>

        <!-- card -->
        <tr>
          <td bgcolor="${PALETTE.surface}" style="padding:28px;border:1px solid ${PALETTE.border};border-radius:14px;font-family:${FONT_STACK};">
            <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:600;letter-spacing:-0.02em;color:${PALETTE.text};">
              ${escapeHtml(heading)}
            </h1>
            ${paragraphs}
            ${button}
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="padding:18px 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${PALETTE.textMuted};">
            ${footnote ? `<p style="margin:0 0 8px;">${escapeHtml(footnote)}</p>` : ""}
            <p style="margin:0;color:${PALETTE.textFaint};">Cerno &middot; an AI daily planner</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The plain-text alternative.
 *
 * Generated from the same content object rather than written twice, so the two
 * cannot drift — a text part that contradicts the HTML is worse than none.
 */
export function renderText(content: EmailContent): string {
  const lines = [content.heading, "", ...content.body];
  if (content.cta) lines.push("", `${content.cta.label}: ${content.cta.url}`);
  if (content.footnote) lines.push("", content.footnote);
  lines.push("", "Cerno - an AI daily planner");
  return lines.join("\n");
}
