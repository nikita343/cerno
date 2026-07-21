import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Calendar · Cerno" };

export default function CalendarSettingsPage() {
  return <SettingsView section="calendar" />;
}
