import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * /admin itself (app/ .tsx tests are not collected, so it is tested from here):
 * leaders' names and emails must never be read, let alone shown, without the
 * admin cookie.
 */

let signedIn = false;
const listSchoolRequests = vi.fn();
const listGrants = vi.fn();

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => ({ value: "cookie" }) }) }));
vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE: "admin",
  adminConfigured: () => true,
  isAdminCookie: () => signedIn,
}));
vi.mock("@/lib/patrol-store", () => ({ listPendingGuideClaims: async () => [] }));
vi.mock("@/lib/library-store", () => ({ GRANTS_PAGE_SIZE: 50, listGrants: (...a: unknown[]) => listGrants(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/school-request-store", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/school-request-store")>()),
  listSchoolRequests: (...a: unknown[]) => listSchoolRequests(...a),
}));

const { default: AdminPage } = await import("@/app/admin/page");
const render = async (searchParams: { before?: string; lbefore?: string } = {}) => renderToStaticMarkup(await AdminPage({ searchParams }));

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
  listGrants.mockReset();
  listGrants.mockResolvedValue([]);
});

describe("/admin", () => {
  it("reads no request and shows none without the admin cookie", async () => {
    const html = await render();
    expect(listSchoolRequests).not.toHaveBeenCalled();
    expect(listGrants).not.toHaveBeenCalled();
    expect(html).not.toContain("Review copies");
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
    expect(html).toContain("Review copies");
    expect(html).toContain("No codes yet.");
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

  it("says the codes could not be loaded when the library list fails", async () => {
    signedIn = true;
    listGrants.mockResolvedValue(null);
    expect(await render()).toContain("The codes could not be loaded");
  });

  it("passes the codes cursor on, separately from the requests cursor", async () => {
    signedIn = true;
    const cursor = "2026-11-18T14:05:00+00:00|00000000-0000-4000-8000-000000000002";
    const html = await render({ lbefore: cursor });
    expect(listGrants).toHaveBeenCalledWith(cursor);
    expect(listSchoolRequests).toHaveBeenCalledWith(undefined);
    expect(html).toContain('href="/admin#library-codes"');
  });

  it("offers a way back to the site, signed in or not, and a way out once signed in", async () => {
    expect(await render()).toContain('href="/"');
    signedIn = true;
    const html = await render();
    expect(html).toContain("Back to the site");
    expect(html).toContain("Sign out");
  });
});
