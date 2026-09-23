import { describe, it, expect } from "vitest";
import { confirmationFromPaymentStatus } from "./checkout-status";

/**
 * The checkout success page may only promise printing and dispatch when Stripe
 * itself confirms the money arrived. Anyone can open /checkout/success with any
 * session_id, so every other case has to resolve to something that makes no
 * fulfilment claim.
 */
describe("confirmationFromPaymentStatus", () => {
  it("treats a paid session as paid", () => {
    expect(confirmationFromPaymentStatus("paid")).toBe("paid");
  });

  it("treats a fully discounted order as paid", () => {
    // Stripe reports this when the total is $0 — a real completed purchase.
    expect(confirmationFromPaymentStatus("no_payment_required")).toBe("paid");
  });

  it("never reports an unpaid session as paid", () => {
    expect(confirmationFromPaymentStatus("unpaid")).toBe("unpaid");
  });

  it("reports 'unknown' when Stripe told us nothing", () => {
    // No session_id in the URL, or the lookup threw: we genuinely do not know,
    // which must stay distinct from telling someone they did not pay.
    expect(confirmationFromPaymentStatus(undefined)).toBe("unknown");
    expect(confirmationFromPaymentStatus(null)).toBe("unknown");
    expect(confirmationFromPaymentStatus("")).toBe("unknown");
  });

  it("does not treat an unrecognised status as paid, but does not accuse either", () => {
    // A status Stripe adds later, or one from a delayed-settlement method, must
    // not make us tell a customer who really did pay that they did not.
    expect(confirmationFromPaymentStatus("something_new_from_stripe")).toBe("unknown");
  });
});
