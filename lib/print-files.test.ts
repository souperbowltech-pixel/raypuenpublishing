import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * puenpublishing.com/print/geezy-book1-qr-codes.zip hands the illustrator all
 * seven QR codes for Book 1 as one link, because a zip attached in the Fiverr
 * chat could not be found and forwarded. The codes hold only public addresses.
 */
const ZIP = path.join(process.cwd(), "public", "print", "geezy-book1-qr-codes.zip");

describe("Book 1 QR codes for the illustrator", () => {
  it("ships a zip holding a print file for every printed address", () => {
    const zip = readFileSync(ZIP);
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const names = zip.toString("latin1");
    for (const code of ["Book1_QR_start", "Video_v1_QR", "Video_v2_QR", "Video_v3_QR", "Video_v4_QR", "Video_v5_QR", "Video_v6_QR"]) {
      expect(names).toContain(`Geezy_${code}_PRINT.svg`);
    }
    expect(names).toContain("README_FOR_THE_PRINTER.txt");
  });
});
