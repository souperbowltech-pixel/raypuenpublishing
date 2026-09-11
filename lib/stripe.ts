import Stripe from "stripe";

// Provide a safe fallback during Vercel build-time analysis if env is not yet configured
const secretKey =
  process.env.STRIPE_SECRET_KEY ||
  "sk_test_placeholder_key_to_allow_nextjs_build_time_evaluation";

export const stripe = new Stripe(secretKey, {
  typescript: true,
});
