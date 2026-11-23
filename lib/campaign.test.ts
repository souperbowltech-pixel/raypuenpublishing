import { describe, it, expect, vi, afterEach } from "vitest";
import { CHARACTERS, validateVote, campaignSource, seasonalReservationTitle, csvCell, reservationQuantity } from "@/lib/campaign";
import { makeReceipt, verifyReceipt, voteFingerprint, campaignConfigured } from "@/lib/campaign-token";

export const validVote = {
  submissionId: "00000000-0000-4000-8000-000000000001", character: "sunny",
  firstName: "Zoë", email: " ZOE@EXAMPLE.COM ", adultConsent: true,
};
afterEach(() => { vi.unstubAllEnvs(); });
describe("campaign domain V01-V07", () => {
  it.each(CHARACTERS)("accepts %s with optional fields omitted and normalizes adult details", (character) => {
    const parsed = validateVote({ ...validVote, character });
    expect(parsed).toEqual({ ok: true, value: {
      submissionId: validVote.submissionId, character, firstName: "Zoë", email: "zoe@example.com",
      answer: null, phone: null, smsConsent: false, marketingConsent: false, source: "direct",
    } });
  });
  it.each([
    null, [], false, { ...validVote, submissionId: "../x" }, { ...validVote, character: "gorgon" },
    { ...validVote, firstName: [] }, { ...validVote, firstName: "a".repeat(51) },
    { ...validVote, firstName: "Ana\r\nBcc" }, { ...validVote, email: {} },
    { ...validVote, email: "a\uD800@example.com" }, { ...validVote, email: "a\u007fb@example.com" },
    { ...validVote, email: "a\u0085b@example.com" }, { ...validVote, email: "a\u202eb@example.com" },
    { ...validVote, email: "bad@address" }, { ...validVote, email: "a\u0000b@example.com" },
    { ...validVote, email: "a".repeat(255) + "@example.com" }, { ...validVote, adultConsent: "true" },
    { ...validVote, adultConsent: false }, { ...validVote, marketingConsent: "yes" },
    { ...validVote, smsConsent: "yes" }, { ...validVote, answer: 23 },
    { ...validVote, answer: "x".repeat(501) }, { ...validVote, answer: "\u0000" },
    { ...validVote, answer: "\uD800" }, { ...validVote, answer: "a\u0085b" },
    { ...validVote, answer: "a\u202eb" },
    { ...validVote, phone: 123 }, { ...validVote, phone: "+15551234567" },
    { ...validVote, phone: "555", smsConsent: true }, { ...validVote, smsConsent: true },
  ])("rejects malformed or non-consensual input %#", (raw) => {
    expect(validateVote(raw).ok).toBe(false);
  });
  it("retains explicitly permitted phone/marketing, bounded answer and canonical source", () => {
    expect(validateVote({ ...validVote, phone: "+15551234567", smsConsent: true, marketingConsent: true,
      answer: " A helpful story\nfor our family ", source: " FIESTA " })).toMatchObject({
      ok: true, value: { phone: "+15551234567", smsConsent: true, marketingConsent: true,
        answer: "A helpful story\nfor our family", source: "fiesta" },
    });
  });
  it("does not retain arbitrary tracking strings, redirects or personal information", () => {
    for (const source of [null, [], "parent@example.com", "https://evil.example", "x".repeat(500)]) {
      expect(campaignSource(source)).toBe("direct");
    }
    expect(campaignSource("melissa-data")).toBe("melissa-data");
  });
  it("accepts only bounded integer reservation quantities", () => {
    expect(reservationQuantity(1)).toBe(1); expect(reservationQuantity(10)).toBe(10);
    for (const raw of [0, 11, -1, 1.5, "2", null, NaN]) expect(reservationQuantity(raw)).toBeNull();
  });
  it("ends Christmas wording at Pacific midnight, including the exact boundary", () => {
    expect(seasonalReservationTitle(new Date("2026-12-26T07:59:59.999Z"))).toContain("Christmas");
    expect(seasonalReservationTitle(new Date("2026-12-26T08:00:00Z"))).toBe("Reserve a copy");
    expect(seasonalReservationTitle(new Date("2027-01-01"))).toBe("Reserve a copy");
  });
  it("quotes CSV text and neutralizes formulas with whitespace or control prefixes", () => {
    expect(csvCell('Say "hello",\nfriend')).toBe('"Say ""hello"",\nfriend"');
    for (const raw of ["=1+1", "+1555", "-1", "@SUM(A1)", " \t=cmd", "\r\n+2"]) {
      expect(csvCell(raw).startsWith('"\'')).toBe(true);
    }
    expect(csvCell(null)).toBe('""');
  });
});
describe("signed campaign receipt D01-D02", () => {
  const id = validVote.submissionId;
  const created = "2026-11-22T00:00:00Z";
  const now = Date.parse(created);
  it("refuses to create or verify a receipt without a strong server secret", () => {
    vi.stubEnv("CAMPAIGN_SECRET", "short");
    expect(campaignConfigured()).toBe(false); expect(makeReceipt(id, created)).toBeNull();
  });
  it("signs the record ID with a 30-day expiry and rejects tampering", () => {
    vi.stubEnv("CAMPAIGN_SECRET", "test-".repeat(10));
    const token = makeReceipt(id, created)!;
    expect(verifyReceipt(token, now)?.id).toBe(id);
    expect(verifyReceipt(token.replace(id, id.slice(0, -1) + "2"), now)).toBeNull();
    expect(verifyReceipt(token.slice(0, -1) + "!", now)).toBeNull();
    expect(verifyReceipt(token, now + 30 * 86400000)).toBeNull();
    expect(verifyReceipt(token, now + 30 * 86400000 - 1)?.id).toBe(id);
    vi.stubEnv("CAMPAIGN_SECRET", "different-".repeat(6));
    expect(verifyReceipt(token, now)).toBeNull();
  });
  it("rejects malformed capabilities, invalid IDs and invalid creation timestamps", () => {
    vi.stubEnv("CAMPAIGN_SECRET", "test-".repeat(10));
    for (const raw of [null, 22, [], "a.b.c", "x".repeat(200)]) expect(verifyReceipt(raw, now)).toBeNull();
    expect(makeReceipt("not-a-uuid", created)).toBeNull(); expect(makeReceipt(id, "bad")).toBeNull();
  });
  it("binds an idempotent submission to all normalized input, not only its email", () => {
    const parsed = validateVote(validVote);
    if (!parsed.ok) throw new Error(parsed.error);
    const fingerprint = voteFingerprint(parsed.value);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(voteFingerprint({ ...parsed.value })).toBe(fingerprint);
    expect(voteFingerprint({ ...parsed.value, character: "lucy" })).not.toBe(fingerprint);
    expect(voteFingerprint({ ...parsed.value, marketingConsent: true })).not.toBe(fingerprint);
  });
});
