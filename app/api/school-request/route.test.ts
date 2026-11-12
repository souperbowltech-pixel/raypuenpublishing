import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const saveMock = vi.fn();
const notifyMock = vi.fn();

vi.mock("@/lib/school-request-store", () => ({
  saveSchoolRequest: (...args: unknown[]) => saveMock(...args),
  notifySchoolRequest: (...args: unknown[]) => notifyMock(...args),
}));

let rateLimitOk = true;
const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => {
    rateLimitMock(...args);
    return { ok: rateLimitOk, retryAfter: 60 };
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

const valid = {
  name: "Ana Lopez",
  role: "Principal",
  school: "Lincoln Elementary",
  location: "Austin, TX",
  email: "ana@school.example",
};

describe("POST /api/school-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOk = true;
    saveMock.mockResolvedValue({ ok: true, id: "row-1" });
    notifyMock.mockResolvedValue({ sent: false, reason: "not-configured" });
  });

  it("saves a valid request and tells Ray", async () => {
    const res = await POST(request(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ school: "Lincoln Elementary", copies: null }));
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when the email to Ray is not sent, because the row is saved", async () => {
    notifyMock.mockResolvedValue({ sent: false, reason: "timeout" });
    const res = await POST(request(valid));
    expect(res.status).toBe(200);
  });

  it("returns 503 and sends no email when the database fails", async () => {
    saveMock.mockResolvedValue({ ok: false, reason: "error" });
    const res = await POST(request(valid));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("could not send");
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("returns 400 with the field for invalid input and saves nothing", async () => {
    const res = await POST(request({ ...valid, email: "nope" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ field: "email" });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it.each([[null], [[]], ["text"], [42]])("rejects a body of %j", async (body) => {
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("rejects unreadable JSON", async () => {
    const res = await POST(request(null, true));
    expect(res.status).toBe(400);
  });

  it("answers a bot like a person but saves nothing", async () => {
    const res = await POST(request({ ...valid, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(saveMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("counts only valid requests against the limit, 20 an hour per connection", async () => {
    await POST(request({ ...valid, email: "nope" }));
    expect(rateLimitMock).not.toHaveBeenCalled();
    await POST(request(valid));
    expect(rateLimitMock).toHaveBeenCalledWith("school-request:127.0.0.1", 20, 60 * 60_000);
  });

  it("returns success, not an error, when the email step throws after the row is saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    notifyMock.mockRejectedValue(new Error("boom"));
    const res = await POST(request(valid));
    expect(res.status).toBe(200);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when rate limited", async () => {
    rateLimitOk = false;
    const res = await POST(request(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(saveMock).not.toHaveBeenCalled();
  });
});
