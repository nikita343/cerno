import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy · Cerno",
  description:
    "How Cerno (Awake Agency) collects, uses, and protects your personal data.",
};

const EFFECTIVE = "23 July 2026";

export default function PrivacyPage() {
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
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.meta}>Last updated: {EFFECTIVE}</p>

        <p className={styles.intro}>
          This policy explains what personal data Cerno collects, why, and the
          rights you have over it. Cerno is operated by{" "}
          <strong>Awake Agency</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;),
          established in Poland, acting as the data controller. For any privacy
          question or request, contact us at{" "}
          <a href="mailto:privacy@cerno.app">privacy@cerno.app</a>.
        </p>

        <section className={styles.section}>
          <h2 className={styles.h2}>1. Data we collect</h2>
          <ul>
            <li>
              <strong>Account data</strong> — your email address and
              authentication details, used to create and secure your account.
            </li>
            <li>
              <strong>Content you create</strong> — the tasks, notes,
              brain-dump text, labels, and workspaces you enter. This is the
              core of the service and is stored so we can show it back to you.
            </li>
            <li>
              <strong>Payment data</strong> — if you subscribe to Team, billing
              is handled by Stripe. We receive subscription status and the last
              four digits/brand of your card; we never see or store full card
              numbers.
            </li>
            <li>
              <strong>Optional integrations</strong> — if you connect Telegram
              or a calendar feed, we store the identifiers needed to run them
              (e.g. a Telegram chat ID, a revocable calendar-feed token).
            </li>
            <li>
              <strong>Technical data</strong> — an essential session cookie and
              minimal server logs needed for security and reliability.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>2. How we use your data</h2>
          <ul>
            <li>To provide, maintain, and secure the service.</li>
            <li>
              To turn your brain-dump into a daily plan using AI (see section
              4).
            </li>
            <li>To process Team subscriptions and send billing receipts.</li>
            <li>
              To send transactional email (sign-in, workspace invites, account
              notices). We do not send marketing email without your consent.
            </li>
            <li>To respond to support requests and enforce our Terms.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>3. Legal bases (GDPR)</h2>
          <p>We process your data under the following bases:</p>
          <ul>
            <li>
              <strong>Performance of a contract</strong> — to provide the
              service you sign up for.
            </li>
            <li>
              <strong>Legitimate interests</strong> — to keep the service
              secure and working.
            </li>
            <li>
              <strong>Consent</strong> — for optional integrations you choose to
              connect (you can withdraw this at any time).
            </li>
            <li>
              <strong>Legal obligation</strong> — where we must keep records
              (e.g. tax/accounting for payments).
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>4. AI processing</h2>
          <p>
            To plan your day, the text you enter is sent to our AI providers —{" "}
            <strong>Anthropic</strong> (Claude) and/or <strong>OpenAI</strong>{" "}
            — which generate the structured plan and return it to us. This
            content is processed only to produce your plan. Under these
            providers&rsquo; API terms, data sent through the API is not used to
            train their models. You choose which model provider to use in
            settings.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>5. Service providers we share with</h2>
          <p>
            We do not sell your data. We share it only with the processors that
            run Cerno, under contracts that limit them to processing on our
            instructions:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — database and authentication hosting.
            </li>
            <li>
              <strong>Anthropic</strong> and <strong>OpenAI</strong> — AI
              planning.
            </li>
            <li>
              <strong>Stripe</strong> — payment processing.
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery.
            </li>
            <li>
              <strong>Telegram</strong> and your <strong>calendar provider</strong>{" "}
              — only if you connect them.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>6. International transfers</h2>
          <p>
            Some of our providers are located outside the European Economic
            Area (for example, in the United States). Where data is transferred
            internationally, it is protected by appropriate safeguards such as
            the European Commission&rsquo;s Standard Contractual Clauses.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>7. Data retention</h2>
          <p>
            We keep your data for as long as your account is active. If you
            delete your account or ask us to erase your data, we remove it from
            our live systems promptly, except where we must keep limited records
            to meet a legal obligation. Backups are rotated and expire on a
            rolling basis.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>8. Your rights</h2>
          <p>Under the GDPR you have the right to:</p>
          <ul>
            <li>access the personal data we hold about you;</li>
            <li>correct inaccurate data;</li>
            <li>erase your data (&ldquo;right to be forgotten&rdquo;);</li>
            <li>restrict or object to processing;</li>
            <li>receive your data in a portable format;</li>
            <li>withdraw consent for optional integrations at any time.</li>
          </ul>
          <p>
            To exercise any of these, email{" "}
            <a href="mailto:privacy@cerno.app">privacy@cerno.app</a>. You also
            have the right to lodge a complaint with your local supervisory
            authority — in Poland this is the President of the Personal Data
            Protection Office (Prezes Urzędu Ochrony Danych Osobowych, UODO).
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>9. Security</h2>
          <p>
            Data is encrypted in transit. Every row is scoped to your account at
            the database level (row-level security), not just in the interface,
            so your data is isolated from other users by default. No system is
            perfectly secure, but we work to protect your data using
            industry-standard measures.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>10. Cookies</h2>
          <p>
            Cerno uses only strictly-necessary cookies — the session cookie that
            keeps you signed in. We do not use analytics, advertising, or
            tracking cookies, so no cookie-consent choice is required beyond the
            notice we show.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>11. Children</h2>
          <p>
            Cerno is not directed to children under 16, and we do not knowingly
            collect their data. If you believe a child has provided us data,
            contact us and we will delete it.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>12. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. When we make material
            changes, we will update the date above and, where appropriate,
            notify you in the app or by email.
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
