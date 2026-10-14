import { describe, it, expect } from "vitest";
import { isStripeConfigured, STRIPE_NOT_CONFIGURED_MESSAGE } from "./stripe";

/**
 * These guard the one failure that only shows itself on the day live keys go
 * in: a missing or misspelled STRIPE_SECRET_KEY leaves the SDK holding the
 * build-time placeholder, and the buyer meets an opaque authentication error
 * instead of an honest one.
 */
describe("isStripeConfigured", () => {
  it("accepts a live secret key", () => {
    expect(isStripeConfigured("sk_live_51AbCdEfGhIjKlMnOp")).toBe(true);
  });

  it("accepts a test secret key, because test mode is a real configuration", () => {
    expect(isStripeConfigured("sk_test_51AbCdEfGhIjKlMnOp")).toBe(true);
  });

  it("rejects the build-time placeholder", () => {
    expect(
      isStripeConfigured("sk_test_placeholder_key_to_allow_nextjs_build_time_evaluation")
    ).toBe(false);
  });

  it("rejects an unset key", () => {
    expect(isStripeConfigured(undefined)).toBe(false);
  });

  it("rejects an empty or whitespace-only key", () => {
    expect(isStripeConfigured("")).toBe(false);
    expect(isStripeConfigured("   ")).toBe(false);
  });

  it("trims surrounding whitespace before judging, since a pasted key often carries it", () => {
    expect(isStripeConfigured("  sk_live_51AbCdEfGhIjKlMnOp  ")).toBe(true);
  });

  it("rejects a value that is not a secret key at all", () => {
    // A publishable key in the secret slot is a real paste error and must not pass.
    expect(isStripeConfigured("pk_live_51AbCdEfGhIjKlMnOp")).toBe(false);
    expect(isStripeConfigured("whsec_AbCdEfGhIjKlMnOp")).toBe(false);
  });

  it("never puts the key itself in the customer-facing message", () => {
    expect(STRIPE_NOT_CONFIGURED_MESSAGE).not.toMatch(/sk_|pk_|whsec_/);
  });
});
