import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LIBRARY_BOOKS,
  findBook,
  generateCode,
  formatCode,
  normalizeCode,
  hashCode,
  libraryConfigured,
  isPrintableText,
  cleanRecipientName,
  stampText,
  codeExpiry,
  grantStatus,
  canDownload,
  REVIEW_DOWNLOAD_HOURS,
  type GrantTimes,
} from "@/lib/library";

/**
 * The library hands private books to people Ray chooses. The rules that keep
 * it private live here, so they are tested without any database or storage.
 */

const NOW = new Date("2026-11-14T12:00:00.000Z");
const hours = (h: number) => h * 60 * 60 * 1000;
const days = (d: number) => hours(d * 24);
const SECRET = "test-secret-that-is-at-least-32-characters";

beforeEach(() => {
  process.env.LIBRARY_CODE_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.LIBRARY_CODE_SECRET;
});

describe("catalog", () => {
  it("knows each book by its slug, and nothing else", () => {
    expect(LIBRARY_BOOKS.map((b) => b.slug)).toEqual(["geezy-book-1", "neighborhood-book-1", "parents-guide"]);
    expect(findBook("neighborhood-book-1")?.masterPath).toBe("masters/neighborhood-book-1.pdf");
    expect(findBook("../secrets")).toBeNull();
    expect(findBook(undefined)).toBeNull();
  });

  it("names every download with characters that survive storage's double encoding", () => {
    for (const book of LIBRARY_BOOKS) expect(book.fileName).toMatch(/^[A-Za-z0-9 .-]+\.pdf$/);
  });
});

describe("codes", () => {
  it("are twelve characters from an alphabet with no look-alike letters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/);
    }
  });

  it("do not repeat", () => {
    const seen = new Set(Array.from({ length: 2000 }, generateCode));
    expect(seen.size).toBe(2000);
  });

  it("use every character of the alphabet about equally", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) for (const char of generateCode()) counts.set(char, (counts.get(char) ?? 0) + 1);
    expect(counts.size).toBe(32);
    // 120,000 characters over 32: about 3,750 each; a broken index would leave some near zero.
    for (const count of counts.values()) expect(count).toBeGreaterThan(3_200);
  });

  it("are shown in three groups of four", () => {
    expect(formatCode("ABCD2345WXYZ")).toBe("ABCD-2345-WXYZ");
    expect(() => formatCode("ABCD")).toThrow();
  });

  it("forgive the way people type them", () => {
    expect(normalizeCode(" abcd-2345 wxyz ")).toBe("ABCD2345WXYZ");
    // O is read as zero, I and L as one: the letters a person confuses.
    expect(normalizeCode("OIL0-1111-2222")).toBe("011011112222");
    expect(normalizeCode("oil0-1111-2222")).toBe("011011112222");
  });

  it("refuse anything that cannot be a code", () => {
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("ABCD-2345")).toBeNull();
    expect(normalizeCode("ABCD-2345-WXYZ-0")).toBeNull();
    expect(normalizeCode("ABCD-2345-WXY!")).toBeNull();
    expect(normalizeCode("ABCD-2345-WXYU")).toBeNull();
    expect(normalizeCode(12345)).toBeNull();
    expect(normalizeCode("A".repeat(5000))).toBeNull();
  });

  it("ignore a tab or line break that came along with a pasted code", () => {
    expect(normalizeCode("ABCD-2345-WXYZ\r\n")).toBe("ABCD2345WXYZ");
    expect(normalizeCode("\tABCD 2345 WXYZ")).toBe("ABCD2345WXYZ");
  });

  it("accept only plain ASCII, so no other script's letter becomes a code character", () => {
    expect(normalizeCode("ıııı-1111-2222")).toBeNull();
    expect(normalizeCode("ＡＢＣＤ-2345-WXYZ")).toBeNull();
  });

  it("allow at most 64 typed characters", () => {
    const padded = (n: number) => "ABCD2345WXYZ" + " ".repeat(n - 12);
    expect(normalizeCode(padded(64))).toBe("ABCD2345WXYZ");
    expect(normalizeCode(padded(65))).toBeNull();
  });

  it("are stored only as a keyed hash, the same for every way of typing one", () => {
    const hash = hashCode("ABCD2345WXYZ");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("ABCD");
    expect(hashCode(normalizeCode("abcd 2345 wxyz")!)).toBe(hash);
  });

  it("hash differently under a different secret, so the table alone cannot test guesses", () => {
    const first = hashCode("ABCD2345WXYZ");
    process.env.LIBRARY_CODE_SECRET = "another-secret-that-is-also-32-characters";
    expect(hashCode("ABCD2345WXYZ")).not.toBe(first);
  });

  it("refuse to hash without a proper secret, or a code that was not normalized", () => {
    expect(() => hashCode("abcd-2345-wxyz")).toThrow(/normalized/);
    process.env.LIBRARY_CODE_SECRET = "short";
    expect(libraryConfigured()).toBe(false);
    process.env.LIBRARY_CODE_SECRET = " ".repeat(40);
    expect(libraryConfigured()).toBe(false);
    expect(() => hashCode("ABCD2345WXYZ")).toThrow(/LIBRARY_CODE_SECRET/);
    delete process.env.LIBRARY_CODE_SECRET;
    expect(() => hashCode("ABCD2345WXYZ")).toThrow(/LIBRARY_CODE_SECRET/);
  });
});

