import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminConfigured, adminCookieValue, isAdminKey, isAdminCookie } from "@/lib/admin-auth";

const fixture = vi.hoisted(() => ({
  rows: new Map<string, { key: string; count: number; reset_at: string }>(),
  requests: [] as { method: string; url: URL; signal?: AbortSignal | null }[],
  failure: "" as "" | "error" | "throw" | "timeout",
  serviceRole: true,
  connected: true,
  cookie: undefined as string | undefined,
  serial: 0,
  healthStamp: "",
}));

// Exercise real auth, routes, query builders and rendering. Only the HTTP,
// framework cookies and unrelated page data are fixtures.
vi.mock("@/lib/supabase", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://admin-session.example.test", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      fixture.requests.push({ url, method, signal: init?.signal });
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json([{ allowed: true, retry_after: 0 }]);
      // The health endpoint uses the same client. Keep its unrelated checks real
      // through the query builder, with local rows rather than a live database.
      if (url.pathname === "/rest/v1/scout_profiles" && method === "POST") {
        fixture.healthStamp = JSON.parse(String(init?.body)).updated_at;
        return new Response(null, { status: 201 });
      }
      if (url.pathname !== "/rest/v1/rate_limits") {
        expect(method).toBe("GET");
        return Response.json(url.searchParams.get("token") === "eq.HEALTH-CHECK" ? [{ updated_at: fixture.healthStamp }] : []);
      }
      if (fixture.failure === "throw") throw new Error("test database unavailable");
      if (fixture.failure === "error") return Response.json({ code: "42P01", message: "test store unavailable" }, { status: 503 });
      if (fixture.failure === "timeout") return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return reject(new Error("missing database deadline"));
        const abort = () => reject(new DOMException("test deadline", "AbortError"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
      expect(url.pathname).toBe("/rest/v1/rate_limits");
      if (method === "POST") {
        const row = JSON.parse(String(init?.body));
        fixture.rows.set(row.key, row);
        return new Response(null, { status: 201 });
      }
      const key = url.searchParams.get("key")?.replace(/^eq\./, "");
      if (method === "GET" && !key && url.searchParams.get("limit") === "1") return Response.json([]);
      expect(key).toBeTruthy();
      if (method === "DELETE") {
        fixture.rows.delete(key!);
        return new Response(null, { status: 204 });
      }
      expect(method).toBe("GET");
      const row = fixture.rows.get(key!);
      return Response.json(row ? [row] : []);
    } },
  });
  return {
    get supabase() { return fixture.connected ? client : null; },
    get usingServiceRole() { return fixture.serviceRole; },
    supabaseConfigSummary: () => ({ configured: true, urlHost: "admin-session.example.test" }),
  };
});
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => fixture.cookie ? { value: fixture.cookie } : undefined }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/patrol-store", () => ({ listPendingGuideClaims: async () => [] }));
vi.mock("@/lib/school-request-store", () => ({ SCHOOL_REQUESTS_PAGE_SIZE: 50, listSchoolRequests: async () => [] }));
vi.mock("@/lib/library-store", () => ({ GRANTS_PAGE_SIZE: 50, listGrants: async () => [] }));
vi.mock("@/lib/campaign-store", () => ({ CAMPAIGN_PAGE_SIZE: 50, campaignAdminData: async () => ({
  rows: [], summary: { votes: 0, reservations: 0, pendingEmails: 0, failedEmails: 0, groups: [] },
}) }));

import { POST as session } from "@/app/api/admin/session/route";
import { readAdminJson } from "@/lib/admin-request";
import { campaignAdminGate } from "@/lib/campaign-admin";
import { GET as health } from "@/app/api/health/route";
import AdminPage from "@/app/admin/page";
import CampaignPage from "@/app/admin/campaign/page";

/**
 * The admin view can approve a free printed book, so the door has to be shut by
 * default: no key configured means no access, rather than access for everyone.
 */

const KEY = "a-long-enough-admin-key-12345";

beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  fixture.rows.clear();
  fixture.requests = [];
  fixture.failure = "";
  fixture.serviceRole = true;
  fixture.connected = true;
  fixture.cookie = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the door is closed unless a key is configured", () => {
  it("is closed with no key at all", async () => {
    delete process.env.ADMIN_TOKEN;
    expect(adminConfigured()).toBe(false);
    expect(isAdminKey("anything")).toBe(false);
    expect(await isAdminCookie("anything")).toBe(false);
  });

  it("is closed for a key too short to be worth having", () => {
    process.env.ADMIN_TOKEN = "short";
    expect(adminConfigured()).toBe(false);
    // Even the correct short key does not open it.
    expect(isAdminKey("short")).toBe(false);
  });

  it("opens only for the configured key", () => {
    expect(isAdminKey(KEY)).toBe(true);
    expect(isAdminKey(KEY + "x")).toBe(false);
    expect(isAdminKey(KEY.slice(0, -1))).toBe(false);
    expect(isAdminKey("")).toBe(false);
    expect(isAdminKey(undefined)).toBe(false);
    expect(isAdminKey(null)).toBe(false);
    expect(isAdminKey({ toString: () => KEY })).toBe(false);
  });
});

describe("signed admin sessions", () => {
  it("carries a signed expiry and random id, never the key", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-11-23T00:00:00Z");
    const first = await adminCookieValue();
    const second = await adminCookieValue();
    expect(first).not.toContain(KEY);
    expect(first).toMatch(/^v1\.[1-9]\d{9}\.[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
    const [version, expiry, id, mac] = first.split(".");
    expect(Number(expiry)).toBe(Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE);
    expect(mac).toBe(createHmac("sha256", KEY).update(`${version}.${expiry}.${id}`).digest("hex"));
    expect(fixture.rows.size).toBe(2);
  });

  it("accepts its own cookie and refuses the raw key as one", async () => {
    expect(await isAdminCookie(await adminCookieValue())).toBe(true);
    expect(await isAdminCookie(KEY)).toBe(false);
  });

  it("stops matching when the key changes", async () => {
    const issued = await adminCookieValue();
    process.env.ADMIN_TOKEN = "a-different-admin-key-1234567";
    expect(await isAdminCookie(issued)).toBe(false);
  });

  it("refuses the old permanent hash cookie without querying the database", async () => {
    expect(await isAdminCookie(createHash("sha256").update(KEY).digest("hex"))).toBe(false);
    expect(fixture.requests).toHaveLength(0);
  });

  it("accepts just before expiry and refuses at and after expiry on the server", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-11-23T00:00:00Z");
    const issued = await adminCookieValue();
    vi.setSystemTime("2026-11-23T11:59:59.999Z");
    expect(await isAdminCookie(issued)).toBe(true);
    const reads = fixture.requests.length;
    vi.setSystemTime("2026-11-23T12:00:00Z");
    expect(await isAdminCookie(issued)).toBe(false);
    vi.setSystemTime("2026-12-23T00:00:00Z");
    expect(await isAdminCookie(issued)).toBe(false);
    expect(fixture.requests).toHaveLength(reads);
  });

  it("refuses tampering with the expiry, id or signature", async () => {
    const issued = await adminCookieValue();
    const parts = issued.split(".");
    const reads = fixture.requests.length;
    for (const index of [1, 2, 3]) {
      const changed = [...parts];
      changed[index] = index === 1 ? String(Number(parts[index]) + 1) : (parts[index][0] === "a" ? "b" : "a") + parts[index].slice(1);
      expect(await isAdminCookie(changed.join("."))).toBe(false);
    }
    expect(fixture.requests).toHaveLength(reads);
  });

  it.each([undefined, null, "", 42, {}, "v1.0.a.b", "v2.1795435200.a.b", "x".repeat(10000)])("refuses malformed cookie %j", async (cookie) => {
    expect(await isAdminCookie(cookie)).toBe(false);
    expect(fixture.requests).toHaveLength(0);
  });

  it("refuses even a correctly signed value with no matching live record", async () => {
    const issued = await adminCookieValue();
    fixture.rows.clear();
    expect(await isAdminCookie(issued)).toBe(false);
  });

  it("refuses a marker with the wrong expiry or count", async () => {
    const issued = await adminCookieValue();
    const row = [...fixture.rows.values()][0];
    const expiry = row.reset_at;
    row.reset_at = "2020-01-01T00:00:00Z";
    expect(await isAdminCookie(issued)).toBe(false);
    row.reset_at = expiry;
    row.count = 1;
    expect(await isAdminCookie(issued)).toBe(false);
    row.count = 0;
    expect(await isAdminCookie(issued)).toBe(true);
  });

  it.each(["error", "throw", "timeout"] as const)("fails closed on database %s", async (failure) => {
    const issued = await adminCookieValue();
    fixture.failure = failure;
    expect(await isAdminCookie(issued)).toBe(false);
    const read = fixture.requests.at(-1)!;
    expect(read.signal).toBeInstanceOf(AbortSignal);
    if (failure === "timeout") expect(read.signal?.aborted).toBe(true);
  }, 10000);

  it.each(["connection", "service role", "admin key"])("fails closed without %s", async (missing) => {
    const issued = await adminCookieValue();
    if (missing === "connection") fixture.connected = false;
    if (missing === "service role") fixture.serviceRole = false;
    if (missing === "admin key") delete process.env.ADMIN_TOKEN;
    expect(await isAdminCookie(issued)).toBe(false);
    await expect(adminCookieValue()).rejects.toThrow();
  });
});

