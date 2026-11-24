import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  NEIGHBORHOOD_VIDEOS,
  SAMPLE_ENTRIES,
  badgeImage,
  neighborhoodEmbedUrl,
  pageImage,
} from "@/lib/neighborhood";

const publicDir = path.resolve(__dirname, "..", "public");
const exists = (url: string) => fs.existsSync(path.join(publicDir, url));

describe("the Neighborhood Chronicles sample kit", () => {
  it("embeds both of Ray's videos through youtube-nocookie", () => {
    expect(NEIGHBORHOOD_VIDEOS.map((v) => v.title)).toEqual(["Welcome Video", "Video 1"]);
    for (const video of NEIGHBORHOOD_VIDEOS) {
      expect(neighborhoodEmbedUrl(video)).toBe(
        `https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1&playsinline=1`
      );
    }
  });

  it("refuses a pasted link in place of a video id", () => {
    expect(() => neighborhoodEmbedUrl({ title: "Broken", youtubeId: "https://youtu.be/CwillOje7qY" })).toThrow(/Broken/);
  });

  it("shows three entries, each on the interior page one after its entry number", () => {
    // Page 1 is the cover, so entry n is printed on page n + 1.
    expect(SAMPLE_ENTRIES.map((e) => [e.entry, e.page])).toEqual([
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
  });

  it("has a coloring page and a badge on disk for every entry, and the cover and link preview", () => {
    const missing = [
      "/neighborhood/cover.jpg",
      "/neighborhood/og.jpg",
      ...SAMPLE_ENTRIES.flatMap((e) => [pageImage(e), badgeImage(e)]),
    ].filter((url) => !exists(url));
    expect(missing).toEqual([]);
  });

  it("gives every entry the full Guide text, with a four line poem and a cited verse", () => {
    for (const e of SAMPLE_ENTRIES) {
      expect(e.quatrain).toHaveLength(4);
      expect(e.scripture.reference).toMatch(/^1 Samuel 16:\d+[a-c]? \(NKJV\)$/);
      for (const text of [e.trait, e.whatItMeans, e.badge, e.parable, e.theCatch, e.parentConnection]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("leaves out the illustrator's notes, which are written for Sarah, not for parents", () => {
    const all = JSON.stringify(SAMPLE_ENTRIES);
    expect(all).not.toMatch(/Illustrator|Blueprint|Draw /);
  });

  it("uses Ray's colour badges, cut out so they sit on any background", () => {
    for (const entry of SAMPLE_ENTRIES) {
      const png = fs.readFileSync(path.join(publicDir, badgeImage(entry)));
      // IHDR: width and height at bytes 16 and 20, colour type at byte 25 (6 = RGB with alpha).
      expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(400);
      expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(400);
      expect(png[25]).toBe(6);
    }
  });
});
