import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PARENTS_GUIDE_DIGITAL_LIVE, PARENTS_GUIDE_DIGITAL_PRICE } from "@/lib/pricing";

/**
 * The digital Parent's Guide may not be sold until it can be delivered.
 *
 * There is no PDF and no way to email a buyer a link, so a completed payment
 * would leave the customer with nothing — and `/checkout/success` would tell
 * them a digital file ships in 2-3 business days. These tests keep the door shut
 * until all three parts of that are fixed together, rather than one of them
 * quietly flipping a flag.
 */

const repoRoot = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), "utf8");

describe("the digital Parent's Guide is closed until it can be delivered", () => {
  it("is switched off", () => {
    expect(PARENTS_GUIDE_DIGITAL_LIVE).toBe(false);
  });

  it("the price is still defined, so opening it again is one flag", () => {
    expect(PARENTS_GUIDE_DIGITAL_PRICE).toBe(29.97);
  });

  it("the checkout route refuses before it does anything else", () => {
    const route = read("app/api/checkout/guide/route.ts");
    expect(route).toContain("PARENTS_GUIDE_DIGITAL_LIVE");
    // The guard must come before the Stripe call, not after it.
    expect(route.indexOf("PARENTS_GUIDE_DIGITAL_LIVE")).toBeLessThan(
      route.indexOf("stripe.checkout.sessions.create")
    );
  });

  it("the page does not promise an instant download while it is closed", () => {
    const page = read("app/guide/page.tsx");
    const promise = "Instant download link delivered immediately";
    // The string may still exist for the live branch, but it must be guarded.
    if (page.includes(promise)) {
      const before = page.slice(0, page.indexOf(promise));
      expect(before).toContain("PARENTS_GUIDE_DIGITAL_LIVE");
    }
  });

  it("the buy button is disabled while it is closed", () => {
    expect(read("app/guide/page.tsx")).toContain("!PARENTS_GUIDE_DIGITAL_LIVE || loadingType !== null");
  });

  it("the $10 Patrol bundle is untouched — its gift codes are real", () => {
    const page = read("app/guide/page.tsx");
    expect(page).toContain('handleCheckout("patrol")');
    expect(page).not.toContain('disabled={!PARENTS_GUIDE_DIGITAL_LIVE || loadingType !== null}\n                className="btn-secondary');
  });
});
