import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { isPrintableText } from "@/lib/library";

/**
 * Print the reader's line at the foot of every inside page.
 *
 * The cover (page one) is left exactly as designed: Ray asked that the colour
 * cover keep its quality. A file with a single page is stamped anyway, because a
 * copy without a name anywhere would break the promise the whole library makes.
 *
 * The line is placed inside the crop box, the part a viewer or printer actually
 * shows, on a pale band so it stays readable over a full-bleed picture. It
 * shrinks to fit a small page, and the stamping fails loudly rather than send a
 * copy whose name runs off the edge or is drawn sideways.
 *
 * The file's Subject is replaced with the same line, so the name also travels in
 * the document's details.
 */

const FONT_SIZE = 8;
const MIN_FONT_SIZE = 5;
const SIDE_MARGIN = 18;
const BASELINE = 12;
const BAND_PADDING = 3;
/**
 * Reading editions are 10 to 15 MB. A master far past that is a print file
 * uploaded by mistake, and would exhaust the function's memory and time.
 */
export const MASTER_MAX_BYTES = 40 * 1024 * 1024;

export async function stampPdf(master: Uint8Array, text: string): Promise<Uint8Array> {
  if (!text.trim()) throw new Error("stampPdf: the stamp text is empty");
  if (!isPrintableText(text)) throw new Error("stampPdf: the stamp text has a character the PDF font cannot print");
  if (master.byteLength > MASTER_MAX_BYTES) {
    throw new Error(`stampPdf: the master is ${Math.round(master.byteLength / 1048576)} MB; use the reading edition`);
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(master);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "EncryptedPDFError") throw new Error("stampPdf: the master is password-protected");
    throw new Error(`stampPdf: the master is not a readable PDF (${err instanceof Error ? err.message : String(err)})`);
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const inside = pages.length > 1 ? pages.slice(1) : pages;

  inside.forEach((page, index) => {
    const pageNumber = pages.length > 1 ? index + 2 : 1;
    // Placing a line on a turned page needs its own geometry; reading editions are never turned.
    if (page.getRotation().angle % 360 !== 0) {
      throw new Error(`stampPdf: page ${pageNumber} is rotated; make the reading edition again`);
    }

    // pdf-lib falls back to the media box when a page has no crop box.
    const box = page.getCropBox();
    const room = box.width - 2 * SIDE_MARGIN - 2 * BAND_PADDING;
    let size = FONT_SIZE;
    while (size > MIN_FONT_SIZE && font.widthOfTextAtSize(text, size) > room) size -= 0.5;
    const width = font.widthOfTextAtSize(text, size);
    if (width > room) throw new Error(`stampPdf: the stamp does not fit on page ${pageNumber}`);

    const x = box.x + (box.width - width) / 2;
    const y = box.y + BASELINE;
    page.drawRectangle({
      x: x - BAND_PADDING,
      y: y - BAND_PADDING,
      width: width + 2 * BAND_PADDING,
      height: size + 2 * BAND_PADDING,
      color: rgb(1, 1, 1),
      opacity: 0.8,
    });
    page.drawText(text, { x, y, size, font, color: rgb(0.3, 0.3, 0.3) });
  });

  doc.setSubject(text);
  return doc.save();
}
