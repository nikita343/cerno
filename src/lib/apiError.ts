/**
 * Error detail that is safe to send to the browser.
 *
 * Provider errors routinely name the account, the price, the model or the
 * quota — none of which a user should see, and some of which is a hint to an
 * attacker. So responses carry generic copy and the real message is logged.
 *
 * That is correct in production and miserable in development, where the person
 * reading the browser console is the person who wrote the code and the real
 * message is the whole answer. This returns it only outside production.
 *
 * `NODE_ENV` is set to "production" by `next build` and `next start`, so the
 * guard cannot be forgotten in a deploy — it is not an env var anyone has to
 * remember to set.
 */
export function devDetail(error: unknown): { detail?: string } {
  if (process.env.NODE_ENV === "production") return {};
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;
  return message ? { detail: message } : {};
}
