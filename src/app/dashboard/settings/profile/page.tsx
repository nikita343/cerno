import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Profile · Cerno" };

export default function ProfileSettingsPage() {
  return <SettingsView section="profile" />;
}
