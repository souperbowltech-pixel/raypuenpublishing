import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SchoolRequestsList } from "@/components/admin/SchoolRequestsList";
import { SCHOOL_REQUESTS_PAGE_SIZE, parsePageCursor, type SchoolRequestRow } from "@/lib/school-request-store";

const row = (n: number, over: Partial<SchoolRequestRow> = {}): SchoolRequestRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  createdAt: "2026-11-18T14:05:00.123456+00:00",
  name: "Grace Miller",
  role: "Co-op coordinator",
  school: `Hope Homeschool Co-op ${n}`,
  location: "Austin, TX",
  email: "grace@example.com",
  phone: null,
  copies: null,
  message: null,
  ...over,
});

const render = (rows: SchoolRequestRow[] | null, paged = false) =>
  renderToStaticMarkup(<SchoolRequestsList rows={rows} paged={paged} />);

describe("the leaders' requests on /admin", () => {
  it("shows who asked, from where, and how to reach them", () => {
    const html = render([row(1, { phone: "512-555-0100", copies: 40, message: "Line one\nLine two" })]);
    expect(html).toContain("Hope Homeschool Co-op 1");
    expect(html).toContain("Grace Miller, Co-op coordinator");
    expect(html).not.toContain("\u00b7");
    expect(html).toContain("Austin, TX");
    expect(html).toContain('href="mailto:grace@example.com"');
    expect(html).toContain("512-555-0100");
    expect(html).toContain("<dd>40</dd>");
    expect(html).toContain("Line one\nLine two");
    expect(html).toContain("Nov 18, 2026");
    expect(html).toContain("UTC");
  });

  it("leaves out the optional lines a leader did not fill in", () => {
    const html = render([row(1)]);
    expect(html).not.toContain("Phone");
    expect(html).not.toContain("Copies");
  });

  it("prints what a leader typed as text, never as markup", () => {
    const html = render([row(1, { school: "<script>alert(1)</script>", message: "<img src=x onerror=alert(1)>" })]);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("says plainly when the list could not be read, instead of looking empty", () => {
    const html = render(null);
    expect(html).toContain('role="alert"');
    expect(html).toContain("could not be loaded");
    expect(html).not.toContain("No requests yet");
  });

  it("says so when nothing has come in yet", () => {
    expect(render([])).toContain("No requests yet");
  });

  it("offers older requests only when the page is full, starting after the last one shown", () => {
    expect(render([row(1)])).not.toContain("Older requests");

    const full = Array.from({ length: SCHOOL_REQUESTS_PAGE_SIZE }, (_, i) => row(i + 1));
    const html = render(full);
    const href = html.match(/href="(\/admin\?before=[^"]+)"/);
    expect(href).not.toBeNull();
    // The timestamp's "+" and the "|" must be encoded: Next reads a bare "+" as a space.
    expect(href![1]).toContain("%2B");
    expect(href![1]).toContain("%7C");
    expect(href![1]).not.toMatch(/[+|]/);
    // Read back the way Next reads ?before= from the URL.
    const before = new URL(href![1], "https://www.puenpublishing.com").searchParams.get("before");
    expect(parsePageCursor(before)).toEqual({ createdAt: full[full.length - 1].createdAt, id: full[full.length - 1].id });
  });

  it("leads back to the newest from an older page", () => {
    const html = render([], true);
    expect(html).toContain("There are no older requests.");
    expect(html).toContain('href="/admin#school-requests"');
  });

  it("encodes a stored address so it cannot add recipients to Ray's reply", () => {
    // Written before the stricter check, or by hand: the link still only addresses this one inbox.
    const html = render([row(1, { email: "a@b.co?cc=evil@x.com" })]);
    expect(html).toContain('href="mailto:a@b.co%3Fcc%3Devil@x.com"');
    expect(html).not.toMatch(/href="[^"]*\?cc=/);
  });

  it("offers no older page below a full page", () => {
    const html = render(Array.from({ length: SCHOOL_REQUESTS_PAGE_SIZE - 1 }, (_, i) => row(i + 1)));
    expect(html).not.toContain("Older requests");
  });

  it("offers both ways from a full older page", () => {
    const html = render(Array.from({ length: SCHOOL_REQUESTS_PAGE_SIZE }, (_, i) => row(i + 1)), true);
    expect(html).toContain("Older requests");
    expect(html).toContain("Back to the newest");
  });

  it("still leads back to the newest when an older page could not be read", () => {
    const html = render(null, true);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Back to the newest");
    expect(html).not.toContain("Older requests");
  });

  it("shows a date it cannot read as it was stored, rather than failing", () => {
    expect(render([row(1, { createdAt: "not a date" })])).toContain("not a date");
  });
});
