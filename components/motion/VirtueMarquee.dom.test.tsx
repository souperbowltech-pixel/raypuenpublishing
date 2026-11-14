// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { PAGE_STICKER_META } from "@/lib/stickers";
import { stickerBadgePath } from "@/lib/gamification";

/**
 * The virtue strip. GSAP is replaced at the loader seam with a loop that
 * records pause and play, so the controls can be checked without a browser.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));

const loop = { pause: vi.fn(), play: vi.fn() };
const toCalls: { target: Element; vars: Record<string, unknown> }[] = [];
const revert = vi.fn();
const loaded = vi.fn();
let fail = false;

vi.mock("@/components/motion/load-gsap", () => ({
  loadGsap: () => {
    loaded();
    if (fail) return Promise.reject(new Error("offline"));
    const gsap = {
      context: (fn: () => void) => {
        fn();
        return { revert };
      },
      to: (target: Element, vars: Record<string, unknown>) => {
        toCalls.push({ target, vars });
        return loop;
      },
    };
    return Promise.resolve({ gsap });
  },
}));

const { VirtueMarquee, MARQUEE_LOOP_SECONDS, BOOK1_VIRTUE_BADGES } = await import("@/components/motion/VirtueMarquee");

const badges = [
  { label: "Courage", src: "/stickers/slot-14.png" },
  { label: "Patience", src: "/stickers/slot-12.png" },
  { label: "Integrity", src: "/stickers/slot-19.png" },
];

let seen: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    seen = callback;
  }
  observe() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

function prefersReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const button = () => container.querySelector("button") as HTMLButtonElement | null;
const lists = () => Array.from(container.querySelectorAll("ul"));
const stripArea = () => container.querySelector("div.mt-4") as HTMLDivElement;

/** A pointer event of the given kind, as React reads it. */
function pointer(type: "pointerover" | "pointerout", pointerType: string) {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => stripArea().dispatchEvent(event));
}

async function mountMoving() {
  act(() => root.render(<VirtueMarquee badges={badges} />));
  await settle();
  loop.pause.mockClear();
  loop.play.mockClear();
}

