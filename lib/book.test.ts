import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { book1, publisherBrand, author } from "@/lib/book";

/**
 * The credit line is a permission, not a style choice.
 *
 * Ray's daughter gave permission on 25 September 2026 for her daughters to be
 * credited by their MIDDLE names only, and Ray sent the exact wording. Their
 * first names had been published in the storefront copy until then. These tests
 * exist so that can never come back by accident.
 */

const FORBIDDEN_FIRST_NAMES = ["Kira", "Cayleigh"];

describe("the granddaughters' credit", () => {
  it("uses Ray's exact permitted wording", () => {
    expect(book1.byline).toBe("By Ray Puen inspired by Grace and Joy.");
  });

  it("never carries their first names in the book or publisher copy", () => {
    const copy = JSON.stringify({ book1, publisherBrand, author });
    for (const name of FORBIDDEN_FIRST_NAMES) {
      expect(copy).not.toContain(name);
    }
  });

  it("never carries their first names anywhere in the source the site renders", () => {
    const roots = ["app", "components", "lib", "data"].map((d) =>
      path.resolve(__dirname, "..", d)
    );

    const offenders: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        // This file names them in order to forbid them.
        if (full === __filename) continue;
        if (!/\.(ts|tsx|json|md)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, "utf8");
        for (const name of FORBIDDEN_FIRST_NAMES) {
          if (text.includes(name)) offenders.push(`${full} contains "${name}"`);
        }
      }
    };
    roots.forEach(walk);

    expect(offenders).toEqual([]);
  });

  it("sets book dimensions to confirmed 8.5 x 11 US Letter format", () => {
    expect(book1.dimensions).toBe('8.5" × 11" (US Letter, softcover)');
  });
});

