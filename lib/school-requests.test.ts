import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isLikelyBot, validateSchoolRequest, MAX_COPIES, SCHOOL_REQUEST_LIMITS } from "@/lib/school-requests";

const valid = (over: Record<string, unknown> = {}) => ({
  name: "Ana Lopez",
  role: "Principal",
  school: "Lincoln Elementary",
  location: "Austin, TX",
  email: "ana@school.example",
  ...over,
});

describe("validateSchoolRequest", () => {
  it("accepts the required fields and leaves the optional ones empty", () => {
    const result = validateSchoolRequest(valid());
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ana Lopez",
        role: "Principal",
        school: "Lincoln Elementary",
        location: "Austin, TX",
        email: "ana@school.example",
        phone: null,
        copies: null,
        message: null,
      },
    });
  });

  it("keeps the optional fields when given", () => {
    const result = validateSchoolRequest(
      valid({ phone: "+1 (512) 555-0100", copies: "120", message: "Line one\r\nLine two" })
    );
    expect(result.ok && result.value).toMatchObject({
      phone: "+1 (512) 555-0100",
      copies: 120,
      message: "Line one\nLine two",
    });
  });

  it.each(["name", "role", "school", "location"])("requires %s", (field) => {
    for (const empty of [undefined, null, "", "   ", 42]) {
      const result = validateSchoolRequest(valid({ [field]: empty }));
      expect(result).toMatchObject({ ok: false, field });
    }
  });

  it.each(Object.entries({ name: 100, role: 80, school: 150, location: 120 }))(
    "limits %s to %i characters",
    (field, max) => {
      expect(validateSchoolRequest(valid({ [field]: "a".repeat(max) })).ok).toBe(true);
      expect(validateSchoolRequest(valid({ [field]: "a".repeat(max + 1) }))).toMatchObject({ ok: false, field });
    }
  );

  it("normalises the email and rejects a bad one", () => {
    const ok = validateSchoolRequest(valid({ email: "  Ana@School.Example " }));
    expect(ok.ok && ok.value.email).toBe("ana@school.example");
    for (const bad of ["", "not-an-email", "a@b", null]) {
      expect(validateSchoolRequest(valid({ email: bad }))).toMatchObject({ ok: false, field: "email" });
    }
  });

  it("rejects a phone that is not a phone", () => {
    for (const bad of ["call me", "123", "<script>", "1".repeat(31), "-------", ".......", "+++++++", 5125550100]) {
      expect(validateSchoolRequest(valid({ phone: bad }))).toMatchObject({ ok: false, field: "phone" });
    }
  });

  it("accepts a phone of 7 and of 30 characters", () => {
    expect(validateSchoolRequest(valid({ phone: "5550100" })).ok).toBe(true);
    expect(validateSchoolRequest(valid({ phone: "1".repeat(30) })).ok).toBe(true);
  });

  it("accepts copies only as a whole number in range", () => {
    expect(validateSchoolRequest(valid({ copies: 1 })).ok).toBe(true);
    expect(validateSchoolRequest(valid({ copies: MAX_COPIES })).ok).toBe(true);
    for (const bad of [0, -5, 2.5, MAX_COPIES + 1, "ten", "1e3x", true, "0", "100001", "-3", "1.5"]) {
      expect(validateSchoolRequest(valid({ copies: bad }))).toMatchObject({ ok: false, field: "copies" });
    }
  });

  it("reads copies given as text, and treats empty as not given", () => {
    const copies = (raw: unknown) => {
      const r = validateSchoolRequest(valid({ copies: raw }));
      return r.ok ? r.value.copies : "invalid";
    };
    expect(copies(" 12 ")).toBe(12);
    expect(copies("007")).toBe(7);
    expect(copies(1e3)).toBe(1000);
    expect(copies(null)).toBeNull();
    expect(copies("")).toBeNull();
    expect(copies("   ")).toBeNull();
  });

  it("counts a message after line endings are normalised, and drops a blank one", () => {
    const max = SCHOOL_REQUEST_LIMITS.message;
    const crlf = "ab\r\n".repeat(Math.floor(max / 3));
    expect(crlf.length).toBeGreaterThan(max);
    expect(validateSchoolRequest(valid({ message: crlf })).ok).toBe(true);
    const blank = validateSchoolRequest(valid({ message: "  \n\r\n\t " }));
    expect(blank.ok && blank.value.message).toBeNull();
  });

  it("rejects an email that is not a plain string or holds invisible characters", () => {
    for (const bad of [["ana@school.example"], 123, "ana\u0000@school.example", "ana‮@school.example", "ana\ud800@school.example"]) {
      expect(validateSchoolRequest(valid({ email: bad }))).toMatchObject({ ok: false, field: "email" });
    }
  });

  it("strips bidi overrides, zero-width marks and C1 controls", () => {
    const result = validateSchoolRequest(
      valid({ school: "Lin‮coln​ Ele\u0085mentary﻿", message: "Hi⁦ there\u009F" })
    );
    expect(result.ok && result.value).toMatchObject({ school: "Lincoln Elementary", message: "Hi there" });
  });

  it("rejects a lone surrogate, which the database would refuse", () => {
    expect(validateSchoolRequest(valid({ school: "Lincoln \ud800" }))).toMatchObject({ ok: false, field: "school" });
    expect(validateSchoolRequest(valid({ message: "x\udc00y" }))).toMatchObject({ ok: false, field: "message" });
    expect(validateSchoolRequest(valid({ school: "Lincoln 😀" })).ok).toBe(true);
  });

  it("counts characters the way Postgres does, so an emoji counts once", () => {
    expect(validateSchoolRequest(valid({ name: "\u{1F600}".repeat(100) })).ok).toBe(true);
    expect(validateSchoolRequest(valid({ name: "\u{1F600}".repeat(101) }))).toMatchObject({ ok: false, field: "name" });
  });

  it("says the limit plainly", () => {
    const result = validateSchoolRequest(valid({ name: "a".repeat(101) }));
    expect(!result.ok && result.error).toBe("Please keep your name to 100 characters or fewer.");
  });

  it("limits the message", () => {
    const max = SCHOOL_REQUEST_LIMITS.message;
    expect(validateSchoolRequest(valid({ message: "m".repeat(max) })).ok).toBe(true);
    expect(validateSchoolRequest(valid({ message: "m".repeat(max + 1) }))).toMatchObject({
      ok: false,
      field: "message",
    });
  });

  it("strips control characters and collapses spaces in one-line fields", () => {
    const result = validateSchoolRequest(valid({ school: "Lincoln\u0000  \tElementary\n" }));
    expect(result.ok && result.value.school).toBe("Lincoln Elementary");
  });

  it("keeps unicode names intact", () => {
    const result = validateSchoolRequest(valid({ name: "José Núñez 李明", school: "Escuela Señora" }));
    expect(result.ok && result.value).toMatchObject({ name: "José Núñez 李明", school: "Escuela Señora" });
  });
});

