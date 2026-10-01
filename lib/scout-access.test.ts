import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  resolveScoutAccess,
  setSessionCookie,
  clearSessionCookie,
} from "./scout-access";
import {
  DEMO_SCOUT_TOKEN,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./family";

const getFamilySessionMock = vi.fn();

vi.mock("@/lib/family-store", () => ({
  getFamilySession: (...args: unknown[]) => getFamilySessionMock(...args),
}));

function buildRequest(cookieValue?: string): NextRequest {
  const req = new NextRequest("https://puenpublishing.com/api/scout/state");
  if (cookieValue !== undefined) {
    req.cookies.set(SESSION_COOKIE, cookieValue);
  }
  return req;
}

const mockFamilySession = {
  familyId: "fam_abc123",
  parentEmail: "parent@example.com",
  scoutToken: "scout_legit_child_token",
  shareCode: "GG-234567",
  firstName: "Timmy",
};

describe("resolveScoutAccess (authorization boundary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants demo access when DEMO_SCOUT_TOKEN is explicitly requested", async () => {
    const req = buildRequest();
    const access = await resolveScoutAccess(req, DEMO_SCOUT_TOKEN);

    expect(access).toEqual({
      kind: "demo",
      scoutToken: DEMO_SCOUT_TOKEN,
    });
    // Demo token does not query family sessions
    expect(getFamilySessionMock).not.toHaveBeenCalled();
  });

  it("grants demo access even if a family session cookie is also present", async () => {
    const req = buildRequest("some_session_secret");
    const access = await resolveScoutAccess(req, DEMO_SCOUT_TOKEN);

    expect(access).toEqual({
      kind: "demo",
      scoutToken: DEMO_SCOUT_TOKEN,
    });
    expect(getFamilySessionMock).not.toHaveBeenCalled();
  });

  it("resolves family access when a valid session cookie exists", async () => {
    getFamilySessionMock.mockResolvedValueOnce(mockFamilySession);

    const req = buildRequest("valid_session_token");
    const access = await resolveScoutAccess(req);

    expect(getFamilySessionMock).toHaveBeenCalledWith("valid_session_token");
    expect(access).toEqual({
      kind: "family",
      scoutToken: "scout_legit_child_token",
      family: mockFamilySession,
    });
  });

  it("enforces authorization boundary: ignores untrusted requestedToken when family session is present", async () => {
    getFamilySessionMock.mockResolvedValueOnce(mockFamilySession);

    // An attacker attempts to read or mutate another child's progress by passing another scout's token
    const attackerTargetToken = "scout_victim_child_token";
    const req = buildRequest("valid_session_token");
    const access = await resolveScoutAccess(req, attackerTargetToken);

    // The returned scoutToken MUST be the authenticated child's token, NEVER the requested token
    expect(access).not.toBeNull();
    expect(access?.kind).toBe("family");
    expect(access?.scoutToken).toBe("scout_legit_child_token");
    expect(access?.scoutToken).not.toBe(attackerTargetToken);
  });

  it("returns null when no session cookie is provided and requestedToken is not demo", async () => {
    const req = buildRequest(); // no cookies
    const access = await resolveScoutAccess(req, "arbitrary_token");

    expect(access).toBeNull();
    expect(getFamilySessionMock).toHaveBeenCalledWith(undefined);
  });

  it("returns null when session cookie is invalid or expired", async () => {
    getFamilySessionMock.mockResolvedValueOnce(null);

    const req = buildRequest("expired_or_invalid_session");
    const access = await resolveScoutAccess(req);

    expect(getFamilySessionMock).toHaveBeenCalledWith("expired_or_invalid_session");
    expect(access).toBeNull();
  });
});

describe("session cookie management", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets session cookie with correct flags in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, "session_secret_123");

    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("session_secret_123");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(cookie?.secure).toBe(false);
  });

  it("sets secure: true in production environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, "session_secret_prod");

    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("session_secret_prod");
    expect(cookie?.secure).toBe(true);
  });

  it("clears session cookie with maxAge: 0", () => {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);

    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(0);
  });
});
