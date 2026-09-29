import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A parent who pays $10 must be able to reach the Patrol they just bought.
 *
 * Nothing in this project sends email, so the only moment the buyer can be
 * handed their token is the checkout success page, using the Stripe session id
 * they were redirected with. Before this existed the token reached the server
 * log and nowhere else: the gift codes were created and the buyer could never
 * open them.
 *
 * The lookup itself is tested in `patrol.test.ts`, alongside the other tests
 * that touch the store: vitest runs test *files* in parallel and the local dev
 * store is one shared JSON file, so two files exercising it race each other.
 */

describe("the checkout success page treats a Patrol as digital", () => {
  const page = fs.readFileSync(
    path.join(path.resolve(__dirname, ".."), "app/checkout/success/page.tsx"),
    "utf8"
  );

  it("never shows the printing and dispatch promises for a Patrol", () => {
    // The fulfilment block is what claims "dispatched within 2-3 business days".
    expect(page).toContain("{isPaid && !isPatrol && (");
    expect(page).toContain("Dispatched directly to your address within 2–3 business days");
  });

  it("hands the buyer their Patrol link when the token is known", () => {
    expect(page).toContain("/dashboard/patrol?token=${patrolToken}");
    expect(page).toContain("Save this link");
  });

  it("says the Patrol is still being set up rather than claiming failure", () => {
    expect(page).toContain("Your Patrol is being set up");
    expect(page).toContain("your payment is recorded and nothing is lost");
  });

  it("only looks the token up once Stripe has confirmed the payment", () => {
    expect(page).toContain(
      'if (isPatrol && confirmationFromPaymentStatus(session.payment_status) === "paid")'
    );
  });
});
