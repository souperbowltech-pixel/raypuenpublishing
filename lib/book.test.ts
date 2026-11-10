import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { book1, publisherBrand, author, shareImage, siteMeta } from "@/lib/book";

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

  it("points to an existing cover image file in the public directory", () => {
    expect(book1.coverImage.src).toBe("/book1-cover-v2.jpg");
    const publicPath = path.resolve(__dirname, "..", "public", book1.coverImage.src.replace(/^\//, ""));
    expect(fs.existsSync(publicPath)).toBe(true);
  });
});

/**
 * The 30 Oct cover and the copyright page both read "The Adventures of Geezy
 * Goober, Volume 1: The Search for the Magic Pen". A parent who sees that in an
 * ad must find the same name on the storefront and on the Stripe receipt.
 */
describe("Book 1 title matches the printed cover", () => {
  it("uses the cover's title and volume line", () => {
    expect(book1.title).toBe("The Adventures of Geezy Goober");
    expect(book1.tagline).toBe("Volume 1: The Search for the Magic Pen");
    expect(book1.coverImage.alt).toContain("The Adventures of Geezy Goober");
  });

  // Sarah's corrected interior of 10 Nov 2026 is 36 US Letter pages, cover included.
  it("shows the page count of the final print file", () => {
    expect(book1.pageCount).toBe(36);
  });

  it("drops the retired working title everywhere it is shown", () => {
    expect(siteMeta.description).toContain("The Adventures of Geezy Goober");
    expect(`${book1.title} ${book1.tagline} ${siteMeta.description}`).not.toMatch(/Guide to Icky Sfand/);
  });

  it("ships a link preview image at the size social networks expect", () => {
    const jpg = fs.readFileSync(path.resolve(__dirname, "..", "public", shareImage.url.replace(/^\//, "")));
    // Width and height from the JPEG start-of-frame marker.
    let i = 2;
    let size: { width: number; height: number } | undefined;
    while (i < jpg.length && !size) {
      const marker = jpg[i + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        size = { height: jpg.readUInt16BE(i + 5), width: jpg.readUInt16BE(i + 7) };
      }
      i += 2 + jpg.readUInt16BE(i + 2);
    }
    expect(size).toEqual({ width: shareImage.width, height: shareImage.height });
    expect({ width: shareImage.width, height: shareImage.height }).toEqual({ width: 1200, height: 630 });
  });
});




describe("publisher credit", () => {
  // Ray confirmed the legal name on 3 November 2026. It replaces "New Life
  // Mission Board, Inc." and must match the nonprofit's registration.
  it("names the nonprofit by its registered name", () => {
    expect(publisherBrand.fullCredit).toContain("New Life Mission Network, Inc.");
    expect(publisherBrand.fullCredit).not.toContain("Mission Board");
  });
});
