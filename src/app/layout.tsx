import type { Metadata, Viewport } from "next";
import { Funnel_Sans } from "next/font/google";

import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

import "./globals.css";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-funnel-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cerno — AI daily planner",
  description:
    "Dump everything on your mind. Cerno turns it into a realistic day — scheduling what fits and parking the rest with a reason.",
};

/**
 * Rendered per request, not at build time. The shell computes "today" on the
 * server, so a statically prerendered page would ship whatever date the build
 * ran on and go stale the next day.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /*
   * The on-screen keyboard shrinks the layout viewport instead of just sliding
   * the visible area around. Without this, a bottom-anchored sheet keeps its
   * full height when the keyboard opens and its footer — the Save button — sits
   * behind the keyboard with nothing to scroll.
   *
   * This is also what makes the `dvh` heights on those sheets mean anything.
   * Chromium honours it; Safari does not yet, so the sheets still cap their
   * height rather than relying on it alone.
   *
   * Note this is *not* `maximum-scale`/`user-scalable=no`. Those would also
   * stop iOS zooming on focus, by breaking pinch-zoom for everyone.
   */
  interactiveWidget: "resizes-content",
};

/**
 * Applies the stored theme before first paint.
 *
 * The server always renders the default theme, so without this a user who
 * chose dark would see a light flash on every navigation. This runs
 * synchronously in <head>, ahead of any rendering, and only ever sets an
 * attribute — so the server and client markup still match.
 */
const NO_FLASH_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (t === "dark" || t === "light") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;

/**
 * Root layout: document shell and theme only.
 *
 * The app chrome (store provider, sidebar, tab bar) lives in the /dashboard
 * layout instead, so the landing and auth pages render without it — they have
 * no store to read and no navigation to show.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* The no-flash script below rewrites data-theme before React hydrates, so a
       dark-theme user's DOM deliberately disagrees with this server-rendered
       attribute. That is the whole point of the script — suppress the warning
       here rather than give up the pre-paint theme. Scoped to this element:
       nothing inside it is exempted. */
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={funnelSans.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
