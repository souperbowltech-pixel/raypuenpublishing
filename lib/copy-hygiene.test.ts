import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEMO_SCOUT_TOKEN } from "@/lib/family";
import { getSiteOrigin } from "@/lib/site";

/**
 * AUDIT OPS-03 and FE-07 — two things that were fixed quietly and could come
 * back just as quietly.
 *
 * The demo token was re-typed as a literal in four files; rotating it would have
 * left stale copies behind. The storefront carried "[Placeholder] ... Card
 * handling is added in Milestone 2" next to a working Stripe checkout. Neither
 * shows up in a type error or a failing build, so a test is the only thing that
 * would notice either returning.
 */

const repo = path.resolve(__dirname, "..");

function sourceFiles(...dirs: string[]): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(path.relative(repo, full).split(path.sep).join("/"));
    }
  };
  for (const dir of dirs) walk(path.join(repo, dir));
  return found;
}

const read = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");

describe("the demo token is written down once", () => {
  it("appears nowhere but the module that defines it", () => {
    // Tests may name it freely; it is production code that must import it.
    const offenders = sourceFiles("app", "components", "lib")
      .filter((f) => f !== "lib/family.ts" && !/\.test\.tsx?$/.test(f))
      .filter((f) => read(f).includes(DEMO_SCOUT_TOKEN));
    expect(offenders).toEqual([]);
  });

  it("is still the value the fallbacks are built around", () => {
    expect(DEMO_SCOUT_TOKEN).toBe("CAPTAIN-RAY-700");
  });
});

describe("nothing on the storefront still calls itself a placeholder", () => {
  it("carries no bracketed placeholder copy", () => {
    const offenders = sourceFiles("app", "components").filter((f) =>
      read(f).includes("[Placeholder]")
    );
    expect(offenders).toEqual([]);
  });

  it("no longer tells a paying customer that card handling comes later", () => {
    // Stripe checkout has been live since Sept; this copy sat next to it.
    const offenders = sourceFiles("app", "components").filter((f) =>
      read(f).includes("Milestone 2")
    );
    expect(offenders).toEqual([]);
  });
});

describe("nothing hands out the hosting platform's address", () => {
  it("builds share and referral links from the brand's own domain", () => {
    // Two dashboard cards hard-coded raypuenpublishing.vercel.app as their
    // server-render fallback, so a link a child copied could carry the platform
    // host instead of puenpublishing.com. The same address reached a printed
    // institutional covenant, where it would die the day the site is moved.
    const offenders = sourceFiles("app", "components", "lib")
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => read(f).includes("vercel.app"));
    expect(offenders).toEqual([]);
  });

  it("has one authoritative origin to fall back to", () => {
    expect(getSiteOrigin()).not.toContain("vercel.app");
  });
});
