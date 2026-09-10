import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // eslint-disable-next-line no-console
  console.warn("Warning: STRIPE_SECRET_KEY is not defined in environment.");
}

export const stripe = new Stripe(secretKey || "", {
  typescript: true,
});
