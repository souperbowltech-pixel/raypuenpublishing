import { describe, it, expect, vi, afterEach } from "vitest";
import { readCampaignJson } from "@/lib/campaign-http";
afterEach(() => { vi.useRealTimers(); });
const streamed = (body: ReadableStream<Uint8Array>, headers = {}) => new Request("https://books.example/api/campaign/vote", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body, duplex: "half",
} as RequestInit);
describe("bounded campaign body reader", () => {
  it("rejects malformed UTF-8 instead of silently replacing invalid bytes", async () => {
    const request = streamed(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.close(); } }));
    const result = await readCampaignJson(request); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
  it("cancels a slow body after the total deadline, freeing the request", async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const request = streamed(new ReadableStream({ cancel }));
    const reading = readCampaignJson(request);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await reading;
    expect(cancel).toHaveBeenCalled(); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(408);
  });
  it("enforces actual bytes even with a false Content-Length header", async () => {
    const request = streamed(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(8193)); controller.close();
    } }), { "content-length": "1" });
    const result = await readCampaignJson(request); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
  it("rejects an empty JSON request", async () => {
    const result = await readCampaignJson(new Request("https://books.example/api/campaign/vote", {
      method: "POST", headers: { "content-type": "application/json" },
    }));
    expect(result.ok).toBe(false);
  });
});
