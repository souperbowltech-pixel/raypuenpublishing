import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import BookUnlockCard from "@/components/dashboard/BookUnlockCard";

/**
 * FE-05 — the dashboard can claim a book was dispatched when nothing was sent.
 *
 * `lib/fulfillment.test.ts` proves dispatchPrintOrder's network and timeout logic.
 * It does not prove BookUnlockCard awaits it: the whole dispatch check could be
 * bypassed and that suite would still pass. These tests guard the component's
 * static render and the wiring of its confirmation handler and dispatch gate.
 */

const source = fs.readFileSync(
  path.join(path.resolve(__dirname, "../.."), "components/dashboard/BookUnlockCard.tsx"),
  "utf8"
);

describe("BookUnlockCard initial static render", () => {
  it("renders the reserved notice and never mentions dispatch while closed", () => {
    const html = renderToStaticMarkup(
      <BookUnlockCard scoutName="Leo" bookNumber={2} />
    );
    expect(html).toContain("reserved for Chief Explorer Leo");
    expect(html).not.toContain("Dispatched");
  });
});

/**
 * The tests below read the component's source. There is no DOM in this test
 * environment and none may be added, so submit events cannot be dispatched and
 * async form state cannot be driven. The source windows are kept narrow — the
 * body of handleConfirmShipping and the render conditional — so that reverting
 * to a synchronous boolean or bypassing the server result fails the suite.
 */

/** The body of handleConfirmShipping, from its signature to the return statement. */
const handleConfirmShippingSource = (() => {
  const start = source.indexOf("const handleConfirmShipping =");
  const end = source.indexOf("return (", start);
  return source.slice(start, end);
})();

/** The render conditional branches for fulfillment and dispatch. */
const renderBranches = (() => {
  const start = source.indexOf("!PRINT_FULFILLMENT_LIVE ?");
  const end = source.indexOf("Total billed:", start) + 100;
  return source.slice(start, end);
})();

describe("handleConfirmShipping wiring", () => {
  it("awaits dispatchPrintOrder with the address and book number", () => {
    expect(handleConfirmShippingSource).toContain("await dispatchPrintOrder(shippingAddress, bookNumber)");
  });

  it("sets dispatch state only with the server result, never a literal", () => {
    expect(handleConfirmShippingSource).toContain("setDispatch(result)");
    expect(handleConfirmShippingSource).not.toMatch(/setDispatch\s*\(\s*(\{|true|false|["'])/);
  });
});

describe("dispatched branch gating", () => {
  it("gates the dispatched branch on dispatch?.dispatched", () => {
    expect(renderBranches).toContain("!dispatch?.dispatched ?");
  });

  it("renders dispatch.reference in the dispatched block", () => {
    expect(renderBranches).toContain("dispatch.reference");
  });
});
