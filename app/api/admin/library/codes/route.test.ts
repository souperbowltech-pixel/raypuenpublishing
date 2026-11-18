import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Ray's review codes from /admin: who may make or cancel one, what is checked
 * before the database is asked, and what comes back. The store is faked; its
 * own rules are tested in lib/library-store.test.ts.
 */

let signedIn = true;
let configured = true;
let limitOk = true;
const limitOptions: unknown[] = [];
const createGrant = vi.fn();
const revokeGrant = vi.fn();
const masterUploaded = vi.fn();
const limitKeys: string[] = [];

vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE: "gg_admin",
  adminConfigured: () => configured,
  isAdminCookie: (value: unknown) => signedIn && value === "good",
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (key: string, _limit: number, _window: number, options: unknown) => {
    limitKeys.push(key);
    limitOptions.push(options);
    return { ok: limitOk, retryAfter: 42 };
  },
  clientIp: () => "203.0.113.5",
}));
vi.mock("@/lib/library-store", () => ({
  createGrant: (...a: unknown[]) => createGrant(...a),
  revokeGrant: (...a: unknown[]) => revokeGrant(...a),
  masterUploaded: (...a: unknown[]) => masterUploaded(...a),
}));
vi.mock("@/lib/site", () => ({ getSiteOrigin: () => "https://www.puenpublishing.com" }));

const { POST: make } = await import("./route");
const { POST: cancel } = await import("./cancel/route");

const GRANT_ID = "8f14e45f-ceea-4e6b-a1a8-7b9d2b5c1e01";