beforeEach(() => {
  toCalls.length = 0;
  loop.pause.mockReset();
  loop.play.mockReset();
  revert.mockReset();
  loaded.mockReset();
  fail = false;
  seen = undefined;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  prefersReducedMotion(false);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VirtueMarquee from the server", () => {
  const html = renderToStaticMarkup(<VirtueMarquee badges={badges} />);

  it("sends one still list, with room already kept for the pause button", () => {
    expect(html.match(/<ul/g)).toHaveLength(1);
    // The real number, once, so the heading reads "3 virtues..." for copy, search and screen readers.
    const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(html)![1].replace(/<[^>]+>/g, "");
    expect(heading).toBe("3 virtues to color in Book 1");
    expect(html).not.toContain("<button");
    expect(html).toMatch(/<div class="container-page flex min-h-11 /);
  });

  it("makes the still row a named region the keyboard can scroll", () => {
    expect(html).toMatch(/tabindex="0" role="region" aria-label="Virtues in Book 1"/);
  });

  it("lets the list wrap for reduced motion, so every virtue shows without scrolling", () => {
    expect(html).toContain("motion-reduce:flex-wrap");
    expect(html).toContain("motion-reduce:overflow-visible");
    expect(html).toContain("motion-reduce:w-auto");
  });
});

describe("VirtueMarquee moving", () => {
  it("loops the strip by exactly one copy, with a second copy hidden from screen readers", async () => {
    await mountMoving();
    expect(toCalls).toHaveLength(1);
    expect(toCalls[0].vars).toMatchObject({ xPercent: -50, ease: "none", repeat: -1, duration: MARQUEE_LOOP_SECONDS });
    expect(lists()).toHaveLength(2);
    expect(lists()[0].getAttribute("aria-hidden")).toBeNull();
    expect(lists()[1].getAttribute("aria-hidden")).toBe("true");
    // Any padding on the track would make -50% more or less than one copy.
    expect(toCalls[0].target.getAttribute("class")).not.toMatch(/\bp[xyselrtb]?-/);
    expect(stripArea().hasAttribute("tabindex")).toBe(false);
  });

  it("can be paused and played again, and says which it is", async () => {
    await mountMoving();
    expect(button()?.getAttribute("aria-pressed")).toBe("false");
    act(() => button()!.click());
    expect(loop.pause).toHaveBeenCalled();
    expect(button()?.getAttribute("aria-pressed")).toBe("true");
    expect(button()?.textContent).toContain("Play");
    act(() => button()!.click());
    expect(loop.play).toHaveBeenCalled();
  });

  it("rests under a mouse, but stays paused afterwards if the reader paused it", async () => {
    await mountMoving();
    pointer("pointerover", "mouse");
    expect(loop.pause).toHaveBeenCalledTimes(1);
    pointer("pointerout", "mouse");
    expect(loop.play).toHaveBeenCalledTimes(1);

    act(() => button()!.click());
    loop.play.mockClear();
    pointer("pointerover", "mouse");
    pointer("pointerout", "mouse");
    expect(loop.play).not.toHaveBeenCalled();
  });

  it("stays rested under the mouse when it scrolls back into view", async () => {
    await mountMoving();
    pointer("pointerover", "mouse");
    act(() => seen!([{ isIntersecting: false }]));
    loop.play.mockClear();
    act(() => seen!([{ isIntersecting: true }]));
    expect(loop.play).not.toHaveBeenCalled();
  });

  it("does not freeze when a finger taps it", async () => {
    await mountMoving();
    pointer("pointerover", "touch");
    expect(loop.pause).not.toHaveBeenCalled();
    expect(button()?.getAttribute("aria-pressed")).toBe("false");
  });

  it("rests while scrolled out of view and resumes when back, unless paused", async () => {
    await mountMoving();
    act(() => seen!([{ isIntersecting: false }]));
    expect(loop.pause).toHaveBeenCalledTimes(1);
    act(() => seen!([{ isIntersecting: true }]));
    expect(loop.play).toHaveBeenCalledTimes(1);

    act(() => button()!.click());
    loop.play.mockClear();
    act(() => seen!([{ isIntersecting: true }]));
    expect(loop.play).not.toHaveBeenCalled();
  });

  it("stops the loop when the page is left", async () => {
    await mountMoving();
    act(() => root.unmount());
    expect(revert).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});

describe("VirtueMarquee staying still", () => {
  it("never loads GSAP for reduced motion", async () => {
    prefersReducedMotion(true);
    act(() => root.render(<VirtueMarquee badges={badges} />));
    await settle();
    expect(loaded).not.toHaveBeenCalled();
    expect(lists()).toHaveLength(1);
    expect(button()).toBeNull();
  });

  it("stays a still, scrollable row with a warning if GSAP cannot load", async () => {
    fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => root.render(<VirtueMarquee badges={badges} />));
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(lists()).toHaveLength(1);
    expect(button()).toBeNull();
    expect(stripArea().getAttribute("tabindex")).toBe("0");
  });

  it("starts nothing if the page is left before GSAP arrives", async () => {
    act(() => root.render(<VirtueMarquee badges={badges} />));
    act(() => root.unmount());
    await settle();
    expect(toCalls).toHaveLength(0);
    root = createRoot(container);
  });
});

describe("the storefront's badges", () => {
  it("are the book's 19 virtues in page order, each with a badge file that exists", () => {
    const storefront = BOOK1_VIRTUE_BADGES;
    expect(storefront.map((b) => b.label)).toEqual(PAGE_STICKER_META.map((page) => page.virtue));
    expect(storefront[0].src).toBe(stickerBadgePath(1));
    expect(storefront).toHaveLength(19);
    expect(new Set(storefront.map((b) => b.label)).size).toBe(19);
    for (const badge of storefront) {
      expect(fs.existsSync(path.resolve(__dirname, "../../public", badge.src.slice(1))), badge.src).toBe(true);
    }
  });
});
