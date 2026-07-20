import { redirect } from "next/navigation";

import { UserProvider } from "@/components/auth/UserProvider";
import { AppShell } from "@/components/shell/AppShell";
import { todayISO } from "@/lib/date";
import { loadDashboard, seedDefaultLabels } from "@/lib/supabase/data";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient, getUser } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS } from "@/lib/types";
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
    try {
      const data = await loadDashboard(supabase, today);

      // A user with no labels is either brand new or predates this feature.
      // Seeding here rather than from a signup trigger covers both, since a
      // trigger could only ever fire for accounts created after it existed.
      let labels = data.labels;
      if (labels.length === 0) {
        try {
          labels = (await seedDefaultLabels(supabase, user.id)) ?? [];
        } catch (error) {
          // Non-fatal: the planner falls back to the default taxonomy, so the
          // app works. Only the Labels list looks empty.
          console.error("[dashboard] label seed failed", error);
        }
      }

      initialData = { today, ...data, labels, userId: user.id };
    } catch (error) {
      // A failed read must not take down the whole app. The shell still
      // renders and the user can capture a dump; the alternative is Next's
      // generic error page, which offers nothing but a reload button.
      console.error("[dashboard] initial load failed", error);
      initialData = {
        today,
        tasks: [],
        dayPlans: {},
        dumps: [],
        labels: [],
        settings: DEFAULT_SETTINGS,
        userId: user.id,
      };
    }
  } else {
    // No backend configured. Fixtures keep the shell explorable in a keyless
    // dev environment; nothing here is reachable once Supabase is set up,
    // because the redirect above fires first.
    initialData = buildInitialData(today);
  }

  // Settings win over the auth profile: a name or photo set in Settings is an
  // explicit choice, and the provider's values are only ever a starting point.
  const profile = toProfile(user, initialData.settings);

  return (
    <UserProvider profile={profile}>
      <StoreProvider initialData={initialData}>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </UserProvider>
  );
}
