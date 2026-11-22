import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
const script = path.resolve("scripts/build-campaign-kit.mjs");
describe("actual Starter Kit assembly", () => {
  it("produces six Letter pages containing exactly the three matching activity sets", async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "puen-kit-test-"));
    const output = path.join(folder, "kit.pdf");
    try {
      const manifest = JSON.parse(execFileSync(process.execPath, [script, "--out", output], { encoding: "utf8" }));
      const pdf = await PDFDocument.load(fs.readFileSync(output));
      expect(pdf.getPageCount()).toBe(6);
      expect(manifest.traits).toEqual(["Purpose", "Fairness", "Sincerity"]);
      expect(manifest.entries).toEqual([2, 3, 4]);
      expect(pdf.getTitle()).toContain("Free Character Starter Kit");
      for (const [index, page] of pdf.getPages().entries()) {
        expect(page.getSize()).toEqual({ width: 612, height: 792 });
        const contents = page.node.Contents();
        const streams = contents instanceof PDFArray
          ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream))
          : contents instanceof PDFRawStream ? [contents] : [];
        const operators = streams.map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1")).join("\n");
        // Embedding a file is insufficient: every actual page must draw its image.
        expect(operators).toMatch(/\/Image-[^\s]+\s+Do/);
        if (index % 2 === 1) {
          for (const heading of ["What it means", "Scripture", "The parable", "The catch", "Parent connection"]) {
            expect(operators).toContain(Buffer.from(heading, "latin1").toString("hex").toUpperCase());
          }
          const fragments = [["Knowing that God", "Just like that dusty"], ["Giving everyone", "Samuel saw David"], ["Doing things with", "Tobi's picture"]];
          for (const fragment of fragments[Math.floor(index / 2)]) {
            expect(operators).toContain(Buffer.from(fragment, "latin1").toString("hex").toUpperCase());
          }
        }
      }
    } finally { if (fs.existsSync(output)) fs.unlinkSync(output); fs.rmdirSync(folder); }
  });
  it("fails before writing a broken PDF when source artwork is missing", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "puen-kit-missing-"));
    const output = path.join(folder, "kit.pdf");
    try {
      expect(() => execFileSync(process.execPath, [script, "--out", output, "--coloring-dir", folder], { stdio: "pipe" })).toThrow();
      expect(fs.existsSync(output)).toBe(false);
    } finally { if (fs.existsSync(output)) fs.unlinkSync(output); fs.rmdirSync(folder); }
  });
});
