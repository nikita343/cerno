import { ViewSkeleton } from "@/components/shell/ViewSkeleton";

/**
 * Suspense boundary for every screen under /dashboard.
 *
 * Next renders this *inside* the dashboard layout, so the shell — sidebar, tab
 * bar, header — is already on screen and only the content column is standing
 * in. It also lets the router prefetch this boundary for each nav link, which
 * is what turns a tap into an immediate response instead of a pause on a dead
 * screen while the segment is fetched.
 *
 * It does not cover the layout's own data load. That await happens above this
 * boundary, so a cold first paint still waits for it — the fix there is to
 * stream the shell separately, which the store's shape doesn't currently allow.
 */
export default function DashboardLoading() {
  return <ViewSkeleton />;
}
