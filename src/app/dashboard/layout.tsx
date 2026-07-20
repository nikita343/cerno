import { redirect } from "next/navigation";

import { UserProvider } from "@/components/auth/UserProvider";
import { AppShell } from "@/components/shell/AppShell";
import { todayISO } from "@/lib/date";
import { loadDashboard } from "@/lib/supabase/data";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient, getUser } from "@/lib/supabase/server";
import { toProfile } from "@/lib/user";
import { buildInitialData, type InitialData } from "@/store/createAppStore";
import { StoreProvider } from "@/store/StoreProvider";

/**
 * Rendered per request. The shell computes "today" on the server, so a
 * statically prerendered page would ship whatever date the build ran on.
 */
export const dynamic = "force-dynamic";

/**
 * The authenticated app shell.
 *
 * Middleware already redirects anonymous requests away from /dashboard, but
 * this check is not redundant: middleware can be bypassed by configuration
 * mistakes in the matcher, and defence for a data-bearing route belongs next to
 * the data. Two cheap checks are better than one clever one.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = hasSupabaseConfig() ? await getUser() : null;
  if (hasSupabaseConfig() && !user) redirect("/login");

  const today = todayISO();

  // Server-rendered so the first paint already has the real plan in it — no
  // spinner, no loading flash, no layout shift. The client re-anchors the date
  // after mount in case the tab was left open overnight.
  let initialData: InitialData;
  if (user) {
    const supabase = await createClient();
    const data = await loadDashboard(supabase, today);
    initialData = { today, ...data };
  } else {
    // No backend configured. Fixtures keep the shell explorable in a keyless
    // dev environment; nothing here is reachable once Supabase is set up,
    // because the redirect above fires first.
    initialData = buildInitialData(today);
  }

  return (
    <UserProvider profile={toProfile(user)}>
      <StoreProvider initialData={initialData}>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </UserProvider>
  );
}
