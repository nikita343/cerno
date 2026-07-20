import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Cerno — AI daily planner",
  description:
    "Dump everything on your mind. Cerno turns it into a realistic day — scheduling what fits and parking the rest with a reason.",
};

export const dynamic = "force-dynamic";

/** The three claims the product actually makes, in the order it makes them. */
const STEPS = [
  {
    label: "Dump",
    body: "Type or speak everything on your mind. One long messy sentence is fine.",
  },
  {
    label: "Cerno reads it",
    body: "Splits it into tasks, estimates effort, weighs deadlines, picks the anchor.",
  },
  {
    label: "A day you can actually do",
    body: "What fits is scheduled by time. What doesn't is parked, with a reason.",
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // An OAuth code can land here rather than on /auth/callback: when Supabase
  // is handed a redirectTo that isn't on its allowlist it silently discards it
  // and falls back to the project's Site URL, which is a bare origin. Without
  // this the code is dropped on the floor and sign-in appears to do nothing.
  //
  // Forward it to the real callback rather than duplicating the exchange.
  const code = typeof params.code === "string" ? params.code : null;
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  // Signed-in visitors have no use for the pitch.
  if (hasSupabaseConfig()) {
    const user = await getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          Cerno
        </span>
        <nav className={styles.navActions}>
          <Link href="/login" className={styles.navLink}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.navCta}>
            Get started
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>AI daily planner</p>
        <h1 className={styles.title}>
          Everything on your mind,
          <br />
          turned into a day that fits.
        </h1>
        <p className={styles.lede}>
          Most planners give you an empty list and let you overcommit. Cerno
          reads the mess, estimates what each thing really costs, and tells you
          what won&rsquo;t fit — before the day does it for you.
        </p>
        <div className={styles.heroActions}>
          <Link href="/signup" className={styles.primary}>
            Start planning
          </Link>
          <Link href="/login" className={styles.secondary}>
            I have an account
          </Link>
        </div>
      </section>

      <section className={styles.steps} aria-label="How it works">
        {STEPS.map((step, i) => (
          <article key={step.label} className={styles.step}>
            <span className={styles.stepIndex}>{String(i + 1).padStart(2, "0")}</span>
            <h2 className={styles.stepLabel}>{step.label}</h2>
            <p className={styles.stepBody}>{step.body}</p>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <span>Cerno</span>
        <span className={styles.footerNote}>
          Your plan, your data — every row scoped to your account.
        </span>
      </footer>
    </main>
  );
}
