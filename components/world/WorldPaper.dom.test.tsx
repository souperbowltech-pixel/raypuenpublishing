// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorldPaper } from "./WorldPaper";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  act(() => root.render(<WorldPaper />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
describe("WorldPaper", () => {
  it("waits for the lazy image and then repeats its decoded URL without another download", async () => {
    const paper = container.querySelector("[data-world-paper]") as HTMLDivElement;
    const image = container.querySelector("img")!;
    expect(paper.style.backgroundImage).toBe("");
    expect(image.loading || image.getAttribute("loading")).toBe("lazy");
    act(() => image.dispatchEvent(new Event("load"))); await settle();
    expect(paper.style.backgroundImage).toContain(image.src);
    expect(paper.style.backgroundRepeat).toBe("repeat");
    expect(paper.style.backgroundSize).toBe("512px 512px");
  });
  it("removes a failed texture", async () => {
    act(() => container.querySelector("img")!.dispatchEvent(new Event("error"))); await settle();
    expect(container.querySelector("[data-world-paper]")).toBeNull();
  });
});
