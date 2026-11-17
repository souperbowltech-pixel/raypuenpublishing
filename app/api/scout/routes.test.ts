import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DEMO_SCOUT_TOKEN } from "@/lib/family";
import type { ScoutAccess } from "@/lib/scout-access";

const resolveScoutAccessMock = vi.fn();
const getOrCreateScoutAsyncMock = vi.fn();
const updateScoutAsyncMock = vi.fn();

vi.mock("@/lib/scout-access", () => ({
  resolveScoutAccess: (...args: unknown[]) => resolveScoutAccessMock(...args),
}));

vi.mock("@/lib/scout-store", () => ({
  getOrCreateScoutAsync: (...args: unknown[]) => getOrCreateScoutAsyncMock(...args),
  updateScoutAsync: (...args: unknown[]) => updateScoutAsyncMock(...args),
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

const { GET: handleGetState } = await import("./state/route");
const { POST: handleUpdateScout } = await import("./update/route");

function buildGetRequest(tokenQuery?: string): NextRequest {
  const url = tokenQuery
    ? `https://puenpublishing.com/api/scout/state?token=${encodeURIComponent(tokenQuery)}`
    : "https://puenpublishing.com/api/scout/state";
  return new NextRequest(url);
}

function buildPostRequest(body: unknown): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
    json: async () => body,
  } as unknown as NextRequest;
}

const mockFamilyAccess: ScoutAccess = {
  kind: "family",
  scoutToken: "scout_secret_token_123",
  family: {
    familyId: "fam_1",
    parentEmail: "parent@example.com",
    scoutToken: "scout_secret_token_123",
    shareCode: "GG-234567",
    firstName: "Sarah",
  },
};

const mockScoutState = {
  scoutName: "Sarah",
  token: "scout_secret_token_123",
  completedPages: [1, 2],
  quizScore: 400,
  hasPassedQuiz: true,
  book2Unlocked: true,
  hasRecruitedFriend: false,
  totalScore: 400,
  status: "Quest Captain" as const,
  readingTimeMinutes: 30,
};

describe("Scout Progress API Routes (GET /api/scout/state, POST /api/scout/update)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveScoutAccessMock.mockReset();
    getOrCreateScoutAsyncMock.mockReset();
    updateScoutAsyncMock.mockReset();
    rateLimitOk = true;
    realLimiter = false;
    ip = "127.0.0.1";
    rateLimitCalls.length = 0;
  });

  describe("GET /api/scout/state", () => {
    it("returns 429 when rate limited", async () => {
      rateLimitOk = false;
      const req = buildGetRequest();
      const res = await handleGetState(req);

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("Too many requests");
    });

    it("returns 401 when access cannot be resolved", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(null);

      const req = buildGetRequest();
      const res = await handleGetState(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Not signed in");
    });

    it("returns scout state with mode 'family' and strips private scoutToken", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(mockFamilyAccess);
      getOrCreateScoutAsyncMock.mockResolvedValueOnce(mockScoutState);

      const req = buildGetRequest();
      const res = await handleGetState(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.mode).toBe("family");
      expect(data.scout.scoutName).toBe("Sarah");
      expect(data.scout.shareCode).toBe("GG-234567");
      // Critical privacy check: private token MUST be undefined
      expect(data.scout.token).toBeUndefined();
    });

    it("returns scout state with mode 'demo' when demo access is resolved", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce({
        kind: "demo",
        scoutToken: DEMO_SCOUT_TOKEN,
      });
      getOrCreateScoutAsyncMock.mockResolvedValueOnce({
        ...mockScoutState,
        scoutName: "Captain Ray Demo",
        token: DEMO_SCOUT_TOKEN,
      });

      const req = buildGetRequest(DEMO_SCOUT_TOKEN);
      const res = await handleGetState(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.mode).toBe("demo");
      expect(data.scout.token).toBe(DEMO_SCOUT_TOKEN);
    });
  });

  describe("POST /api/scout/update", () => {
    it("returns 429 when rate limited", async () => {
      rateLimitOk = false;
      const req = buildPostRequest({ completedPages: [1] });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("Too many requests");
    });

    describe("a table of families on one Wi-Fi", () => {
      const familyAccess = (n: number): ScoutAccess => ({
        ...mockFamilyAccess,
        scoutToken: `scout_token_${n}`,
        family: { ...mockFamilyAccess.family, familyId: `fam_${n}`, scoutToken: `scout_token_${n}` },
      });
      const tick = () => handleUpdateScout(buildPostRequest({ completedPages: [1] }));

      beforeEach(() => {
        realLimiter = true;
        updateScoutAsyncMock.mockResolvedValue({ state: mockScoutState, persisted: true });
      });

      it("counts each child on their own, so ten children can tick 19 stickers each in one minute", async () => {
        ip = "203.0.113.10";
        for (let child = 1; child <= 10; child++) {
          resolveScoutAccessMock.mockResolvedValue(familyAccess(child));
          for (let sticker = 1; sticker <= 19; sticker++) expect((await tick()).status).toBe(200);
        }
      });

      it("still stops one child past 30 saves a minute, without stopping the next child", async () => {
        ip = "203.0.113.11";
        resolveScoutAccessMock.mockResolvedValue(familyAccess(101));
        for (let i = 1; i <= 30; i++) expect((await tick()).status).toBe(200);
        const blocked = await tick();
        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

        resolveScoutAccessMock.mockResolvedValue(familyAccess(102));
        expect((await tick()).status).toBe(200);
      });

      it("counts a family's saves on that child and on the connection", async () => {
        ip = "203.0.113.13";
        resolveScoutAccessMock.mockResolvedValue(familyAccess(201));
        await tick();
        expect(rateLimitCalls).toEqual([
          ["scout-update:203.0.113.13", 300, 60_000],
          ["scout-update:child:scout_token_201", 30, 60_000],
        ]);
      });

      it("counts a request that is not signed in only on the connection", async () => {
        ip = "203.0.113.14";
        resolveScoutAccessMock.mockResolvedValue(null);
        expect((await tick()).status).toBe(401);
        expect(rateLimitCalls).toEqual([["scout-update:203.0.113.14", 300, 60_000]]);
      });

      it("counts the shared demo per connection, never as one bucket for every visitor", async () => {
        ip = "203.0.113.12";
        resolveScoutAccessMock.mockResolvedValue({ kind: "demo", scoutToken: DEMO_SCOUT_TOKEN });
        await tick();
        expect(rateLimitCalls).toEqual([
          ["scout-update:203.0.113.12", 300, 60_000],
          ["scout-update:demo:203.0.113.12", 30, 60_000],
        ]);
      });
    });

    it("returns 401 when access cannot be resolved", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(null);

      const req = buildPostRequest({ completedPages: [1] });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Not signed in");
    });

    it("rejects invalid child name with 400 for registered families", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(mockFamilyAccess);

      const req = buildPostRequest({ scoutName: "Invalid@Name#1" });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
      expect(updateScoutAsyncMock).not.toHaveBeenCalled();
    });

    it("rejects request with 400 when no valid fields are provided", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(mockFamilyAccess);

      const req = buildPostRequest({ bogusField: 123 });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("No valid fields to update");
      expect(updateScoutAsyncMock).not.toHaveBeenCalled();
    });

    it("sanitizes completedPages to valid integers in range 1..19", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(mockFamilyAccess);
      updateScoutAsyncMock.mockResolvedValueOnce({
        persisted: true,
        state: { ...mockScoutState, completedPages: [1, 5, 19] },
      });

      const req = buildPostRequest({
        completedPages: [1, 5, 19, 0, 20, -3, "invalid", 5, 1.2],
      });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(200);
      expect(updateScoutAsyncMock).toHaveBeenCalledWith(
        "scout_secret_token_123",
        expect.objectContaining({
          completedPages: [1, 5, 19],
        })
      );
    });

    it("computes quizScore server-side via gradeQuiz", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(mockFamilyAccess);
      updateScoutAsyncMock.mockResolvedValueOnce({
        persisted: true,
        state: { ...mockScoutState, quizScore: 400 },
      });

      const req = buildPostRequest({
        quizBook: 1,
        quizAnswers: { book1_q1: 0, book1_q2: 1, book1_q3: 2, book1_q4: 0 },
      });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(200);
      expect(updateScoutAsyncMock).toHaveBeenCalledWith(
        "scout_secret_token_123",
        expect.objectContaining({
          quizScore: 400,
        })
      );
    });

    it("returns 503 when update cannot be persisted to database", async () => {
      resolveScoutAccessMock.mockResolvedValueOnce(mockFamilyAccess);
      updateScoutAsyncMock.mockResolvedValueOnce({
        persisted: false,
        state: mockScoutState,
      });

      const req = buildPostRequest({ completedPages: [1] });
      const res = await handleUpdateScout(req);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.saved).toBe(false);
      expect(data.error).toContain("Your progress could not be saved");
    });
  });
});
