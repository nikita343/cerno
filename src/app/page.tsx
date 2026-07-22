import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo, LogoMark } from "@/components/brand/Logo";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

import addTaskImg from "@/assets/addnewtaskwithai.png";
import upcomingImg from "@/assets/upcoming.png";
import inboxImg from "@/assets/inbox.png";
import dragImg from "@/assets/draganddrop.png";
import filtersImg from "@/assets/filterslabels.png";
import notificationsImg from "@/assets/notifications.png";
import teamImg from "@/assets/workspaceteam.png";

import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Cerno — AI daily planner",
  description:
    "Dump everything on your mind. Cerno reads the mess, estimates what each thing costs, and hands you one realistic day — scheduling what fits and parking the rest with a reason.",
};

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Content — the source of truth is FEATURES.md.                              */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Dump it all",
    body: "Type or speak everything on your mind. One long, messy sentence is fine — no fields, no tags, no formatting.",
  },
  {
    n: "02",
    title: "Cerno plans",
    body: "It splits the pile into tasks, estimates effort, weighs deadlines, and lays a realistic day on the clock.",
  },
  {
    n: "03",
    title: "Do the day",
    body: "What fits is scheduled by time. What doesn't is parked for tomorrow — always with a reason you can read.",
  },
];

interface Feature {
  eyebrow: string;
  title: string;
  body: string;
  image: StaticImageData;
  alt: string;
}

const FEATURES: Feature[] = [
  {
    eyebrow: "Capture",
    title: "One box. It untangles the rest.",
    body: "Write or speak a stream of everything you owe the day. Cerno turns it into titled tasks, each with a priority, an effort estimate, a deadline and a one-line reason — no key required to try it.",
    image: addTaskImg,
    alt: "Cerno parsing a brain dump into structured tasks",
  },
  {
    eyebrow: "The plan",
    title: "A realistic day, not a wish list.",
    body: "A capacity guard runs after the model: anything that pushes past your working hours is moved to tomorrow, whatever it was labelled. The top of Today explains the shape of the day in one honest line.",
    image: upcomingImg,
    alt: "A day laid on a clock, bucketed into morning, afternoon and evening",
  },
  {
    eyebrow: "Inbox",
    title: "Nothing waits without a reason.",
    body: "Whatever Cerno parses but doesn't schedule lands in the inbox, each row showing why it wasn't planned — and a single tap to put it on today.",
    image: inboxImg,
    alt: "The inbox, each task showing Cerno's reasoning",
  },
  {
    eyebrow: "Drag & drop",
    title: "Move anything, anywhere.",
    body: "Drag a task to another day, drop it into a time block, or postpone it to tomorrow. On a phone, press-and-hold — it never fights the swipe.",
    image: dragImg,
    alt: "Dragging a task between days and time blocks",
  },
  {
    eyebrow: "Labels & filters",
    title: "Tags and views that build themselves.",
    body: "Cerno labels new tasks automatically — errand, comms, health, work. Filter by priority, deadline or label; search scans titles, labels and reasoning.",
    image: filtersImg,
    alt: "Smart labels and filtered views",
  },
  {
    eyebrow: "Reminders",
    title: "Nudges only when they count.",
    body: "The bell collects what's overdue and what's coming up within your lead time. Overdue warnings don't dismiss — they clear when the task is done or moved.",
    image: notificationsImg,
    alt: "The notification bell with overdue and upcoming reminders",
  },
  {
    eyebrow: "Teams",
    title: "One shared day for the team.",
    body: "A workspace is a shared list — up to 10 people. Assign tasks to teammates, invite by email or link, and let roles keep it tidy. You pay; the people you invite don't.",
    image: teamImg,
    alt: "A shared workspace with assigned tasks",
  },
];

const MORE = [
  { title: "Calendar feed", body: "Subscribe from Google, Apple or Outlook. A private, revocable iCal link." },
  { title: "Your model", body: "Plan with Claude or GPT — your choice, stored as a preference." },
  { title: "English & Ukrainian", body: "The whole app, in either language, switchable any time." },
  { title: "Private by design", body: "Every row is scoped to your account by the database, not the interface." },
];

const FREE_POINTS = [
  "Unlimited personal tasks",
  "AI plans your day from a brain dump",
  "Calendar feed for Google & Apple",
  "Overdue & upcoming reminders",
];
const TEAM_POINTS = [
  "Shared workspaces, up to 10 people",
  "Assign tasks to teammates",
  "You pay; the people you invite don't",
];

const FAQ = [
  {
    q: "Do I have to organise anything?",
    a: "No. Dump it in any order and Cerno does the sorting — priority, effort, timing and what to leave for tomorrow.",
  },
  {
    q: "What if the plan is wrong?",
    a: "It's your day. Drag anything to another day or time, edit a task, or just dump again — the plan rebuilds around what you change.",
  },
  {
    q: "Is my data private?",
    a: "Every task, label and workspace is scoped to your account by the database itself, not the interface. The calendar link is a revocable credential you can kill any time.",
  },
  {
    q: "Do I need a credit card?",
    a: "No. Free is free forever. Team is $12 a month when you want a shared list — and the people you invite never pay.",
  },
  {
    q: "Can my team use it?",
    a: "Yes — a workspace is a shared day for up to 10 people, with assignees, roles and email or link invites.",
  },
  {
    q: "Does it work in Ukrainian?",
    a: "Yes, the entire app. Switch language in Settings any time.",
  },
];

