// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Reveal } from "@/components/ui/Reveal";
import { REVEAL_SETTLE_MS, REVEAL_STAGGER_CAP } from "@/lib/motion";

/**
 * The part of Reveal that runs in the browser: what it hides, when it shows it
 * again, and that it never leaves anything hidden. jsdom has no layout and no
 * IntersectionObserver, so the group's position and the observer are supplied.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeObserver {
  static made: FakeObserver[] = [];
  connected = true;
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.made.push(this);
  }
  observe() {}
  disconnect() {
    this.connected = false;
  }
  enter() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

let container: HTMLDivElement;
let root: Root;

function place({ top, reduced = false }: { top: number; reduced?: boolean }) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);
}

function mount(count: number, strict = false) {
  const items = Array.from({ length: count }, (_, i) => <p key={i}>Item {i}</p>);
  const tree = <Reveal className="group">{items}</Reveal>;
  act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
  return container.querySelector(".group") as HTMLDivElement;
}

const steps = (group: HTMLElement) =>
  Array.from(group.children).map((child) => (child as HTMLElement).style.getPropertyValue("--reveal-i"));

beforeEach(() => {
  vi.useFakeTimers();
  FakeObserver.made = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a group below the fold", () => {
  it("waits hidden, numbered for the stagger, then enters when reached", () => {
    place({ top: 1200 });
    const group = mount(9);

    expect(group.dataset.reveal).toBe("pending");
    const cap = String(REVEAL_STAGGER_CAP);
    expect(steps(group)).toEqual(["0", "1", "2", "3", "4", "5", cap, cap, cap]);

    act(() => FakeObserver.made[0].enter());
    expect(group.dataset.reveal).toBe("shown");
    expect(FakeObserver.made[0].connected).toBe(false);
  });

  it("drops the entrance state once it has played, so children keep their own timing", () => {
    place({ top: 1200 });
    const group = mount(3);
    act(() => FakeObserver.made[0].enter());

    act(() => vi.advanceTimersByTime(REVEAL_SETTLE_MS - 1));
    expect(group.dataset.reveal).toBe("shown");
    act(() => vi.advanceTimersByTime(1));
    expect(group.hasAttribute("data-reveal")).toBe(false);
    expect(steps(group)).toEqual(["", "", ""]);
  });

  it("is never left hidden when the page is left before it was reached", () => {
    place({ top: 1200 });
    const group = mount(2);
    act(() => root.render(<div />));
    expect(group.hasAttribute("data-reveal")).toBe(false);
    expect(FakeObserver.made[0].connected).toBe(false);
  });

  it("survives React's development double mount with exactly one observer watching", () => {
    place({ top: 1200 });
    const group = mount(2, true);

    expect(group.dataset.reveal).toBe("pending");
    const watching = FakeObserver.made.filter((observer) => observer.connected);
    expect(watching).toHaveLength(1);
    act(() => watching[0].enter());
    expect(group.dataset.reveal).toBe("shown");
  });
});

describe("a list", () => {
  it("stays a list and staggers its items", () => {
    place({ top: 1200 });
    act(() =>
      root.render(
        <Reveal as="ul" className="list">
          <li>One</li>
          <li>Two</li>
        </Reveal>
      )
    );
    const list = container.querySelector("ul.list") as HTMLUListElement;
    expect(list).not.toBeNull();
    expect(list.dataset.reveal).toBe("pending");
    expect(steps(list)).toEqual(["0", "1"]);
  });
});

describe("a group that is never hidden", () => {
  it("leaves a group already on screen alone", () => {
    place({ top: 100 });
    expect(mount(2).hasAttribute("data-reveal")).toBe(false);
    expect(FakeObserver.made).toHaveLength(0);
  });

  it("does nothing for someone who asked for reduced motion", () => {
    place({ top: 1200, reduced: true });
    expect(mount(2).hasAttribute("data-reveal")).toBe(false);
  });

  it("does nothing in a browser without IntersectionObserver", () => {
    place({ top: 1200 });
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(mount(2).hasAttribute("data-reveal")).toBe(false);
  });
});
