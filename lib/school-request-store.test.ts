import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SchoolRequestInput } from "@/lib/school-requests";

/**
 * The query builder is faked so these tests check what this module does with
 * the database's answers: the row it sends, the order and paging it asks for,
 * and that every failure becomes a result the caller can act on.
 */
const calls: { method: string; args: unknown[] }[] = [];
let answer: { data: unknown; error: unknown } = { data: null, error: null };

function builder() {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "insert", "select", "order", "limit", "or", "single"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(answer).then(resolve);
  return chain;
}

let dbConfigured = true;
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return dbConfigured ? builder() : null;
  },
}));

const sendEmailMock = vi.fn();
let emailOn = true;
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  emailConfigured: () => emailOn,
  redactEmail: () => "a***@school.example",
}));
vi.mock("@/lib/notifications", () => ({ approvalRecipient: () => "ray@inbox.example" }));

const store = await import("@/lib/school-request-store");

const input: SchoolRequestInput = {
  name: "Ana Lopez",
  role: "Principal",
  school: "Lincoln Elementary",
  location: "Austin, TX",
  email: "ana@school.example",
  phone: null,
  copies: 40,
  message: null,
};

beforeEach(() => {
  calls.length = 0;
  answer = { data: null, error: null };
  dbConfigured = true;
  emailOn = true;
  sendEmailMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("saveSchoolRequest", () => {
  it("inserts the row and returns its id", async () => {
    answer = { data: { id: "row-1" }, error: null };
    expect(await store.saveSchoolRequest(input)).toEqual({ ok: true, id: "row-1" });
    expect(calls.find((c) => c.method === "from")?.args).toEqual(["school_requests"]);
    expect(calls.find((c) => c.method === "insert")?.args[0]).toMatchObject({ school: "Lincoln Elementary", copies: 40 });
  });

  it("reports an error when the insert fails", async () => {
    answer = { data: null, error: { code: "23514", message: "check violation" } };
    expect(await store.saveSchoolRequest(input)).toEqual({ ok: false, reason: "error" });
  });

  it("reports an error when the insert returns nothing, and logs no personal data", async () => {
    answer = { data: null, error: { code: "23514", message: "check violation" } };
    await store.saveSchoolRequest(input);
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain(input.email);
    expect(logged).not.toContain(input.name);
    answer = { data: null, error: null };
    expect(await store.saveSchoolRequest(input)).toEqual({ ok: false, reason: "error" });
  });

  it("reports unavailable when there is no database", async () => {
    dbConfigured = false;
    expect(await store.saveSchoolRequest(input)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("listSchoolRequests", () => {
  it("reads newest first, one page, and maps the columns", async () => {
    answer = {
      data: [{ ...input, id: "row-1", created_at: "2026-11-12T10:00:00Z" }],
      error: null,
    };
    const rows = await store.listSchoolRequests();
    expect(rows).toEqual([{ ...input, id: "row-1", createdAt: "2026-11-12T10:00:00Z" }]);
    expect(calls.filter((c) => c.method === "order").map((c) => c.args)).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(calls.find((c) => c.method === "limit")?.args).toEqual([store.SCHOOL_REQUESTS_PAGE_SIZE]);
    expect(calls.some((c) => c.method === "or")).toBe(false);
  });

  it("pages after the last row by time and id, so rows sharing a time are not skipped", async () => {
    answer = { data: [], error: null };
    const id = "0b8f7c1e-9a4d-4c2e-8f1a-2b3c4d5e6f70";
    const at = "2026-11-12T10:00:00.123456+00:00";
    await store.listSchoolRequests(store.pageCursor({ createdAt: at, id }));
    expect(calls.find((c) => c.method === "or")?.args).toEqual([
      `created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`,
    ]);
  });

  it.each([
    "abc",
    "2026-11-12|not-a-uuid",
    "2026-11-12T10:00:00Z|0b8f7c1e-9a4d-4c2e-8f1a-2b3c4d5e6f70|x",
    "),id.gt.0|0b8f7c1e-9a4d-4c2e-8f1a-2b3c4d5e6f70",
  ])("treats the malformed cursor %j as the first page", async (bad) => {
    answer = { data: [], error: null };
    expect(await store.listSchoolRequests(bad)).toEqual([]);
    expect(calls.some((c) => c.method === "or")).toBe(false);
  });

  it("returns null when the list cannot be read", async () => {
    answer = { data: null, error: { code: "42P01", message: "missing table" } };
    expect(await store.listSchoolRequests()).toBeNull();
    dbConfigured = false;
    expect(await store.listSchoolRequests()).toBeNull();
  });
});

describe("notifySchoolRequest", () => {
  it("emails Ray with the school as subject and the principal as reply-to", async () => {
    sendEmailMock.mockResolvedValue({ sent: true, id: "e1" });
    expect(await store.notifySchoolRequest(input)).toEqual({ sent: true, id: "e1" });
    const message = sendEmailMock.mock.calls[0][0];
    expect(message).toMatchObject({
      to: "ray@inbox.example",
      subject: "School request: Lincoln Elementary",
      replyTo: "ana@school.example",
    });
    expect(message.text).toContain("Copies: 40");
    expect(message.text).toContain("Phone: not given");
  });

  it("keeps a multi-line message, and a school name cannot break the subject line", async () => {
    const { validateSchoolRequest } = await import("@/lib/school-requests");
    const parsed = validateSchoolRequest({
      ...input,
      school: "Lincoln\r\nBcc: x@evil.example",
      phone: "512 555 0100",
      message: "First line\nSecond line",
    });
    if (!parsed.ok) throw new Error(parsed.error);
    sendEmailMock.mockResolvedValue({ sent: true, id: "e2" });
    await store.notifySchoolRequest(parsed.value);
    const message = sendEmailMock.mock.calls[0][0];
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.text).toContain("Phone: 512 555 0100");
    expect(message.text).toContain("First line\nSecond line");
  });

  it("sends nothing when email is not configured", async () => {
    emailOn = false;
    expect(await store.notifySchoolRequest(input)).toEqual({ sent: false, reason: "not-configured" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("passes a failed send back unchanged", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, reason: "timeout" });
    expect(await store.notifySchoolRequest(input)).toEqual({ sent: false, reason: "timeout" });
  });
});