/* -------------------------------------------------------------------------- */

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // An OAuth code can land here rather than on /auth/callback when Supabase
  // discards a redirectTo that isn't on its allowlist and falls back to the
  // bare Site URL. Forward it rather than dropping sign-in on the floor.
  const code = typeof params.code === "string" ? params.code : null;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);

  if (hasSupabaseConfig()) {
    const user = await getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <div className={styles.page}>
      <LandingMotion />
      {/* ------------------------------------------------------------- nav */}
      <header className={styles.nav} data-nav>
        <Link href="#top" className={styles.navBrand} aria-label="Cerno">
          <Logo size={26} />
        </Link>
        <nav className={styles.navLinks}>
          <a href="#how">how it works</a>
          <a href="#features">features</a>
          <a href="#plans">plans</a>
          <a href="#faq">faq</a>
        </nav>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navSignIn}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.navCta}>
            Get started
          </Link>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section id="top" className={styles.hero} data-hero>
        <span className={styles.heroDot} aria-hidden="true" data-floating-dot />
        <span className={styles.heroDotSecondary} aria-hidden="true" data-floating-dot />
        <span className={styles.heroDotTertiary} aria-hidden="true" data-floating-dot />
        <div className={styles.heroCopy} data-hero-copy>
          <p className={styles.eyebrow}>AI daily planner</p>
          <h1 className={styles.title}>
            plan the day.
            <br />
            <span className={styles.accent}>not</span> the list.
          </h1>
          <p className={styles.lede}>
            Dump everything on your mind. Cerno decides what matters, estimates
            the effort, and hands you one realistic day — in order, with the
            rest quietly parked.
          </p>
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.primary}>
              Start planning
            </Link>
            <a href="#how" className={styles.textLink}>
              see how it works →
            </a>
          </div>
        </div>

        <div className={styles.heroMedia} data-hero-media>
          <div className={styles.frame}>
            <div className={styles.frameBar}>
              <span />
              <span />
              <span />
              <em>cerno.app / today</em>
            </div>
            <Image
              src={upcomingImg}
              alt="Cerno — your planned day, laid on a clock"
              className={styles.frameShot}
              priority
              sizes="(max-width: 900px) 100vw, 620px"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ statement */}
      <section className={styles.statement}>
        <p data-statement-text>
          A to-do list only ever grows. Cerno reads the pile, weighs urgency
          against effort, and protects your day from itself — so you{" "}
          <span className={styles.accent}>finish</span>, instead of scrolling.
        </p>
      </section>

      {/* --------------------------------------------------- how it works */}
      <section id="how" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            three moves.
            <br />
            one calm day.
          </h2>
        </div>
        <div className={styles.steps}>
          {STEPS.map((step) => (
            <article key={step.n} className={styles.step} data-reveal>
              <span className={styles.stepN}>{step.n}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- features */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            quiet on the surface.
            <br />
            decisive underneath.
          </h2>
        </div>

        <div className={styles.featureList}>
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className={styles.feature}
              data-flip={i % 2 === 1 || undefined}
            >
              <div className={styles.featureCopy} data-reveal>
                <span className={styles.featureEyebrow}>{f.eyebrow}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureBody}>{f.body}</p>
              </div>
              <div className={styles.featureMedia} data-reveal>
                <div className={styles.shotFrame}>
                  <Image
                    src={f.image}
                    alt={f.alt}
                    className={styles.shot}
                    sizes="(max-width: 900px) 100vw, 560px"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.moreGrid}>
          {MORE.map((m) => (
            <div key={m.title} className={styles.moreCard}>
              <h4 className={styles.moreTitle}>{m.title}</h4>
              <p className={styles.moreBody}>{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- plans */}
      <section id="plans" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>simple, honest pricing.</h2>
          <p className={styles.sectionLede}>
            Everything personal is free, forever. Pay only when you want a shared
            day with your team.
          </p>
        </div>

        <div className={styles.plans}>
          <div className={styles.plan} data-reveal>
            <div className={styles.planHead}>
              <span className={styles.planName}>Free</span>
            </div>
            <div className={styles.planPrice}>
              <span className={styles.planAmount}>$0</span>
              <span className={styles.planPer}>/ month</span>
            </div>
            <ul className={styles.planPoints}>
              {FREE_POINTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link href="/signup" className={styles.planCta}>
              Start free
            </Link>
          </div>

          <div className={styles.plan} data-featured data-reveal>
            <div className={styles.planHead}>
              <span className={styles.planName}>Team</span>
              <span className={styles.planTag}>up to 10 people</span>
            </div>
            <div className={styles.planPrice}>
              <span className={styles.planAmount}>$12</span>
              <span className={styles.planPer}>/ month</span>
            </div>
            <p className={styles.planPlus}>Everything in Free, plus</p>
            <ul className={styles.planPoints} data-accent>
              {TEAM_POINTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link href="/signup" className={styles.planCtaPrimary}>
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section id="faq" className={styles.faqSection}>
        <div className={styles.faqGrid}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>
              the honest
              <br />
              answers.
            </h2>
          </div>
          <div className={styles.faqList}>
            {FAQ.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary className={styles.faqQ}>
                  {item.q}
                  <span className={styles.faqPlus} aria-hidden="true" />
                </summary>
                <p className={styles.faqA}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ cta */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            start planning.
            <br />
            get your day back.
          </h2>
          <p className={styles.ctaLede}>
            Free to start, no credit card. Dump what&rsquo;s on your mind and see
            your day in under a minute.
          </p>
          <Link href="/signup" className={styles.ctaButton}>
            Get started
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- footer */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <LogoMark size={22} />
          <span>
            cerno<span className={styles.accent}>.</span>
          </span>
        </div>
        <p className={styles.footerNote}>
          Your plan, your data — every row scoped to your account.
        </p>
        <div className={styles.footerLinks}>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Get started</Link>
          <a href="#top">Top</a>
        </div>
      </footer>
    </div>
  );
}
