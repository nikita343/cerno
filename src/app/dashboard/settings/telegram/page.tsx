import type { Metadata } from "next";

import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Telegram · Cerno" };

export default function TelegramSettingsPage() {
  return <SettingsView section="telegram" />;
}
