import type { Metadata } from "next";

import { WorkspaceListView } from "@/components/views/WorkspaceListView";

export const metadata: Metadata = { title: "Workspaces · Cerno" };

/**
 * Where the Workspaces tab lands.
 *
 * A list rather than a redirect into the first workspace: on a phone this is
 * the only way to move between them, since the sidebar that lists them by name
 * isn't there.
 */
export default function WorkspacesPage() {
  return <WorkspaceListView />;
}