describe("cleanRecipientName", () => {
  it("tidies spaces and keeps an ordinary name", () => {
    expect(cleanRecipientName("  Jane   Smith ")).toBe("Jane Smith");
  });

  it("keeps accents the PDF font can print", () => {
    expect(cleanRecipientName("José Müller-Ñúñez")).toBe("José Müller-Ñúñez");
  });

  it("turns letters the font cannot print into their plain form", () => {
    expect(cleanRecipientName("Łukasz Dvořák")).toBe("Lukasz Dvorák");
    expect(cleanRecipientName("Đorđe Yıldız")).toBe("Dorde Yildiz");
    expect(cleanRecipientName("Aná")).toBe("Aná");
  });

  it("drops emoji, scripts the font has no letters for, and control characters", () => {
    expect(cleanRecipientName("Jane 😀 Smith")).toBe("Jane Smith");
    expect(cleanRecipientName("Jane\r\nBcc: x\u0000")).toBe("Jane Bcc: x");
    expect(cleanRecipientName("山田 Taro")).toBe("Taro");
  });

  it("refuses a name with nothing printable left, or none at all", () => {
    expect(cleanRecipientName("")).toBeNull();
    expect(cleanRecipientName("   ")).toBeNull();
    expect(cleanRecipientName("山田")).toBeNull();
    expect(cleanRecipientName("---")).toBeNull();
    expect(cleanRecipientName(null)).toBeNull();
    expect(cleanRecipientName(42)).toBeNull();
  });

  it("refuses a name too long to print on one line", () => {
    expect(cleanRecipientName("A".repeat(60))).toBe("A".repeat(60));
    expect(cleanRecipientName("A".repeat(61))).toBeNull();
    expect(cleanRecipientName(`${"A".repeat(30)}      ${"B".repeat(29)}`)).toBe(`${"A".repeat(30)} ${"B".repeat(29)}`);
  });

  it("checks the capital form too, which a review stamp prints", () => {
    // Both print in their own form, but their capitals do not exist in the font.
    expect(cleanRecipientName("µ")).toBeNull();
    expect(cleanRecipientName("ƒ")).toBeNull();
    // ß doubles in capitals, so 60 of them would not fit.
    expect(cleanRecipientName("ß".repeat(60))).toBeNull();
    expect(cleanRecipientName("Weiß")).toBe("Weiß");
  });

  it("needs a letter: digits alone are not a name", () => {
    expect(cleanRecipientName("²")).toBeNull();
    expect(cleanRecipientName("123")).toBeNull();
    expect(cleanRecipientName("Agent 007")).toBe("Agent 007");
  });

  it("joins decomposed accents and drops invisible characters", () => {
    expect(cleanRecipientName("José")).toBe("José");
    expect(cleanRecipientName("Ja​ne ‮Smith")).toBe("Jane Smith");
    expect(cleanRecipientName("Jo­hn")).toBe("John");
  });
});

