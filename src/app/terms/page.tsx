import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Use · Cerno",
  description: "The terms that govern your use of Cerno.",
};

const EFFECTIVE = "23 July 2026";

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          cerno<span className={styles.dot}>.</span>
        </Link>
        <Link href="/" className={styles.back}>
          ← Back to site
        </Link>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Terms of Use</h1>
        <p className={styles.meta}>Last updated: {EFFECTIVE}</p>

        <p className={styles.intro}>
          These terms govern your use of Cerno, an AI daily planner operated by{" "}
          <strong>Awake Agency</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;),
          established in Poland. By creating an account or using Cerno, you agree
          to these terms. If you do not agree, please do not use the service.
        </p>

        <section className={styles.section}>
          <h2 className={styles.h2}>1. Eligibility &amp; your account</h2>
          <p>
            You must be at least 16 years old to use Cerno. You are responsible
            for the activity under your account and for keeping your login
            secure. Tell us promptly at{" "}
            <a href="mailto:privacy@cerno.app">privacy@cerno.app</a> if you
            suspect unauthorised access.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>2. The service</h2>
          <p>
            Cerno lets you capture a stream of tasks and uses AI to turn it into
            a structured daily plan — estimating effort, weighing deadlines, and
            deferring what does not fit. Features may change, improve, or be
            discontinued over time as we develop the product.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>use Cerno for any unlawful purpose or to harm others;</li>
            <li>
              attempt to disrupt, reverse-engineer, or gain unauthorised access
              to the service or other users&rsquo; data;
            </li>
            <li>
              upload content that infringes others&rsquo; rights or violates
              applicable law;
            </li>
            <li>
              resell or provide the service to third parties except through the
              Team workspace features we provide.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>4. Plans &amp; payment</h2>
          <p>
            Personal use of Cerno is free. The Team plan costs{" "}
            <strong>$8 per month</strong> or <strong>$80 per year</strong> and
            adds shared workspaces for up to 10 people; the person who pays is
            billed, and invited members do not pay. Payments are processed by
            Stripe.
          </p>
          <p>
            Subscriptions renew automatically at the end of each billing period
            until cancelled. You can cancel at any time and will keep Team
            features until the end of the paid period. Except where required by
            law, payments are non-refundable. We may change prices with prior
            notice, effective from your next billing period.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>5. Your content</h2>
          <p>
            You own the content you create in Cerno. You grant us a limited
            licence to store, process, and display it solely to operate the
            service for you — including sending relevant text to our AI
            providers to generate your plan, as described in our{" "}
            <Link href="/privacy">Privacy Policy</Link>. You are responsible for
            the content you enter.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>6. AI output</h2>
          <p>
            Cerno&rsquo;s plans are automated suggestions to help you organise
            your day. They may be incomplete or wrong, and they are not
            professional advice. You remain responsible for your decisions and
            should use your own judgement — always verify anything important.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>7. Third-party services</h2>
          <p>
            Cerno relies on third-party providers (such as Supabase, Stripe,
            Anthropic, OpenAI, Resend, Telegram, and calendar providers) and may
            let you connect your own accounts with them. Your use of those
            services is subject to their terms, and we are not responsible for
            them.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>8. Termination</h2>
          <p>
            You may stop using Cerno and delete your account at any time. We may
            suspend or terminate access if you breach these terms or use the
            service in a way that risks harm to others or to the service. On
            termination, your right to use Cerno ends; the sections that by
            their nature should survive (e.g. content licence limits,
            disclaimers, liability, governing law) continue to apply.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>9. Disclaimers</h2>
          <p>
            Cerno is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
            without warranties of any kind, to the fullest extent permitted by
            law. We do not guarantee that the service will be uninterrupted,
            error-free, or that plans will meet your expectations. Nothing in
            these terms excludes liability that cannot be excluded under
            applicable law, including your mandatory rights as a consumer.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>10. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, we are not liable for
            indirect, incidental, or consequential damages, or for lost data or
            profits arising from your use of Cerno. Where liability cannot be
            excluded, it is limited to the amount you paid us for the service in
            the 12 months before the claim.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>11. Governing law</h2>
          <p>
            These terms are governed by the laws of Poland, without prejudice to
            any mandatory consumer-protection rights you have in your country of
            residence. Disputes will be subject to the competent courts of
            Poland, unless applicable law grants you the right to bring a claim
            elsewhere.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>12. Changes to these terms</h2>
          <p>
            We may update these terms as the service evolves. When we make
            material changes, we will update the date above and, where
            appropriate, notify you in the app or by email. Continuing to use
            Cerno after changes take effect means you accept the updated terms.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>13. Contact</h2>
          <p>
            Awake Agency, Poland ·{" "}
            <a href="mailto:privacy@cerno.app">privacy@cerno.app</a>
          </p>
        </section>
      </main>
    </div>
  );
}
