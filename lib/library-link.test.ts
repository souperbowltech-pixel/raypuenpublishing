import { describe, it, expect } from "vitest";
import { codeFromFragment, isSafeDownloadUrl } from "@/lib/library-link";

describe("codeFromFragment", () => {
  it("reads the code from a link's fragment", () => {
    expect(codeFromFragment("#code=ABCD-2345-WXYZ")).toBe("ABCD-2345-WXYZ");
    expect(codeFromFragment("code=abcd%202345")).toBe("abcd 2345");
  });

  it("finds nothing when there is no code", () => {
    expect(codeFromFragment("")).toBeNull();
    expect(codeFromFragment("#other=1")).toBeNull();
    expect(codeFromFragment("#code=")).toBeNull();
  });

  it("never takes more than a code's worth of text", () => {
    expect(codeFromFragment(`#code=${"A".repeat(500)}`)).toHaveLength(64);
  });
});

describe("isSafeDownloadUrl", () => {
  it("follows an https link", () => {
    expect(isSafeDownloadUrl("https://abcdefgh.supabase.co/storage/v1/object/sign/library/copies/x.pdf?token=t")).toBe(true);
  });

  it("refuses any other scheme, or something that is not a link", () => {
    expect(isSafeDownloadUrl("http://abcdefgh.supabase.co/x.pdf")).toBe(false);
    expect(isSafeDownloadUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeDownloadUrl("data:application/pdf;base64,AAAA")).toBe(false);
    expect(isSafeDownloadUrl("not a url")).toBe(false);
    expect(isSafeDownloadUrl(undefined)).toBe(false);
  });
});
