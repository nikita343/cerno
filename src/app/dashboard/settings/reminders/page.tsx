import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Reminders · Cerno" };

export default function RemindersSettingsPage() {
  return <SettingsView section="reminders" />;
}
