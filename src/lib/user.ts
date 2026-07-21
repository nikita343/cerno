import type { User } from "@supabase/supabase-js";

import { DEMO_USER } from "./fixtures";
import type { UserProfile, UserSettings } from "./types";

/**
 * Derives the display profile from a Supabase user and their settings.
 *
 * Google gives us `full_name` and often `name`; an email signup gives us
 * neither, so the local part of the address stands in. Initials come from
 * whichever name we ended up with.
 *
 * Settings take precedence over both: a display name or avatar chosen in
 * Settings is a deliberate override, and letting the provider's values win
 * would make the Settings form appear to save and then do nothing.
 */
export function toProfile(
  user: User | null,
  settings?: Pick<UserSettings, "display_name" | "avatar_url">,
): UserProfile {
  // Only reached when Supabase isn't configured — keeps the shell renderable
  // in a local dev environment with no backend.
  if (!user) return DEMO_USER;

  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const rawName =
    settings?.display_name?.trim() ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email.split("@")[0] ||
    "You";

  // Strip separators an email local part might carry ("ada.lovelace" -> "ada lovelace").
  const name = rawName.replace(/[._-]+/g, " ").trim();

  const providerPhoto =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  return {
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    email,
    initials: initialsFrom(name),
    avatarUrl: settings?.avatar_url ?? providerPhoto,
  };
}

function initialsFrom(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A workspace member as an avatar-shaped profile.
 *
 * The roster RPC already resolves name and photo with the same precedence as
 * `toProfile` (see 0008_member_identity.sql), so this is only reshaping — but
 * it means `<Avatar>` renders a teammate exactly as it renders you, initials
 * fallback and all, instead of the roster hand-rolling its own circle.
 */
export function memberProfile(member: {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}): UserProfile {
  const raw = member.display_name?.trim() || member.email?.split("@")[0] || "";
  // Same tidy-up as toProfile: "ada.lovelace" reads better as "Ada Lovelace".
  const name = raw.replace(/[._-]+/g, " ").trim();
  const titled = name.replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: titled || "Pending",
    email: member.email ?? "",
    initials: initialsFrom(name || "?"),
    avatarUrl: member.avatar_url,
  };
}
