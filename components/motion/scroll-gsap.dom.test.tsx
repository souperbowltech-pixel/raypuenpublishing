// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { loadScrollGsap } from "@/components/motion/load-gsap";
import { CoverParallax } from "@/components/motion/CoverParallax";

/**
 * The real GSAP and ScrollTrigger, not a stand-in: the plugin is registered,
 * and leaving the page removes the scroll link it made, so nothing is left
 * listening after an in-site visit away from the storefront.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no matchMedia; ScrollTrigger needs a full one. "No preference" for motion.
const mediaQuery = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});
window.matchMedia = mediaQuery as unknown as typeof window.matchMedia;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadScrollGsap", () => {
  it("registers ScrollTrigger, and loading twice is harmless", async () => {
    const first = await loadScrollGsap();
    const second = await loadScrollGsap();
    expect(second.ScrollTrigger).toBe(first.ScrollTrigger);
    // Registered: a tween given scrollTrigger settings makes a real scroll link.
    const tween = first.gsap.to(document.createElement("div"), { x: 1, scrollTrigger: { trigger: document.body } });
    expect(tween.scrollTrigger).toBeInstanceOf(first.ScrollTrigger);
    tween.scrollTrigger?.kill();
    tween.kill();
  });
});

describe("CoverParallax with the real ScrollTrigger", () => {
  it("makes one scroll link while shown and removes it, and its transform, when the page is left", async () => {
    const { ScrollTrigger } = await loadScrollGsap();
    const before = ScrollTrigger.getAll().length;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <section>
          <CoverParallax>
            <p>cover</p>
          </CoverParallax>
        </section>
      )
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const wrapper = container.querySelector("section > div") as HTMLDivElement;
    expect(ScrollTrigger.getAll().length).toBe(before + 1);

    act(() => root.unmount());
    expect(ScrollTrigger.getAll().length).toBe(before);
    expect(wrapper.style.transform).toBe("");
    container.remove();
  });
});
