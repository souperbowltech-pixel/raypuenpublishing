import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

let supabaseConfigMock = {
  configured: false,
  host: undefined as string | undefined,
  keyKind: "none" as "none" | "anon" | "service",
  keyLength: 0,
};

let rateLimitOk = true;
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: rateLimitOk, retryAfter: 60 }),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  supabaseConfigSummary: () => supabaseConfigMock,
}));

let isAdminKeyMock = false;
let isAdminCookieMock = false;
vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE: "gg_admin",
  isAdminKey: () => isAdminKeyMock,
  isAdminCookie: () => isAdminCookieMock,
}));

const { GET } = await import("./route");

function buildRequest(headers: Record<string, string> = {}, cookieValue?: string): NextRequest {
  const req = {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    cookies: {
      get: (name: string) =>
        name === ADMIN_COOKIE && cookieValue !== undefined ? { value: cookieValue } : undefined,
    },
  } as unknown as NextRequest;
  return req;
}

describe("GET /api/health (infrastructure health check and SEC-07 privacy boundary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOk = true;
    isAdminKeyMock = false;
    isAdminCookieMock = false;
    supabaseConfigMock = {
      configured: false,
      host: undefined,
      keyKind: "none",
      keyLength: 0,
    };
  });

  it("returns 429 when rate limited", async () => {
    rateLimitOk = false;
    const req = buildRequest();
    const res = await GET(req);

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("Too many requests");
  });

  it("returns 503 when Supabase is not configured", async () => {
    supabaseConfigMock.configured = false;

    const req = buildRequest();
    const res = await GET(req);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("enforces SEC-07: stranger sees verdict and checks only, never host or key details", async () => {
    supabaseConfigMock = {
      configured: true,
      host: "xyz.supabase.co",
      keyKind: "service",
      keyLength: 200,
    };
    isAdminKeyMock = false;
    isAdminCookieMock = false;

    const req = buildRequest(); // no admin credentials
    const res = await GET(req);

    const data = await res.json();
    expect(data.ok).toBe(true);
    // SEC-07: host, database config, and key kind must not be disclosed
    expect(data.database).toBeUndefined();
    expect(data.host).toBeUndefined();
    expect(data.checkedAt).toBeDefined();
  });

  it("discloses full diagnostics to an administrator presenting x-admin-key", async () => {
    supabaseConfigMock = {
      configured: true,
      host: "xyz.supabase.co",
      keyKind: "service",
      keyLength: 200,
    };
    isAdminKeyMock = true;

    const req = buildRequest({ "x-admin-key": "valid-secret" });
    const res = await GET(req);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.database).toEqual(supabaseConfigMock);
    expect(data.checkedAt).toBeDefined();
  });

  it("discloses full diagnostics to an administrator presenting admin cookie", async () => {
    supabaseConfigMock = {
      configured: true,
      host: "xyz.supabase.co",
      keyKind: "service",
      keyLength: 200,
    };
    isAdminCookieMock = true;

    const req = buildRequest({}, "valid-admin-cookie-value");
    const res = await GET(req);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.database).toEqual(supabaseConfigMock);
  });
});
