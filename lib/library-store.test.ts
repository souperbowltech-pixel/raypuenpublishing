import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PDFDocument } from "pdf-lib";

/**
 * The database and storage are faked, so these tests check what the store does
 * with their answers: what it writes and with which filters, what it refuses,
 * and that every failure becomes a reason the page can show. The stamping is
 * the real one, run on a small real PDF, so a copy that comes out is a real
 * stamped file.
 */

type Answer = { data: unknown; error: unknown };
type Query = { calls: [string, unknown[]][] };
const queries: Query[] = [];
let answers: Answer[] = [];

/** Each use of the client starts a new query; its calls are kept together. */
function builder() {
  const query: Query = { calls: [] };
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "insert", "update", "select", "eq", "is", "not", "lt", "in", "limit", "order", "single", "maybeSingle"]) {
    chain[method] = (...args: unknown[]) => {
      if (method === "from") queries.push(query);
      query.calls.push([method, args]);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(answers.shift() ?? { data: null, error: { code: "TEST", message: "no answer queued" } }).then(resolve);
  return chain;
}

const bucket = {
  download: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
};
const buckets: string[] = [];
let dbConfigured = true;
let serviceRole = true;
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return dbConfigured ? builder() : null;
  },
  get storageClient() {
    return dbConfigured ? { storage: { from: (name: string) => (buckets.push(name), bucket) } } : null;
  },
  get usingServiceRole() {
    return serviceRole;
  },
}));

const store = await import("@/lib/library-store");
const { hashCode, normalizeCode, findBook } = await import("@/lib/library");

const NOW = new Date("2026-11-14T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const HOUR = 60 * 60 * 1000;
const GRANT_ID = "8f14e45f-ceea-4e6b-a1a8-7b9d2b5c1e01";
const COPY = `copies/${GRANT_ID}.pdf`;
const SIGNED = "https://storage.example/signed";

function row(over: Record<string, unknown> = {}) {
  return {
    id: GRANT_ID,
    kind: "review",
    book_slug: "neighborhood-book-1",
    recipient_name: "Jane Smith",
    recipient_email: null,
    email_sent_at: null,
    expires_at: iso(10 * 24 * HOUR),
    first_used_at: null,
    download_until: null,
    copy_path: null,
    copy_expires_at: null,
    revoked_at: null,
    created_at: iso(-HOUR),
    ...over,
  };
}

const ok = (data: unknown): Answer => ({ data, error: null });
const failed = (code = "XX000"): Answer => ({ data: null, error: { code, message: "database said no" } });
const updates = () => queries.filter((q) => q.calls.some(([m]) => m === "update"));
const argsOf = (query: Query, method: string) => query.calls.filter(([m]) => m === method).map(([, a]) => a);

async function smallPdf(): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  return new Blob([await doc.save()], { type: "application/pdf" });
}

/** Storage that holds a master and accepts copies. */
async function storageWorks() {
  bucket.list.mockResolvedValue({ data: [], error: null });
  bucket.download.mockResolvedValue({ data: await smallPdf(), error: null });
  bucket.upload.mockResolvedValue({ data: {}, error: null });
  bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED }, error: null });
  bucket.remove.mockResolvedValue({ data: [], error: null });
}

beforeEach(() => {
  queries.length = 0;
  buckets.length = 0;
  answers = [];
  dbConfigured = true;
  serviceRole = true;
  process.env.LIBRARY_CODE_SECRET = "test-secret-that-is-at-least-32-characters";
  for (const fn of Object.values(bucket)) fn.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LIBRARY_CODE_SECRET;
});

