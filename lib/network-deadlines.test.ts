import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { noStoreFetch } from "./supabase";
import { addSubscriberToMailerLite } from "./mailerlite";
import { alertFailure } from "./alerts";

// Only the HTTP boundary is a fixture. Real Response streams, consumers and
// Supabase query builders exercise the production helpers and their deadlines.
function stalledBody(signal?: AbortSignal | null, status = 200) {
  return new Response(new ReadableStream({
    start(stream) {
      stream.enqueue(new TextEncoder().encode('{"data":'));
      signal?.addEventListener("abort", () => stream.error(signal.reason), { once: true });
    },
  }), { status });
}

function stalledFetch() {
  let signal: AbortSignal | null | undefined;
  const request = vi.fn((_input: unknown, init?: RequestInit) => {
    signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal?.reason), { once: true });
    });
  });
  vi.stubGlobal("fetch", request);
  return { request, signal: () => signal };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("MAILERLITE_API_KEY", "test-mailerlite-key");
  vi.stubEnv("ALERT_WEBHOOK_URL", "https://alerts.example.test/hook");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("database deadlines cover response bodies", () => {
  it("aborts a real Supabase query when headers arrive but its body stalls", async () => {
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return stalledBody(signal);
    }));
    const client = createClient("https://database.example.test", "test-service-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: noStoreFetch },
    });
    let settled = false;
    const pending = Promise.resolve(client.from("videos").select("id")).then(result => {
      settled = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBe(false);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(settled).toBe(true);
    const result = await pending;
    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/abort/i);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps status, headers and body for a completed database error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"unavailable"}', {
      status: 503, statusText: "Unavailable", headers: { "x-request-id": "test-request" },
    })));
    const response = await noStoreFetch("https://database.example.test/rest/v1/videos");
    expect(response.status).toBe(503);
    expect(response.statusText).toBe("Unavailable");
    expect(response.headers.get("x-request-id")).toBe("test-request");
    expect(await response.json()).toEqual({ message: "unavailable" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([204, 205, 304])("preserves bodyless status %i", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    const response = await noStoreFetch("https://database.example.test/rest/v1/videos");
    expect(response.status).toBe(status);
    expect(response.body).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up after a network rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));
    await expect(noStoreFetch("https://database.example.test")).rejects.toThrow("Connection refused");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the caller's deadline effective while consuming a stalled body", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => stalledBody(init?.signal)));
    let settled = false;
    const pending = noStoreFetch("https://database.example.test", { signal: controller.signal });
    const outcome = pending.then(() => { settled = true; }, () => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await outcome;
    expect(settled).toBe(true);
    await expect(pending).rejects.toThrow(/abort/i);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("MailerLite deadlines cover JSON consumption", () => {
  it.each([200, 422])("aborts a stalled body with HTTP %i without retrying or claiming success", async status => {
    let signal: AbortSignal | null | undefined;
    const request = vi.fn(async (_input: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return stalledBody(signal, status);
    });
    vi.stubGlobal("fetch", request);
    let settled = false;
    const pending = addSubscriberToMailerLite({ email: "reader@example.test", fields: { source: "order" } })
      .then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(5_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(settled).toBe(true);
    expect(await pending).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("[MailerLite] Network error:", expect.any(Error));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("normalizes input and returns parsed subscriber data", async () => {
    const request = vi.fn(async (_input: unknown, _init?: RequestInit) => Response.json({ data: { id: "subscriber-1" } }));
    vi.stubGlobal("fetch", request);
    expect(await addSubscriberToMailerLite({ email: " Reader@Example.test ", name: "Reader", groupId: "buyers" }))
      .toEqual({ data: { id: "subscriber-1" } });
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      email: "reader@example.test", status: "active", groups: ["buyers"], fields: { name: "Reader" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries a completed 422 once without custom fields", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ message: "Unknown field" }, { status: 422 }))
      .mockResolvedValueOnce(Response.json({ data: { id: "subscriber-2" } }));
    vi.stubGlobal("fetch", request);
    expect(await addSubscriberToMailerLite({ email: "reader@example.test", fields: { unknown: "value" } }))
      .toEqual({ data: { id: "subscriber-2" } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body).fields).toEqual({ unknown: "value" });
    expect(JSON.parse(request.mock.calls[1][1].body)).not.toHaveProperty("fields");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives the retry its own body deadline", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({}, { status: 422 }))
      .mockImplementationOnce(async (_input: unknown, init?: RequestInit) => stalledBody(init?.signal));
    vi.stubGlobal("fetch", request);
    let settled = false;
    const pending = addSubscriberToMailerLite({ email: "reader@example.test", fields: { unknown: "value" } })
      .then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(6_000);
    expect(settled).toBe(true);
    expect(await pending).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([200, 500])("returns null for malformed JSON with HTTP %i and cleans up", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid-json", { status })));
    expect(await addSubscriberToMailerLite({ email: "reader@example.test" })).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns null after a connection timeout", async () => {
    const fixture = stalledFetch();
    let settled = false;
    const pending = addSubscriberToMailerLite({ email: "reader@example.test" })
      .then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fixture.signal()?.aborted).toBe(true);
    expect(settled).toBe(true);
    expect(await pending).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["missing-key", "invalid-email"])("does not start a request for %s", async failure => {
    if (failure === "missing-key") vi.stubEnv("MAILERLITE_API_KEY", "");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await addSubscriberToMailerLite({ email: failure === "invalid-email" ? "invalid" : "reader@example.test" }))
      .toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("alert webhooks have a short nonthrowing deadline", () => {
  it("returns at three seconds when the webhook never answers", async () => {
    const fixture = stalledFetch();
    let settled = false;
    const pending = alertFailure("Test failure").then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(fixture.signal()?.aborted).toBe(true);
    expect(settled).toBe(true);
    await expect(pending).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[ALERT] Failed to deliver alert webhook:", expect.any(Error));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the deadline active until the alert response body finishes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => stalledBody(init?.signal)));
    let settled = false;
    const pending = alertFailure("Test failure").then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await expect(pending).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[ALERT] Failed to deliver alert webhook:", expect.any(Error));
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([200, 204])("cleans up after a completed HTTP %i response", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    await expect(alertFailure("Test failure")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("logs HTTP rejection without throwing or leaving a timer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    await expect(alertFailure("Test failure")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[ALERT] Failed to deliver alert webhook:", expect.any(Error));
    expect(vi.getTimerCount()).toBe(0);
  });
});
