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
    expect(page).toContain("{isPaid && !isPatrol && !isGuide && (");
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

describe("the checkout success page treats the digital Guide as digital too", () => {
  const page = fs.readFileSync(
    path.join(path.resolve(__dirname, ".."), "app/checkout/success/page.tsx"),
    "utf8"
  );

  it("never shows printing and dispatch for a Guide order", () => {
    expect(page).toContain("{isPaid && !isPatrol && !isGuide && (");
  });

  it("promises the email only while the Guide is actually being issued", () => {
    // The claim and the flag have to travel together: the sentence about a
    // download link must sit inside the PARENTS_GUIDE_DIGITAL_LIVE branch.
    const claim = "on its way to the email address you used at checkout";
    const at = page.indexOf(claim);
    expect(at).toBeGreaterThan(-1);
    // Look only at the conditional immediately before the sentence. Searching
    // the whole file would pass on the import line alone, which is a test that
    // cannot fail.
    expect(page.slice(Math.max(0, at - 200), at)).toContain("PARENTS_GUIDE_DIGITAL_LIVE");
  });

  it("says plainly that nothing will arrive while it is closed", () => {
    expect(page).toContain("nothing will arrive by email today");
  });
});

