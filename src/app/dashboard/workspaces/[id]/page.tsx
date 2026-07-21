import type { Metadata } from "next";

import { WorkspaceView } from "@/components/views/WorkspaceView";

export const metadata: Metadata = { title: "Workspace · Cerno" };

/**
 * `params` is a Promise in Next 15 — awaiting it is required, not optional.
 *
 * No data is fetched here: workspaces are already in the store from the
 * dashboard layout, so the view reads the one it needs. A second server read
 * would duplicate a query the layout has already paid for.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkspaceView workspaceId={id} />;
}
