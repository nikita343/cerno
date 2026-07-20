"use client";

import { createContext, useContext } from "react";

import type { UserProfile } from "@/lib/types";

/**
 * The signed-in user's display profile.
 *
 * Resolved once on the server in the dashboard layout and passed down, rather
 * than re-fetched in each of the three places that show an avatar. Nothing here
 * is authorization — it is the name and initials on screen. Access decisions
 * live in middleware and in RLS.
 */
const UserContext = createContext<UserProfile | null>(null);

export function UserProvider({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={profile}>{children}</UserContext.Provider>;
}

export function useUser(): UserProfile {
  const profile = useContext(UserContext);
  if (!profile) {
    throw new Error("useUser must be used inside <UserProvider>.");
  }
  return profile;
}
