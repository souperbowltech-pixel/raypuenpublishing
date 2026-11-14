import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Huzaifah asked on 15 Nov for the site to carry no emoji. Plain text marks
 * (✓ ✕ ★ ← ·) stay. Internal alert emails (lib/alerts.ts) and tests, which
 * check that a pasted emoji is handled, are not part of the site.
 */

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B50}\u{231A}-\u{23FF}\u{2705}\u{FE0F}]/u;
const repo = path.resolve(__dirname, "..");

function sources(dir: string): string[] {
  return (fs.readdirSync(path.join(repo, dir), { recursive: true }) as string[])
    .map((p) => `${dir}/${p.split(path.sep).join("/")}`)
    .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) && p !== "lib/alerts.ts");
}

describe("the site has no emoji", () => {
  it.each(["app", "components", "lib"])("in %s", (dir) => {
    const offenders = sources(dir).flatMap((file) =>
      fs
        .readFileSync(path.join(repo, file), "utf8")
        .split("\n")
        // ★ is a plain text star in the same Unicode block, and it stays.
        .map((line, i) => (EMOJI.test(line.replace(/★/g, "")) ? `${file}:${i + 1}` : null))
        .filter(Boolean)
    );
    expect(offenders).toEqual([]);
  });
});
