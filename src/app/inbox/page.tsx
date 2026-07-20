import type { Metadata } from "next";

import { InboxView } from "@/components/views/InboxView";

export const metadata: Metadata = { title: "Inbox · Cerno" };

export default function InboxPage() {
  return <InboxView />;
}
