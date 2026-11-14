// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useJustBecameTrue } from "@/components/ui/useJustBecameTrue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ flag, ready }: { flag: boolean; ready?: boolean }) {
  return <p>{String(useJustBecameTrue(flag, ready))}</p>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

const show = (flag: boolean, ready?: boolean, strict = false) => {
  const probe = <Probe flag={flag} ready={ready} />;
  act(() => root.render(strict ? <StrictMode>{probe}</StrictMode> : probe));
  return container.textContent;
};

describe("useJustBecameTrue", () => {
  it("celebrates something that turns on while the reader is here", () => {
    expect(show(false)).toBe("false");
    expect(show(true)).toBe("true");
    expect(show(true)).toBe("true"); // stays on, so the class stays and the animation does not restart
  });

  it("does not celebrate what was already on when the page opened", () => {
    expect(show(true)).toBe("false");
    expect(show(true)).toBe("false");
  });

  it("celebrates again if it goes off and comes back on", () => {
    show(true);
    expect(show(false)).toBe("false");
    expect(show(true)).toBe("true");
  });

  it("takes its baseline from the first ready render, not the loading screen", () => {
    expect(show(false, false)).toBe("false"); // still loading: no data yet
    expect(show(true, true)).toBe("false"); // loaded, and it was already unlocked
    expect(show(false, false)).toBe("false");
  });

  it("celebrates an unlock that comes after the page finished loading", () => {
    expect(show(false, false)).toBe("false");
    expect(show(false, true)).toBe("false");
    expect(show(true, true)).toBe("true");
  });

  it("keeps its baseline when the page goes back to loading for a while", () => {
    show(true, true);
    expect(show(true, false)).toBe("false");
    expect(show(true, true)).toBe("false"); // still the unlock it opened with
  });

  it("does the same under React's development double render", () => {
    expect(show(true, true, true)).toBe("false");
    expect(show(false, true, true)).toBe("false");
    expect(show(true, true, true)).toBe("true");
  });
});
