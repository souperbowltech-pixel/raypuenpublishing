// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORLD_LAYER, type CharacterPlacement, type WorldEntrance } from "@/lib/world";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const loaded = vi.fn();
const revert = vi.fn();
const play = vi.fn();
const steps: Record<string, unknown>[] = [];
const triggers: { once: boolean; trigger: Element; onEnter: () => void }[] = [];
let fail = false;
let hold = false;
let resolveLoad: (() => void) | undefined;

vi.mock("@/components/motion/load-gsap", () => {
  const load = () => {
    loaded();
    if (fail) return Promise.reject(new Error("offline"));
    const timeline = {
      fromTo: (_node: Element, from: Record<string, unknown>, to: Record<string, unknown>) => { steps.push({ from, ...to }); return timeline; },
      to: (_node: Element, vars: Record<string, unknown>) => { steps.push(vars); return timeline; },
      play,
    };
    const motionModule = {
      gsap: { context: (fn: () => void) => { fn(); return { revert }; }, timeline: () => timeline },
      ScrollTrigger: { create: (vars: typeof triggers[number]) => triggers.push(vars) },
    };
    if (hold) return new Promise(resolve => { resolveLoad = () => resolve(motionModule); });
    return Promise.resolve(motionModule);
  };
  return { loadGsap: load, loadScrollGsap: load };
});

const { WorldCharacter } = await import("./WorldCharacter");
let container: HTMLDivElement;
let root: Root;
let reduced = false;
let change: (() => void) | undefined;
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const placement = (entrance: WorldEntrance): CharacterPlacement => ({ ...WORLD_LAYER.placements.hero, eager: entrance === "peek", entrance });

beforeEach(() => {
  loaded.mockClear(); revert.mockClear(); play.mockClear();
  steps.length = 0; triggers.length = 0; fail = false; reduced = false; change = undefined; hold = false; resolveLoad = undefined;
  WORLD_LAYER.enabled = true;
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() { return reduced; },
    addEventListener: (_event: string, listener: () => void) => { change = listener; },
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); WORLD_LAYER.enabled = true; vi.restoreAllMocks(); });

async function mount(entrance: WorldEntrance = "rise", strict = false) {
  const content = <section data-world-trigger=""><WorldCharacter placement={placement(entrance)} /></section>;
  act(() => root.render(strict ? <StrictMode>{content}</StrictMode> : content));
  await settle();
}
async function imageLoaded() {
  act(() => container.querySelector("img")!.dispatchEvent(new Event("load")));
  await settle();
}

describe("WorldCharacter motion", () => {
  it("waits for the actual image before starting a finite hero entrance", async () => {
    await mount("peek");
    expect(loaded).not.toHaveBeenCalled();
    await imageLoaded();
    expect(steps[0]).toMatchObject({ from: { x: -24 }, x: 0 });
    expect(steps.reduce((sum, step) => sum + Number(step.duration), 0)).toBeLessThan(5);
    expect(steps.every(step => step.repeat !== -1 && step.opacity === undefined)).toBe(true);
    expect(triggers).toHaveLength(0);
  });
  it.each(["wiggle", "rise", "walk", "wave"] as const)("plays %s only once when its section enters", async entrance => {
    await mount(entrance);
    await imageLoaded();
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({ once: true, trigger: container.querySelector("section") });
    expect(play).not.toHaveBeenCalled();
    act(() => { triggers[0].onEnter(); triggers[0].onEnter(); });
    expect(play).toHaveBeenCalledTimes(1);
  });
  it("leaves every entrance still under reduced motion", async () => {
    reduced = true;
    await mount(); await imageLoaded();
    expect(loaded).not.toHaveBeenCalled();
    expect(container.querySelector("img")).not.toBeNull();
  });
  it("does not load motion for a decoration hidden by its responsive layout", async () => {
    vi.mocked(HTMLElement.prototype.getClientRects).mockReturnValue([] as unknown as DOMRectList);
    await mount(); await imageLoaded();
    expect(loaded).not.toHaveBeenCalled();
  });
  it("reverts immediately when reduced motion is selected and does not repeat a played entrance", async () => {
    await mount(); await imageLoaded();
    act(() => triggers[0].onEnter());
    reduced = true; act(() => change!());
    expect(revert).toHaveBeenCalledTimes(1);
    reduced = false; act(() => change!()); await settle();
    expect(loaded).toHaveBeenCalledTimes(1);
  });
  it("keeps the image still and warns if the animation chunk fails", async () => {
    fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mount(); await imageLoaded();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(container.querySelector("img")).not.toBeNull();
    expect(triggers).toHaveLength(0);
  });
  it("removes an image that fails instead of showing a broken decoration", async () => {
    await mount();
    act(() => container.querySelector("img")!.dispatchEvent(new Event("error")));
    await settle();
    expect(container.querySelector("[data-world-character]")).toBeNull();
  });
  it("cancels an in-flight load when the page is left", async () => {
    hold = true;
    await mount(); await imageLoaded();
    expect(loaded).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    resolveLoad!();
    await settle();
    expect(triggers).toHaveLength(0);
    root = createRoot(container);
  });
  it("cancels an in-flight load if reduced motion is selected", async () => {
    hold = true;
    await mount(); await imageLoaded();
    reduced = true; act(() => change!());
    resolveLoad!(); await settle();
    expect(triggers).toHaveLength(0);
    expect(steps).toHaveLength(0);
  });
  it("cleans up the context on unmount, including in StrictMode", async () => {
    await mount("rise", true); await imageLoaded();
    expect(triggers).toHaveLength(1);
    act(() => root.unmount());
    expect(revert).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});
