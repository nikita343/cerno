import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Plan · Cerno" };

export default function PlanSettingsPage() {
  return <SettingsView section="plan" />;
}
