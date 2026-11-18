// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryCodes, type LibraryCodeRow } from "@/components/admin/LibraryCodes";
import { libraryBookOptions, libraryCodeRows, olderCodesCursor } from "@/lib/admin-library-rows";
import type { Grant } from "@/lib/library-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const books = [
  { slug: "geezy-book-1", title: "The Geezy Goober, Book 1" },
  { slug: "parents-guide", title: "The Parent's Guide" },
];
const row = (over: Partial<LibraryCodeRow> = {}): LibraryCodeRow => ({
  id: "8f14e45f-ceea-4e6b-a1a8-7b9d2b5c1e01",
  bookTitle: "The Geezy Goober, Book 1",
  recipientName: "Jane Smith",
  kind: "review",
  status: "unused",
  createdAt: "2026-11-18T10:00:00.000Z",
  expiresAt: "2027-01-17T10:00:00.000Z",
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let container: HTMLDivElement;
let root: Root;
function mount(rows: LibraryCodeRow[] | null = []) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<LibraryCodes books={books} rows={rows} />));
}

const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
function type(id: string, value: string) {
  const input = container.querySelector(`#${id}`) as HTMLInputElement;
  act(() => {
    inputSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = () =>
  act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

beforeEach(() => refresh.mockReset());
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("review codes on /admin", () => {
  it("makes a code, shows it once with the link to send, and refreshes the list", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        json({
          code: "ABCD-2345-WXYZ",
          bookTitle: "The Geezy Goober, Book 1",
          recipientName: "Jane Smith",
          expiresAt: "2027-01-17T12:00:00.000Z",
          libraryUrl: "https://www.puenpublishing.com/library",
          bookUploaded: true,
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    mount();
    type("lc-name", "Jane Smith");
    await submit();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/library/codes");
    expect(JSON.parse(String(init.body))).toEqual({ book: "geezy-book-1", name: "Jane Smith", email: "" });
    const status = container.querySelector('[role="status"]')!.textContent!;
    expect(status).toContain("ABCD-2345-WXYZ");
    expect(status).toContain("https://www.puenpublishing.com/library#code=ABCD-2345-WXYZ");
    expect(status).toContain("Shown only now");
    expect(status).not.toContain("not uploaded");
    expect(refresh).toHaveBeenCalled();
    expect((container.querySelector("#lc-name") as HTMLInputElement).value).toBe("");
  });

  it("warns when the book's file is not uploaded yet", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({
      code: "ABCD-2345-WXYZ", bookTitle: "x", recipientName: "Jane", expiresAt: "2027-01-17T12:00:00.000Z",
      libraryUrl: "https://www.puenpublishing.com/library", bookUploaded: false,
    }))));
    mount();
    type("lc-name", "Jane");
    await submit();
    expect(container.textContent).toContain("not uploaded yet, so the code will not open anything");
  });

  it("asks for a name before calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("#lc-name")!.getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the server's message against the field it names", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "Please enter a valid email address, or leave it empty.", field: "email" }, 400))));
    mount();
    type("lc-name", "Jane");
    type("lc-email", "bad");
    await submit();
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("valid email");
    expect(container.querySelector("#lc-email")!.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("says so when the site cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    mount();
    type("lc-name", "Jane");
    await submit();
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("Could not reach the site");
  });

  it("cancels a code only after Ray confirms, then refreshes the list", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ cancelled: true })));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.spyOn(window, "confirm");
    mount([row()]);
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Cancel code")!;

    confirm.mockReturnValueOnce(false);
    await act(async () => button.click());
    expect(fetchMock).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await act(async () => button.click());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/library/codes/cancel");
    expect(JSON.parse(String(init.body))).toEqual({ id: row().id });
    expect(refresh).toHaveBeenCalled();
  });

  it("refreshes the list when the code was already cancelled elsewhere", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "That code was not found, or it was already cancelled." }, 404))));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mount([row()]);
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Cancel code")!;
    await act(async () => button.click());
    expect(refresh).toHaveBeenCalled();
  });

  it("does not refresh after a server failure, and says so", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "The library is not reachable right now." }, 503))));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mount([row()]);
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Cancel code")!;
    await act(async () => button.click());
    expect(refresh).not.toHaveBeenCalled();
    expect(container.textContent).toContain("not reachable");
  });

  it("says when the file check could not be done", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({
      code: "ABCD-2345-WXYZ", bookTitle: "x", recipientName: "Jane", expiresAt: "2027-01-17T12:00:00.000Z",
      libraryUrl: "https://www.puenpublishing.com/library", bookUploaded: null,
    }))));
    mount();
    type("lc-name", "Jane");
    await submit();
    expect(container.textContent).toContain("Could not check whether this book");
  });

  it("sends once however many times the button is pressed while waiting", async () => {
    let answer: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    type("lc-name", "Jane");
    await submit();
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => answer(json({ error: "x" }, 500)));
  });

  it("treats an answer without the link as a failure, never printing a broken link", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ code: "ABCD-2345-WXYZ" }))));
    mount();
    type("lc-name", "Jane");
    await submit();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).not.toContain("undefined");
  });

  it("tells Ray when the link could not be copied", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({
      code: "ABCD-2345-WXYZ", bookTitle: "x", recipientName: "Jane", expiresAt: "2027-01-17T12:00:00.000Z",
      libraryUrl: "https://www.puenpublishing.com/library", bookUploaded: true,
    }))));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    mount();
    type("lc-name", "Jane");
    await submit();
    const copy = [...container.querySelectorAll("button")].find((b) => b.textContent === "Copy the link to send")!;
    await act(async () => copy.click());
    expect(container.textContent).toContain("Could not copy");
  });

  it("shows why a cancel failed", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: "That code was not found, or it was already cancelled." }, 404))));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mount([row()]);
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Cancel code")!;
    await act(async () => button.click());
    expect(container.textContent).toContain("already cancelled");
  });
});