describe("createGrant", () => {
  it("stores the hash of a fresh code, never the code, and returns the code once", async () => {
    answers = [ok(row())];
    const result = await store.createGrant({ kind: "review", bookSlug: "neighborhood-book-1", recipientName: " Jane  Smith ", now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inserted = argsOf(queries[0], "insert")[0][0] as Record<string, unknown>;
    expect(inserted.code_hash).toBe(hashCode(result.code));
    expect(JSON.stringify(inserted)).not.toContain(result.code);
    expect(inserted).toMatchObject({
      kind: "review",
      book_slug: "neighborhood-book-1",
      recipient_name: "Jane Smith",
      expires_at: iso(60 * 24 * HOUR),
    });
  });

  it("refuses an unknown book or an unusable name before touching the database", async () => {
    expect(await store.createGrant({ kind: "review", bookSlug: "nope", recipientName: "Jane" })).toEqual({ ok: false, reason: "unknown-book" });
    expect(await store.createGrant({ kind: "review", bookSlug: "geezy-book-1", recipientName: "😀" })).toEqual({ ok: false, reason: "invalid-name" });
    expect(queries).toHaveLength(0);
  });

  it("says the library is unavailable without a database, a secret or the service key", async () => {
    const attempt = () => store.createGrant({ kind: "review", bookSlug: "geezy-book-1", recipientName: "Jane" });
    dbConfigured = false;
    expect(await attempt()).toEqual({ ok: false, reason: "unavailable" });
    dbConfigured = true;
    serviceRole = false;
    expect(await attempt()).toEqual({ ok: false, reason: "unavailable" });
    serviceRole = true;
    delete process.env.LIBRARY_CODE_SECRET;
    expect(await attempt()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports a second paid copy for the same checkout as a duplicate", async () => {
    answers = [failed("23505")];
    const result = await store.createGrant({ kind: "purchase", bookSlug: "parents-guide", recipientName: "Jane", stripeSessionId: "cs_test_1" });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("reports any other database failure as an error", async () => {
    answers = [failed()];
    expect(await store.createGrant({ kind: "review", bookSlug: "geezy-book-1", recipientName: "Jane" })).toEqual({ ok: false, reason: "error" });
  });
});

describe("openCode", () => {
  const CODE = "ABCD2345WXYZ";
  const copyRecorded = ok(null);

  it("refuses something that is not a code without asking the database", async () => {
    expect(await store.openCode("hello", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(queries).toHaveLength(0);
  });

  it("looks the code up by its hash, however it was typed", async () => {
    answers = [ok(null)];
    expect(await store.openCode("abcd-2345-wxyz", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(argsOf(queries[0], "eq")).toEqual([["code_hash", hashCode(normalizeCode(CODE)!)]]);
  });

  it("says unavailable rather than invalid when only the public key is set", async () => {
    serviceRole = false;
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("makes the copy, then starts the download window on this grant only, in one conditional update", async () => {
    await storageWorks();
    const opened = row({ first_used_at: NOW.toISOString(), download_until: iso(24 * HOUR) });
    answers = [ok(row()), copyRecorded, ok([opened])];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: true, url: SIGNED });

    const [recordCopy, firstUse] = updates();
    expect(argsOf(recordCopy, "eq")).toEqual([["id", GRANT_ID]]);
    expect(argsOf(firstUse, "update")[0][0]).toEqual({ first_used_at: NOW.toISOString(), download_until: iso(24 * HOUR) });
    expect(argsOf(firstUse, "eq")).toEqual([["id", GRANT_ID]]);
    expect(argsOf(firstUse, "is")).toEqual([
      ["first_used_at", null],
      ["revoked_at", null],
    ]);
  });

  it("does not spend a review code when the copy cannot be made", async () => {
    await storageWorks();
    bucket.download.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    answers = [ok(row())];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "missing-master" });
    expect(updates()).toHaveLength(0);
  });

  it("lets the same person click again inside the window without restarting it", async () => {
    await storageWorks();
    const inUse = row({ first_used_at: iso(-HOUR), download_until: iso(23 * HOUR), copy_path: COPY, copy_expires_at: iso(20 * HOUR) });
    answers = [ok(inUse), ok(inUse)];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: true, url: SIGNED });
    expect(updates()).toHaveLength(0);
    expect(bucket.download).not.toHaveBeenCalled();
  });

  it("refuses a grant in use that Ray cancels while its copy is being made", async () => {
    await storageWorks();
    const inUse = row({ first_used_at: iso(-HOUR), download_until: iso(23 * HOUR) });
    answers = [ok(inUse), copyRecorded, ok({ ...inUse, revoked_at: NOW.toISOString() })];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "cancelled" });
  });

  it("refuses a spent, expired or cancelled code with the reason, and makes no copy", async () => {
    answers = [ok(row({ first_used_at: iso(-30 * HOUR), download_until: iso(-6 * HOUR) }))];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "used" });
    answers = [ok(row({ expires_at: iso(-1) }))];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "expired" });
    answers = [ok(row({ revoked_at: iso(-HOUR) }))];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "cancelled" });
    expect(bucket.download).not.toHaveBeenCalled();
  });

  it("judges a lost race on what the winner wrote", async () => {
    await storageWorks();
    const winner = row({ first_used_at: NOW.toISOString(), download_until: iso(24 * HOUR) });
    answers = [ok(row()), copyRecorded, ok([]), ok(winner)];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: true, url: SIGNED });
  });

  it("writes both racing copies to the grant's one file name, so neither is left behind", async () => {
    await storageWorks();
    const winner = row({ first_used_at: NOW.toISOString(), download_until: iso(24 * HOUR) });
    answers = [ok(row()), ok(row())];
    const first = store.openCode(CODE, NOW);
    const second = store.openCode(CODE, NOW);
    answers.push(copyRecorded, copyRecorded, ok([winner]), ok([]), ok(winner));
    expect((await first).ok).toBe(true);
    expect((await second).ok).toBe(true);
    const paths = bucket.upload.mock.calls.map(([path]) => path);
    expect(paths).toEqual([COPY, COPY]);
    expect(bucket.upload.mock.calls[0][2]).toMatchObject({ upsert: true });
  });

  it("refuses when Ray cancelled the code in the same moment", async () => {
    await storageWorks();
    answers = [ok(row()), copyRecorded, ok([]), ok(row({ revoked_at: NOW.toISOString() }))];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "cancelled" });
  });

  it("starts no window for a paid copy, only records the first use", async () => {
    await storageWorks();
    const bought = row({ kind: "purchase", book_slug: "parents-guide", expires_at: iso(300 * 24 * HOUR) });
    answers = [ok(bought), copyRecorded, ok([{ ...bought, first_used_at: NOW.toISOString() }])];
    expect((await store.openCode(CODE, NOW)).ok).toBe(true);
    expect(argsOf(updates()[1], "update")[0][0]).toEqual({ first_used_at: NOW.toISOString() });
  });

  it("treats a row naming a book no longer in the catalog as invalid", async () => {
    answers = [ok(row({ book_slug: "retired-book" }))];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("says unavailable when the database fails at any step", async () => {
    answers = [failed()];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "unavailable" });
    await storageWorks();
    answers = [ok(row()), copyRecorded, failed()];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "unavailable" });
    answers = [ok(row()), copyRecorded, ok([]), failed()];
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "unavailable" });
    dbConfigured = false;
    expect(await store.openCode(CODE, NOW)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("downloadLink", () => {
  const book = findBook("neighborhood-book-1")!;
  const grantOf = (over: Record<string, unknown> = {}) => {
    const r = row(over);
    return {
      id: r.id,
      kind: r.kind as "review",
      bookSlug: r.book_slug,
      recipientName: r.recipient_name,
      recipientEmail: null,
      emailSentAt: null,
      expiresAt: r.expires_at,
      firstUsedAt: r.first_used_at as string | null,
      downloadUntil: r.download_until as string | null,
      copyPath: r.copy_path as string | null,
      copyExpiresAt: r.copy_expires_at as string | null,
      revokedAt: null,
      createdAt: r.created_at,
    };
  };

  it("stamps the master into the grant's one copy file and links to it", async () => {
    await storageWorks();
    answers = [ok(null)];
    expect(await store.downloadLink(grantOf(), book, NOW)).toEqual({ ok: true, url: SIGNED });

    expect(buckets.every((name) => name === "library")).toBe(true);
    expect(bucket.download).toHaveBeenCalledWith("masters/neighborhood-book-1.pdf");
    const [path, bytes, options] = bucket.upload.mock.calls[0];
    expect(path).toBe(COPY);
    expect(options).toEqual({ contentType: "application/pdf", upsert: true });
    const copy = await PDFDocument.load(bytes as Uint8Array);
    expect(copy.getSubject()).toBe("REVIEW COPY FOR JANE SMITH. NOT TO BE CIRCULATED");
    expect(argsOf(updates()[0], "update")[0][0]).toEqual({ copy_path: COPY, copy_expires_at: iso(HOUR) });
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(COPY, 300, { download: book.fileName });
  });

  it("reuses a copy made in the last hour instead of stamping again", async () => {
    await storageWorks();
    const cached = grantOf({ copy_path: COPY, copy_expires_at: iso(40 * 60 * 1000) });
    expect(await store.downloadLink(cached, book, NOW)).toEqual({ ok: true, url: SIGNED });
    expect(bucket.download).not.toHaveBeenCalled();
    expect(bucket.list).not.toHaveBeenCalled();
  });

  it("makes the copy again when the cached one is near its end, or recorded under another name", async () => {
    await storageWorks();
    answers = [ok(null), ok(null)];
    expect((await store.downloadLink(grantOf({ copy_path: COPY, copy_expires_at: iso(5 * 60 * 1000) }), book, NOW)).ok).toBe(true);
    expect((await store.downloadLink(grantOf({ copy_path: "copies/old-1.pdf", copy_expires_at: iso(5 * HOUR) }), book, NOW)).ok).toBe(true);
    expect(bucket.upload).toHaveBeenCalledTimes(2);
  });

  it("sweeps old copies before making a new one, freeing space first", async () => {
    await storageWorks();
    bucket.list.mockResolvedValue({ data: [{ name: "old.pdf", updated_at: iso(-3 * HOUR) }], error: null });
    answers = [ok(null)];
    await store.downloadLink(grantOf(), book, NOW);
    expect(bucket.remove).toHaveBeenCalledWith(["copies/old.pdf"]);
    expect(bucket.remove.mock.invocationCallOrder[0]).toBeLessThan(bucket.upload.mock.invocationCallOrder[0]);
  });

  it("does not sweep away the grant's own old copy while making its new one", async () => {
    await storageWorks();
    bucket.list.mockResolvedValue({ data: [{ name: `${GRANT_ID}.pdf`, updated_at: iso(-3 * HOUR) }], error: null });
    answers = [ok(null)];
    await store.downloadLink(grantOf(), book, NOW);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("says the master is missing when it was never uploaded", async () => {
    await storageWorks();
    bucket.download.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    expect(await store.downloadLink(grantOf(), book, NOW)).toEqual({ ok: false, reason: "missing-master" });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("fails cleanly when the master cannot be stamped", async () => {
    await storageWorks();
    bucket.download.mockResolvedValue({ data: new Blob(["not a pdf"]), error: null });
    expect(await store.downloadLink(grantOf(), book, NOW)).toEqual({ ok: false, reason: "error" });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("fails cleanly when the copy cannot be stored or linked", async () => {
    await storageWorks();
    bucket.upload.mockResolvedValue({ data: null, error: { message: "quota" } });
    expect(await store.downloadLink(grantOf(), book, NOW)).toEqual({ ok: false, reason: "error" });

    bucket.upload.mockResolvedValue({ data: {}, error: null });
    bucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });
    answers = [ok(null)];
    expect(await store.downloadLink(grantOf(), book, NOW)).toEqual({ ok: false, reason: "error" });
  });

  it("stamps again when the cached copy turns out to be gone, instead of failing for the hour", async () => {
    await storageWorks();
    bucket.createSignedUrl
      .mockResolvedValueOnce({ data: null, error: { message: "Object not found" } })
      .mockResolvedValueOnce({ data: { signedUrl: SIGNED }, error: null });
    answers = [ok(null)];
    const cached = grantOf({ copy_path: COPY, copy_expires_at: iso(40 * 60 * 1000) });
    expect(await store.downloadLink(cached, book, NOW)).toEqual({ ok: true, url: SIGNED });
    expect(bucket.upload).toHaveBeenCalledTimes(1);
    expect(bucket.upload.mock.calls[0][0]).toBe(COPY);
  });

  it("still hands over the copy when recording it fails; it sits at the grant's one path, where the sweep finds it", async () => {
    await storageWorks();
    answers = [failed()];
    expect(await store.downloadLink(grantOf(), book, NOW)).toEqual({ ok: true, url: SIGNED });
    expect(bucket.upload.mock.calls[0][0]).toBe(COPY);
  });
});

describe("sweepOldCopies", () => {
  it("removes copies older than two hours by their age in storage, in one call", async () => {
    bucket.list.mockResolvedValue({
      data: [
        { name: "a.pdf", updated_at: iso(-3 * HOUR) },
        { name: "b.pdf", updated_at: iso(-2 * HOUR - 1) },
        { name: "fresh.pdf", updated_at: iso(-2 * HOUR) },
        { name: "note.txt", updated_at: iso(-48 * HOUR) },
        { name: "undated.pdf" },
      ],
      error: null,
    });
    bucket.remove.mockResolvedValue({ data: [], error: null });
    expect(await store.sweepOldCopies(NOW)).toBe(2);
    expect(bucket.list).toHaveBeenCalledWith("copies", { limit: 100, sortBy: { column: "updated_at", order: "asc" } });
    expect(bucket.remove).toHaveBeenCalledWith(["copies/a.pdf", "copies/b.pdf"]);
  });

  it("does nothing when nothing is old", async () => {
    bucket.list.mockResolvedValue({ data: [{ name: "x.pdf", updated_at: iso(-HOUR) }], error: null });
    expect(await store.sweepOldCopies(NOW)).toBe(0);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("never throws, whatever storage does", async () => {
    bucket.list.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await store.sweepOldCopies(NOW)).toBe(0);
    bucket.list.mockResolvedValue({ data: [{ name: "a.pdf", updated_at: iso(-3 * HOUR) }], error: null });
    bucket.remove.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await store.sweepOldCopies(NOW)).toBe(0);
    bucket.list.mockRejectedValue(new Error("aborted"));
    expect(await store.sweepOldCopies(NOW)).toBe(0);
    dbConfigured = false;
    expect(await store.sweepOldCopies(NOW)).toBe(0);
  });

  it("never removes the copy it was told to keep", async () => {
    bucket.list.mockResolvedValue({ data: [{ name: "mine.pdf", updated_at: iso(-3 * HOUR) }, { name: "x.pdf", updated_at: iso(-3 * HOUR) }], error: null });
    bucket.remove.mockResolvedValue({ data: [], error: null });
    expect(await store.sweepOldCopies(NOW, "copies/mine.pdf")).toBe(1);
    expect(bucket.remove).toHaveBeenCalledWith(["copies/x.pdf"]);
  });

  it("deletes nothing once it has given up, even if the listing arrives late", async () => {
    vi.useFakeTimers();
    let deliver: (v: unknown) => void = () => {};
    bucket.list.mockReturnValue(new Promise((resolve) => (deliver = resolve)));
    bucket.remove.mockResolvedValue({ data: [], error: null });
    const result = store.sweepOldCopies(NOW);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await result).toBe(0);
    deliver({ data: [{ name: "a.pdf", updated_at: iso(-3 * HOUR) }], error: null });
    await vi.advanceTimersByTimeAsync(10);
    expect(bucket.remove).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("gives up after a few seconds rather than hold up a download", async () => {
    vi.useFakeTimers();
    bucket.list.mockReturnValue(new Promise(() => {}));
    const result = store.sweepOldCopies(NOW);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await result).toBe(0);
    vi.useRealTimers();
  });
});
