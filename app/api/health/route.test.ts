import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

let supabaseMock: unknown = null;
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return supabaseMock;
  },
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
    vi.useRealTimers();
    supabaseMock = null;
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

  describe("with a database client", () => {
    type Kind = "read" | "write" | "readBack";
    type Reply = { data?: unknown; error?: { code?: string; message?: string } | null };

    /**
     * A fake supabase-js client. `reply(table, kind)` decides each answer:
     * a Reply resolves, "hang" never settles (a paused project), "throw" rejects.
     * Every builder records the abort signal it is handed, and the healthy
     * read-back returns whatever the last write stored, as a real database does.
     */
    function fakeDb(reply: (table: string, kind: Kind) => Reply | "hang" | "throw") {
      const calls = { from: 0, signals: [] as AbortSignal[] };
      let stored: unknown = null;
      const settle = (r: Reply | "hang" | "throw") =>
        r === "hang"
          ? new Promise(() => undefined)
          : r === "throw"
            ? Promise.reject(new Error("socket closed"))
            : Promise.resolve({ data: r.data === "stored" ? { updated_at: stored } : r.data ?? null, error: r.error ?? null });

      const client = {
        from(table: string) {
          calls.from += 1;
          let kind: Kind = "read";
          const builder = {
            select: () => builder,
            limit: () => builder,
            eq: () => {
              kind = "readBack";
              return builder;
            },
            upsert: (row: { updated_at: string }) => {
              kind = "write";
              stored = row.updated_at;
              return builder;
            },
            abortSignal: (signal: AbortSignal) => {
              calls.signals.push(signal);
              return builder;
            },
            maybeSingle: () => settle(reply(table, kind)),
            then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              settle(reply(table, kind)).then(resolve, reject),
          };
          return builder;
        },
      };
      return { client, calls };
    }

    const healthy = (_table: string, kind: Kind): Reply => (kind === "readBack" ? { data: "stored" } : { data: [] });

    beforeEach(() => {
      supabaseConfigMock.configured = true;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("runs every check and reports a healthy database as ok", async () => {
      supabaseMock = fakeDb(healthy).client;

      const res = await GET(buildRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(Object.keys(data.checks).sort()).toEqual(
        [
          "familiesTable", "familySessionsTable", "guideApprovalsTable", "ordersTable",
          "patrolGiftsTable", "patrolLeadersTable", "scoutFamilyColumns", "scoutNewColumns",
          "schoolRequestsTable", "scoutRead", "scoutReferralColumn", "scoutWrite", "videosTable",
          // The library and the shared rate limit: without these checks a migration
          // that never ran would leave health green.
          "libraryGrantsTable", "rateLimitsTable",
        ].sort()
      );
    });

    it("answers at its deadline when the database never replies, and stops the work it started", async () => {
      // A paused or unreachable Supabase project: every query hangs. Before the
      // deadline the route waited on thirteen of these in a row and the request
      // got no answer at all, which is the one time a health check is needed.
      const { client, calls } = fakeDb(() => "hang");
      supabaseMock = client;

      vi.useFakeTimers();
      let settled = false;
      const pending = GET(buildRequest()).then((r) => {
        settled = true;
        return r;
      });

      await vi.advanceTimersByTimeAsync(5_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const res = await pending;

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.ok).toBe(false);
      // A stranger learns the verdict, never the error text.
      expect(data.checks.databaseReachable).toEqual({ ok: false });

      // Every query was handed the signal, and the deadline fired it.
      expect(calls.signals.length).toBe(calls.from);
      expect(calls.signals.every((s) => s.aborted)).toBe(true);

      // Nothing new starts after the answer has gone.
      const before = calls.from;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls.from).toBe(before);
    });

    it("keeps the checks that finished when the deadline cuts the rest off", async () => {
      supabaseMock = fakeDb((table) => (table === "orders" ? { data: [] } : "hang")).client;
      isAdminKeyMock = true;

      vi.useFakeTimers();
      const pending = GET(buildRequest({ "x-admin-key": "k" }));
      await vi.advanceTimersByTimeAsync(6_000);
      const data = await (await pending).json();

      expect(data.checks.ordersTable).toEqual({ ok: true });
      expect(data.checks.databaseReachable.ok).toBe(false);
      expect(data.checks.databaseReachable.error).toContain("6000ms");
    });

    it("shows a stranger only the verdict of a failing check, and an administrator the error", async () => {
      const missing = { code: "42P01", message: "relation public.videos does not exist" };
      const reply = (table: string, kind: Kind): Reply => (table === "videos" ? { error: missing } : healthy(table, kind));

      supabaseMock = fakeDb(reply).client;
      const stranger = await (await GET(buildRequest())).json();
      expect(stranger.checks.videosTable).toEqual({ ok: false });

      isAdminKeyMock = true;
      supabaseMock = fakeDb(reply).client;
      const admin = await (await GET(buildRequest({ "x-admin-key": "k" }))).json();
      expect(admin.checks.videosTable).toEqual({ ok: false, error: `42P01: ${missing.message}` });
    });

    it("fails the write check when the row read back is not the one just written", async () => {
      supabaseMock = fakeDb((_t, kind) =>
        kind === "readBack" ? { data: { updated_at: "2020-01-01T00:00:00Z" } } : { data: [] }
      ).client;
      isAdminKeyMock = true;

      const data = await (await GET(buildRequest({ "x-admin-key": "k" }))).json();

      expect(data.ok).toBe(false);
      expect(data.checks.scoutWrite.ok).toBe(false);
      expect(data.checks.scoutWrite.error).toContain("read back 2020-01-01T00:00:00Z");
    });

    it("answers 503 rather than crashing when a query throws", async () => {
      supabaseMock = fakeDb((table, kind) => (table === "families" ? "throw" : healthy(table, kind))).client;
      isAdminKeyMock = true;

      const res = await GET(buildRequest({ "x-admin-key": "k" }));
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.checks.databaseReachable).toEqual({ ok: false, error: "socket closed" });
    });
  });
});
