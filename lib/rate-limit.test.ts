import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The two-layer rate limit. Supabase is replaced with a stand-in whose RPC
 * answer each test chooses, so every path is exercised: counted, refused,
 * not set up yet, unreachable, slow, and each route's choice for when the
 * shared count cannot be checked. The SQL itself is checked by
 * supabase/checks/rate_limits.sql, run by hand in Supabase.
 */

type RpcAnswer =
  | { data?: unknown; error?: { code?: string; message?: string } | null }
  | "hang"
  | "throw"
  | "throw-sync";
let answer: RpcAnswer;
const rpc = vi.fn((_name: string, _args: Record<string, unknown>) => {
  if (answer === "throw-sync") throw new Error("client broken");
  return {
    abortSignal: (signal: AbortSignal) => {
      if (answer === "hang")
        return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
      if (answer === "throw") return Promise.reject(new Error("network down"));
      return Promise.resolve(answer);
    },
  };
});
let configured = true;

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return configured ? { rpc } : null;
  },
  get usingServiceRole() {
    return configured;
  },
}));

const SECRET = "test-service-role-key";

async function load() {
  vi.resetModules();
  return import("@/lib/rate-limit");
}
let mod: Awaited<ReturnType<typeof load>>;

let n = 0;
const key = () => `route-${++n}:203.0.113.${n % 250}`; // a fresh key per test, so counts never leak between them

