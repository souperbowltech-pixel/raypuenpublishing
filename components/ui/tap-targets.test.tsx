import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

/**
 * Fitts's law and the Doherty threshold, held in place.
 *
 * Every control a finger has to hit is at least 44 px (Tailwind `h-11` or
 * `min-h-11`), and every button that waits on the network shows a spinner the
 * moment it is pressed. Components that render without the app around them
 * are checked on their rendered markup; page files are checked in the source,
 * as lib/timeouts.test.ts does. Either way the check reads the class list of
 * the one element, so the order of classes does not matter. The busy states
 * themselves are exercised in busy-buttons.dom.test.tsx.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));

const { BuyBox } = await import("@/components/retail/BuyBox");
const { SiteHeader } = await import("@/components/retail/SiteHeader");
const { CertificateDownload } = await import("@/components/certificate/CertificateDownload");
const PageStickersGrid = (await import("@/components/dashboard/PageStickersGrid")).default;
const WholesaleForm = (await import("@/components/institutions/WholesaleForm")).default;
const CheckoutCancelPage = (await import("@/app/checkout/cancel/page")).default;

const repo = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");

/** Where the opening tag that starts at `start` ends: the first `>` outside `{...}`. */
function openingTagEnd(markup: string, start: number): number {
  let depth = 0;
  for (let i = start; i < markup.length; i++) {
    const c = markup[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return markup.length;
}

/** The class list of the element whose opening tag holds, or directly wraps, `marker`. */
function classesOf(markup: string, marker: string): string[] {
  const at = markup.indexOf(marker);
  if (at === -1) throw new Error(`marker not found: ${marker}`);
  const tag = markup.lastIndexOf("<", at);
  const found = /class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(markup.slice(tag, openingTagEnd(markup, tag)));
  if (!found) throw new Error(`no class list on the element at: ${marker}`);
  return (found[1] ?? found[2]).split(/\s+/).filter(Boolean);
}

/** At least 44 px tall, and no later height class undoing it. */
function expectTappable(classes: string[]) {
  expect(classes.some((c) => c === "min-h-11" || c === "h-11"), classes.join(" ")).toBe(true);
  expect(classes.filter((c) => /^!?(max-h|h)-/.test(c) && c !== "h-11"), classes.join(" ")).toEqual([]);
}

describe("rendered controls are at least 44 px", () => {
  it("gives the quantity steppers a full 44 px", () => {
    const html = renderToStaticMarkup(<BuyBox />);
    expectTappable(classesOf(html, 'aria-label="Decrease quantity"'));
    expectTappable(classesOf(html, 'aria-label="Increase quantity"'));
  });

  it("gives the logo and every header link a 44 px hit area, and still hides two links on phones", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    expectTappable(classesOf(html, 'href="/"'));
    for (const href of ["/#gallery", "/#details", "/#buy"]) expectTappable(classesOf(html, `href="${href}"`));
    for (const href of ["/#gallery", "/#details"]) {
      const classes = classesOf(html, `href="${href}"`);
      expect(classes).toContain("hidden");
      expect(classes).toContain("sm:inline-flex");
    }
  });

  it("makes each sticker a toggle whose name starts with its visible words and says which page it is", () => {
    const html = renderToStaticMarkup(<PageStickersGrid completedPages={[1]} onTogglePage={() => {}} />);
    const toggles = html.match(/<button[^>]*aria-pressed="(true|false)"[^>]*>.*?<\/button>/g) ?? [];
    expect(toggles.length).toBeGreaterThan(1);
    expect(toggles[0]).toContain('aria-pressed="true"');
    expect(toggles[1]).toContain('aria-pressed="false"');
    // No aria-label, so the visible words stay the start of the accessible name (WCAG 2.5.3).
    for (const toggle of toggles) expect(toggle).not.toContain("aria-label");
    expect(toggles[0]).toMatch(/>✓ Completed<span class="sr-only">, page 1, /);
    expect(toggles[1]).toMatch(/>I Completed This!<span class="sr-only">, page 2, /);
    const names = toggles.map((t) => t.replace(/<[^>]+>/g, ""));
    expect(new Set(names).size).toBe(toggles.length);
    expectTappable(classesOf(html, "I Completed This!"));
    expectTappable(classesOf(html, 'href="/api/stickers/sheet"'));
  });

  it("names each tier button by its visible words, then the tier and price", () => {
    const html = renderToStaticMarkup(<WholesaleForm />);
    const tiers = html.match(/<button type="button"[^>]*>(✓ Selected Tier|Choose Tier)<span class="sr-only">[^<]*<\/span><\/button>/g) ?? [];
    expect(tiers).toHaveLength(3);
    for (const tier of tiers) expect(tier).not.toContain("aria-label");
    const names = tiers.map((t) => t.replace(/<[^>]+>/g, ""));
    expect(names.every((n) => /Tier \d, \$[\d,.]+$/.test(n))).toBe(true);
    expect(new Set(names).size).toBe(3);
    expectTappable(classesOf(html, "Choose Tier"));
  });

  it("gives the certificate page's way back a 44 px hit area", () => {
    expectTappable(classesOf(renderToStaticMarkup(<CertificateDownload />), "← Return to Book 1 Storefront"));
  });

  it("gives the cancelled checkout's way home a 44 px hit area", () => {
    expectTappable(classesOf(renderToStaticMarkup(<CheckoutCancelPage />), "Go to Homepage"));
  });
});

describe("controls in page files are at least 44 px", () => {
  it.each([
    ["components/dashboard/ComprehensionQuiz.tsx", "Book {b} Keys"],
    ["components/dashboard/ComprehensionQuiz.tsx", "Retake Quiz"],
    ["components/dashboard/ScoreGate.tsx", "onClick={handlePrintRibbon}"],
    ["components/dashboard/QuestCaptainBox.tsx", '"Copy Captain Link"'],
    ["components/dashboard/QuestCaptainBox.tsx", "⚡ Simulate Friend Join"],
    ["components/dashboard/QuestCaptainBox.tsx", "Reset Referral Test"],
    ["app/dashboard/book2/page.tsx", "← Back to Storefront"],
    ["app/dashboard/book2/page.tsx", "font-display text-lg sm:text-xl"],
    ["app/dashboard/book2/page.tsx", "Dismiss"],
    ["app/dashboard/book2/page.tsx", "onClick={handleSignOut}"],
    ["app/dashboard/patrol/page.tsx", "← Back to Parent"],
    ["app/dashboard/patrol/page.tsx", '"Copy Gift Link"'],
    ["app/admin/page.tsx", "Sign out"],
    ["app/start/StartForm.tsx", 'htmlFor="isParentOrGuardian"'],
    ["app/start/StartForm.tsx", "← Back to the store"],
    ["app/guide/page.tsx", "← Return to Book 1 Storefront"],
    ["app/sponsor/page.tsx", "← Back to Storefront"],
    ["app/institutions/page.tsx", '<Link href="/"'],
    ["app/checkout/success/page.tsx", "href={`/dashboard/patrol?token="],
  ])("%s: %s", (file, marker) => {
    expectTappable(classesOf(read(file), marker));
  });

});

describe("busy buttons answer at once", () => {
  it.each([
    ["components/institutions/WholesaleForm.tsx", "Preparing Secure Checkout..."],
    ["app/start/StartForm.tsx", "Setting up your album…"],
    ["app/guide/page.tsx", "Connecting to Checkout…"],
    ["app/sponsor/page.tsx", "Redirecting to secure checkout…"],
    ["components/dashboard/BookUnlockCard.tsx", "Sending..."],
    ["app/dashboard/patrol/page.tsx", "Submitting Shipping Claim…"],
    ["app/dashboard/book2/page.tsx", "Signing out…"],
  ])("shows a spinner beside the words in %s", (file, words) => {
    const source = read(file);
    const at = source.indexOf(words);
    expect(at).toBeGreaterThan(-1);
    expect(source.slice(Math.max(0, at - 60), at)).toContain("<Spinner ");
  });

  it.each([
    ["app/start/loading.tsx", "Getting your adventure ready…"],
    ["app/start/StartForm.tsx", "Checking for your album…"],
    ["app/dashboard/book2/page.tsx", "Opening your Explorer dashboard…"],
    ["app/dashboard/patrol/page.tsx", "Loading Patrol Leader Hub…"],
    ["app/sponsor/page.tsx", "Confirming your gift…"],
  ])("puts a spinner and a status on the waiting screen in %s", (file, words) => {
    const source = read(file);
    const at = source.indexOf(words);
    expect(at).toBeGreaterThan(-1);
    const before = source.slice(Math.max(0, at - 220), at);
    expect(before).toContain("<Spinner ");
    expect(before).toContain('role="status"');
  });

  it("keeps the gift page's heading a heading while it confirms", () => {
    const source = read("app/sponsor/page.tsx");
    const at = source.indexOf("Confirming your gift…");
    expect(source.slice(source.lastIndexOf("<h1", at), at)).not.toContain("role=");
  });
});
