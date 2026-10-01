import { describe, it, expect } from "vitest";
import { nextFocusIndex } from "@/lib/focus-trap";

/**
 * FE-06 — Lightbox modal focus trap.
 *
 * In this repository's node test environment, there is no browser DOM. The pure
 * index-calculation function nextFocusIndex is the tested surface for keyboard
 * focus navigation and wrapping.
 */

describe("nextFocusIndex", () => {
  it("Tab from the last element wraps to 0", () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it("Shift+Tab from 0 wraps to the last element", () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it("Tab from outside the dialog (-1) gives 0", () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
  });

  it("Shift+Tab from outside the dialog (-1) gives count - 1", () => {
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  it("a middle index steps forward by one and backward by one", () => {
    expect(nextFocusIndex(3, 1, false)).toBe(2);
    expect(nextFocusIndex(3, 1, true)).toBe(0);
  });

  it("count 0 gives -1", () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
    expect(nextFocusIndex(0, 1, true)).toBe(-1);
  });
});
