import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The reward logic and the save path are the two places where a bug costs a real
 * child their progress or a paying sponsor their unlock, so both are covered
 * here: the pure threshold maths, and what `updateScoutAsync` reports when the
 * database misbehaves.
 *
 * The Supabase client is replaced with a fake at the module boundary. The
 * assertions are about observable outcomes — what ended up in the row, and what
 * the result object says — never about "was this mock called", so the tests
 * still fail if the real logic breaks.
 */

const env = vi.hoisted(() => ({
  supabase: null as unknown,
  isProduction: false,
}));

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return env.supabase;
  },
  get isProduction() {
    return env.isProduction;
  },
}));

// Keep the local JSON mirror entirely in memory: tests must never write into the repo.
vi.mock("fs", () => ({
  default: {
    existsSync: () => true,
    mkdirSync: () => undefined,
    readFileSync: () => "{}",
    writeFileSync: () => undefined,
  },
}));

const { deriveScoutFields, updateScoutAsync } = await import("./scout-store");

interface FakeRow {
  token: string;
  scout_name: string;
  completed_pages: number[];
  quiz_score: number;
  referral_score: number;
  friends_completed: number;
  book3_sponsored: boolean;
  status: string;
  updated_at: string;
}

function makeFakeSupabase(initial: Partial<FakeRow> = {}) {
  const db = {
    row: {
      token: "SCOUT-1",
      scout_name: "Ali",
      completed_pages: [] as number[],
      quiz_score: 0,
      referral_score: 0,
      friends_completed: 0,
      book3_sponsored: false,
      status: "In_Progress",
      updated_at: "2026-09-23T10:00:00.000Z",
      ...initial,
    } as FakeRow,
    updateAttempts: 0,
    updateError: null as { message: string; code?: string } | null,
    /**
     * Simulates a database that never received the friends_completed /
     * book3_sponsored migration: writes carrying those columns are rejected with
     * Postgres' undefined-column code, writes without them succeed.
     */
    rejectNewColumns: false,
    /** Simulates another request writing to the same row mid-flight. Fires once. */
    competingWrite: null as null | (() => void),
  };

  const client = {
    from() {
      return {
        select() {
          const read = {
            eq: () => read,
            maybeSingle: async () => ({ data: db.row, error: null }),
          };
          return read;
        },
        insert() {
          return {
            select: () => ({ maybeSingle: async () => ({ data: db.row, error: null }) }),
          };
        },
        update(patch: Partial<FakeRow>) {
          const filters: Record<string, unknown> = {};
          const write = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              return write;
            },
            async select() {
              db.updateAttempts += 1;
              if (db.competingWrite) {
                db.competingWrite();
                db.competingWrite = null;
              }
              if (db.updateError) return { data: null, error: db.updateError };
              if (
                db.rejectNewColumns &&
                ("friends_completed" in patch || "book3_sponsored" in patch)
              ) {
                return {
                  data: null,
                  error: { message: 'column "book3_sponsored" does not exist', code: "42703" },
                };
              }
              // The optimistic-concurrency guard the real table enforces.
              if (filters.updated_at !== db.row.updated_at) return { data: [], error: null };
              db.row = { ...db.row, ...patch } as FakeRow;
              return { data: [{ token: db.row.token }], error: null };
            },
          };
          return write;
        },
      };
    },
  };

  return { db, client };
}

beforeEach(() => {
  env.supabase = null;
  env.isProduction = false;
});

describe("deriveScoutFields — the reward thresholds", () => {
  const base = {
    token: "SCOUT-1",
    scoutName: "Ali",
    completedPages: [],
    book3Sponsored: false,
    updatedAt: "2026-09-23T10:00:00.000Z",
  };

  it("does not pass the quiz one point short of 400", () => {
    const s = deriveScoutFields({ ...base, quizScore: 399, friendsCompleted: 0 });
    expect(s.hasPassedQuiz).toBe(false);
    expect(s.status).toBe("In_Progress");
  });

  it("passes the quiz exactly at 400", () => {
    const s = deriveScoutFields({ ...base, quizScore: 400, friendsCompleted: 0 });
    expect(s.hasPassedQuiz).toBe(true);
    expect(s.totalScore).toBe(400);
    expect(s.status).toBe("Academic_Pass");
  });

  it("awards nothing for one friend, and 300 for the second", () => {
    expect(deriveScoutFields({ ...base, quizScore: 400, friendsCompleted: 1 }).referralScore).toBe(0);
    expect(deriveScoutFields({ ...base, quizScore: 400, friendsCompleted: 2 }).referralScore).toBe(300);
  });

  it("unlocks Book 2 only once the total reaches 700", () => {
    const short = deriveScoutFields({ ...base, quizScore: 399, friendsCompleted: 2 });
    expect(short.totalScore).toBe(699);
    expect(short.book2Unlocked).toBe(false);

    const exact = deriveScoutFields({ ...base, quizScore: 400, friendsCompleted: 2 });
    expect(exact.totalScore).toBe(700);
    expect(exact.book2Unlocked).toBe(true);
    expect(exact.status).toBe("Unlock_Volume_2");
  });

  it("clamps scores that are out of range, negative or not numbers at all", () => {
    expect(deriveScoutFields({ ...base, quizScore: 99999, friendsCompleted: 0 }).quizScore).toBe(400);
    expect(deriveScoutFields({ ...base, quizScore: -50, friendsCompleted: 0 }).quizScore).toBe(0);
    expect(
      deriveScoutFields({ ...base, quizScore: "abc" as unknown as number, friendsCompleted: 0 }).quizScore
    ).toBe(0);
    // A third friend cannot be worth more than the second.
    expect(deriveScoutFields({ ...base, quizScore: 0, friendsCompleted: 99 }).friendsCompleted).toBe(3);
  });

  it("keeps the Grandpa (Book 3) track independent of the 700-point track", () => {
    const s = deriveScoutFields({ ...base, quizScore: 0, friendsCompleted: 0, book3Sponsored: true });
    expect(s.book3Unlocked).toBe(true);
    expect(s.book2Unlocked).toBe(false);
  });
});

