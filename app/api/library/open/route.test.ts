import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const openMock = vi.fn();
vi.mock("@/lib/library-store", () => ({
  openCode: (...args: unknown[]) => openMock(...args),
}));

let rateLimitOk = true;
const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => {
    rateLimitMock(...args);
    return { ok: rateLimitOk, retryAfter: 42 };
  },
  clientIp: () => "127.0.0.1",
}));

const { POST } = await import("./route");

function request(body: unknown, throws = false): NextRequest {
  return {
    headers: { get: () => "application/json" },
    json: async () => {
      if (throws) throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  openMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitOk = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/library/open", () => {
  it("hands back the link to the reader's copy, never cached", async () => {
    openMock.mockResolvedValue({ ok: true, url: "https://storage.example/signed" });
    const res = await POST(request({ code: "ABCD-2345-WXYZ" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://storage.example/signed" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(openMock).toHaveBeenCalledWith("ABCD-2345-WXYZ");
  });

  it("counts every try against the connection, before any work", async () => {
    rateLimitOk = false;
    const res = await POST(request({ code: "ABCD-2345-WXYZ" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(openMock).not.toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalledWith("library-open:127.0.0.1", 10, 60_000);
  });

  it("refuses a body that is not a code", async () => {
    for (const body of [null, [], "ABCD", { code: 12 }, {}]) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
    }
    expect((await POST(request(null, true))).status).toBe(400);
    expect(openMock).not.toHaveBeenCalled();
  });

  it("explains each refusal in words a reader can act on", async () => {
    const cases: [string, number, RegExp][] = [
      ["invalid", 400, /not valid/],
      ["used", 410, /already been used/],
      ["expired", 410, /expired/],
      ["cancelled", 410, /no longer active/],
      ["missing-master", 503, /not ready/],
      ["unavailable", 503, /try again/],
      ["error", 500, /let us know/],
    ];
    for (const [reason, status, message] of cases) {
      openMock.mockResolvedValue({ ok: false, reason });
      const res = await POST(request({ code: "ABCD-2345-WXYZ" }));
      expect(res.status).toBe(status);
      expect((await res.json()).error).toMatch(message);
    }
  });

  it("answers calmly when the store throws, and never logs the code", async () => {
    openMock.mockRejectedValue(new Error("boom"));
    const res = await POST(request({ code: "ABCD-2345-WXYZ" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain("ABCD");
  });
});
