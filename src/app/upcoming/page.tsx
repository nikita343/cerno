import type { Metadata } from "next";

import { UpcomingView } from "@/components/views/UpcomingView";

export const metadata: Metadata = { title: "Upcoming · Cerno" };

export default function UpcomingPage() {
  return <UpcomingView />;
}
