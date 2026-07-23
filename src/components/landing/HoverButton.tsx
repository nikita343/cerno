import Link from "next/link";
import type { ReactNode } from "react";

import styles from "@/app/landing.module.css";

function ArrowIcon() {
  return (
    <svg
      className={styles.btnArrow}
      viewBox="0 0 91 91"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M26.6356 45.1126L61.3023 45.1126"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="square"
      />
      <path
        d="M45.3022 26.4463L63.9689 45.113L45.3022 63.7796"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * A link/button whose label rolls over on hover: two stacked copies of the
 * text inside a one-line clipped window slide up 100% together, so the second
 * copy takes the first's place. `arrow` adds the animated chevron. `variant`
 * distinguishes the pill buttons (`solid`) from inline text links (`text`),
 * where the arrow slides in from nothing instead of nudging.
 *
 * Pure markup — the motion is entirely CSS — so it is safe in both server and
 * client trees.
 */
export function HoverButton({
  href,
  className,
  children,
  arrow = false,
  variant = "solid",
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  arrow?: boolean;
  variant?: "solid" | "text";
  onClick?: () => void;
}) {
  const cls = [
    styles.hoverBtn,
    variant === "text" ? styles.hoverBtnText : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className={styles.btnText}>
        <span className={styles.btnLabel}>{children}</span>
        <span
          className={`${styles.btnLabel} ${styles.btnLabelClone}`}
          aria-hidden="true"
        >
          {children}
        </span>
      </span>
      {arrow && <ArrowIcon />}
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} onClick={onClick}>
      {inner}
    </Link>
  );
}

export default HoverButton;
