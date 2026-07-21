import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Language · Cerno" };

export default function LanguageSettingsPage() {
  return <SettingsView section="language" />;
}
