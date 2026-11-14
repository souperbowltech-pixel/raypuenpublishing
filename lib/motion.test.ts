import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "@/tailwind.config";
import {
  MOTION_FALLBACK_MS,
  REVEAL_DURATION_MS,
  REVEAL_SETTLE_MS,
  REVEAL_STAGGER_CAP,
  REVEAL_STEP_MS,
  revealIndex,
  shouldDeferReveal,
} from "@/lib/motion";

describe("shouldDeferReveal", () => {
  it("holds back a group that starts below the fold", () => {
    expect(shouldDeferReveal(900, 800, false)).toBe(true);
    expect(shouldDeferReveal(800, 800, false)).toBe(true);
  });

  it("leaves a group the reader can already see alone", () => {
    expect(shouldDeferReveal(0, 800, false)).toBe(false);
    expect(shouldDeferReveal(799, 800, false)).toBe(false);
    expect(shouldDeferReveal(-300, 800, false)).toBe(false);
  });

  it("never hides anything for someone who asked for reduced motion", () => {
    expect(shouldDeferReveal(5000, 800, true)).toBe(false);
  });

  it("shows the group when the measurements make no sense", () => {
    expect(shouldDeferReveal(Number.NaN, 800, false)).toBe(false);
    expect(shouldDeferReveal(900, 0, false)).toBe(false);
    expect(shouldDeferReveal(900, Number.POSITIVE_INFINITY, false)).toBe(false);
  });
});

describe("revealIndex", () => {
  it("steps each child one beat later", () => {
    expect([0, 1, 2].map(revealIndex)).toEqual([0, 1, 2]);
  });

  it("caps the delay so a long list does not crawl in", () => {
    expect(revealIndex(40)).toBe(REVEAL_STAGGER_CAP);
  });

  it("treats a bad index as the first", () => {
    expect(revealIndex(-1)).toBe(0);
    expect(revealIndex(1.5)).toBe(0);
  });
});

describe("motion tokens", () => {
  const extend = config.theme?.extend as {
    keyframes: Record<string, unknown>;
    animation: Record<string, string>;
    transitionTimingFunction: Record<string, string>;
  };

  it("names a real keyframe in every animation utility", () => {
    for (const [name, value] of Object.entries(extend.animation)) {
      const keyframe = value.split(" ")[0];
      expect(extend.keyframes, `animation "${name}"`).toHaveProperty([keyframe]);
    }
  });

  it("keeps every celebration short enough not to hold the reader up", () => {
    for (const value of Object.values(extend.animation)) {
      const ms = value.split(" ").filter((part) => /^\d+ms$/.test(part)).map((part) => parseInt(part, 10));
      expect(ms.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(850);
    }
  });

  it("only moves transform and opacity, which a phone can animate without relayout", () => {
    for (const frames of Object.values(extend.keyframes) as Record<string, Record<string, string>>[]) {
      for (const pose of Object.values(frames)) {
        expect(Object.keys(pose).every((prop) => prop === "transform" || prop === "opacity")).toBe(true);
      }
    }
  });

  it("gives transitions a slow in and slow out", () => {
    expect(extend.transitionTimingFunction["out-soft"]).toMatch(/^cubic-bezier\(/);
  });
});

describe("globals.css, as Tailwind compiles it", async () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  // Compiled against markup that uses the classes, as a page would; unused ones are purged.
  const { css } = await postcss([
    tailwindcss({
      ...config,
      content: [{ raw: '<a class="btn-primary btn-secondary lift animate-stamp">', extension: "html" }],
    }),
  ]).process(source, { from: undefined });
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  };

  it("squashes both button styles on press, but not a disabled one", () => {
    for (const button of [".btn-primary", ".btn-secondary"]) {
      expect(rule(`${button}:active:not(:disabled):not([aria-disabled="true"])`)).toContain("scale(0.96)");
      expect(rule(button)).toContain("transition-duration: 120ms");
    }
  });

  it("lifts a card only where a real pointer can hover", () => {
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.lift:hover \{/);
    expect(rule(".lift")).toContain("transition-duration: 200ms");
  });

  it("puts the Reveal rules after .lift, so a lifting card inside a Reveal still enters", () => {
    // Same specificity: whichever comes later wins. The wholesale tier cards rely on this.
    expect(css.indexOf(".lift {")).toBeGreaterThan(-1);
    expect(css.indexOf('[data-reveal="shown"] > *')).toBeGreaterThan(css.indexOf(".lift {"));
  });

  it("shows the GSAP hero words by CSS after the same time the script gives up waiting", () => {
    expect(css).toContain(`animation: motion-fallback 0s linear ${MOTION_FALLBACK_MS / 1000}s forwards`);
  });

  it("emits the keyframe for an animation a page uses", () => {
    expect(css).toContain("@keyframes stamp");
  });

  it("only hides a Reveal group once script has marked it pending", () => {
    expect(rule('[data-reveal="pending"] > *')).toContain("opacity: 0");
    expect(css).not.toMatch(/\[data-reveal\] > \*[^{]*\{[^}]*opacity: 0/);
  });

  it("animates only opacity and translate on entrance, at the timing lib/motion.ts settles by", () => {
    const shown = rule('[data-reveal="shown"] > *');
    expect(shown).toContain("transition-property: opacity, translate");
    expect(shown).toContain(`transition-duration: ${REVEAL_DURATION_MS}ms`);
    expect(shown).toContain(`* ${REVEAL_STEP_MS}ms)`);
    expect(REVEAL_SETTLE_MS).toBeGreaterThan(REVEAL_DURATION_MS + REVEAL_STAGGER_CAP * REVEAL_STEP_MS);
  });

  it("prints every section, even one never scrolled to", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\[data-reveal\] > \* \{\s*opacity: 1 !important;/);
  });

  it("still cuts every animation, transition and delay for reduced motion", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const line of [
      "animation-duration: 0.001ms !important",
      "transition-duration: 0.001ms !important",
      "animation-delay: 0s !important",
      "transition-delay: 0s !important",
    ]) {
      expect(block).toContain(line);
    }
  });
});
