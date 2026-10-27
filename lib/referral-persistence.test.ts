import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The referral logic is already covered by `referrals.test.ts`, which exercises
 * the local JSON store inside one process. This file covers the thing that store
 * cannot show: whether the referrer's new count has actually reached the database
 * by the time the friend's request is answered.
 *
 * That distinction is the whole point. On Vercel a serverless function may be
 * frozen the moment it returns its response, so a promise left unawaited can be
 * killed before it finishes. A referral write started and not waited for is a
 * reward that silently never lands, and nobody finds out until a parent writes in.
 *
 * Every fake call below yields to the event loop first, the way a real network
 * round trip does. Without that, an unawaited promise would finish anyway while
 * the microtask queue drained and the test would pass against broken code.
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

// The local JSON mirror stays in memory: tests must never write into the repo.
vi.mock("fs", () => ({
  default: {
    existsSync: () => true,
    mkdirSync: () => undefined,
    readFileSync: () => "{}",
    writeFileSync: () => undefined,
  },
}));

const { updateScoutAsync } = await import("./scout-store");

interface Row {
  token: string;
  scout_name: string;
  completed_pages: number[];
  quiz_score: number;
  referral_score: number;
  friends_completed: number;
  book3_sponsored: boolean;
  referred_by_scout_token: string | null;
  status: string;
  updated_at: string;
}

function row(token: string, extra: Partial<Row> = {}): Row {
  return {
    token,
    scout_name: "Scout",
    completed_pages: [],
    quiz_score: 0,
    referral_score: 0,
    friends_completed: 0,
    book3_sponsored: false,
    referred_by_scout_token: null,
    status: "In_Progress",
    updated_at: "2026-10-27T10:00:00.000Z",
    ...extra,
  };
}

/** A real round trip is never instant, so neither is this one. */
const hop = () => new Promise((r) => setTimeout(r, 0));

/** A fake `scout_profiles` holding several rows, with the filters this code uses. */
function makeTable(rows: Row[]) {
  const db = { rows: [...rows] };

  const client = {
    from() {
      return {
        select() {
          const filters: Record<string, unknown> = {};
          const read = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              return read;
            },
            async maybeSingle() {
              await hop();
              const found = db.rows.find((r) => r.token === filters.token);
              return { data: found ?? null, error: null };
            },
            // Awaited directly (no maybeSingle) when listing a scout's referrals.
            async then(resolve: (v: unknown) => void) {
              await hop();
              const matched = db.rows.filter(
                (r) => r.referred_by_scout_token === filters.referred_by_scout_token
              );
              resolve({ data: matched, error: null });
            },
          };
          return read;
        },
        insert() {
          return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
        },
        update(patch: Partial<Row>) {
          const filters: Record<string, unknown> = {};
          const write = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              return write;
            },
            async select() {
              await hop();
              const target = db.rows.find((r) => r.token === filters.token);
              if (!target) return { data: [], error: null };
              // The optimistic-concurrency guard the real table enforces.
              if (target.updated_at !== filters.updated_at) return { data: [], error: null };
              Object.assign(target, patch);
              return { data: [{ token: target.token }], error: null };
            },
          };
          return write;
        },
      };
    },
  };

  return { db, client };
}

const friendsOf = (db: { rows: Row[] }, token: string) =>
  db.rows.find((r) => r.token === token)!.friends_completed;

beforeEach(() => {
  env.supabase = null;
  env.isProduction = false;
});

describe("the referrer's count must be saved before the friend's request is answered", () => {
  it("credits the referrer by the time updateScoutAsync resolves", async () => {
    const { db, client } = makeTable([
      row("SCOUT-A"),
      row("SCOUT-B", { referred_by_scout_token: "SCOUT-A" }),
    ]);
    env.supabase = client;

    await updateScoutAsync("SCOUT-B", { completedPages: [1] });

    // No extra waiting here on purpose: the caller has been told the work is done.
    expect(friendsOf(db, "SCOUT-A")).toBe(1);
  });

  it("reaches two friends, which is what actually unlocks Book 2", async () => {
    const { db, client } = makeTable([
      row("SCOUT-A", { quiz_score: 400 }),
      row("SCOUT-B", { referred_by_scout_token: "SCOUT-A" }),
      row("SCOUT-C", { referred_by_scout_token: "SCOUT-A" }),
    ]);
    env.supabase = client;

    await updateScoutAsync("SCOUT-B", { completedPages: [1] });
    await updateScoutAsync("SCOUT-C", { completedPages: [1] });

    expect(friendsOf(db, "SCOUT-A")).toBe(2);
    // 400 from the quiz plus 300 for the second friend is the Biblical 700.
    expect(db.rows.find((r) => r.token === "SCOUT-A")!.referral_score).toBe(300);
    expect(db.rows.find((r) => r.token === "SCOUT-A")!.status).toBe("Unlock_Volume_2");
  });

  it("does not credit anyone when the friend colours a page other than page one", async () => {
    const { db, client } = makeTable([
      row("SCOUT-A"),
      row("SCOUT-B", { referred_by_scout_token: "SCOUT-A" }),
    ]);
    env.supabase = client;

    await updateScoutAsync("SCOUT-B", { completedPages: [2, 3] });

    expect(friendsOf(db, "SCOUT-A")).toBe(0);
  });

  it("does not double count when the same friend sends page one twice", async () => {
    const { db, client } = makeTable([
      row("SCOUT-A"),
      row("SCOUT-B", { referred_by_scout_token: "SCOUT-A" }),
    ]);
    env.supabase = client;

    await updateScoutAsync("SCOUT-B", { completedPages: [1] });
    await updateScoutAsync("SCOUT-B", { completedPages: [1, 4] });

    expect(friendsOf(db, "SCOUT-A")).toBe(1);
  });
});