describe("isPrintableText", () => {
  it("accepts what the font can draw and nothing else", () => {
    expect(isPrintableText("REVIEW COPY FOR JOSÉ — “Ñ” €")).toBe(true);
    expect(isPrintableText("Μ")).toBe(false);
    expect(isPrintableText("a­b")).toBe(false);
  });
});

describe("stampText", () => {
  it("uses Ray's own wording for a review copy", () => {
    expect(stampText("review", "Jane Smith")).toBe("REVIEW COPY FOR JANE SMITH. NOT TO BE CIRCULATED");
  });

  it("names the buyer of a paid copy", () => {
    expect(stampText("purchase", "Jane Smith")).toBe("Licensed to Jane Smith for family use. Please do not share.");
  });

  it("never produces a character the font cannot print, even after capitals", () => {
    // The micro sign becomes a Greek capital Mu when upper-cased.
    expect(stampText("review", "µ Jane")).toBe("REVIEW COPY FOR JANE. NOT TO BE CIRCULATED");
  });

  it("throws rather than leave the name slot empty", () => {
    expect(() => stampText("review", "µ")).toThrow(/name/);
    expect(() => stampText("purchase", "😀")).toThrow(/name/);
  });
});

describe("codeExpiry", () => {
  it("gives a review code 60 days and a paid copy a year", () => {
    expect(codeExpiry("review", NOW).getTime() - NOW.getTime()).toBe(days(60));
    expect(codeExpiry("purchase", NOW).getTime() - NOW.getTime()).toBe(days(365));
  });
});

