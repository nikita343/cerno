# Stripe setup (test mode)

What to click in the Stripe dashboard, and what the app does with it. Everything
here is test mode — no real money, no business verification.

## Your checklist

Everything below in order. Steps 1–3 are the ones nothing works without.

- [ ] **1.** Confirm the dashboard is in **Test mode** (banner top-right)
- [ ] **2.** Create product `Cerno Team`, $12/month recurring → copy the
      **price ID** (`price_...`, not `prod_...`)
- [ ] **3.** Copy the **secret key** (`sk_test_...`) from Developers → API keys
- [ ] **4.** Put both in `.env.local` as `STRIPE_PRICE_TEAM` and
      `STRIPE_SECRET_KEY` — **not** `.env.example`, which is committed
- [ ] **5.** `brew install stripe/stripe-cli/stripe && stripe login`
- [ ] **6.** `stripe listen --forward-to localhost:3000/api/stripe/webhook`
      → copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`
- [ ] **7.** Supabase → Project Settings → API → copy **service_role** into
      `SUPABASE_SERVICE_ROLE_KEY` (see the warning in `.env.example`)
- [ ] **8.** Activate the **Customer portal**: Settings → Billing → Customer
      portal → Activate. Without this, `/api/stripe/portal` returns an error
      and users cannot cancel
- [ ] **9.** Test a payment with card `4242 4242 4242 4242`
- [ ] **10.** Confirm the row landed: `select * from subscriptions;` in the
      Supabase SQL editor — `status` should be `active`
- [ ] **11.** Test the unhappy paths: `stripe trigger invoice.payment_failed`
      and `stripe trigger customer.subscription.deleted`

**When you deploy** (not needed for local testing):

- [ ] Developers → Webhooks → Add endpoint → `https://your-domain/api/stripe/webhook`
- [ ] Subscribe it to: `checkout.session.completed`,
      `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy **that endpoint's** signing secret — it differs from the CLI's, and
      using the wrong one rejects every event with a 400
- [ ] Set `NEXT_PUBLIC_SITE_URL` so Stripe redirects back to the right host

**The one rule:** the browser never decides whether someone has paid. It asks
Stripe to start a checkout, and Stripe tells *our server* what happened. The
`subscriptions` table has no INSERT/UPDATE policy at all (see
`0005_workspaces.sql`), so the only writer is the webhook holding the
service-role key. Anything that trusts a client-side "payment succeeded" is a
paid tier you can get for free with devtools open.

---

## 1. Product and price

Dashboard → **Developers** toggle → make sure you are in **Test mode** (the
banner should say so). Then:

1. **Product catalog → + Add product**
   - Name: `Cerno Team`
   - Price: `12.00 USD`, **Recurring**, **Monthly**
2. Save, then copy the **price ID** — `price_...`, *not* the product ID
   (`prod_...`). The API takes the price.

Because the model is **$12/month per paying user, unlimited workspaces**, this
is a flat recurring price with quantity 1. No metered billing, no quantity sync
on invite — that only becomes necessary if you move to per-seat.

## 2. Keys

**Developers → API keys**:

| Key | Goes where |
|---|---|
| Publishable `pk_test_...` | Not needed — Checkout redirects, so nothing Stripe-related runs in our client |
| Secret `sk_test_...` | `.env.local` only |

```bash
# .env.local — gitignored. NEVER .env.example, which is committed.
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_TEAM=price_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from step 3
```

No `NEXT_PUBLIC_` prefix on any of these. That prefix inlines the value into the
JavaScript bundle, and `sk_test_` in a bundle is a full-access key to the
account — in test mode that is embarrassing rather than expensive, but the same
mistake carries to live mode unchanged.

## 3. Webhook

This is the part that actually grants access.

**Local development** — Stripe cannot reach `localhost`, so forward with the CLI:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints `whsec_...` on startup. That is `STRIPE_WEBHOOK_SECRET`. **It differs
from the dashboard endpoint's secret**, so a deployed endpoint and local
forwarding need different values.

**Deployed** — Developers → **Webhooks → + Add endpoint**:

- URL: `https://your-domain/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Reveal the signing secret and set `STRIPE_WEBHOOK_SECRET`.

### Verify the signature, and read the raw body

Two things routinely go wrong here, both silent:

- **Signature verification is not optional.** The endpoint is a public URL that
  grants paid access. Without `stripe.webhooks.constructEvent(...)` anyone who
  finds it can POST a fake `checkout.session.completed` and upgrade themselves.
- **Verify against the raw body.** Next must not parse the JSON first — the
  signature covers the exact bytes, and re-serialising a parsed object changes
  them. In the App Router that means `await request.text()`, never
  `await request.json()`.

## 4. Testing without a card

Checkout test cards:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| `4000 0000 0000 9995` | declines (insufficient funds) |
| `4000 0025 0000 3155` | requires 3-D Secure |

Any future expiry, any CVC, any postcode.

Worth exercising deliberately, because each is a different state in
`subscriptions.status` and a different thing the UI has to say:

```bash
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

## 5. Customer portal

**Settings → Billing → Customer portal → Activate**. This gives cancel, update
card, and invoice history for free. Building those ourselves means handling PCI
scope and dunning; the portal is a redirect.

---

## What we build against it

```
Settings ──"Upgrade"──► POST /api/stripe/checkout
                          │  creates/reuses a Stripe customer,
                          │  stores stripe_customer_id
                          ▼
                        Checkout (hosted by Stripe)
                          │
                          ▼
Stripe ──webhook──► POST /api/stripe/webhook ──service role──► subscriptions
                                                                    │
                                            has_active_plan() ◄──────┘
                                                    │
                                          create_workspace() gate
```

Notes that matter:

- **Map Stripe customer → our user via `client_reference_id`** on the Checkout
  session, set to the Supabase user id. Matching on email is tempting and wrong:
  a customer can change their Stripe email, and two accounts can share one.
- **Webhooks are not ordered and not exactly-once.** Stripe retries, and
  `subscription.updated` can arrive before `checkout.session.completed`. The
  handler must be idempotent — upsert on `user_id`, and ignore an event whose
  data is older than what is already stored.
- **`status` is copied from Stripe verbatim.** `has_active_plan()` decides what
  each status *means*; the webhook does no interpretation. One place to change
  the rule.
- **Losing the plan does not delete anything.** Workspaces stay, and stay
  readable; `create_workspace()` refuses new ones. Deleting a team's shared
  tasks because a card expired is not a thing to do to somebody.

## Going live later

Live mode is a separate set of keys, a separate webhook endpoint and secret, and
a separate product/price — **nothing created in test mode carries over**. Live
mode also needs business details and a bank account on the Stripe account.
