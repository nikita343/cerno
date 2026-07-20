import type { User } from "@supabase/supabase-js";

import { DEMO_USER } from "./fixtures";
import type { UserProfile } from "./types";

/**
 * Derives the display profile from a Supabase user.
 *
 * Google gives us `full_name` and often `name`; an email signup gives us
 * neither, so the local part of the address stands in. Initials come from
 * whichever name we ended up with.
 */
export function toProfile(user: User | null): UserProfile {
  // Only reached when Supabase isn't configured — keeps the shell renderable
  // in a local dev environment with no backend.
  if (!user) return DEMO_USER;

  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const rawName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email.split("@")[0] ||
    "You";

  // Strip separators an email local part might carry ("ada.lovelace" -> "ada lovelace").
  const name = rawName.replace(/[._-]+/g, " ").trim();

  return {
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    email,
    initials: initialsFrom(name),
  };
}

function initialsFrom(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