beforeEach(async () => {
  answer = { data: [{ allowed: true, retry_after: 0 }], error: null };
  configured = true;
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
  rpc.mockClear();
  mod = await load(); // fresh module: the "reported missing" note starts unsent
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the shared count", () => {
  it("asks Supabase with an HMAC of the key under the server secret, never the IP itself", async () => {
    const k = key();
    expect(await mod.rateLimit(k, 10, 60_000)).toEqual({ ok: true, retryAfter: 0 });
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", { p_key: mod.sharedKey(k, SECRET), p_limit: 10, p_window_ms: 60_000 });
    expect(mod.sharedKey(k, SECRET)).toMatch(/^[0-9a-f]{64}$/);
    expect(mod.sharedKey(k, SECRET)).not.toBe(mod.sharedKey(k, "another-secret")); // not reversible without the secret
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.");
  });

  it("refuses when the shared count says so, even though this instance has room", async () => {
    answer = { data: [{ allowed: false, retry_after: 42 }], error: null };
    expect(await mod.rateLimit(key(), 10, 60_000)).toEqual({ ok: false, retryAfter: 42 });
  });

  it("reads a single row as well as a list, and asks for at least a second when no wait is given", async () => {
    answer = { data: { allowed: false, retry_after: null }, error: null };
    expect(await mod.rateLimit(key(), 10, 60_000)).toEqual({ ok: false, retryAfter: 1 });
  });

  it("refuses at this instance first, without asking the database", async () => {
    const k = key();
    await mod.rateLimit(k, 1, 60_000);
    rpc.mockClear();
    expect((await mod.rateLimit(k, 1, 60_000)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("before the migration has run", () => {
  it.each([
    ["PostgREST cannot find the function", { code: "PGRST202", message: "Could not find the function public.hit_rate_limit" }],
    ["Postgres says this function does not exist", { code: "42883", message: "function public.hit_rate_limit does not exist" }],
  ])("falls back to this instance's count when %s, even where it would refuse, and says so once", async (_case, error) => {
    answer = { data: null, error };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await mod.rateLimit(key(), 10, 60_000, { whenUnavailable: "refuse" })).toEqual({ ok: true, retryAfter: 0 });
    await mod.rateLimit(key(), 10, 60_000);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toContain("migration 20261115 not run");
  });

  it("treats a 42883 about anything else as a fault, not as a missing migration", async () => {
    answer = { data: null, error: { code: "42883", message: "operator does not exist: text + integer" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await mod.rateLimit(key(), 10, 60_000, { whenUnavailable: "refuse" })).toEqual({
      ok: false,
      retryAfter: mod.UNAVAILABLE_RETRY_SECONDS,
    });
  });

  it("uses this instance's count when Supabase is not configured at all", async () => {
    configured = false;
    expect(await mod.rateLimit(key(), 10, 60_000)).toEqual({ ok: true, retryAfter: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("when the shared count cannot be reached", () => {
  it.each([
    ["it errors", { data: null, error: { code: "57014", message: "canceling statement" } } as RpcAnswer],
    ["the request throws", "throw" as RpcAnswer],
    ["the client throws at once", "throw-sync" as RpcAnswer],
    ["it answers nonsense", { data: [{}], error: null } as RpcAnswer],
  ])("an ordinary route carries on with this instance's count when %s, and logs without the IP", async (_case, a) => {
    answer = a;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await mod.rateLimit("checkout-retail:198.51.100.7", 10, 60_000)).toEqual({ ok: true, retryAfter: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("checkout-retail");
    expect(warn.mock.calls[0][0]).not.toContain("198.51.100.7");
  });

  it("a refusing route refuses, and logs without the IP", async () => {
    answer = "throw";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await mod.rateLimit("library-open:198.51.100.8", 10, 60_000, { whenUnavailable: "refuse" })).toEqual({
      ok: false,
      retryAfter: mod.UNAVAILABLE_RETRY_SECONDS,
    });
    expect(error.mock.calls[0][0]).toContain("library-open");
    expect(error.mock.calls[0][0]).not.toContain("198.51.100.8");
  });

  it("admin sign-in is not locked out: it falls back to a stricter count on this instance", async () => {
    answer = "throw";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const k = "admin-session:198.51.100.9";
    const tries = [];
    for (let i = 0; i < 4; i++) tries.push((await mod.rateLimit(k, 10, 60_000, { whenUnavailable: 3 })).ok);
    expect(tries).toEqual([true, true, true, false]);
  });

  it("gives up on a slow database after the timeout, cancelling the request, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    answer = "hang";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = mod.rateLimit(key(), 10, 60_000, { whenUnavailable: "refuse" });
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(mod.SHARED_LIMIT_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).ok).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("memoryLimit", () => {
  it("allows up to the limit in a window, then refuses until it resets", () => {
    vi.useFakeTimers();
    const k = key();
    expect(mod.memoryLimit(k, 2, 1_000).ok).toBe(true);
    expect(mod.memoryLimit(k, 2, 1_000).ok).toBe(true);
    expect(mod.memoryLimit(k, 2, 1_000)).toEqual({ ok: false, retryAfter: 1 });
    vi.advanceTimersByTime(1_000);
    expect(mod.memoryLimit(k, 2, 1_000).ok).toBe(true);
  });

  it("clears expired keys once there are many, so rotating addresses cannot fill memory", () => {
    vi.useFakeTimers();
    for (let i = 0; i < mod.MEMORY_SWEEP_AT; i++) mod.memoryLimit(`flood:${i}`, 5, 1_000);
    vi.advanceTimersByTime(1_000);
    mod.memoryLimit("flood:new", 5, 1_000); // triggers the sweep
    // A swept key starts a fresh window rather than carrying an old count.
    for (let i = 0; i < 5; i++) expect(mod.memoryLimit("flood:0", 5, 1_000).ok).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("https://puenpublishing.com/api/x", { headers });

  it("takes the first X-Forwarded-For address, which Vercel sets and overwrites", () => {
    expect(mod.clientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-real-ip": "198.51.100.1" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then to a fixed local address", () => {
    expect(mod.clientIp(req({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(mod.clientIp(req({}))).toBe("127.0.0.1");
  });

  it("counts an IPv6 caller by its /64, so changing the last part does not reset the limit", () => {
    const a = mod.clientIp(req({ "x-forwarded-for": "2001:db8:1234:5678:aaaa::1" }));
    const b = mod.clientIp(req({ "x-forwarded-for": "2001:0db8:1234:5678:ffff:eeee:dddd:2" }));
    expect(a).toBe("2001:db8:1234:5678::/64");
    expect(b).toBe(a);
    expect(mod.limitAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(mod.limitAddress("::1")).toBe("0:0:0:0::/64");
  });

  it("keeps IPv4 written as IPv6 apart, one count per IPv4 address, not one for everyone", () => {
    expect(mod.limitAddress("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(mod.limitAddress("::ffff:198.51.100.1")).toBe("198.51.100.1");
  });

  it("ignores brackets, a port and a zone, and counts anything that is not an address as given", () => {
    expect(mod.limitAddress("[2001:db8:1:2::5]:443")).toBe("2001:db8:1:2::/64");
    expect(mod.limitAddress("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(mod.limitAddress("not-an-address")).toBe("not-an-address");
    expect(mod.limitAddress("203.0.113.9")).toBe("203.0.113.9");
  });
});

describe("the routes", () => {
  const repo = path.resolve(__dirname, "..");
  const routes = (fs.readdirSync(path.join(repo, "app/api"), { recursive: true }) as string[])
    .map((p) => `app/api/${p.split(path.sep).join("/")}`)
    .filter((p) => p.endsWith("/route.ts"));
  const source = (p: string) => fs.readFileSync(path.join(repo, p), "utf8");

  it("all wait for the shared count; a limiter call left un-awaited would always pass", () => {
    const callers = routes.filter((p) => source(p).includes("rateLimit("));
    expect(callers.length).toBeGreaterThanOrEqual(17);
    for (const p of callers) expect(source(p), p).not.toMatch(/(?<!await )\brateLimit\(/);
  });

  it.each(["app/api/admin/approve-guide/route.ts", "app/api/library/open/route.ts"])(
    "%s refuses when the shared count cannot be checked",
    (p) => {
      expect(source(p)).toMatch(/await rateLimit\([^;]*\{ whenUnavailable: "refuse" \}\)/);
    }
  );

  it("admin sign-in falls back to a stricter count rather than refusing", () => {
    expect(source("app/api/admin/session/route.ts")).toMatch(/await rateLimit\([^;]*\{ whenUnavailable: 3 \}\)/);
  });
});