describe("isLikelyBot", () => {
  it("flags a filled hidden field and nothing else", () => {
    expect(isLikelyBot({ website: "http://spam.example" })).toBe(true);
    expect(isLikelyBot({ website: 1 })).toBe(true);
    expect(isLikelyBot({ website: ["x"] })).toBe(true);
    expect(isLikelyBot({ website: true })).toBe(true);
    expect(isLikelyBot({ website: null })).toBe(false);
    expect(isLikelyBot({ website: "" })).toBe(false);
    expect(isLikelyBot({ website: "   " })).toBe(false);
    expect(isLikelyBot({})).toBe(false);
  });
});

describe("the table and the form agree", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261112_create_school_requests.sql"), "utf8");

  it.each(["name", "role", "school", "location"] as const)("%s has the same limit in SQL", (field) => {
    expect(sql).toContain(`char_length(${field}) between 1 and ${SCHOOL_REQUEST_LIMITS[field]}`);
  });

  it("phone, message, email and copies have the same limits in SQL", () => {
    expect(sql).toContain(`char_length(phone) <= ${SCHOOL_REQUEST_LIMITS.phone}`);
    expect(sql).toContain(`char_length(message) <= ${SCHOOL_REQUEST_LIMITS.message}`);
    expect(sql).toContain(`copies between 1 and ${MAX_COPIES}`);
    expect(sql).toContain("char_length(email) between 3 and 254");
  });

  it("keeps the public keys out", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on public.school_requests from anon, authenticated");
  });
});
