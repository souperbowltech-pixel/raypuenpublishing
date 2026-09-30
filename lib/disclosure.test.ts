import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isEmailAddress, EMAIL_REGEX } from "@/lib/family";

const repo = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");

/**
 * AUDIT SEC-07 — the health endpoint is a diagnosis, not a map of the building.
 * AUDIT BUG-08 — one definition of an email address, not three.
 */

const HEALTH_KEY = "an-admin-key-long-enough-1234";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  supabaseConfigSummary: () => ({ configured: true, urlHost: "secret.supabase.co", keyRole: "service_role" }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ ok: true }), clientIp: () => "1.1.1.1" }));

const { GET } = await import("@/app/api/health/route");

const call = (headers: Record<string, string> = {}, cookie?: string) =>
  GET({
    headers: { get: (n: string) => headers[n] ?? null },
    cookies: { get: (n: string) => (cookie && n === "gg_admin" ? { value: cookie } : undefined) },
  } as never);

describe("health tells a stranger the verdict and nothing else", () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = HEALTH_KEY;
  });
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it("gives an anonymous caller no database fingerprint at all", async () => {
    const body = await (await call()).json();
    expect(body.ok).toBe(true);
    expect(body.database).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("supabase.co");
    expect(JSON.stringify(body)).not.toContain("service_role");
  });

  it("gives the whole picture to a caller with the admin key", async () => {
    const body = await (await call({ "x-admin-key": HEALTH_KEY })).json();
    expect(body.database).toMatchObject({ urlHost: "secret.supabase.co" });
  });

  it("refuses a wrong key like any other stranger", async () => {
    const body = await (await call({ "x-admin-key": "not-the-key" })).json();
    expect(body.database).toBeUndefined();
  });

  it("still answers the one question an uptime monitor asks", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).checkedAt).toBeTruthy();
  });
});

describe("one definition of an email address", () => {
  it("is exported from the module that owns identity", () => {
    expect(EMAIL_REGEX).toBeInstanceOf(RegExp);
    expect(isEmailAddress("parent@example.com")).toBe(true);
  });

  it("is no longer written out again anywhere else", () => {
    for (const file of ["lib/mailerlite.ts", "app/api/checkout/wholesale/route.ts"]) {
      expect(read(file)).not.toContain("const EMAIL_REGEX");
      expect(read(file)).toContain("isEmailAddress");
    }
  });

  it("applies the same rule everywhere it is used", () => {
    // The two copies disagreed: one required a two-character top-level domain
    // and the other did not, so the same address could pass at checkout and
    // fail at registration.
    expect(isEmailAddress("parent@example.c")).toBe(false);
    expect(isEmailAddress("parent@example.co")).toBe(true);
  });

  it("refuses what is not an address at all", () => {
    for (const bad of ["", "nobody", "no@body", "two @spaces.com", "a@b.c", null, undefined, 42]) {
      expect(isEmailAddress(bad)).toBe(false);
    }
  });

  it("refuses an address longer than the field that stores it", () => {
    expect(isEmailAddress(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});
