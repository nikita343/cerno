import { SettingsShell } from "@/components/views/settings/SettingsShell";

/**
 * Wraps every Settings section with its nav.
 *
 * A layout rather than a component each page renders: the nav then survives
 * navigation between sections instead of unmounting and remounting, so moving
 * from Profile to Plan doesn't flash the whole sidebar.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsShell>{children}</SettingsShell>;
}
