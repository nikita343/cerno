import type { Metadata } from "next";

import { WorkspaceSettingsView } from "@/components/views/WorkspaceSettingsView";

export const metadata: Metadata = { title: "Workspace settings · Cerno" };

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkspaceSettingsView workspaceId={id} />;
}