function request(body: unknown, { cookie = "good", type = "application/json" } = {}) {
  return new NextRequest("https://www.puenpublishing.com/api/admin/library/codes", {
    method: "POST",
    headers: { "content-type": type, cookie: `gg_admin=${cookie}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  signedIn = true;
  configured = true;
  limitOk = true;
  limitKeys.length = 0;
  limitOptions.length = 0;
  createGrant.mockReset();
  revokeGrant.mockReset();
  masterUploaded.mockReset();
  createGrant.mockResolvedValue({
    ok: true,
    code: "ABCD2345WXYZ",
    grant: { recipientName: "Jane Smith", expiresAt: "2027-01-17T12:00:00.000Z" },
  });
  masterUploaded.mockResolvedValue(true);
});

describe("POST /api/admin/library/codes", () => {
  it("makes a review code and shows it once, with the link to send and the book's file state", async () => {
    const res = await make(request({ book: "neighborhood-book-1", name: "Jane Smith", email: "Jane@Example.com" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      code: "ABCD-2345-WXYZ",
      bookTitle: "The Neighborhood Chronicles, Book 1: David and Goliath",
      recipientName: "Jane Smith",
      expiresAt: "2027-01-17T12:00:00.000Z",
      libraryUrl: "https://www.puenpublishing.com/library",
      bookUploaded: true,
    });
    expect(createGrant).toHaveBeenCalledWith({
      kind: "review",
      bookSlug: "neighborhood-book-1",
      recipientName: "Jane Smith",
      recipientEmail: "jane@example.com",
    });
  });

  it("only ever makes review codes, whatever the request asks for", async () => {
    await make(request({ book: "parents-guide", name: "Jane", kind: "purchase" }));
    expect(createGrant).toHaveBeenCalledWith(expect.objectContaining({ kind: "review", recipientEmail: null }));
  });

  it("refuses anyone without the admin cookie, before counting or asking the store", async () => {
    signedIn = false;
    const res = await make(request({ book: "geezy-book-1", name: "Jane" }));
    expect(res.status).toBe(401);
    expect(createGrant).not.toHaveBeenCalled();
    expect(limitKeys).toEqual([]);
  });

  it("refuses a plain form post, which is all a cross-site page could send", async () => {
    const res = await make(request("book=geezy-book-1&name=Jane", { type: "application/x-www-form-urlencoded" }));
    expect(res.status).toBe(415);
    expect(createGrant).not.toHaveBeenCalled();
  });

  it("counts every attempt per connection and stops a burst with a wait time", async () => {
    limitOk = false;
    const res = await make(request({ book: "geezy-book-1", name: "Jane" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(limitKeys).toEqual(["admin-library-code:203.0.113.5"]);
    expect(createGrant).not.toHaveBeenCalled();
  });

  it("names the field that needs fixing", async () => {
    for (const [body, field] of [
      [{ book: "no-such-book", name: "Jane" }, "book"],
      [{ book: "geezy-book-1", name: "Jane", email: "not-an-email" }, "email"],
    ] as const) {
      const res = await make(request(body));
      expect(res.status).toBe(400);
      expect((await res.json()).field).toBe(field);
    }
    createGrant.mockResolvedValueOnce({ ok: false, reason: "invalid-name" });
    const res = await make(request({ book: "geezy-book-1", name: "###" }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("name");
  });

  it("refuses a body that is not a JSON object", async () => {
    for (const body of ["not json", "null", "[]"]) {
      expect((await make(request(body))).status).toBe(400);
    }
  });

  it("says plainly when the library is unreachable or the code could not be made", async () => {
    createGrant.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    expect((await make(request({ book: "geezy-book-1", name: "Jane" }))).status).toBe(503);
    createGrant.mockResolvedValueOnce({ ok: false, reason: "error" });
    expect((await make(request({ book: "geezy-book-1", name: "Jane" }))).status).toBe(500);
  });

  it("passes on that the book's file is missing, so Ray is told the code opens nothing yet", async () => {
    masterUploaded.mockResolvedValueOnce(false);
    const res = await make(request({ book: "geezy-book-1", name: "Jane" }));
    expect((await res.json()).bookUploaded).toBe(false);
  });
});

describe("POST /api/admin/library/codes/cancel", () => {
  it("cancels a code", async () => {
    revokeGrant.mockResolvedValueOnce("revoked");
    const res = await cancel(request({ id: GRANT_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cancelled: true });
    expect(revokeGrant).toHaveBeenCalledWith(GRANT_ID);
    expect(limitKeys).toEqual(["admin-library-cancel:203.0.113.5"]);
  });

  it("refuses anyone without the admin cookie", async () => {
    const res = await cancel(request({ id: GRANT_ID }, { cookie: "forged" }));
    expect(res.status).toBe(401);
    expect(revokeGrant).not.toHaveBeenCalled();
  });

  it("answers 404 for a code already cancelled or not there, and 503 when unreachable", async () => {
    revokeGrant.mockResolvedValueOnce("not-found");
    expect((await cancel(request({ id: GRANT_ID }))).status).toBe(404);
    revokeGrant.mockResolvedValueOnce("unavailable");
    expect((await cancel(request({ id: GRANT_ID }))).status).toBe(503);
  });
});

describe("the checks both routes share", () => {
  const routes = [
    ["make", make, { book: "geezy-book-1", name: "Jane" }],
    ["cancel", cancel, { id: GRANT_ID }],
  ] as const;

  it("refuses everyone when no admin key is configured", async () => {
    configured = false;
    for (const [, route, body] of routes) expect((await route(request(body))).status).toBe(401);
  });

  it("refuses a text/plain body even when it holds valid JSON: that is what a cross-site form can send", async () => {
    for (const [, route, body] of routes) {
      expect((await route(request(JSON.stringify(body), { type: "text/plain" }))).status).toBe(415);
    }
    expect(createGrant).not.toHaveBeenCalled();
    expect(revokeGrant).not.toHaveBeenCalled();
  });

  it("accepts JSON with a charset, and nothing that only starts like JSON", async () => {
    revokeGrant.mockResolvedValue("revoked");
    expect((await cancel(request({ id: GRANT_ID }, { type: "application/json; charset=utf-8" }))).status).toBe(200);
    expect((await cancel(request({ id: GRANT_ID }, { type: "application/jsonp" }))).status).toBe(415);
  });

  it("refuses a burst with a wait time, and refuses when the count cannot be checked", async () => {
    limitOk = false;
    for (const [, route, body] of routes) {
      const res = await route(request(body));
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("42");
    }
    expect(limitOptions).toEqual([{ whenUnavailable: "refuse" }, { whenUnavailable: "refuse" }]);
  });

  it("refuses a body that is not a JSON object", async () => {
    for (const [, route] of routes) {
      for (const body of ["not json", "null", "[]"]) expect((await route(request(body))).status).toBe(400);
    }
  });
});

describe("making a code, the edges", () => {
  it("refuses an email that is not text", async () => {
    for (const email of [42, { a: 1 }, ["a@b.co"]]) {
      const res = await make(request({ book: "geezy-book-1", name: "Jane", email }));
      expect(res.status).toBe(400);
      expect((await res.json()).field).toBe("email");
    }
    expect(createGrant).not.toHaveBeenCalled();
  });

  it("refuses an unusable name before checking the book's file or making anything", async () => {
    const res = await make(request({ book: "geezy-book-1", name: "###" }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("name");
    expect(masterUploaded).not.toHaveBeenCalled();
    expect(createGrant).not.toHaveBeenCalled();
  });

  it("treats a duplicate as a failure to try again", async () => {
    createGrant.mockResolvedValueOnce({ ok: false, reason: "duplicate" });
    expect((await make(request({ book: "geezy-book-1", name: "Jane" }))).status).toBe(500);
  });

  it("checks the book's file before making the grant, so a slow check never strands a made code", async () => {
    const order: string[] = [];
    masterUploaded.mockImplementationOnce(async () => {
      order.push("check");
      return null;
    });
    createGrant.mockImplementationOnce(async () => {
      order.push("create");
      return { ok: true, code: "ABCD2345WXYZ", grant: { recipientName: "Jane", expiresAt: "2027-01-17T12:00:00.000Z" } };
    });
    const res = await make(request({ book: "geezy-book-1", name: "Jane" }));
    expect(order).toEqual(["check", "create"]);
    expect((await res.json()).bookUploaded).toBeNull();
  });
});