describe("updateScoutAsync — never report a save that did not happen", () => {
  it("reports persisted:false when the database rejects the write", async () => {
    const { db, client } = makeFakeSupabase();
    env.supabase = client;
    db.updateError = { message: "connection refused" };

    const result = await updateScoutAsync("SCOUT-1", { completedPages: [1] });

    expect(result.persisted).toBe(false);
    expect(result.error).toContain("connection refused");
  });

  it("reports persisted:true when the write lands", async () => {
    const { db, client } = makeFakeSupabase();
    env.supabase = client;

    const result = await updateScoutAsync("SCOUT-1", { completedPages: [1, 2] });

    expect(result.persisted).toBe(true);
    expect(db.row.completed_pages).toEqual([1, 2]);
  });

  it("does not lose a competing write that lands between our read and our write", async () => {
    const { db, client } = makeFakeSupabase();
    env.supabase = client;

    // Another request passes the quiz for this child while our page-toggle is in flight.
    db.competingWrite = () => {
      db.row = {
        ...db.row,
        quiz_score: 400,
        status: "Academic_Pass",
        updated_at: "2026-09-23T10:05:00.000Z",
      };
    };

    const result = await updateScoutAsync("SCOUT-1", { completedPages: [7] });

    expect(result.persisted).toBe(true);
    // Both survive: the guard forced a re-read and re-merge instead of clobbering.
    expect(db.row.quiz_score).toBe(400);
    expect(db.row.completed_pages).toEqual([7]);
    expect(db.updateAttempts).toBeGreaterThan(1);
  });

  it("gives up honestly rather than looping forever under constant contention", async () => {
    const { db, client } = makeFakeSupabase();
    env.supabase = client;

    // A writer that always wins the race, on every single attempt.
    let tick = 0;
    Object.defineProperty(db, "competingWrite", {
      get: () => () => {
        tick += 1;
        db.row = { ...db.row, updated_at: `2026-09-23T10:0${tick}:00.000Z` };
      },
      set: () => undefined,
      configurable: true,
    });

    const result = await updateScoutAsync("SCOUT-1", { completedPages: [3] });

    expect(result.persisted).toBe(false);
    expect(result.error).toBe("concurrent update");
  });

  it("refuses to claim a sponsorship saved when the database lacks the column for it", async () => {
    // A database that never got the friends_completed/book3_sponsored migration
    // rejects those columns. The rest of the row still saves, but the unlock the
    // sponsor paid for did not — reporting success here is the original bug.
    const { db, client } = makeFakeSupabase();
    env.supabase = client;
    db.rejectNewColumns = true;

    const result = await updateScoutAsync("SCOUT-1", { book3Sponsored: true });

    // The legacy half of the row saves fine, so it is tempting to call this a
    // success — but the one value the sponsor paid for was dropped.
    expect(db.row.scout_name).toBe("Ali");
    expect(result.persisted).toBe(false);
    expect(result.error).toContain("book3_sponsored");
  });

  it("still counts an unrelated change as saved on a database missing those columns", async () => {
    const { db, client } = makeFakeSupabase();
    env.supabase = client;
    db.rejectNewColumns = true;

    const result = await updateScoutAsync("SCOUT-1", { completedPages: [4] });

    // Nothing this caller asked for was dropped, so this really is saved.
    expect(result.persisted).toBe(true);
    expect(db.row.completed_pages).toEqual([4]);
  });

  it("says the row is missing rather than blaming a race that never happened", async () => {
    // The row is not in the database at all: reads find nothing, the create does
    // not land either, so every conditional write matches zero rows. Calling that
    // a "concurrent update" would send an operator hunting a race that never
    // happened.
    env.supabase = {
      from: () => ({
        select: () => ({
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        insert: () => ({
          select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        update: () => ({
          eq() {
            return this;
          },
          select: async () => ({ data: [], error: null }),
        }),
      }),
    };

    const result = await updateScoutAsync("SCOUT-GONE", { completedPages: [1] });

    expect(result.persisted).toBe(false);
    expect(result.error).toContain("missing");
  });

  it("treats the local JSON store as a real save in development", async () => {
    env.supabase = null;
    env.isProduction = false;

    const result = await updateScoutAsync("SCOUT-DEV", { completedPages: [1] });

    expect(result.persisted).toBe(true);
  });

  it("refuses to claim a save in production when no database is configured", async () => {
    // This is the exact misconfiguration that silently lost writes on the live
    // site: there is no durable store, so nothing may report success.
    env.supabase = null;
    env.isProduction = true;

    const result = await updateScoutAsync("SCOUT-PROD", { completedPages: [1] });

    expect(result.persisted).toBe(false);
    expect(result.error).toBe("database not configured");
  });
});
