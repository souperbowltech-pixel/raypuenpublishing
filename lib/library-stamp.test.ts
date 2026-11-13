import { describe, it, expect } from "vitest";
import { PDFDocument, PDFArray, PDFRawStream, PDFRef, PDFPage, StandardFonts, decodePDFRawStream, degrees } from "pdf-lib";
import { stampPdf, MASTER_MAX_BYTES } from "@/lib/library-stamp";

/**
 * The promise to Ray: the cover stays clean and every inside page carries the
 * reader's name. These tests read the saved file back and look for the text in
 * each page's own drawing instructions.
 */

const STAMP = "REVIEW COPY FOR JANE SMITH. NOT TO BE CIRCULATED";

async function samplePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return doc.save();
}

/** Everything a page draws, decoded, as text. */
function pageDrawing(page: PDFPage): string {
  const contents = page.node.Contents();
  if (!contents) return "";
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  return refs
    .map((ref) => {
      const stream = ref instanceof PDFRef ? page.doc.context.lookup(ref) : ref;
      if (!(stream instanceof PDFRawStream)) return "";
      return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    })
    .join("\n");
}

/** Built-in fonts write text as hex: find the stamp in that form. */
const hexOf = (text: string) => Buffer.from(text, "latin1").toString("hex").toUpperCase();

describe("stampPdf", () => {
  it("leaves the cover alone and names the reader on every inside page", async () => {
    const stamped = await PDFDocument.load(await stampPdf(await samplePdf(3), STAMP));
    const [cover, second, third] = stamped.getPages();
    expect(pageDrawing(cover)).not.toContain(hexOf(STAMP));
    expect(pageDrawing(second)).toContain(hexOf(STAMP));
    expect(pageDrawing(third)).toContain(hexOf(STAMP));
  });

  it("records the stamp in the file's own details too", async () => {
    const stamped = await PDFDocument.load(await stampPdf(await samplePdf(2), STAMP));
    expect(stamped.getSubject()).toBe(STAMP);
  });

  it("keeps every page", async () => {
    const stamped = await PDFDocument.load(await stampPdf(await samplePdf(5), STAMP));
    expect(stamped.getPageCount()).toBe(5);
  });

  it("stamps a one-page file, so no copy ever goes out without a name", async () => {
    const stamped = await PDFDocument.load(await stampPdf(await samplePdf(1), STAMP));
    expect(pageDrawing(stamped.getPage(0))).toContain(hexOf(STAMP));
  });

  it("shrinks a long stamp to fit a small page, inside its edges", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    doc.addPage([300, 400]);
    const long = `REVIEW COPY FOR ${"A".repeat(40)}. NOT TO BE CIRCULATED`;
    const stamped = await PDFDocument.load(await stampPdf(await doc.save(), long));
    const drawing = pageDrawing(stamped.getPage(1));
    expect(drawing).toContain(hexOf(long));
    const size = Number(drawing.match(/([\d.]+) Tf/)![1]);
    expect(size).toBeLessThan(8);
    const [x] = textPosition(drawing);
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(x).toBeGreaterThan(0);
    expect(x + font.widthOfTextAtSize(long, size)).toBeLessThan(300);
    // Centred: the gaps either side match.
    expect(Math.abs(x - (300 - (x + font.widthOfTextAtSize(long, size))))).toBeLessThan(0.01);
  });

  it("refuses a stamp that cannot fit even at the smallest size", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([150, 200]);
    doc.addPage([150, 200]);
    await expect(stampPdf(await doc.save(), STAMP)).rejects.toThrow(/does not fit on page 2/);
  });

  it("places the stamp inside the crop box, the part a reader actually sees", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([684, 864]);
    const page = doc.addPage([684, 864]);
    page.setCropBox(36, 36, 612, 792);
    const stamped = await PDFDocument.load(await stampPdf(await doc.save(), STAMP));
    const drawing = pageDrawing(stamped.getPage(1));
    const [x, y] = textPosition(drawing);
    const size = Number(drawing.match(/([\d.]+) Tf/)![1]);
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(y).toBeGreaterThan(36);
    expect(y).toBeLessThan(60);
    expect(x).toBeGreaterThan(36);
    expect(x + font.widthOfTextAtSize(STAMP, size)).toBeLessThan(36 + 612);
  });

  it("follows a page whose box does not start at zero", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const page = doc.addPage([612, 792]);
    page.setMediaBox(100, 200, 612, 792);
    const stamped = await PDFDocument.load(await stampPdf(await doc.save(), STAMP));
    const [x, y] = textPosition(pageDrawing(stamped.getPage(1)));
    expect(y).toBeGreaterThan(200);
    expect(x).toBeGreaterThan(100);
  });

  it("refuses a rotated page rather than print the name sideways", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.addPage([612, 792]).setRotation(degrees(90));
    await expect(stampPdf(await doc.save(), STAMP)).rejects.toThrow(/page 2 is rotated/);
  });

  it("leaves the cover's drawing exactly as it was", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]).drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    doc.addPage([612, 792]);
    const original = await PDFDocument.load(await doc.save());
    const stamped = await PDFDocument.load(await stampPdf(await doc.save(), STAMP));
    expect(pageDrawing(stamped.getPage(0))).toBe(pageDrawing(original.getPage(0)));
  });

  it("replaces whatever Subject the master had", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    doc.setSubject("Print master");
    const stamped = await PDFDocument.load(await stampPdf(await doc.save(), STAMP));
    expect(stamped.getSubject()).toBe(STAMP);
  });

  it("says plainly when the master is not a PDF", async () => {
    await expect(stampPdf(new TextEncoder().encode("not a pdf"), STAMP)).rejects.toThrow(/not a readable PDF/);
  });

  it("refuses a master far bigger than a reading edition", async () => {
    await expect(stampPdf(new Uint8Array(MASTER_MAX_BYTES + 1), STAMP)).rejects.toThrow(/reading edition/);
  });

  it("refuses an empty stamp rather than send an unnamed copy", async () => {
    await expect(stampPdf(await samplePdf(2), "  ")).rejects.toThrow(/stamp/);
  });

  it("refuses a stamp the font cannot print, with its own clear message", async () => {
    await expect(stampPdf(await samplePdf(2), "REVIEW COPY FOR ΜΑΡΙΑ")).rejects.toThrow(/^stampPdf: .*cannot print/);
  });
});

/** The x and y where the text is drawn, from its text matrix. */
function textPosition(drawing: string): [number, number] {
  const match = drawing.match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
  if (!match) throw new Error("no text matrix found");
  return [Number(match[1]), Number(match[2])];
}
