// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Tesler's law and Miller's law in the forms, exercised in a browser-like DOM:
 * the site carries the fiddly part (labels that name their field, autofill,
 * the number pad for a ZIP, capitals for a state, a pasted link that just
 * works), and a long form reads in small groups.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const WholesaleForm = (await import("@/components/institutions/WholesaleForm")).default;
const PatrolPage = (await import("@/app/dashboard/patrol/page")).default;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** Types into a React-controlled field the way a browser does. */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;

describe("the wholesale form", () => {
  function openShippingTier() {
    act(() => root.render(<WholesaleForm />));
    for (const card of Array.from(container.querySelectorAll("div.cursor-pointer"))) {
      act(() => card.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      if (field("ws-state")) return;
    }
    throw new Error("no tier shows the shipping address");
  }

  it("names every field by its label and lets the browser fill it", () => {
    openShippingTier();
    const wanted: Record<string, string> = {
      "ws-org": "organization",
      "ws-name": "name",
      "ws-email": "email",
      "ws-phone": "tel",
      "ws-street": "shipping address-line1",
      "ws-city": "shipping address-level2",
      "ws-state": "shipping address-level1",
      "ws-zip": "shipping postal-code",
    };
    for (const [id, autocomplete] of Object.entries(wanted)) {
      expect(field(id).labels?.length, id).toBe(1);
      expect(field(id).getAttribute("autocomplete"), id).toBe(autocomplete);
    }
    expect(field("ws-zip").getAttribute("inputmode")).toBe("numeric");
  });

  it("capitalises the state once the box is left, not while typing", () => {
    openShippingTier();
    type(field("ws-state"), "ca");
    expect(field("ws-state").value).toBe("ca");
    act(() => field("ws-state").dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(field("ws-state").value).toBe("CA");
  });

  it("keeps the contact details to one group of four", () => {
    act(() => root.render(<WholesaleForm />));
    const heading = Array.from(container.querySelectorAll("h3")).find((h) => h.textContent?.includes("Organization Information"));
    expect(heading?.parentElement?.querySelectorAll("input")).toHaveLength(4);
  });
});

describe("the Patrol access box", () => {
  const token = "PT-abcDEF123_-xyz";

  function respond(status: number, body: unknown = {}) {
    const fetchMock = vi.fn((_url: string) => Promise.resolve(new Response(JSON.stringify(body), { status })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function openAccess() {
    await act(async () => root.render(<PatrolPage />));
    return container.querySelector('input[aria-label="Patrol Leader token or link"]') as HTMLInputElement;
  }

  async function send(box: HTMLInputElement) {
    await act(async () => {
      box.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  it("does not look anything up while the leader types", async () => {
    const fetchMock = respond(404);
    const box = await openAccess();
    type(box, "PT-ab");
    type(box, "PT-ab c");
    expect(box.value).toBe("PT-ab c"); // typed freely, nothing taken out
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens with the token taken out of a pasted sentence", async () => {
    const fetchMock = respond(404);
    const box = await openAccess();
    type(box, `Open https://puenpublishing.com/dashboard/patrol?token=${token}. Thanks!`);
    await send(box);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/patrol/state?token=${encodeURIComponent(token)}`);
  });

  it("says when no Patrol matches, and lets the leader try again", async () => {
    const fetchMock = respond(404);
    const box = await openAccess();
    type(box, token);
    await send(box);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not find a Patrol");

    await send(await openAccess());
    expect(fetchMock).toHaveBeenCalledTimes(2); // the same token is looked up again, not stuck
    expect(container.querySelector('[role="status"]')).toBeNull(); // no spinner left behind
  });

  it("looks a token saved on this device up once, and forgets it if it no longer opens anything", async () => {
    localStorage.setItem("gg_patrol_token", token);
    const fetchMock = respond(404);
    await openAccess();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("gg_patrol_token")).toBeNull();
  });

  it("asks for a token when only spaces were entered, and looks nothing up", async () => {
    const fetchMock = respond(404);
    const box = await openAccess();
    type(box, "   ");
    await send(box);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("paste your Patrol link");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the leader to wait when the lookup limit is reached", async () => {
    respond(429);
    const box = await openAccess();
    type(box, token);
    await send(box);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("wait a minute");
  });
});
