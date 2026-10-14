import Stripe from "stripe";

/**
 * The Vercel build evaluates every module, including this one, before any
 * environment variable is guaranteed to exist. Constructing the SDK with a
 * placeholder keeps the build green; `isStripeConfigured` below is what stops
 * that placeholder from ever reaching a paying customer.
 */
const BUILD_TIME_PLACEHOLDER_KEY =
  "sk_test_placeholder_key_to_allow_nextjs_build_time_evaluation";

const secretKey = process.env.STRIPE_SECRET_KEY || BUILD_TIME_PLACEHOLDER_KEY;

/**
 * Stripe's SDK defaults to an ~80s timeout, which outlives the serverless
 * function a customer is waiting on: a slow Stripe would leave someone who just
 * paid staring at a blank tab. Fail fast instead, so the page can say something
 * honest. One retry covers a transient network blip without stacking latency.
 */
export const STRIPE_TIMEOUT_MS = 8_000;

export const stripe = new Stripe(secretKey, {
  typescript: true,
  timeout: STRIPE_TIMEOUT_MS,
  maxNetworkRetries: 1,
});

/**
 * Whether a real key is in play, as opposed to the build-time placeholder.
 *
 * Without this, a missing or misspelled `STRIPE_SECRET_KEY` in production does
 * not fail loudly: the SDK is constructed with the placeholder, the request
 * reaches Stripe, and the customer is shown whatever an authentication error
 * happens to look like that day. On the morning live keys go in, that is the
 * difference between "payments are not configured" and a buyer staring at an
 * opaque error with their card in their hand.
 *
 * Takes the key as a parameter so the unconfigured state can actually be
 * tested; the default reads the environment the routes run in.
 */
export function isStripeConfigured(
  key: string | undefined = process.env.STRIPE_SECRET_KEY
): boolean {
  const trimmed = (key ?? "").trim();
  if (!trimmed) return false;
  if (trimmed === BUILD_TIME_PLACEHOLDER_KEY) return false;
  return trimmed.startsWith("sk_");
}

/** The single response every checkout route gives when payments are not wired up. */
export const STRIPE_NOT_CONFIGURED_MESSAGE =
  "Payments are not configured. Please try again shortly.";
