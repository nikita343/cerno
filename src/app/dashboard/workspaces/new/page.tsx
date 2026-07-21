import type { Metadata } from "next";

import { NewWorkspaceView } from "@/components/views/NewWorkspaceView";

export const metadata: Metadata = { title: "New workspace · Cerno" };

export default function NewWorkspacePage() {
  return <NewWorkspaceView />;
}
