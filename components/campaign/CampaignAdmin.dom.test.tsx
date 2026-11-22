// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CampaignEmailRetry } from "@/components/campaign/CampaignEmailRetry";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement; let root: Root;
beforeEach(() => { refresh.mockReset(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); act(() => root.render(<CampaignEmailRetry voteId="vote-id" />)); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const click = async () => { await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click(); }); };
describe("owner email retry control", () => {
  it("requests a retry for only its row and refreshes after an acknowledged result", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "Delivery still pending." }))); vi.stubGlobal("fetch", fetcher);
    await click();
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ voteId: "vote-id" });
    expect(refresh).toHaveBeenCalledTimes(1); expect(container.querySelector('[role="status"]')?.textContent).toContain("still pending");
  });
  it("prevents duplicate retries while waiting", async () => {
    let finish: (r: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
    await click(); await click(); expect(fetcher).toHaveBeenCalledTimes(1); expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify({ message: "Accepted." }))); });
  });
  it("does not claim success after a rejected or lost retry response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Sign in again." }), { status: 401 })));
    await click(); expect(container.textContent).toContain("Sign in again"); expect(refresh).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); })); await click(); expect(container.textContent).toContain("Reload the page");
  });
});
