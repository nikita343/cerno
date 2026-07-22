import Link from "next/link";

import { Logo } from "@/components/brand/Logo";

import styles from "./auth.module.css";

/**
 * Centred single-card layout for /login and /signup.
 *
 * A route group, so the URLs stay /login and /signup — the middleware's
 * AUTH_ROUTES list matches on those exact paths.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back} aria-label="Cerno home">
        <Logo size={24} />
      </Link>
      {children}
    </main>
  );
}
