import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/family";

const registerFamilyMock = vi.fn();
const getFamilySessionMock = vi.fn();
const endFamilySessionMock = vi.fn();

vi.mock("@/lib/family-store", () => ({
  registerFamily: (...args: unknown[]) => registerFamilyMock(...args),
  getFamilySession: (...args: unknown[]) => getFamilySessionMock(...args),
  endFamilySession: (...args: unknown[]) => endFamilySessionMock(...args),
}));

let rateLimitOk = true;
// Set to count for real with the in-memory limiter; otherwise rateLimitOk decides.
let realLimiter = false;
let ip = "127.0.0.1";
const rateLimitCalls: [string, number, number][] = [];
vi.mock("@/lib/rate-limit", async (importActual) => {
  const { memoryLimit } = await importActual<typeof import("@/lib/rate-limit")>();
  return {
    rateLimit: (key: string, limit: number, windowMs: number) => {
      rateLimitCalls.push([key, limit, windowMs]);
      return realLimiter ? memoryLimit(key, limit, windowMs) : { ok: rateLimitOk, retryAfter: 60 };
    },
    clientIp: () => ip,
  };
});

const { POST: handleRegister } = await import("./register/route");
const { GET: handleMe } = await import("./me/route");
const { POST: handleLogout } = await import("./logout/route");

function buildRequest(body?: unknown, cookieValue?: string): NextRequest {
  const req = {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
    json: async () => body,
    cookies: {
      get: (name: string) =>
        name === SESSION_COOKIE && cookieValue !== undefined
          ? { value: cookieValue }
          : undefined,
    },
  } as unknown as NextRequest;
  return req;
}

