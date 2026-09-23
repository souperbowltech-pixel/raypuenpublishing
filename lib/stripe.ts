import Stripe from "stripe";

// Provide a safe fallback during Vercel build-time analysis if env is not yet configured
const secretKey =
  process.env.STRIPE_SECRET_KEY ||
  "sk_test_placeholder_key_to_allow_nextjs_build_time_evaluation";

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
