import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CERTIFICATE_PATH, CERTIFICATE_PDF, CERTIFICATE_PREVIEW } from "@/lib/certificate";

/**
 * The address under the printed certificate cannot be corrected once the books
 * are printed, so these check the files behind it, not just the page.
 */
const publicFile = (url: string) => path.join(process.cwd(), "public", url);

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(jpg: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < jpg.length) {
    const marker = jpg[i + 1];
    const length = jpg.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: jpg.readUInt16BE(i + 5), width: jpg.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error("no start-of-frame marker");
}

describe("colour certificate download", () => {
  it("keeps the address that is printed in the book", () => {
    expect(CERTIFICATE_PATH).toBe("/certificate");
    expect(statSync(path.join(process.cwd(), "app", "certificate", "page.tsx")).isFile()).toBe(true);
  });

  it("ships a real one-page US Letter PDF small enough for a phone", () => {
    const pdf = readFileSync(publicFile(CERTIFICATE_PDF));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdf.toString("latin1");
    // 612 x 792 points is 8.5 x 11 inches.
    expect(text).toMatch(/\/MediaBox\s*\[\s*0 0 612 792\s*\]/);
    expect(text.match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(1);
    expect(pdf.length).toBeLessThan(5 * 1024 * 1024);
  });

  it("keeps the 300 DPI artwork inside the PDF", () => {
    const text = readFileSync(publicFile(CERTIFICATE_PDF)).toString("latin1");
    expect(text).toMatch(/\/Width\s+2550/);
    expect(text).toMatch(/\/Height\s+3300/);
  });

  it("ships the preview image the page shows", () => {
    const jpg = readFileSync(publicFile(CERTIFICATE_PREVIEW));
    expect(jpg[0]).toBe(0xff);
    expect(jpg[1]).toBe(0xd8);
  });

  it("keeps the preview at the artwork's shape and the size the page declares", () => {
    // CertificateDownload declares 900 x 1165; a swapped file of another shape would be stretched.
    const { width, height } = jpegSize(readFileSync(publicFile(CERTIFICATE_PREVIEW)));
    expect({ width, height }).toEqual({ width: 900, height: 1165 });
    expect(Math.abs(height / width - 3300 / 2550)).toBeLessThan(0.002);
  });
});