describe("Family Account API Routes (registration, session-cookie, me, logout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOk = true;
    realLimiter = false;
    ip = "127.0.0.1";
    rateLimitCalls.length = 0;
  });

  describe("POST /api/family/register", () => {
    it("returns 429 when rate limited", async () => {
      rateLimitOk = false;
      const req = buildRequest({
        childFirstName: "Alice",
        parentEmail: "alice.parent@example.com",
        isParentOrGuardian: true,
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain("Too many sign-ups");
    });

    it("counts sign-ups per connection, 60 an hour", async () => {
      registerFamilyMock.mockResolvedValue({ ok: false, reason: "unavailable" });
      await handleRegister(
        buildRequest({ childFirstName: "Alice", parentEmail: "alice.parent@example.com", isParentOrGuardian: true })
      );
      expect(rateLimitCalls).toEqual([["family-register:127.0.0.1", 60, 60 * 60_000]]);
    });

    it("lets 60 families sign up from one shared Wi-Fi, and turns the 61st away with a wait time", async () => {
      // At a church or co-op table every phone on the venue Wi-Fi shares one IP.
      realLimiter = true;
      ip = "203.0.113.60";
      registerFamilyMock.mockResolvedValue({
        ok: true,
        session: { firstName: "Kid", shareCode: "GG-234567" },
        sessionToken: "session_token_123",
      });
      for (let i = 1; i <= 60; i++) {
        const res = await handleRegister(
          buildRequest({ childFirstName: "Kid", parentEmail: `parent${i}@example.com`, isParentOrGuardian: true })
        );
        expect(res.status).toBe(200);
      }
      const res = await handleRegister(
        buildRequest({ childFirstName: "Kid", parentEmail: "parent61@example.com", isParentOrGuardian: true })
      );
      expect(res.status).toBe(429);
      expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect((await res.json()).error).toContain("Too many sign-ups");
    });

    it("does not count a form with a mistake against the venue's hour", async () => {
      for (const body of [
        { childFirstName: "", parentEmail: "a@example.com", isParentOrGuardian: true },
        { childFirstName: "Alice", parentEmail: "not-an-email", isParentOrGuardian: true },
        { childFirstName: "Alice", parentEmail: "a@example.com", isParentOrGuardian: false },
        null,
        [],
      ]) {
        const res = await handleRegister(buildRequest(body));
        expect(res.status).toBe(400);
      }
      expect(rateLimitCalls).toEqual([]);
      expect(registerFamilyMock).not.toHaveBeenCalled();
    });

    it("rejects invalid request JSON or missing body with 400", async () => {
      const badReq = {
        headers: { get: () => "application/json" },
        json: async () => {
          throw new Error("Syntax error");
        },
      } as unknown as NextRequest;

      const res = await handleRegister(badReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid request.");
    });

    it("rejects invalid child name with 400", async () => {
      const invalidNames = ["", "   ", "Alice@123", "A".repeat(35)];

      for (const name of invalidNames) {
        const req = buildRequest({
          childFirstName: name,
          parentEmail: "parent@example.com",
          isParentOrGuardian: true,
        });

        const res = await handleRegister(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.field).toBe("childFirstName");
      }
    });

    it("rejects invalid parent email with 400", async () => {
      const invalidEmails = ["", "invalid", "user@", "user@domain", "user@.com"];

      for (const email of invalidEmails) {
        const req = buildRequest({
          childFirstName: "Alice",
          parentEmail: email,
          isParentOrGuardian: true,
        });

        const res = await handleRegister(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.field).toBe("parentEmail");
      }
    });

    it("rejects when isParentOrGuardian is not true with 400", async () => {
      const req = buildRequest({
        childFirstName: "Alice",
        parentEmail: "parent@example.com",
        isParentOrGuardian: false,
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.field).toBe("isParentOrGuardian");
      expect(data.error).toContain("Please confirm you are the parent or guardian");
    });

    it("returns 409 when email is already taken", async () => {
      registerFamilyMock.mockResolvedValueOnce({
        ok: false,
        reason: "email_taken",
      });

      const req = buildRequest({
        childFirstName: "Alice",
        parentEmail: "existing@example.com",
        isParentOrGuardian: true,
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.reason).toBe("email_taken");
      expect(data.error).toContain("This email already has an Explorer account");
    });

    it("returns 503 when family store is unavailable or errors", async () => {
      registerFamilyMock.mockResolvedValueOnce({
        ok: false,
        reason: "unavailable",
      });

      const req = buildRequest({
        childFirstName: "Alice",
        parentEmail: "parent@example.com",
        isParentOrGuardian: true,
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.reason).toBe("unavailable");
      expect(data.error).toContain("We could not create your account right now");
    });

    it("registers successfully, sets session cookie, and returns public child info", async () => {
      registerFamilyMock.mockResolvedValueOnce({
        ok: true,
        sessionToken: "session_secret_token_xyz",
        session: {
          familyId: "fam_1",
          parentEmail: "parent@example.com",
          scoutToken: "scout_private_secret_token",
          shareCode: "GG-234567",
          firstName: "Alice",
        },
      });

      const req = buildRequest({
        childFirstName: "Alice",
        parentEmail: "parent@example.com",
        isParentOrGuardian: true,
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.family.firstName).toBe("Alice");
      expect(data.family.shareCode).toBe("GG-234567");
      // Must not leak private scout token or family id
      expect(data.family.scoutToken).toBeUndefined();
      expect(data.family.familyId).toBeUndefined();

      // Session cookie is set
      const cookie = res.cookies.get(SESSION_COOKIE);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe("session_secret_token_xyz");
      expect(cookie?.httpOnly).toBe(true);
    });
  });

  describe("GET /api/family/me", () => {
    it("returns 429 when rate limited", async () => {
      rateLimitOk = false;
      const req = buildRequest(undefined, "some_cookie");
      const res = await handleMe(req);

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("Too many requests");
    });

    it("returns 401 { signedIn: false } when no session cookie is present", async () => {
      const req = buildRequest(); // no cookie
      const res = await handleMe(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.signedIn).toBe(false);
    });

    it("returns 401 { signedIn: false } when session is invalid or expired", async () => {
      getFamilySessionMock.mockResolvedValueOnce(null);

      const req = buildRequest(undefined, "expired_cookie_val");
      const res = await handleMe(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.signedIn).toBe(false);
      expect(getFamilySessionMock).toHaveBeenCalledWith("expired_cookie_val");
    });

    it("returns 200 with family details and never discloses private scoutToken", async () => {
      getFamilySessionMock.mockResolvedValueOnce({
        familyId: "fam_1",
        parentEmail: "parent@example.com",
        scoutToken: "scout_private_secret_token",
        shareCode: "GG-234567",
        firstName: "Alice",
      });

      const req = buildRequest(undefined, "valid_cookie_val");
      const res = await handleMe(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.signedIn).toBe(true);
      expect(data.family).toEqual({
        firstName: "Alice",
        shareCode: "GG-234567",
        parentEmail: "parent@example.com",
      });
      // Verification: scoutToken and familyId must not be leaked
      expect(data.family.scoutToken).toBeUndefined();
      expect(data.family.familyId).toBeUndefined();
    });
  });

  describe("POST /api/family/logout", () => {
    it("ends family session and clears session cookie", async () => {
      const req = buildRequest(undefined, "active_session_token");
      const res = await handleLogout(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(endFamilySessionMock).toHaveBeenCalledWith("active_session_token");

      // Cookie is cleared with maxAge 0
      const cookie = res.cookies.get(SESSION_COOKIE);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe("");
      expect(cookie?.maxAge).toBe(0);
    });
  });
});
