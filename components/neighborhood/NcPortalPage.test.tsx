import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NC_PORTALS, ncPortal, ncPortalPath } from "@/lib/nc-portals";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
const page = await import("@/app/nc/[slug]/page");

describe("NC printed destinations", () => {
  it("provides seven distinct fixed routes and rejects unknown input", () => {
    const routes = page.generateStaticParams();
    expect(routes.map(({ slug }) => slug)).toEqual(["welcome", "video-1", "video-2", "video-3", "video-4", "bring-two-friends", "join"]);
    expect(new Set(NC_PORTALS.map(ncPortalPath)).size).toBe(7);
    for (const value of [null, {}, "__proto__", "../v1", "v1", "unknown"]) expect(ncPortal(value)).toBeNull();
    expect(() => page.default({ params: { slug: "unknown" } })).toThrow("404");
  });

  it("renders the five correct NC videos with player identity and a direct fallback", () => {
    const expected = ["-k_TB3THjQk", "CwillOje7qY", "pSd3ZForw2U", "1g63wcScFn8", "ho6rJ1x4fOI"];
    for (const [index, slug] of ["welcome", "video-1", "video-2", "video-3", "video-4"].entries()) {
      const html = renderToStaticMarkup(page.default({ params: { slug } }));
      const frame = html.match(/<iframe[^>]*>/)?.[0];
      expect(frame).toContain(`https://www.youtube-nocookie.com/embed/${expected[index]}?`);
      expect(frame).toContain('referrerPolicy="strict-origin-when-cross-origin"');
      expect(frame).toContain("min-h-[200px]");
      expect(html).toContain(`href="https://www.youtube.com/watch?v=${expected[index]}"`);
      expect(html).toContain("The Neighborhood Chronicles, Book 1: David and Goliath");
      expect(html).not.toContain('href="/start"');
      expect(html).not.toContain("Geezy");
    }
  });

  it("shares the NC welcome page without inventing an invitation film or reward", () => {
    const html = renderToStaticMarkup(page.default({ params: { slug: "bring-two-friends" } }));
    expect(html).toContain("invite two families");
    expect(html).toMatch(/href="\/nc\/welcome"[^>]*>puenpublishing\.com\/nc\/welcome<\/a>/);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("100% FREE");
  });

  it("states the club is pending and links only to the available NC kit request", () => {
    const html = renderToStaticMarkup(page.default({ params: { slug: "join" } }));
    expect(html).toContain("Club registration and referral rewards are not open yet");
    expect(html).toContain("does not create a club account or unlock a free book");
    expect(html).toContain('href="/welcome#vote"');
    expect(html).not.toContain('href="/start"');
    expect(html).not.toContain("<iframe");
    expect(page.generateMetadata({ params: { slug: "join" } }).robots).toEqual({ index: false, follow: true });
  });
});
