// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LibraryForm } from "@/app/library/LibraryForm";
import GrandpaSponsorCard from "@/components/dashboard/GrandpaSponsorCard";

/**
 * The Doherty threshold, exercised: the moment a button that waits on the
 * network is pressed, it shows a spinner and stops taking more presses. The
 * request is left hanging, as a slow connection would.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function press(button: HTMLButtonElement) {
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function expectBusy(button: HTMLButtonElement, words: RegExp) {
  expect(button.disabled).toBe(true);
  expect(button.querySelector('svg.animate-spin[aria-hidden="true"]')).not.toBeNull();
  expect(button.textContent).toMatch(words);
}

describe("busy buttons", () => {
  it("the library download shows a spinner as soon as it is pressed", () => {
    window.history.replaceState(null, "", "/library#code=ABCD-2345-WXYZ");
    act(() => root.render(<LibraryForm />));
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.querySelector("svg")).toBeNull();

    act(() => {
      button.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectBusy(button, /Preparing your copy/);
  });

  it("the Grandpa sponsorship shows a spinner and cannot be pressed twice", () => {
    act(() => root.render(<GrandpaSponsorCard shareCode="ABC123" scoutName="Sam" />));
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Sponsor Book 3")
    ) as HTMLButtonElement;

    press(button);
    press(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectBusy(button, /Redirecting to secure checkout/);
  });
});
