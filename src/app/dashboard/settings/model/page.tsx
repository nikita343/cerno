import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Model · Cerno" };

export default function ModelSettingsPage() {
  return <SettingsView section="model" />;
}
