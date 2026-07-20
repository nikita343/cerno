import type { Metadata, Viewport } from "next";
import { Funnel_Sans } from "next/font/google";

import { AppShell } from "@/components/shell/AppShell";
import { todayISO } from "@/lib/date";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
import { buildInitialData } from "@/store/createAppStore";
import { StoreProvider } from "@/store/StoreProvider";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-rendered so the first paint already has a real plan in it — no
  // spinner, no layout shift. The client re-anchors the date after mount.
  const initialData = buildInitialData(todayISO());

  return (
    <html lang="en" data-theme={DEFAULT_THEME} className={funnelSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <StoreProvider initialData={initialData}>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
