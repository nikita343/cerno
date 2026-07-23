import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo, LogoMark } from "@/components/brand/Logo";
import {
  FeatureDemo,
  type DemoVariant,
} from "@/components/landing/FeatureDemo";
import { CtaLogo } from "@/components/landing/CtaLogo";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { HoverButton } from "@/components/landing/HoverButton";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { MobileNav } from "@/components/landing/MobileNav";
import { TeamPlanCard } from "@/components/landing/PricingToggle";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

import upcomingImg from "@/assets/upcoming.png";

import styles from "./landing.module.css";

const DESCRIPTION =
  "Dump everything on your mind. Cerno reads the mess, estimates what each thing costs, and hands you one realistic day — scheduling what fits and parking the rest with a reason.";

export const metadata: Metadata = {
  title: "Meet the Intelligent Planner.",
  description: DESCRIPTION,
  openGraph: {
    title: "Meet the Intelligent Planner.",
    description: DESCRIPTION,
  },
  twitter: {
    title: "Meet the Intelligent Planner.",
    description: DESCRIPTION,
  },
};

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Content — the source of truth is FEATURES.md.                              */
/* -------------------------------------------------------------------------- */


interface Feature {
  eyebrow: string;
  title: string;
  body: string;
  demo: DemoVariant;
}

const FEATURES: Feature[] = [
  {
    eyebrow: "Capture",
    title: "One box. It untangles the rest.",
    body: "Write or speak a stream of everything you owe the day. Cerno turns it into titled tasks, each with a priority, an effort estimate, a deadline and a one-line reason — no key required to try it.",
    demo: "capture",
  },
  {
    eyebrow: "The plan",
    title: "A realistic day, not a wish list.",
    body: "A capacity guard runs after the model: anything that pushes past your working hours is moved to tomorrow, whatever it was labelled. The top of Today explains the shape of the day in one honest line.",
    demo: "plan",
  },
  {
    eyebrow: "Inbox",
    title: "Nothing waits without a reason.",
    body: "Whatever Cerno parses but doesn't schedule lands in the inbox, each row showing why it wasn't planned — and a single tap to put it on today.",
    demo: "inbox",
  },
  {
    eyebrow: "Drag & drop",
    title: "Move anything, anywhere.",
    body: "Drag a task to another day, drop it into a time block, or postpone it to tomorrow. On a phone, press-and-hold — it never fights the swipe.",
    demo: "drag",
  },
  {
    eyebrow: "Labels & filters",
    title: "Tags and views that build themselves.",
    body: "Cerno labels new tasks automatically — errand, comms, health, work. Filter by priority, deadline or label; search scans titles, labels and reasoning.",
    demo: "labels",
  },
  {
    eyebrow: "Reminders",
    title: "Nudges only when they count.",
    body: "The bell collects what's overdue and what's coming up within your lead time. Overdue warnings don't dismiss — they clear when the task is done or moved.",
    demo: "reminders",
  },
  {
    eyebrow: "Teams",
    title: "One shared day for the team.",
    body: "A workspace is a shared list — up to 10 people. Assign tasks to teammates, invite by email or link, and let roles keep it tidy. You pay; the people you invite don't.",
    demo: "teams",
  },
];

