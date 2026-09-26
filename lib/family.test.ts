import { describe, it, expect } from "vitest";
import {
  validateFirstName,
  normalizeEmail,
  newShareCode,
  newScoutToken,
  newSessionToken,
  hashSessionToken,
  displayRank,
  normalizeShareCode,
  SHARE_CODE_REGEX,
  FIRST_NAME_MAX,
} from "./family";

describe("validateFirstName", () => {
  it("accepts ordinary, accented, hyphenated and two-part first names", () => {
    for (const name of ["Sam", "Zoë", "O'Neil", "Anne-Marie", "Mary Jane", "José"]) {
      expect(validateFirstName(name)).toEqual({ ok: true, value: name });
    }
  });

  it("trims and collapses spaces", () => {
    expect(validateFirstName("  Mary   Jane ")).toEqual({ ok: true, value: "Mary Jane" });
  });

  it("rejects empty, too long, digits, emails and markup", () => {
    for (const bad of ["", "   ", "a".repeat(FIRST_NAME_MAX + 1), "Sam2", "sam@example.com", "<b>Sam</b>", "-Sam"]) {
      expect(validateFirstName(bad).ok).toBe(false);
    }
  });
});

describe("normalizeEmail", () => {
  it("lower-cases and trims a valid address", () => {
    expect(normalizeEmail("  Parent@Example.COM ")).toEqual({ ok: true, value: "parent@example.com" });
  });

  it("rejects invalid addresses", () => {
    for (const bad of ["", "parent", "parent@", "parent@example", "a b@example.com"]) {
      expect(normalizeEmail(bad).ok).toBe(false);
    }
  });
});

describe("normalizeShareCode", () => {
  it("normalizes valid GG- codes and bare 6-char codes", () => {
    expect(normalizeShareCode("GG-7KQ2XM")).toBe("GG-7KQ2XM");
    expect(normalizeShareCode("  gg-7kq2xm  ")).toBe("GG-7KQ2XM");
    expect(normalizeShareCode("7KQ2XM")).toBe("GG-7KQ2XM");
    expect(normalizeShareCode("7kq2xm")).toBe("GG-7KQ2XM");
  });

  it("rejects invalid share codes", () => {
    for (const bad of ["", "   ", "GG-12345", "GG-7KQ2XMO", "INVALID", null, undefined, 123456]) {
      expect(normalizeShareCode(bad)).toBeNull();
    }
  });
});

describe("codes and tokens", () => {
  it("share codes are readable GG- codes and differ each time", () => {
    const codes = new Set(Array.from({ length: 200 }, newShareCode));
    for (const c of codes) expect(c).toMatch(SHARE_CODE_REGEX);
    expect(codes.size).toBeGreaterThan(195);
  });

  it("scout tokens fit the existing token format", () => {
    expect(newScoutToken()).toMatch(/^[A-Za-z0-9_-]{3,64}$/);
  });

  it("session tokens are random and stored only as a stable hash", () => {
    const t = newSessionToken();
    expect(t).not.toEqual(newSessionToken());
    expect(hashSessionToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(t)).toEqual(hashSessionToken(t));
    expect(hashSessionToken(t)).not.toContain(t);
  });

  it("builds Ray's display string", () => {
    expect(displayRank("Sam")).toBe("Chief Explorer Sam");
  });
});