function request(cookie?: string, signout = false) {
  return new NextRequest(`https://admin.example.test/api/admin/session${signout ? "?signout=1" : ""}`, {
    method: "POST",
    headers: { ...(cookie ? { cookie: `${ADMIN_COOKIE}=${cookie}` } : {}), "x-forwarded-for": `192.0.2.${++fixture.serial}` },
    body: new URLSearchParams({ key: KEY }),
  });
}

describe("admin session route and consumers", () => {
  it("signs in with a private cookie and lets the real admin pages and gates open", async () => {
    const response = await session(request());
    expect(response.status).toBe(303);
    const cookie = response.cookies.get(ADMIN_COOKIE)!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: ADMIN_COOKIE_MAX_AGE });
    expect(await isAdminCookie(cookie.value)).toBe(true);
    fixture.cookie = cookie.value;
    expect(renderToStaticMarkup(await AdminPage({ searchParams: {} }))).toContain("Sign out");
    expect(renderToStaticMarkup(await CampaignPage({ searchParams: {} }))).toContain("Votes by character");
    expect(await campaignAdminGate(request(cookie.value))).toBeNull();
    const diagnostics = await health(request(cookie.value));
    expect(diagnostics.status).toBe(200);
    expect((await diagnostics.json()).database).toBeDefined();
    const json = new NextRequest("https://admin.example.test/api/admin/library/codes", {
      method: "POST", headers: { cookie: `${ADMIN_COOKIE}=${cookie.value}`, "content-type": "application/json" }, body: "{}",
    });
    expect(await readAdminJson(json, "session-test")).toEqual({ ok: true, body: {} });
  });

  it("sign-out revokes a copied cookie across fresh module instances and preserves another login", async () => {
    const first = await adminCookieValue();
    const second = await adminCookieValue();
    const out = await session(request(first, true));
    expect(out.status).toBe(303);
    expect(out.cookies.get(ADMIN_COOKIE)).toMatchObject({ value: "", maxAge: 0 });
    expect(await isAdminCookie(first)).toBe(false);
    expect(await isAdminCookie(second)).toBe(true);
    vi.resetModules();
    const fresh = await import("@/lib/admin-auth");
    expect(await fresh.isAdminCookie(first)).toBe(false);
    expect(await fresh.isAdminCookie(second)).toBe(true);
    expect((await session(request(first, true))).status).toBe(303);
  });

  it.each(["expired", "signed out", "legacy", "tampered"])("closes every cookie consumer for a %s session", async (state) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let cookie = await adminCookieValue();
    if (state === "expired") vi.setSystemTime(Date.now() + ADMIN_COOKIE_MAX_AGE * 1000);
    if (state === "signed out") await session(request(cookie, true));
    if (state === "legacy") cookie = createHash("sha256").update(KEY).digest("hex");
    if (state === "tampered") cookie = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    fixture.cookie = cookie;
    expect(renderToStaticMarkup(await AdminPage({ searchParams: {} }))).toContain("Enter the admin key");
    expect(renderToStaticMarkup(await CampaignPage({ searchParams: {} }))).toContain("Please sign in");
    expect((await campaignAdminGate(request(cookie)))?.status).toBe(401);
    const read = await readAdminJson(request(cookie), "session-test");
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.response.status).toBe(401);
    const diagnostics = await health(request(cookie));
    expect(diagnostics.status).toBe(200);
    expect((await diagnostics.json()).database).toBeUndefined();
  });

  it.each(["error", "throw", "timeout"] as const)("returns a retryable failure when sign-out has a database %s", async (failure) => {
    const issued = await adminCookieValue();
    fixture.failure = failure;
    const out = await session(request(issued, true));
    expect(out.status).toBe(503);
    expect(out.cookies.get(ADMIN_COOKIE)).toBeUndefined();
    expect(out.headers.get("cache-control")).toBe("no-store");
    fixture.failure = "";
    expect((await session(request(issued, true))).status).toBe(303);
    expect(await isAdminCookie(issued)).toBe(false);
  }, 10000);

  it.each(["error", "throw", "timeout"] as const)("does not issue a cookie when saving has a database %s", async (failure) => {
    fixture.failure = failure;
    const response = await session(request());
    expect(response.status).toBe(503);
    expect(response.cookies.get(ADMIN_COOKIE)).toBeUndefined();
    expect(response.headers.get("cache-control")).toBe("no-store");
  }, 10000);

  it("refuses a wrong sign-in key without saving a session", async () => {
    const response = await session(new NextRequest("https://admin.example.test/api/admin/session", {
      method: "POST", body: new URLSearchParams({ key: "wrong" }), headers: { "x-forwarded-for": `192.0.2.${++fixture.serial}` },
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://admin.example.test/admin?error=1");
    expect(response.cookies.get(ADMIN_COOKIE)).toBeUndefined();
    expect(fixture.rows.size).toBe(0);
  });

  it.each([undefined, "garbage", createHash("sha256").update(KEY).digest("hex")])("signs out idempotently with invalid cookie %j", async (cookie) => {
    fixture.failure = "error";
    expect((await session(request(cookie, true))).status).toBe(303);
    expect(fixture.requests).toHaveLength(0);
  });
});

describe("approving a Guide takes a POST, never a GET", () => {
  const route = fs.readFileSync(
    path.join(path.resolve(__dirname, ".."), "app/api/admin/approve-guide/route.ts"),
    "utf8"
  );

  it("does not review a claim in the GET handler", () => {
    // Anything that follows links without a human - a mail scanner, an antivirus
    // checker, a chat preview - issues GETs and never POSTs. If the decision can
    // be made on GET, Ray's approval can happen without him.
    const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    expect(get).not.toContain("reviewGuideApproval");
    expect(get).toContain("<form method=\"POST\"");
  });

  it("makes the decision in the POST handler", () => {
    const post = route.slice(route.indexOf("export async function POST"));
    expect(post).toContain("reviewGuideApproval");
  });

  it("escapes the token it reflects back into the confirmation form", () => {
    expect(route).toContain('value="${escape(token)}"');
  });

  it("keeps the approval pages out of search engines", () => {
    expect(route).toContain('name="robots" content="noindex"');
  });
});
