// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MOTION_FALLBACK_MS } from "@/lib/motion";

/**
 * The GSAP hero title. GSAP itself is replaced with a recorder: what matters
 * here is what the component asks of it, and that the title is never left
 * waiting, whatever happens to the script. Word spacing is a layout question
 * jsdom cannot answer; it is checked in a real browser (see PROGRESS.md).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calls: { targets: Element[]; from: Record<string, unknown>; to: Record<string, unknown> }[] = [];
const revert = vi.fn();
const loaded = vi.fn();
let breakGsap = false;

const fakeGsap = {
  context: (fn: () => void) => {
    if (breakGsap) throw new Error("gsap failed");
    fn();
    return { revert };
  },
  fromTo: (targets: NodeListOf<Element>, from: Record<string, unknown>, to: Record<string, unknown>) => {
    calls.push({ targets: Array.from(targets), from, to });
  },
};

vi.mock("@/components/motion/load-gsap", () => ({
  loadGsap: () => {
    loaded();
    return Promise.resolve({ gsap: fakeGsap });
  },
}));

const { HeroTitle } = await import("@/components/motion/HeroTitle");

let container: HTMLDivElement;
let root: Root;

function prefersReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  calls.length = 0;
  revert.mockReset();
  breakGsap = false;
  vi.spyOn(performance, "now").mockReturnValue(200); // early in the page's life
  prefersReducedMotion(false);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

const heading = () => container.querySelector("h1") as HTMLHeadingElement;
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("HeroTitle", () => {
  it("sends the full title from the server, word by word for the animation, whole for screen readers", () => {
    const html = renderToStaticMarkup(<HeroTitle text="The Adventures of Geezy Goober" />);
    expect(html).toContain('aria-label="The Adventures of Geezy Goober"');
    expect(html.match(/data-word="true"/g)).toHaveLength(5);
    // The gap sits between the word boxes, not inside one, where a browser would drop it.
    expect(html).toContain('<span class="inline-block">The</span></span> <span data-word');
    expect(html).toContain('data-motion="waiting"');
  });

  it("raises every word in turn with GSAP, then marks the title done", async () => {
    act(() => root.render(<HeroTitle text="The Adventures of Geezy Goober" />));
    await settle();

    expect(calls).toHaveLength(1);
    expect(calls[0].targets.map((t) => t.textContent)).toEqual(["The", "Adventures", "of", "Geezy", "Goober"]);
    expect(calls[0].from).toMatchObject({ yPercent: 110, autoAlpha: 0 });
    expect(calls[0].to).toMatchObject({ yPercent: 0, autoAlpha: 1, stagger: 0.08 });
    expect(heading().dataset.motion).toBe("waiting");

    act(() => (calls[0].to.onComplete as () => void)());
    expect(heading().dataset.motion).toBe("done");
  });

  it("starts once under React's development double run, with the title still held until then", async () => {
    act(() => root.render(<StrictMode><HeroTitle text="Geezy Goober" /></StrictMode>));
    expect(heading().dataset.motion).toBe("waiting");
    await settle();
    expect(calls).toHaveLength(1);
    expect(revert).not.toHaveBeenCalled();
  });

  it("still rises on a later in-site visit, timed from when this title appeared", async () => {
    // Long after the page loaded, GSAP already cached: 100 ms after the title is inserted.
    // (React's scheduler reads the clock too, so the time is set, not counted.)
    let now = 60_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    act(() => root.render(<HeroTitle text="Geezy Goober" />));
    now = 60_100;
    await settle();
    expect(calls).toHaveLength(1);
  });

  it("leaves the title alone if GSAP arrives after the CSS fallback has shown it", async () => {
    // Whether timed from the page load (0) or from insertion (200), it arrives over the limit.
    let now = 200;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    act(() => root.render(<HeroTitle text="Geezy Goober" />));
    now = 200 + MOTION_FALLBACK_MS + 1;
    await settle();
    expect(calls).toHaveLength(0);
    expect(heading().dataset.motion).toBe("done");
  });

  it("shows the title if GSAP fails", async () => {
    breakGsap = true;
    act(() => root.render(<HeroTitle text="Geezy Goober" />));
    await settle();
    expect(calls).toHaveLength(0);
    expect(heading().dataset.motion).toBe("done");
  });

  it("shows the title at once, without loading GSAP, for reduced motion", async () => {
    loaded.mockClear();
    prefersReducedMotion(true);
    act(() => root.render(<HeroTitle text="Geezy Goober" />));
    await settle();
    expect(loaded).not.toHaveBeenCalled();
    expect(heading().dataset.motion).toBe("done");
  });

  it("does nothing if the page is left before GSAP arrives", async () => {
    act(() => root.render(<HeroTitle text="Geezy Goober" />));
    act(() => root.unmount());
    await settle();
    expect(calls).toHaveLength(0);
    expect(revert).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("puts the title back and stops the animation when the page is left mid-way", async () => {
    act(() => root.render(<HeroTitle text="Geezy Goober" />));
    await settle();
    const h = heading();
    act(() => root.unmount());
    expect(revert).toHaveBeenCalledTimes(1);
    expect(h.dataset.motion).toBe("done");
    root = createRoot(container);
  });
});
