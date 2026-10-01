import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

/**
 * AUDIT FE-06 — the dialog keeps the promise `aria-modal` makes.
 *
 * `lib/focus-trap.test.ts` proves the index arithmetic. It does not prove the
 * Lightbox uses it: the whole Tab branch can be deleted from the component and
 * that suite still passes. These tests guard the wiring instead, which is the
 * part a later edit would actually remove.
 */

// next/image needs Next's loader config; only the markup it produces matters here.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const { Lightbox } = await import("@/components/ui/Lightbox");

const images = [
  { src: "/placeholders/interior-1.svg", alt: "First illustration" },
  { src: "/placeholders/interior-2.svg", alt: "Second illustration" },
];

const render = (index: number | null) =>
  renderToStaticMarkup(
    <Lightbox images={images} index={index} onClose={() => {}} onNavigate={() => {}} />
  );

const source = fs.readFileSync(
  path.join(path.resolve(__dirname, "../.."), "components/ui/Lightbox.tsx"),
  "utf8"
);

describe("the open dialog can receive focus", () => {
  it("is focusable programmatically without joining the tab order", () => {
    // Focus is moved onto this container when the lightbox opens; without
    // tabindex="-1" the call is a no-op and the trap has nowhere to start.
    expect(render(0)).toContain('tabindex="-1"');
  });

  it("still announces itself as a modal dialog", () => {
    const html = render(0);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("renders nothing at all when closed", () => {
    expect(render(null)).toBe("");
  });
});

/**
 * The three below read the component's source. There is no DOM in this test
 * environment and none may be added, so a keydown cannot be dispatched and
 * `document.activeElement` cannot be moved. The windows are kept narrow — the
 * body of the key handler, and one dependency array — so that deleting the
 * behaviour fails the test rather than merely moving it.
 */

/** The body of the keydown handler, and nothing around it. */
const keyHandler = (() => {
  const start = source.indexOf("function onKey(");
  const end = source.indexOf("document.addEventListener", start);
  return source.slice(start, end);
})();

describe("Tab is trapped inside the dialog", () => {
  it("handles Tab in the key handler rather than letting it reach the page", () => {
    expect(keyHandler).toContain('e.key === "Tab"');
  });

  it("decides where to move with the proven helper, not a second copy of the maths", () => {
    // Searched inside the dialog, not the page: querying the document would
    // cycle focus through everything behind the modal, which is the bug.
    expect(keyHandler).toContain("dialogRef.current.querySelectorAll");
    expect(keyHandler).toContain("FOCUSABLE_SELECTOR");
    // Shift must reach the helper: it is the only thing that tells forward from
    // backward, and dropping it breaks Shift+Tab without breaking Tab.
    expect(keyHandler).toContain("nextFocusIndex(list.length, current, e.shiftKey)");
  });

  it("stops the browser's own Tab, which is what leaves the dialog", () => {
    expect(keyHandler).toContain("e.preventDefault()");
  });
});

describe("focus is restored to whatever opened the lightbox", () => {
  /** The focus/scroll effect, from its first line to its dependency array. */
  const focusEffect = (() => {
    const start = source.indexOf("const previous = document.activeElement");
    const end = source.indexOf("]);", start) + 3;
    return source.slice(start, end);
  })();

  it("remembers the element that had focus and gives it back on close", () => {
    expect(focusEffect).toContain("previous.focus()");
    expect(focusEffect).toContain("document.contains(previous)");
  });

  it("runs only when the lightbox opens or closes", () => {
    // The arrow keys change `index`, which changes the identity of goPrev and
    // goNext. If this effect depended on them it would re-run on every arrow
    // press, capture the dialog itself as "previous", and hand focus back to a
    // node that no longer exists instead of to the thumbnail that opened it.
    expect(focusEffect.endsWith("}, [isOpen]);")).toBe(true);
  });
});
