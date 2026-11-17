import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * /admin itself (app/ .tsx tests are not collected, so it is tested from here):
 * leaders' names and emails must never be read, let alone shown, without the
 * admin cookie.
 */

let signedIn = false;
const listSchoolRequests = vi.fn();

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => ({ value: "cookie" }) }) }));
vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE: "admin",
  adminConfigured: () => true,
  isAdminCookie: () => signedIn,
}));
vi.mock("@/lib/patrol-store", () => ({ listPendingGuideClaims: async () => [] }));
vi.mock("@/lib/school-request-store", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/school-request-store")>()),
  listSchoolRequests: (...a: unknown[]) => listSchoolRequests(...a),
}));

const { default: AdminPage } = await import("@/app/admin/page");
const render = async (searchParams: { before?: string } = {}) => renderToStaticMarkup(await AdminPage({ searchParams }));

const row = {
  id: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-11-18T14:05:00+00:00",
  name: "Grace Miller",
  role: "Co-op coordinator",
  school: "Hope Homeschool Co-op",
  location: "Austin, TX",
  email: "grace@example.com",
  phone: null,
  copies: null,
  message: null,
};

beforeEach(() => {
  signedIn = false;
  listSchoolRequests.mockReset();
  listSchoolRequests.mockResolvedValue([row]);
});

describe("/admin", () => {
  it("reads no request and shows none without the admin cookie", async () => {
    const html = await render();
    expect(listSchoolRequests).not.toHaveBeenCalled();
    expect(html).not.toContain("Requests from leaders");
    expect(html).not.toContain("grace@example.com");
    expect(html).toContain("Enter the admin key");
  });

  it("lists the requests once signed in", async () => {
    signedIn = true;
    const html = await render();
    expect(listSchoolRequests).toHaveBeenCalledWith(undefined);
    expect(html).toContain("Requests from leaders");
    expect(html).toContain("Hope Homeschool Co-op");
  });

  it("passes an older-page cursor on, and calls it an older page only when it is a real one", async () => {
    signedIn = true;
    const cursor = "2026-11-18T14:05:00+00:00|00000000-0000-4000-8000-000000000001";
    expect(await render({ before: cursor })).toContain("Back to the newest");
    expect(listSchoolRequests).toHaveBeenCalledWith(cursor);

    // A "+" read as a space, or any junk, is the first page and says so.
    const junk = await render({ before: "2026-11-18T14:05:00 00:00|garbage" });
    expect(junk).not.toContain("Back to the newest");
    expect(listSchoolRequests).toHaveBeenLastCalledWith("2026-11-18T14:05:00 00:00|garbage");
    expect(junk).toContain("Hope Homeschool Co-op");
  });
});
