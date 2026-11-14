// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The count-up. GSAP and ScrollTrigger are replaced at the loader seam with
 * recorders, so the test can say when the number scrolls in and step the count.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let enter: (() => void) | undefined;
let triggers = 0;
let triggerVars: Record<string, unknown> | undefined;
let tweenVars: (Record<string, unknown> & { onUpdate?: () => void; onComplete?: () => void }) | undefined;
let counter: { n: number } | undefined;
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
      to: (target: { n: number }, vars: typeof tweenVars) => {
        counter = target;
        tweenVars = vars;
      },
    };
    const ScrollTrigger = {
      create: (vars: Record<string, unknown>) => {
        triggers++;
        triggerVars = vars;
        enter = vars.onEnter as () => void;
      },
    };
    return Promise.resolve({ gsap, ScrollTrigger });
  },
}));

const { CountUp, COUNT_UP_SECONDS } = await import("@/components/motion/CountUp");

let container: HTMLDivElement;
let root: Root;

function setup({ top = 2000, reduced = false } = {}) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);
}
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const digits = () => container.querySelector("span") as HTMLSpanElement;

beforeEach(() => {
  enter = undefined;
  triggers = 0;
  triggerVars = undefined;
  tweenVars = undefined;
  counter = undefined;
  revert.mockReset();
  loaded.mockReset();
  fail = false;
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

describe("CountUp from the server", () => {
  it("sends the real number once, with room kept for its final width", () => {
    const html = renderToStaticMarkup(
      <dd>
        <CountUp value={36} /> pages
      </dd>
    );
    expect(html).toBe('<dd><span class="inline-block text-right tabular-nums" style="min-width:2ch">36</span> pages</dd>');
    expect(html.replace(/<[^>]+>/g, "")).toBe("36 pages"); // what copying, search and screen readers get
  });
});

describe("CountUp in the browser", () => {
  it("counts from 0 to the number when it first scrolls into view, then rests on the real number", async () => {
    setup();
    act(() => root.render(<CountUp value={36} />));
    await settle();
    expect(digits().textContent).toBe("36"); // untouched until it is reached
    expect(triggerVars).toMatchObject({ once: true, start: "top 80%" });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 2000, width: 23.5 } as DOMRect);
    act(() => enter!());
    expect(digits().textContent).toBe("0");
    expect(digits().style.minWidth).toBe("23.5px"); // the real number's width, held while counting
    expect(tweenVars).toMatchObject({ n: 36, duration: COUNT_UP_SECONDS });
    counter!.n = 17.6;
    act(() => tweenVars!.onUpdate!());
    expect(digits().textContent).toBe("18");
    act(() => tweenVars!.onComplete!());
    expect(digits().textContent).toBe("36");
  });

  it("shows a new number when the value changes, whether or not it had counted", async () => {
    setup();
    act(() => root.render(<CountUp value={36} />));
    await settle();
    act(() => root.render(<CountUp value={40} />));
    await settle();
    expect(digits().textContent).toBe("40");

    act(() => enter!());
    act(() => tweenVars!.onComplete!());
    act(() => root.render(<CountUp value={41} />));
    await settle();
    expect(digits().textContent).toBe("41");
  });

  it("carries on counting through a re-render with the same number", async () => {
    setup();
    act(() => root.render(<CountUp value={19} />));
    await settle();
    act(() => enter!());
    act(() => root.render(<CountUp value={19} />));
    act(() => tweenVars!.onComplete!());
    expect(digits().textContent).toBe("19");
    expect(revert).not.toHaveBeenCalled();
  });

  it("makes one scroll link under React's development double run", async () => {
    setup();
    act(() => root.render(<StrictMode><CountUp value={36} /></StrictMode>));
    await settle();
    expect(triggers).toBe(1);
    expect(digits().textContent).toBe("36");
  });

  it.each([
    ["on screen", 100],
    ["scrolled past", -400],
  ])("leaves a number already %s alone", async (_case, top) => {
    setup({ top });
    act(() => root.render(<CountUp value={36} />));
    await settle();
    expect(loaded).not.toHaveBeenCalled();
    expect(digits().textContent).toBe("36");
  });

  it("schedules the count for a number just below the fold", async () => {
    setup({ top: 800 });
    act(() => root.render(<CountUp value={36} />));
    await settle();
    expect(triggers).toBe(1);
  });

  it("never counts for reduced motion", async () => {
    setup({ reduced: true });
    act(() => root.render(<CountUp value={36} />));
    await settle();
    expect(loaded).not.toHaveBeenCalled();
  });

  it("keeps the real number, with a warning, if GSAP cannot load", async () => {
    setup();
    fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => root.render(<CountUp value={36} />));
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(digits().textContent).toBe("36");
  });

  it("starts nothing if the page is left before GSAP arrives", async () => {
    setup();
    act(() => root.render(<CountUp value={36} />));
    act(() => root.unmount());
    await settle();
    expect(triggers).toBe(0);
    root = createRoot(container);
  });

  it("removes the scroll link when the page is left", async () => {
    setup();
    act(() => root.render(<CountUp value={36} />));
    await settle();
    act(() => root.unmount());
    expect(revert).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});