describe("the list of codes", () => {
  const html = (rows: LibraryCodeRow[] | null) => renderToStaticMarkup(<LibraryCodes books={books} rows={rows} />);

  it("offers cancel only on a review code that can still open something", () => {
    for (const status of ["unused", "open"] as const) expect(html([row({ status })])).toContain("Cancel code");
    for (const status of ["used", "expired", "cancelled"] as const) expect(html([row({ status })])).not.toContain("Cancel code");
  });

  it("never offers cancel on a paid buyer's code", () => {
    for (const status of ["unused", "open"] as const) {
      expect(html([row({ kind: "purchase", status })])).not.toContain("Cancel code");
    }
  });

  it("offers older codes from a full page, and the way back from an older one", () => {
    const cursor = "2026-11-18T10:00:00.000Z|8f14e45f-ceea-4e6b-a1a8-7b9d2b5c1e01";
    const full = renderToStaticMarkup(<LibraryCodes books={books} rows={[row()]} olderCursor={cursor} />);
    const href = full.match(/href="(\/admin\?lbefore=[^"]+)"/)![1];
    expect(new URL(href, "https://www.puenpublishing.com").searchParams.get("lbefore")).toBe(cursor);
    expect(full).not.toContain("Back to the newest");

    const older = renderToStaticMarkup(<LibraryCodes books={books} rows={[]} paged />);
    expect(older).toContain("There are no older codes.");
    expect(older).toContain('href="/admin#library-codes"');
  });

  it("says plainly when the codes could not be loaded, and when there are none", () => {
    expect(html(null)).toContain("could not be loaded");
    expect(html([])).toContain("No codes yet.");
  });

  it("prints a typed name as text, never as markup", () => {
    const out = html([row({ recipientName: "<img src=x onerror=alert(1)>" })]);
    expect(out).not.toContain("<img");
  });
});

describe("libraryCodeRows", () => {
  const grant = (over: Partial<Grant> = {}): Grant => ({
    id: "g1",
    kind: "review",
    bookSlug: "geezy-book-1",
    recipientName: "Jane",
    recipientEmail: "jane@example.com",
    emailSentAt: null,
    expiresAt: "2027-01-17T10:00:00.000Z",
    firstUsedAt: null,
    downloadUntil: null,
    copyPath: null,
    copyExpiresAt: null,
    revokedAt: null,
    createdAt: "2026-11-18T10:00:00.000Z",
    ...over,
  });
  const now = new Date("2026-11-20T10:00:00.000Z");

  it("hands the page plain rows with the book title and the status, and nothing else", () => {
    const [r] = libraryCodeRows([grant()], now)!;
    expect(r).toEqual({
      id: "g1",
      bookTitle: "The Geezy Goober, Book 1",
      recipientName: "Jane",
      kind: "review",
      status: "unused",
      createdAt: "2026-11-18T10:00:00.000Z",
      expiresAt: "2027-01-17T10:00:00.000Z",
    });
  });

  it("works out each status from the grant's times", () => {
    const status = (over: Partial<Grant>) => libraryCodeRows([grant(over)], now)![0].status;
    expect(status({ revokedAt: "2026-11-19T00:00:00.000Z" })).toBe("cancelled");
    expect(status({ expiresAt: "2026-11-19T00:00:00.000Z" })).toBe("expired");
    expect(status({ firstUsedAt: "2026-11-20T09:00:00.000Z", downloadUntil: "2026-11-21T09:00:00.000Z" })).toBe("open");
    expect(status({ firstUsedAt: "2026-11-18T09:00:00.000Z", downloadUntil: "2026-11-19T09:00:00.000Z" })).toBe("used");
  });

  it("keeps null as null, so the page can say the list failed", () => {
    expect(libraryCodeRows(null, now)).toBeNull();
  });

  it("gives a cursor for older codes only when the page is full", () => {
    expect(olderCodesCursor(null)).toBeNull();
    expect(olderCodesCursor([grant()])).toBeNull();
    const full = Array.from({ length: 50 }, (_, i) => grant({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    expect(olderCodesCursor(full)).toBe(`2026-11-18T10:00:00.000Z|${full[49].id}`);
  });

  it("offers every book in the library", () => {
    expect(libraryBookOptions().map((b) => b.slug)).toEqual(["geezy-book-1", "neighborhood-book-1", "parents-guide"]);
  });
});
