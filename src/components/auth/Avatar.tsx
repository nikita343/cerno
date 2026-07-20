"use client";

import { useEffect, useState } from "react";

import type { UserProfile } from "@/lib/types";

import styles from "./Avatar.module.css";

/**
 * The user's photo, falling back to their initials.
 *
 * A plain `<img>`, not `next/image`: avatars come from Supabase Storage under a
 * project-specific hostname, and configuring a remote pattern for it would put
 * the deployment's Supabase URL into `next.config` where it can't read an env
 * var at request time.
 *
 * `size` is a CSS length so callers can size it in the same units as the
 * surrounding layout.
 */
export function Avatar({
  profile,
  size = "2.375rem",
  className,
}: {
  profile: Pick<UserProfile, "initials" | "avatarUrl" | "name">;
  size?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // A new upload replaces the URL; without this the previous image's error
  // state would persist and permanently show initials instead.
  useEffect(() => {
    setFailed(false);
  }, [profile.avatarUrl]);

  const showImage = Boolean(profile.avatarUrl) && !failed;

  return (
    <span
      className={`${styles.avatar} ${className ?? ""}`}
      style={{ width: size, height: size }}
      data-image={showImage || undefined}
    >
      {showImage ? (
        <img
          src={profile.avatarUrl as string}
          alt=""
          className={styles.image}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        profile.initials
      )}
    </span>
  );
}
