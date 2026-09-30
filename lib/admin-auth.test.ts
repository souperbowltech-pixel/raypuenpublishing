import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { adminConfigured, adminCookieValue, isAdminKey, isAdminCookie } from "@/lib/admin-auth";

/**
 * The admin view can approve a free printed book, so the door has to be shut by
 * default: no key configured means no access, rather than access for everyone.
 */

const KEY = "a-long-enough-admin-key-12345";

beforeEach(() => {
  process.env.ADMIN_TOKEN = KEY;
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("the door is closed unless a key is configured", () => {
  it("is closed with no key at all", () => {
    delete process.env.ADMIN_TOKEN;
    expect(adminConfigured()).toBe(false);
    expect(isAdminKey("anything")).toBe(false);
    expect(isAdminCookie("anything")).toBe(false);
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

describe("the cookie carries a hash, never the key", () => {
  it("does not contain the key", () => {
    expect(adminCookieValue()).not.toContain(KEY);
    expect(adminCookieValue()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts its own cookie and refuses the raw key as one", () => {
    expect(isAdminCookie(adminCookieValue())).toBe(true);
    expect(isAdminCookie(KEY)).toBe(false);
  });

  it("stops matching when the key changes", () => {
    const issued = adminCookieValue();
    process.env.ADMIN_TOKEN = "a-different-admin-key-1234567";
    expect(isAdminCookie(issued)).toBe(false);
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
