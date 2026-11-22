// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VoteForm } from "@/components/campaign/VoteForm";
import { CampaignReceipt } from "@/components/campaign/CampaignReceipt";

const push = vi.fn(); const openDownload = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/campaign-client", async (actual) => ({
  ...(await actual<typeof import("@/lib/campaign-client")>()), openCampaignDownload: (...args: unknown[]) => openDownload(...args),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement; let root: Root;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
function type(name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
function check(name: string, value?: string) {
  act(() => { container.querySelector<HTMLInputElement>(`[name="${name}"]${value ? `[value="${value}"]` : ""}`)!.click(); });
}
async function submit() {
  await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
function fillVote() { check("character", "sunny"); type("firstName", "Ana"); type("email", "ana@example.com"); check("adultConsent"); }
const view = { title: "Woohoo, Ana! Sunny says thank you!", message: "Sunny opened her trusty guidebook.", character: "Sunny",
  canOrder: false, reservationTitle: "Reserve a copy", quantity: null };
beforeEach(() => {
  window.history.replaceState({}, "", "/welcome?ref=fiesta");
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  push.mockReset(); openDownload.mockReset();
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe("parent vote form U01-U02", () => {
  it("shows five native choices with separate unchecked permissions and an optional answer", () => {
    act(() => root.render(<VoteForm />));
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(5);
    expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0);
    expect(container.textContent).toContain("Six printable pages");
    check("character", "sunny"); expect(container.textContent).toContain("What would you and Sunny do together?");
    expect(container.querySelector<HTMLInputElement>('[name="website"]')!.tabIndex).toBe(-1);
  });
  it("sends normalized adult data and source, then navigates with only a private fragment", async () => {
    const fetcher = vi.fn(async () => json({ receipt: "private-token" })); vi.stubGlobal("fetch", fetcher);
    act(() => root.render(<VoteForm />)); fillVote(); await submit();
    const [path, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/campaign/vote");
    expect(JSON.parse(String(init.body))).toMatchObject({ character: "sunny", firstName: "Ana", email: "ana@example.com", source: "fiesta", adultConsent: true,
      phone: null, marketingConsent: false, smsConsent: false });
    expect(push).toHaveBeenCalledWith("/welcome/thanks#receipt=private-token");
    expect(push.mock.calls[0][0]).not.toContain("ana@example.com");
  });
  it("focuses a missing field and makes no request for invalid input", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); act(() => root.render(<VoteForm />));
    await submit(); expect(fetcher).not.toHaveBeenCalled(); expect(document.activeElement).toBe(container.querySelector('[name="character"]'));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Choose one");
  });
  it("prevents a double submit while the first request is pending", async () => {
    let resolve: (value: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal("fetch", fetcher);
    act(() => root.render(<VoteForm />)); fillVote(); await submit(); await submit();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    await act(async () => { resolve(json({ receipt: "private" })); });
  });
  it("preserves input and submission identity across a lost response and retry", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(json({ receipt: "private" }));
    vi.stubGlobal("fetch", fetcher); act(() => root.render(<VoteForm />)); fillVote(); await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("may already be saved");
    expect(container.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe("ana@example.com");
    await submit();
    const first = JSON.parse(String(fetcher.mock.calls[0][1].body)); const second = JSON.parse(String(fetcher.mock.calls[1][1].body));
    expect(second.submissionId).toBe(first.submissionId); expect(push).toHaveBeenCalled();
  });
  it("shows a server field error and a neutral duplicate response without losing input", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: "Check your email.", field: "email" }, 400)).mockResolvedValueOnce(json({ message: "Use your earlier private link." }));
    vi.stubGlobal("fetch", fetcher); act(() => root.render(<VoteForm />)); fillVote(); await submit();
    expect(document.activeElement).toBe(container.querySelector('[name="email"]')); expect(container.querySelector('[name="email"]')?.getAttribute("aria-invalid")).toBe("true");
    await submit(); expect(container.querySelector('[role="status"]')?.textContent).toContain("earlier private link"); expect(push).not.toHaveBeenCalled();
  });
  it("handles non-JSON upstream failure and never claims to unlock a kit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad gateway", { status: 502 })));
    act(() => root.render(<VoteForm />)); fillVote(); await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not answer"); expect(push).not.toHaveBeenCalled();
  });
});
describe("private kit and reservation UI", () => {
  async function mount(body = view) {
    window.history.replaceState({}, "", "/welcome/thanks#receipt=private-token");
    vi.stubGlobal("fetch", vi.fn(async () => json(body)));
    await act(async () => { root.render(<CampaignReceipt />); });
  }
  it("loads the capability from the fragment, shows real copy and focuses the confirmation", async () => {
    await mount(); expect(container.textContent).toContain(view.title); expect(container.textContent).toContain(view.message);
    expect(document.activeElement).toBe(container.querySelector("h1"));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/campaign/receipt");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ receipt: "private-token" });
  });
  it("downloads only after a successful kit response and preserves error recovery", async () => {
    await mount(); vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Kit temporarily unavailable." }, 503)));
    await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click(); });
    expect(openDownload).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')?.textContent).toContain("temporarily unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => json({ url: "https://storage.example/kit" })));
    await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click(); });
    expect(openDownload).toHaveBeenCalledWith("https://storage.example/kit");
  });
  it("saves interest without presenting it as payment, and retains the original returned quantity", async () => {
    await mount(); type("quantity", "9");
    const fetcher = vi.fn(async () => json({ quantity: 2 })); vi.stubGlobal("fetch", fetcher); await submit();
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ receipt: "private-token", quantity: 9 });
    expect(container.querySelector('[role="status"]')?.textContent).toContain("2 copies");
    expect(container.textContent).toContain("not a payment"); expect(container.querySelector("form")).toBeNull();
  });
  it("uses the existing order link when the server enables live ordering", async () => {
    await mount({ ...view, canOrder: true }); expect(container.querySelector('a[href="/neighborhood#order"]')).not.toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });
  it("does not call the server for a missing private link", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await act(async () => { root.render(<CampaignReceipt />); });
    expect(fetcher).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')?.textContent).toContain("private link");
  });
  it("offers recovery for expired links and malformed server responses", async () => {
    window.history.replaceState({}, "", "/welcome/thanks#receipt=old");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Link expired." }, 404)));
    await act(async () => { root.render(<CampaignReceipt />); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("expired");
    expect(container.querySelector('a[href="/welcome"]')).not.toBeNull();
  });
  it("retries a temporary receipt failure using the same capability, without voting again", async () => {
    window.history.replaceState({}, "", "/welcome/thanks#receipt=private-token");
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: "Temporarily unavailable." }, 503)).mockResolvedValueOnce(json(view));
    vi.stubGlobal("fetch", fetcher);
    await act(async () => { root.render(<CampaignReceipt />); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Temporarily unavailable");
    await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click(); });
    expect(container.textContent).toContain(view.title);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls) {
      expect(call[0]).toBe("/api/campaign/receipt");
      expect(JSON.parse(String(call[1].body))).toEqual({ receipt: "private-token" });
    }
  });
  it("opens the emailed PDF link automatically using the same protected download endpoint", async () => {
    window.history.replaceState({}, "", "/welcome/download#receipt=private-token");
    vi.stubGlobal("fetch", vi.fn(async () => json({ url: "https://storage.example/kit" })));
    await act(async () => { root.render(<CampaignReceipt autoDownload />); });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/campaign/kit"); expect(openDownload).toHaveBeenCalledWith("https://storage.example/kit");
  });
});
