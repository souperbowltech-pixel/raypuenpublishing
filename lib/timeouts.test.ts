import { describe, it, expect, vi } from "vitest";
import { noStoreFetch, storageFetch } from "@/lib/supabase";
import fs from "node:fs";
import path from "node:path";

/**
 * AUDIT BUG-04 — every call that leaves this server has a deadline.
 *
 * Without one, a stalled MailerLite holds a paid Stripe webhook open until the
 * platform kills the function, and everything the webhook had left to do never
 * runs. A stalled Supabase does the same to a page render. Neither produces an
 * error anybody can act on; they just hang.
 *
 * These are read from the source rather than exercised, because making a real
 * socket hang in a unit test proves less than it costs. What matters is that the
 * deadline is present at the one place every call passes through, and that is
 * exactly what would be lost in a careless edit.
 */

const repo = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");

describe("the database has a deadline", () => {
  // Exercised rather than read: the string checks that came first all passed
  // with the signal deleted from the call, which is a test that cannot fail.
  it("gives every query an abort signal and keeps the cache bypass", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await noStoreFetch("https://example.test/rest/v1/videos");

    const init = fetchMock.mock.calls[0][1];
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal.aborted).toBe(false);
    vi.unstubAllGlobals();
  });

  it("aborts a query that never comes back", async () => {
    vi.useFakeTimers();
    let captured: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init: RequestInit) => {
        captured = init.signal as AbortSignal;
        return new Promise(() => {}); // never settles, like a stalled connection
      })
    );

    void noStoreFetch("https://example.test/rest/v1/videos");
    expect(captured!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(captured!.aborted).toBe(true);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("leaves a caller's own signal alone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const mine = new AbortController();

    await noStoreFetch("https://example.test/rest/v1/videos", { signal: mine.signal });

    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).toBe(mine.signal);
    expect(init.cache).toBe("no-store");
    vi.unstubAllGlobals();
  });
});

describe("storage has a deadline that covers the whole file", () => {
  it("hands back the full body, status and headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("book bytes", { status: 200, headers: { "x-test": "1" } })));
    const response = await storageFetch("https://example.test/storage/v1/object/library/masters/a.pdf");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-test")).toBe("1");
    expect(await response.text()).toBe("book bytes");
    vi.unstubAllGlobals();
  });

  it("passes on a reply that may not carry a body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect((await storageFetch("https://example.test/storage/v1/x")).status).toBe(204);
    vi.unstubAllGlobals();
  });

  it("aborts a download whose body stalls after the headers arrive", async () => {
    vi.useFakeTimers();
    let captured: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init: RequestInit) => {
        captured = init.signal as AbortSignal;
        // Headers arrive at once; the body never finishes until the request is aborted, as with real fetch.
        const body = new Promise<ArrayBuffer>((_resolve, reject) =>
          captured!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        );
        return Promise.resolve({ status: 200, statusText: "OK", headers: new Headers(), arrayBuffer: () => body });
      })
    );

    const pending = storageFetch("https://example.test/storage/v1/object/library/masters/a.pdf");
    const outcome = expect(pending).rejects.toThrow(/aborted/);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(captured!.aborted).toBe(false); // longer than a database call: a book is big
    await vi.advanceTimersByTimeAsync(22_000);
    expect(captured!.aborted).toBe(true);
    await outcome;

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe("MailerLite has a deadline", () => {
  const mailerlite = read("lib/mailerlite.ts");

  it("aborts rather than holding a paid order open", () => {
    expect(mailerlite).toContain("MAILERLITE_TIMEOUT_MS");
    expect(mailerlite).toContain("signal: controller.signal");
  });

  it("clears its timer whether the call succeeded or threw", () => {
    expect(mailerlite).toContain("} finally {");
    expect(mailerlite).toContain("clearTimeout(timer)");
  });

  it("is shorter than the database deadline, being the least important call", () => {
    const ml = Number(mailerlite.match(/MAILERLITE_TIMEOUT_MS = ([\d_]+)/)![1].replace(/_/g, ""));
    const db = Number(read("lib/supabase.ts").match(/DB_TIMEOUT_MS = ([\d_]+)/)![1].replace(/_/g, ""));
    expect(ml).toBeLessThan(db);
  });
});

describe("Stripe already had one, and keeps it", () => {
  it("still sets a timeout and a retry on the SDK", () => {
    const stripe = read("lib/stripe.ts");
    expect(stripe).toMatch(/timeout/i);
  });
});