describe("grantStatus and canDownload", () => {
  const review = (over: Partial<GrantTimes> = {}): GrantTimes => ({
    kind: "review",
    expiresAt: new Date(NOW.getTime() + days(10)).toISOString(),
    firstUsedAt: null,
    downloadUntil: null,
    revokedAt: null,
    ...over,
  });

  it("lets an unused review code be opened before it expires", () => {
    expect(grantStatus(review(), NOW)).toBe("unused");
    expect(canDownload(review(), NOW)).toEqual({ ok: true });
  });

  it("keeps a review copy open for the download window after first use", () => {
    const opened = review({
      firstUsedAt: NOW.toISOString(),
      downloadUntil: new Date(NOW.getTime() + hours(REVIEW_DOWNLOAD_HOURS)).toISOString(),
    });
    expect(grantStatus(opened, new Date(NOW.getTime() + hours(23)))).toBe("open");
    expect(canDownload(opened, new Date(NOW.getTime() + hours(23)))).toEqual({ ok: true });
    expect(grantStatus(opened, new Date(NOW.getTime() + hours(25)))).toBe("used");
    expect(canDownload(opened, new Date(NOW.getTime() + hours(25)))).toEqual({ ok: false, reason: "used" });
  });

  it("refuses an unused review code after it expires", () => {
    const old = review({ expiresAt: new Date(NOW.getTime() - 1).toISOString() });
    expect(grantStatus(old, NOW)).toBe("expired");
    expect(canDownload(old, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a cancelled code whatever else is true", () => {
    const cancelled = review({ revokedAt: NOW.toISOString() });
    expect(grantStatus(cancelled, NOW)).toBe("cancelled");
    expect(canDownload(cancelled, NOW)).toEqual({ ok: false, reason: "cancelled" });
  });

  it("lets a buyer download again and again until the year is up", () => {
    const bought: GrantTimes = {
      kind: "purchase",
      expiresAt: new Date(NOW.getTime() + days(365)).toISOString(),
      firstUsedAt: new Date(NOW.getTime() - days(30)).toISOString(),
      downloadUntil: null,
      revokedAt: null,
    };
    expect(canDownload(bought, NOW)).toEqual({ ok: true });
    expect(canDownload(bought, new Date(NOW.getTime() + days(366)))).toEqual({ ok: false, reason: "expired" });
  });

  it("treats an unreadable date as closed, not open", () => {
    expect(canDownload(review({ expiresAt: "not a date" }), NOW)).toEqual({ ok: false, reason: "expired" });
    const badWindow = review({ firstUsedAt: NOW.toISOString(), downloadUntil: "soon" });
    expect(grantStatus(badWindow, NOW)).toBe("used");
    const noWindow = review({ firstUsedAt: NOW.toISOString(), downloadUntil: null });
    expect(grantStatus(noWindow, NOW)).toBe("used");
  });

  it("refuses a time with no zone, which would be read in the server's own zone", () => {
    expect(grantStatus(review({ expiresAt: "2026-12-01T12:00:00" }), NOW)).toBe("expired");
    expect(grantStatus(review({ expiresAt: "2026-12-01T12:00:00+05:00" }), NOW)).toBe("unused");
    expect(grantStatus(review({ expiresAt: "2026-12-01T12:00:00.123456+00:00" }), NOW)).toBe("unused");
  });

  it("reads the forms the database really returns, and nothing looser", () => {
    // supabase-js passes timestamptz through as PostgREST JSON; Postgres' own text form ends in +00.
    expect(grantStatus(review({ expiresAt: "2026-12-01T12:00:00.123456+00:00" }), NOW)).toBe("unused");
    expect(grantStatus(review({ expiresAt: "2026-12-01 12:00:00+00" }), NOW)).toBe("unused");
    // A month-day-year string happens to end like an offset; it must still be refused.
    expect(grantStatus(review({ expiresAt: "12-01-2026" }), NOW)).toBe("expired");
  });

  it("counts the last instant as still inside", () => {
    expect(grantStatus(review({ expiresAt: NOW.toISOString() }), NOW)).toBe("unused");
    const opened = review({ firstUsedAt: NOW.toISOString(), downloadUntil: NOW.toISOString() });
    expect(grantStatus(opened, NOW)).toBe("open");
  });

  it("keeps a review copy opened on its last day downloadable for the whole window", () => {
    const lastDay = review({
      expiresAt: new Date(NOW.getTime() - hours(1)).toISOString(),
      firstUsedAt: new Date(NOW.getTime() - hours(2)).toISOString(),
      downloadUntil: new Date(NOW.getTime() + hours(22)).toISOString(),
    });
    expect(canDownload(lastDay, NOW)).toEqual({ ok: true });
  });

  it("treats a cancelled mark of any value, even an empty one, as cancelled", () => {
    expect(grantStatus(review({ revokedAt: "" }), NOW)).toBe("cancelled");
  });

  it("refuses a kind of grant it does not know", () => {
    const strange = { ...review(), kind: "gift" } as unknown as GrantTimes;
    expect(canDownload(strange, NOW)).toEqual({ ok: false, reason: "cancelled" });
  });

  it("refuses everything when the clock itself is broken", () => {
    expect(canDownload(review(), new Date(NaN))).toEqual({ ok: false, reason: "expired" });
  });

  it("covers a paid copy's other states", () => {
    const bought: GrantTimes = {
      kind: "purchase",
      expiresAt: new Date(NOW.getTime() + days(365)).toISOString(),
      firstUsedAt: null,
      downloadUntil: null,
      revokedAt: null,
    };
    expect(grantStatus(bought, NOW)).toBe("unused");
    expect(grantStatus({ ...bought, revokedAt: NOW.toISOString() }, NOW)).toBe("cancelled");
    expect(grantStatus({ ...bought, expiresAt: "garbage" }, NOW)).toBe("expired");
  });
});
