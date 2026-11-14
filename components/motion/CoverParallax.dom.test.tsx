// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The cover's scroll motion. GSAP is replaced with a recorder at the loader
 * seam; what matters is what the component asks for and that the cover is
 * left untouched whenever the motion cannot or should not run.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tweens: { target: Element; vars: Record<string, unknown> }[] = [];
const revert = vi.fn();
const loaded = vi.fn();
let fail = false;

vi.mock("@/components/motion/load-gsap", () => ({
  loadScrollGsap: () => {
    loaded();
    if (fail) return Promise.reject(new Error("offline"));
    const gsap = {
      context: (fn: () => void) => {
        fn();
        return { revert };
      },
      to: (target: Element, vars: Record<string, unknown>) => tweens.push({ target, vars }),
    };
    return Promise.resolve({ gsap, ScrollTrigger: {} });
  },
}));

const { CoverParallax } = await import("@/components/motion/CoverParallax");

let container: HTMLDivElement;
let root: Root;

function prefersReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

function mount() {
  act(() =>
    root.render(
      <section id="hero">
        <CoverParallax>
          <img alt="cover" />
        </CoverParallax>
      </section>
    )
  );
}

beforeEach(() => {
  tweens.length = 0;
  revert.mockReset();
  loaded.mockReset();
  fail = false;
  prefersReducedMotion(false);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

describe("CoverParallax", () => {
  it("ties a small lift and turn to scrolling past the hero section", async () => {
    mount();
    await settle();
    expect(tweens).toHaveLength(1);
    const { target, vars } = tweens[0];
    expect(target.querySelector("img")).not.toBeNull();
    expect(vars).toMatchObject({ yPercent: -12, rotate: -4, ease: "none" });
    const trigger = vars.scrollTrigger as Record<string, unknown>;
    expect((trigger.trigger as Element).id).toBe("hero");
    expect(trigger).toMatchObject({ start: "top top", end: "bottom top" });
    expect(trigger.scrub).toBeGreaterThan(0);
  });

  it("never loads GSAP for reduced motion, leaving the cover still", async () => {
    prefersReducedMotion(true);
    mount();
    await settle();
    expect(loaded).not.toHaveBeenCalled();
    expect(tweens).toHaveLength(0);
  });

  it("leaves the cover still, with a warning, if GSAP cannot load", async () => {
    fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount();
    await settle();
    expect(tweens).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("removes the scroll link when the page is left", async () => {
    mount();
    await settle();
    act(() => root.unmount());
    expect(revert).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("starts nothing if the page is left before GSAP arrives", async () => {
    mount();
    act(() => root.unmount());
    await settle();
    expect(tweens).toHaveLength(0);
    root = createRoot(container);
  });
});
