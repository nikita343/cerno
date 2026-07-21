import type { Metadata } from "next";

import { SettingsIndex } from "@/components/views/settings/SettingsIndex";

export const metadata: Metadata = { title: "Settings · Cerno" };

/**
 * The Settings index.
 *
 * On a phone this is the menu — tap a row, get that section. On a desktop the
 * nav is always visible in the layout beside the content, so the index instead
 * shows the first section directly rather than a menu that duplicates it.
 */
export default function SettingsPage() {
  return <SettingsIndex />;
}
