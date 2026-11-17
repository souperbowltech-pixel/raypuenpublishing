import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The claim that keeps a paid book order to one email to Ray. A fake table
 * stands in for public.orders and applies the same filters the real queries
 * do, so deliveries of one Stripe event can be played against it in order.
 * It cannot prove Postgres runs the conditional update atomically; that rests
 * on a single UPDATE ... WHERE being atomic, which is Postgres's own guarantee.
 */

type Row = {
  stripe_session_id: string;
  notice_claimed_at: string | null;
  notice_sent_at: string | null;
  last_error: string | null;
};
let rows: Row[] = [];
let dbConfigured = true;
let failWith: { code: string; message: string } | null = null;
let throwOnCall = false;
const updates: Record<string, unknown>[] = [];
const orFilters: string[] = [];

type Filter = (row: Row) => boolean;

/** The one .or() the claim uses: "col.is.null,col.lt.<iso>". */
function orFilter(expr: string): Filter {
  const parts = expr.split(",").map((part) => {
    const [column, op, ...rest] = part.split(".");
    const value = rest.join(".").replace(/^"(.*)"$/, "$1");
    const key = column as keyof Row;
    if (op === "is" && value === "null") return (row: Row) => row[key] === null;
    if (op === "lt") return (row: Row) => row[key] !== null && String(row[key]) < value;
    throw new Error(`fake db: unsupported filter ${part}`);
  });
  return (row) => parts.some((f) => f(row));
}

function filtered(run: (hit: Row[]) => { data: unknown; error: unknown }) {
  const filters: Filter[] = [];
  const result = () => (failWith ? { data: null, error: failWith } : run(rows.filter((r) => filters.every((f) => f(r)))));
  const chain = {
    eq(column: keyof Row, value: string) {
      filters.push((row) => row[column] === value);
      return chain;
    },
    is(column: keyof Row, value: null) {
      filters.push((row) => row[column] === value);
      return chain;
    },
    or(expr: string) {
      orFilters.push(expr);
      filters.push(orFilter(expr));
      return chain;
    },
    select: async () => result(),
    maybeSingle: async () => result(),
    then: (resolve: (v: ReturnType<typeof result>) => unknown) => resolve(result()),
  };
  return chain;
}

const table = {
  update(patch: Record<string, unknown>) {
    if (throwOnCall) throw new Error("network down");
    updates.push(patch);
    return filtered((hit) => {
      for (const row of hit) Object.assign(row, patch);
      return { data: hit.map((row) => ({ stripe_session_id: row.stripe_session_id })), error: null };
    });
  },
  select() {
    if (throwOnCall) throw new Error("network down");
    return filtered((hit) => ({ data: hit[0] ? { notice_sent_at: hit[0].notice_sent_at } : null, error: null }));
  },
};

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return dbConfigured ? { from: () => table } : null;
  },
}));

const { claimOrderNotice, markOrderNoticeSent, releaseOrderNotice, NOTICE_LEASE_MS } = await import("@/lib/orders");

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 21, 19, 0) + minutes * 60_000);

beforeEach(() => {
  rows = ["cs_1", "cs_2"].map((id) => ({
    stripe_session_id: id,
    notice_claimed_at: null,
    notice_sent_at: null,
    last_error: null,
  }));
  dbConfigured = true;
  failWith = null;
  throwOnCall = false;
  updates.length = 0;
  orFilters.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("claimOrderNotice", () => {
  it("lets one delivery send, and tells a second one it is in progress", async () => {
    expect(await claimOrderNotice("cs_1", at(0))).toBe("claimed");
    expect(await claimOrderNotice("cs_1", at(1))).toBe("in-progress");
  });

  it("never sends again once the email was marked as sent", async () => {
    await claimOrderNotice("cs_1", at(0));
    expect(await markOrderNoticeSent("cs_1", at(0))).toBe(true);
    expect(await claimOrderNotice("cs_1", at(60))).toBe("already-sent");
  });

  it("lets a later delivery take over a claim left by one that died mid-send", async () => {
    await claimOrderNotice("cs_1", at(0));
    expect(await claimOrderNotice("cs_1", at(NOTICE_LEASE_MS / 60_000 - 1))).toBe("in-progress");
    expect(await claimOrderNotice("cs_1", at(NOTICE_LEASE_MS / 60_000 + 1))).toBe("claimed");
  });

  it("quotes the lapse time in the filter, as PostgREST needs for a value with dots and colons", async () => {
    await claimOrderNotice("cs_1", at(30));
    expect(orFilters).toEqual([
      `notice_claimed_at.is.null,notice_claimed_at.lt."${at(30 - NOTICE_LEASE_MS / 60_000).toISOString()}"`,
    ]);
  });

  it("claims one order without touching another", async () => {
    await claimOrderNotice("cs_1", at(0));
    expect(await claimOrderNotice("cs_2", at(0))).toBe("claimed");
  });

  it("answers unavailable, never already-sent, for an order that is not in the table", async () => {
    expect(await claimOrderNotice("cs_missing", at(0))).toBe("unavailable");
  });

  it("answers unavailable when there is no database", async () => {
    dbConfigured = false;
    expect(await claimOrderNotice("cs_1")).toBe("unavailable");
  });

  it("answers unavailable when the columns are missing or the query fails", async () => {
    // The state before migration 20261118 has run: the order must not go unannounced.
    failWith = { code: "42703", message: "column orders.notice_claimed_at does not exist" };
    expect(await claimOrderNotice("cs_1")).toBe("unavailable");
  });

  it("answers unavailable when the call itself throws", async () => {
    throwOnCall = true;
    expect(await claimOrderNotice("cs_1")).toBe("unavailable");
  });
});

describe("markOrderNoticeSent", () => {
  it("records the time and clears an error an earlier failed attempt left", async () => {
    rows[0].last_error = "Order email to Ray not sent: timeout";
    await markOrderNoticeSent("cs_1", at(5));
    expect(rows[0].notice_sent_at).toBe(at(5).toISOString());
    expect(rows[0].last_error).toBeNull();
  });

  it("reports false when it could not be written", async () => {
    failWith = { code: "08006", message: "connection failure" };
    expect(await markOrderNoticeSent("cs_1")).toBe(false);
    failWith = null;
    throwOnCall = true;
    expect(await markOrderNoticeSent("cs_1")).toBe(false);
    throwOnCall = false;
    dbConfigured = false;
    expect(await markOrderNoticeSent("cs_1")).toBe(false);
  });
});

describe("releaseOrderNotice", () => {
  it("gives the claim back, so Stripe's retry sends at once", async () => {
    await claimOrderNotice("cs_1", at(0));
    expect(await releaseOrderNotice("cs_1")).toBe(true);
    expect(await claimOrderNotice("cs_1", at(1))).toBe("claimed");
  });

  it("never clears the claim of an email already marked as sent", async () => {
    await claimOrderNotice("cs_1", at(0));
    await markOrderNoticeSent("cs_1", at(0));
    await releaseOrderNotice("cs_1");
    expect(rows[0].notice_claimed_at).toBe(at(0).toISOString());
  });

  it("reports false, and never throws, whatever the database does", async () => {
    throwOnCall = true;
    expect(await releaseOrderNotice("cs_1")).toBe(false);
    throwOnCall = false;
    failWith = { code: "08006", message: "connection failure" };
    expect(await releaseOrderNotice("cs_1")).toBe(false);
    dbConfigured = false;
    expect(await releaseOrderNotice("cs_1")).toBe(false);
  });
});
