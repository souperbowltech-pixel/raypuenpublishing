import { describe, it, expect, vi, afterEach } from "vitest";
import { newCampaignSubmissionId, campaignRequest, openCampaignDownload } from "@/lib/campaign-client";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("campaign browser helpers", () => {
  it("uses secure random bytes on browsers without randomUUID", () => {
    const fill = vi.fn((bytes: Uint8Array) => { bytes.fill(123); return bytes; });
    vi.stubGlobal("crypto", { getRandomValues: fill });
    expect(newCampaignSubmissionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(fill).toHaveBeenCalledTimes(1);
  });
  it("rejects non-HTTPS download destinations before browser navigation", () => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
    expect(() => openCampaignDownload("javascript:alert(1)")).toThrow(); expect(() => openCampaignDownload(null)).toThrow();
    expect(assign).not.toHaveBeenCalled();
  });
  it("opens an authorized HTTPS download in the current browser", () => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
    openCampaignDownload("https://storage.example/private-kit");
    expect(assign).toHaveBeenCalledWith("https://storage.example/private-kit");
  });
  it("aborts a stalled request and gives an idempotent-retry explanation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const response = campaignRequest("vote", {});
    const expected = expect(response).rejects.toThrow("may already be saved");
    await vi.advanceTimersByTimeAsync(30000); await expected;
  });
});
