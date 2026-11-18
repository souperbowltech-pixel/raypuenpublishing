// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORLD_LAYER } from "@/lib/world";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const loaded = vi.fn();
const revert = vi.fn();
const tweens: { from: Record<string, unknown>; to: Record<string, unknown> }[] = [];
let fail = false;
vi.mock("@/components/motion/load-gsap", () => ({
  loadScrollGsap: () => {
    loaded();
    if (fail) return Promise.reject(new Error("offline"));
    return Promise.resolve({ gsap: {
      context: (fn: () => void) => { fn(); return {revert}; },
      fromTo: (_node: Element, from: Record<string, unknown>, to: Record<string, unknown>) => tweens.push({from, to}),
    }});
  },
}));
const { WorldScene } = await import("./WorldScene");
let root: Root;
let container: HTMLDivElement;
let reduced = false;
let change: (() => void) | undefined;
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
beforeEach(() => {
  loaded.mockClear(); revert.mockClear(); tweens.length = 0; fail = false; reduced = false;
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() { return reduced; },
    addEventListener: (_event: string, fn: () => void) => { change = fn; },
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
async function mount() {
  act(() => root.render(<section><WorldScene placement={WORLD_LAYER.placements.gallery} /></section>));
  act(() => container.querySelector("img")!.dispatchEvent(new Event("load")));
  await settle();
}
describe("WorldScene", () => {
  it("ties only a 12 px drift to scrolling across its section", async () => {
    await mount();
    expect(tweens).toHaveLength(1);
    expect(tweens[0].from).toEqual({y:6});
    expect(tweens[0].to).toMatchObject({y:-6, ease:"none", scrollTrigger:{trigger:container.querySelector("section"), scrub:0.8}});
    expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
  it("never loads motion under reduced motion and reverts an active drift on preference change", async () => {
    reduced = true; await mount(); expect(loaded).not.toHaveBeenCalled();
    reduced = false; act(() => change!()); await settle(); expect(tweens).toHaveLength(1);
    reduced = true; act(() => change!()); expect(revert).toHaveBeenCalledTimes(1);
  });
  it("leaves the image still and warns if GSAP cannot load", async () => {
    fail = true; const warn = vi.spyOn(console,"warn").mockImplementation(() => {});
    await mount(); expect(warn).toHaveBeenCalledTimes(1); expect(container.querySelector("img")).not.toBeNull();
  });
  it("removes the failed image and cleans up motion when leaving", async () => {
    await mount();
    act(() => container.querySelector("img")!.dispatchEvent(new Event("error"))); await settle();
    expect(container.querySelector("img")).toBeNull(); expect(revert).toHaveBeenCalledTimes(1);
  });
});
