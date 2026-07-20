import type { Metadata } from "next";

import { TodayView } from "@/components/views/TodayView";

export const metadata: Metadata = { title: "Today · Cerno" };

export default function TodayPage() {
  return <TodayView />;
}
