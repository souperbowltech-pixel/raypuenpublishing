// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SchoolRequestForm } from "@/components/neighborhood/SchoolRequestForm";

/**
 * The request form on /neighborhood, driven in a browser-like DOM against a
 * stubbed /api/school-request. The route's own rules are tested in
 * app/api/school-request/route.test.ts; here it is what the leader sees.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<SchoolRequestForm />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
function type(id: string, value: string) {
  const input = container.querySelector(`#${id}`) as HTMLInputElement;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function fillRequired() {
  type("sr-name", "Grace Miller");
  type("sr-role", "Co-op coordinator");
  type("sr-school", "Hope Homeschool Co-op");
  type("sr-location", "Austin, TX");
  type("sr-email", "grace@example.com");
}

const submit = () =>
  act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

describe("SchoolRequestForm", () => {
  it("sends every field, with the empty honeypot, and thanks the leader", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    fillRequired();
    type("sr-copies", "40");
    await submit();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/school-request");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Grace Miller",
      role: "Co-op coordinator",
      school: "Hope Homeschool Co-op",
      location: "Austin, TX",
      email: "grace@example.com",
      phone: "",
      copies: "40",
      message: "",
      website: "",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Thank you");
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the server's message under the field it names, and keeps what was typed", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "Please enter a valid email address.", field: "email" }, 400))));
    fillRequired();
    await submit();

    const email = container.querySelector("#sr-email") as HTMLInputElement;
    expect(email.getAttribute("aria-describedby")).toBe("sr-email-error");
    expect(container.querySelector("#sr-email-error")?.textContent).toBe("Please enter a valid email address.");
    expect(email.value).toBe("grace@example.com");
    expect((container.querySelector("#sr-name") as HTMLInputElement).value).toBe("Grace Miller");
  });

  it("says plainly when the server cannot be reached, and lets the leader try again", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    fillRequired();
    await submit();

    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/could not reach the server/);
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it("passes on the server's answer when it is busy or rate limited", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "Too many requests from this connection. Please try again later." }, 429))));
    fillRequired();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Too many requests");
  });

  it("sends once however many times the button is pressed while waiting", async () => {
    let answer: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    fillRequired();
    await submit();
    await submit();

    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Sending");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => answer(json({ success: true })));
  });

  it("answers an empty form at once, on the first missing field, without calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    type("sr-name", "Grace Miller");
    await submit();

    expect(fetchMock).not.toHaveBeenCalled();
    const role = container.querySelector("#sr-role") as HTMLInputElement;
    expect(role.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(role);
    expect(container.querySelector("#sr-role-error")?.textContent).toBe("Please enter your role.");
  });

  it("puts focus on the field the server names, and clears the old error on the next try", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "Please enter a valid email address.", field: "email" }, 400))));
    fillRequired();
    await submit();
    const email = container.querySelector("#sr-email") as HTMLInputElement;
    expect(document.activeElement).toBe(email);
    expect(email.getAttribute("aria-invalid")).toBe("true");

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "Please enter a phone number, or leave it empty.", field: "phone" }, 400))));
    await submit();
    expect(container.querySelector("#sr-email-error")).toBeNull();
    expect(email.hasAttribute("aria-invalid")).toBe(false);
    expect(container.querySelector("#sr-phone-error")).not.toBeNull();
  });

  it("still shows a server message that names a field the form does not have", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "Something about the website.", field: "website" }, 400))));
    fillRequired();
    await submit();
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toBe("Something about the website.");
    expect(alert.className).not.toContain("sr-only");
  });

  it("shows the server's own words when it is down, and a plain fallback for a page that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "We could not send your request right now. Please try again in a few minutes." }, 503))));
    fillRequired();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("try again in a few minutes");

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("<html>Bad gateway</html>", { status: 502 }))));
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("We could not send your request. Please try again.");
  });

  it("warns that a slow request may already have arrived, instead of inviting a duplicate", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new DOMException("timed out", "TimeoutError"))));
    fillRequired();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/may already have arrived/);
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it("still sends on a browser without AbortSignal.timeout, as on older iPads", async () => {
    const original = AbortSignal.timeout;
    (AbortSignal as { timeout?: unknown }).timeout = undefined;
    try {
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve(json({ success: true }));
      });
      vi.stubGlobal("fetch", fetchMock);
      fillRequired();
      await submit();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    } finally {
      AbortSignal.timeout = original;
    }
  });

  it("moves focus to the thank-you message so it is heard", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ success: true }))));
    fillRequired();
    await submit();
    expect(document.activeElement?.textContent).toContain("Thank you");
  });

  it("passes a filled honeypot on to the server, which is what drops the bot", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    fillRequired();
    type("sr-website", "http://spam.example");
    await submit();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).website).toBe("http://spam.example");
  });

  it("hides the honeypot from people and from the tab order", () => {
    const trap = container.querySelector("#sr-website") as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
