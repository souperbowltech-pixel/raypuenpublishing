import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
const script = path.resolve("scripts/build-campaign-kit.mjs");
function operators(page: ReturnType<PDFDocument["getPage"]>) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream))
    : contents instanceof PDFRawStream ? [contents] : [];
  return streams.map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1")).join("\n");
}
async function checkBadgeSheet(pdf: PDFDocument) {
  expect(pdf.getPageCount()).toBe(7);
  const sheet = pdf.getPage(6);
  const content = operators(sheet);
  const draws = [...content.matchAll(/q\s+((?:[-\d. ]+ cm\s+)+)\/(Image-[^\s]+)\s+Do\s+Q/g)];
  expect(draws).toHaveLength(3);
  const source = await PDFDocument.create();
  const expected = await Promise.all([2, 3, 4].map((entry) => source.embedPng(fs.readFileSync(path.resolve(`public/neighborhood/badge-${entry}.png`)))));
  await source.flush();
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const [i, draw] of draws.entries()) {
    const image = sheet.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).lookup(PDFName.of(draw[2]));
    const original = source.context.lookup(expected[i].ref);
    if (!(image instanceof PDFRawStream) || !(original instanceof PDFRawStream)) throw new Error("Badge must be an actual image stream");
    expect(image.dict.get(PDFName.of("Subtype"))).toEqual(PDFName.of("Image"));
    expect(Buffer.from(decodePDFRawStream(image).decode())).toEqual(Buffer.from(decodePDFRawStream(original).decode()));
    for (const key of ["Width", "Height", "ColorSpace", "BitsPerComponent"]) {
      expect(image.dict.get(PDFName.of(key))).toEqual(original.dict.get(PDFName.of(key)));
    }
    const matrices = [...draw[1].matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)];
    const x = Number(matrices[0][5]), y = Number(matrices[0][6]);
    const width = Number(matrices[2][1]), height = Number(matrices[2][4]);
    expect(width).toBeGreaterThanOrEqual(100);
    expect(height).toBeGreaterThanOrEqual(100);
    expect(width / height).toBeCloseTo(expected[i].width / expected[i].height, 5);
    expect(x).toBeGreaterThanOrEqual(36);
    expect(y).toBeGreaterThanOrEqual(36);
    expect(x + width).toBeLessThanOrEqual(576);
    expect(y + height).toBeLessThanOrEqual(756);
    boxes.push({ x, y, width, height });
    expect(content).toContain(Buffer.from(`Matches Activity ${i + 2}`).toString("hex").toUpperCase());
  }
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].x - (boxes[i - 1].x + boxes[i - 1].width)).toBeGreaterThanOrEqual(16);
  }
}
describe("actual Starter Kit assembly", () => {
  it("produces seven Letter pages containing the three matching activity sets and cut-out badges", async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "puen-kit-test-"));
    const output = path.join(folder, "nested folder", "kit.pdf");
    try {
      const manifest = JSON.parse(execFileSync(process.execPath, [script, "--out", output], { encoding: "utf8" }));
      const pdf = await PDFDocument.load(fs.readFileSync(output));
      expect(pdf.getPageCount()).toBe(7);
      expect(manifest.pages).toBe(7);
      await checkBadgeSheet(pdf);
      expect(manifest.traits).toEqual(["Purpose", "Fairness", "Sincerity"]);
      expect(manifest.entries).toEqual([2, 3, 4]);
      expect(pdf.getTitle()).toContain("Free Character Starter Kit");
      for (const [index, page] of pdf.getPages().entries()) {
        expect(page.getSize()).toEqual({ width: 612, height: 792 });
        const content = operators(page);
        // Embedding a file is insufficient: every actual page must draw its image.
        expect(content).toMatch(/\/Image-[^\s]+\s+Do/);
        if (index % 2 === 1) {
          for (const heading of ["What it means", "Scripture", "The parable", "The catch", "Parent connection"]) {
            expect(content).toContain(Buffer.from(heading, "latin1").toString("hex").toUpperCase());
          }
          const fragments = [["Knowing that God", "Just like that dusty"], ["Giving everyone", "Samuel saw David"], ["Doing things with", "Tobi's picture"]];
          for (const fragment of fragments[Math.floor(index / 2)]) {
            expect(content).toContain(Buffer.from(fragment, "latin1").toString("hex").toUpperCase());
          }
        }
      }
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it("fails before writing a broken PDF when source artwork is missing", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "puen-kit-missing-"));
    const output = path.join(folder, "kit.pdf");
    try {
      expect(() => execFileSync(process.execPath, [script, "--out", output, "--coloring-dir", folder], { stdio: "pipe" })).toThrow();
      expect(fs.existsSync(output)).toBe(false);
    } finally { if (fs.existsSync(output)) fs.unlinkSync(output); fs.rmdirSync(folder); }
  });
  it.each(["missing", "corrupt"])("rejects a %s final badge without writing or replacing the kit", (failure) => {
    // Isolate real source files and run the real CLI, without altering repository assets.
    const data = path.resolve("data");
    fs.mkdirSync(data, { recursive: true });
    const folder = fs.mkdtempSync(path.join(data, "kit-fixture-"));
    const output = path.join(folder, "kit.pdf");
    try {
      for (const directory of ["scripts", "lib", "public/neighborhood"]) {
        fs.mkdirSync(path.join(folder, directory), { recursive: true });
      }
      fs.copyFileSync(script, path.join(folder, "scripts/build-campaign-kit.mjs"));
      fs.copyFileSync(path.resolve("lib/neighborhood.ts"), path.join(folder, "lib/neighborhood.ts"));
      for (const name of ["page-3.jpg", "page-4.jpg", "page-5.jpg", "badge-2.png", "badge-3.png"]) {
        fs.copyFileSync(path.resolve("public/neighborhood", name), path.join(folder, "public/neighborhood", name));
      }
      if (failure === "corrupt") fs.writeFileSync(path.join(folder, "public/neighborhood/badge-4.png"), "invalid PNG");
      for (const existing of [false, true]) {
        const previous = Buffer.from("previous approved PDF");
        if (existing) fs.writeFileSync(output, previous);
        expect(() => execFileSync(process.execPath, [path.join(folder, "scripts/build-campaign-kit.mjs"), "--out", output], { stdio: "pipe" })).toThrow();
        if (existing) expect(fs.readFileSync(output)).toEqual(previous);
        else expect(fs.existsSync(output)).toBe(false);
      }
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it("refuses an output under public before creating a downloadable kit", () => {
    const output = path.resolve("public/campaign-kit-must-not-exist.pdf");
    expect(fs.existsSync(output)).toBe(false);
    expect(() => execFileSync(process.execPath, [script, "--out", output], { stdio: "pipe" })).toThrow("outside public/");
    expect(fs.existsSync(output)).toBe(false);
  });
});
