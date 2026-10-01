import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * PERF-01 — the fallback stores quietly disagree with each other, and one write
 * is wasted.
 *
 * `updateScoutAsync` previously mirrored to the local JSON file even when the
 * database had just accepted the write. On serverless (Vercel) this write fails
 * because the filesystem is read-only; where it succeeds, it leaves a stale local
 * copy.
 *
 * These tests verify the write behavior:
 * - When Supabase accepts the write, writeFileSync is NOT called for scouts.json.
 * - When Supabase rejects the write with an error, writeFileSync IS called because
 *   the local fallback is the only copy that exists.
 * - When Supabase drops unmigrated columns (written-without-new-columns), writeFileSync
 *   IS called because the local fallback is the only copy that holds them.
 * - The returned state is the same either way.
 *
 * In addition, the per-instance nature of memoryStore and the local family fallback
 * is verified in source docblocks, ensuring neither store silently hides divergence.
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

const { updateScoutAsync } = await import("./scout-store");

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

function makeFakeSupabase(options: {
  initial?: Partial<FakeRow>;
  updateError?: { message: string; code?: string } | null;
  rejectNewColumns?: boolean;
} = {}) {
  const { initial = {}, updateError = null, rejectNewColumns = false } = options;
  const db = {
    row: {
      token: "SCOUT-FALLBACK-TEST",
      scout_name: "Fallback Explorer",
      completed_pages: [1],
      quiz_score: 100,
      referral_score: 0,
      friends_completed: 0,
      book3_sponsored: false,
      status: "In_Progress",
      updated_at: "2026-10-01T10:00:00.000Z",
      ...initial,
    } as FakeRow,
    updateError,
    rejectNewColumns,
  };

  const client = {
    from() {
      return {
        select() {
          const query = {
            eq: () => query,
            maybeSingle: async () => ({ data: db.row, error: null }),
          };
          return query;
        },
        update(patch: Partial<FakeRow>) {
          const query = {
            eq: () => query,
            async select() {
              if (db.updateError) return { data: null, error: db.updateError };
              if (
                db.rejectNewColumns &&
                ("friends_completed" in patch || "book3_sponsored" in patch)
              ) {
                return {
                  data: null,
                  error: {
                    message: 'column "friends_completed" does not exist',
                    code: "42703",
                  },
                };
              }
              db.row = { ...db.row, ...patch } as FakeRow;
              return { data: [{ token: db.row.token }], error: null };
            },
          };
          return query;
        },
      };
    },
  };

  return { db, client };
}

describe("updateScoutAsync local mirror behaviour", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not call writeFileSync for scouts.json when the database accepts the write", async () => {
    const { client } = makeFakeSupabase();
    env.supabase = client;

    const result = await updateScoutAsync("SCOUT-FALLBACK-TEST", { completedPages: [1, 2] });
    expect(result.persisted).toBe(true);

    const scoutWrites = writeSpy.mock.calls.filter((c) => String(c[0]).endsWith("scouts.json"));
    expect(scoutWrites).toHaveLength(0);
  });

  it("calls writeFileSync for scouts.json when the database write comes back as an error", async () => {
    const { db, client } = makeFakeSupabase();
    db.updateError = { message: "connection refused" };
    env.supabase = client;

    const result = await updateScoutAsync("SCOUT-FALLBACK-TEST", { completedPages: [1, 2] });
    expect(result.persisted).toBe(false);
    expect(result.error).toBe("connection refused");

    const scoutWrites = writeSpy.mock.calls.filter((c) => String(c[0]).endsWith("scouts.json"));
    expect(scoutWrites.length).toBeGreaterThanOrEqual(1);
  });

  it("calls writeFileSync for scouts.json when database write drops unmigrated columns", async () => {
    const { client } = makeFakeSupabase({ rejectNewColumns: true });
    env.supabase = client;

    const result = await updateScoutAsync("SCOUT-FALLBACK-TEST", { friendsCompleted: 2 });
    expect(result.persisted).toBe(false);
    expect(result.error).toBe(
      "scout_profiles is missing the friends_completed/book3_sponsored columns"
    );

    const scoutWrites = writeSpy.mock.calls.filter((c) => String(c[0]).endsWith("scouts.json"));
    expect(scoutWrites.length).toBeGreaterThanOrEqual(1);
  });

  it("returns the same state whether the write succeeded in the database or fell back to local", async () => {
    const { client: successClient } = makeFakeSupabase();
    env.supabase = successClient;
    const successResult = await updateScoutAsync("SCOUT-FALLBACK-TEST", { completedPages: [1, 2] });

    writeSpy.mockClear();

    const { db: errorDb, client: errorClient } = makeFakeSupabase();
    errorDb.updateError = { message: "database timeout" };
    env.supabase = errorClient;
    const errorResult = await updateScoutAsync("SCOUT-FALLBACK-TEST", { completedPages: [1, 2] });

    expect(successResult.state).toEqual(errorResult.state);
  });
});

/**
 * Docblock verification for fallback stores.
 *
 * Verifies that each store's fallback declaration is preceded by a block comment
 * containing "per-instance", ensuring the divergence behavior remains documented.
 */
describe("fallback stores per-instance divergence warnings", () => {
  it("scout-store documents that memoryStore is per-instance", () => {
    const scoutStoreSource = fs.readFileSync(
      path.join(path.resolve(__dirname, ".."), "lib/scout-store.ts"),
      "utf8"
    );
    const declIndex = scoutStoreSource.indexOf("const memoryStore");
    expect(declIndex).toBeGreaterThan(-1);
    const preceding = scoutStoreSource.slice(0, declIndex).trimEnd();
    expect(preceding).toMatch(/\/\*\*[\s\S]*?per-instance[\s\S]*?\*\/$/);
  });

  it("family-store documents that its local fallback is per-instance", () => {
    const familyStoreSource = fs.readFileSync(
      path.join(path.resolve(__dirname, ".."), "lib/family-store.ts"),
      "utf8"
    );
    const declIndex = familyStoreSource.indexOf("const LOCAL_FILE");
    expect(declIndex).toBeGreaterThan(-1);
    const preceding = familyStoreSource.slice(0, declIndex).trimEnd();
    expect(preceding).toMatch(/\/\*\*[\s\S]*?per-instance[\s\S]*?\*\/$/);
  });
});
