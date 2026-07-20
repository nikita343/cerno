import Link from "next/link";

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
      <Link href="/" className={styles.back}>
        Cerno
      </Link>
      {children}
    </main>
  );
}