const MORE = [
  {
    title: "Calendar feed",
    body: "Subscribe from Google, Apple or Outlook. A private, revocable iCal link.",
  },
  {
    title: "Your model",
    body: "Plan with Claude or GPT — your choice, stored as a preference.",
  },
  {
    title: "English & Ukrainian",
    body: "The whole app, in either language, switchable any time.",
  },
  {
    title: "Private by design",
    body: "Every row is scoped to your account by the database, not the interface.",
  },
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

const STREAM_TASKS = [
  { title: "fix the kitchen leak", effort: "20m", color: "#C77F17" },
  { title: "reply to the Karlsson brief", effort: "10m", color: "#7B57E0" },
  { title: "draft Q3 planning doc", effort: "90m", color: "#3B6FD4" },
  { title: "book the dentist", effort: "5m", color: "#D23E6E" },
  { title: "review 3 pull requests", effort: "35m", color: "#3B6FD4" },
  { title: "pick up dry cleaning", effort: "15m", color: "#1E9E6E" },
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
    a: "No. Free is free forever. Team is $8 a month — or $80 a year — when you want a shared list, and the people you invite never pay.",
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
          <HoverButton href="/signup" className={styles.navCta} arrow>
            Get started
          </HoverButton>
          <MobileNav />
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section id="top" className={styles.heroShell} data-hero>
        <HeroBackground />
        <div className={styles.hero}>
          <span
            className={styles.heroDot}
            aria-hidden="true"
            data-floating-dot
          />
          <span
            className={styles.heroDotSecondary}
            aria-hidden="true"
            data-floating-dot
          />
          <span
            className={styles.heroDotTertiary}
            aria-hidden="true"
            data-floating-dot
          />
          <div className={styles.heroCopy} data-hero-copy>
            <p className={styles.eyebrow}>AI daily planner</p>
            <h1 className={styles.title}>
              plan the day.
              <br />
              <span className={styles.accent}>not</span> the list.
            </h1>
            <p className={styles.lede}>
              Dump everything on your mind. Cerno decides what matters,
              estimates the effort, and hands you one realistic day — in order,
              with the rest quietly parked.
            </p>
            <div className={styles.heroActions}>
              <HoverButton href="/signup" className={styles.primary} arrow>
                Start planning
              </HoverButton>
              <HoverButton
                href="#how"
                className={styles.textLink}
                variant="text"
                arrow
              >
                see how it works
              </HoverButton>
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

      {/* -------------------------------------------- watch it think (live) */}
      <section id="watch" className={styles.bento}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>watch it think.</h2>
        </div>

        <div className={styles.bentoGrid}>
          {/* the reprioritizing task stream */}
          <div
            className={`${styles.bentoCard} ${styles.bentoCardTall}`}
            data-reveal
          >
            <div className={styles.bentoRowHead}>
              <span className={styles.bentoLabel}>today, reprioritized</span>
              <span className={styles.thinking}>
                <span
                  className={styles.thinkDot}
                  data-think-dot
                  aria-hidden="true"
                />
                cerno is planning
              </span>
            </div>
            <div className={styles.streamViewport}>
              <div className={styles.streamMask}>
                <div className={styles.anchorSlot} aria-hidden="true" />
                <div className={styles.stream} data-stream>
                  {STREAM_TASKS.map((t) => (
                    <div key={t.title} className={styles.task} data-task>
                      <span
                        className={styles.taskDot}
                        style={{ background: t.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.taskTitle}>{t.title}</span>
                      <span className={styles.taskEffort}>{t.effort}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span className={styles.anchorTag} aria-hidden="true">
                anchor
              </span>
            </div>
            <p className={styles.bentoNote}>
              urgency against effort, recomputed as things land.
            </p>
          </div>

          {/* the typewriter brain dump */}
          <div
            className={`${styles.bentoCard} ${styles.bentoCardDark}`}
            data-reveal
          >
            <span className={styles.bentoLabelDark}>just start typing</span>
            <div className={styles.cmdBox}>
              <div className={styles.cmdBar}>
                <span
                  className={styles.cmdDot}
                  data-cmd-dot
                  aria-hidden="true"
                />
                <span className={styles.cmdEyebrow}>brain dump</span>
              </div>
              <div className={styles.cmdText}>
                <span data-typed />
                <span className={styles.caret} data-caret aria-hidden="true" />
              </div>
            </div>
            <p className={styles.bentoNoteDark}>
              no fields, no tags. cerno reads the mess.
            </p>
          </div>

          {/* the live status card */}
          <div className={styles.bentoCard} data-reveal>
            <span className={styles.notif} data-notif aria-hidden="true">
              <span className={styles.notifDot} />
              plan ready
            </span>
            <span className={styles.bentoLabel}>your day, at a glance</span>
            <div className={styles.statusList}>
              <div className={styles.statusRow}>
                <span
                  className={styles.statusDot}
                  data-breathe
                  style={{ background: "var(--l-accent)" }}
                  aria-hidden="true"
                />
                <span className={styles.statusLabel}>
                  deep work — planning doc
                </span>
                <span className={styles.statusTime}>now</span>
              </div>
              <div className={styles.statusRow}>
                <span
                  className={styles.statusDot}
                  data-breathe
                  style={{ background: "#C77F17" }}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.statusLabel} ${styles.statusLabelMuted}`}
                >
                  quick wins — 3 tasks
                </span>
                <span className={styles.statusTime}>11:00</span>
              </div>
              <div className={styles.statusRow}>
                <span
                  className={styles.statusDot}
                  style={{ background: "#D6D6D2" }}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.statusLabel} ${styles.statusLabelParked}`}
                >
                  parked — 4 deferred
                </span>
                <span className={styles.statusTime}>later</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- how it works */}
      <section id="how" className={styles.how}>
        <HowItWorks />
        <span className={styles.howLine} data-how-line aria-hidden="true" />
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
                <FeatureDemo variant={f.demo} />
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
        <div className={`${styles.sectionHead} ${styles.featureSectionHead}`}>
          <h2 className={styles.h2}>simple, honest pricing.</h2>
          <p className={styles.sectionLede}>
            Everything personal is free, forever. Pay only when you want a
            shared day with your team.
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
            <HoverButton href="/signup" className={styles.planCta} arrow>
              Start free
            </HoverButton>
          </div>

          <TeamPlanCard />
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
          <HeroBackground dark />
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>
              start planning.
              <br />
              get your day back.
            </h2>
            <p className={styles.ctaLede}>
              Free to start, no credit card. Dump what&rsquo;s on your mind and
              see your day in under a minute.
            </p>
            <HoverButton href="/signup" className={styles.ctaButton} arrow>
              Get started
            </HoverButton>
          </div>
          <CtaLogo />
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
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="#top">Top</a>
        </div>
      </footer>
    </div>
  );
}
