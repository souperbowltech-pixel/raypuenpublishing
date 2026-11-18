// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadScrollGsap } from "@/components/motion/load-gsap";
import { WorldCharacter } from "./WorldCharacter";
import { WorldScene } from "./WorldScene";
import { WORLD_LAYER } from "@/lib/world";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
afterEach(() => { vi.restoreAllMocks(); });

describe("world motion with real GSAP and ScrollTrigger", () => {
  it.each(["character", "scene"] as const)("registers and cleans up the real %s scroll link and transforms", async kind => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({top:2000, bottom:2200, left:0, right:200, width:200, height:200} as DOMRect);
    const { gsap, ScrollTrigger } = await loadScrollGsap();
    const before = ScrollTrigger.getAll().length;
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    let motion: HTMLDivElement | null = null;
    try {
      act(() => root.render(<section>{kind === "character" ? <WorldCharacter placement={WORLD_LAYER.placements.details} /> : <WorldScene placement={WORLD_LAYER.placements.gallery} />}</section>));
      motion = container.querySelector('[data-world-character] > div, [data-world-scene] > div');
      await act(async () => {
        container.querySelector("img")!.dispatchEvent(new Event("load"));
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(ScrollTrigger.getAll()).toHaveLength(before + 1);
      const trigger = ScrollTrigger.getAll().at(-1)!;
      expect(trigger.vars.trigger).toBe(container.querySelector("section"));
      if (kind === "character") expect(trigger.vars.once).toBe(true);
      else expect(trigger.vars.scrub).toBe(0.8);
      await act(async () => {
        trigger.vars.onEnter?.(trigger);
        await new Promise(resolve => setTimeout(resolve, 20));
        gsap.ticker.tick();
      });
      expect(motion!.style.transform).not.toBe("");
    } finally {
      act(() => root.unmount());
      expect(ScrollTrigger.getAll()).toHaveLength(before);
      expect(motion!.style.transform).toBe("");
      container.remove();
    }
  });
});
