import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PAGE_STICKER_META } from "@/lib/stickers";
import { STICKER_SLOT_COUNT } from "@/lib/gamification";

export const dynamic = "force-dynamic";

// US Letter (8.5" x 11") in PDF points (72 pt per inch).
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const COLS = 4;
const ROWS = 5; // 4 x 5 = 20 cells, 19 used
const TITLE_BAND = 64;

/**
 * "Download Master Sticker Sheet" (Module A) — streams a print-ready PDF with all
 * 19 merit badges laid out on a single Letter page for home-printing onto adhesive
 * paper. Real badge PNGs live in public/stickers (slot-01.png … slot-19.png);
 * any not yet delivered render as a clean numbered placeholder.
 */
export async function GET() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const ink = rgb(0.17, 0.13, 0.09);
  const soft = rgb(0.4, 0.36, 0.32);

  // Title
  const title = "The Geezy Goober — Master Sticker Sheet";
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 14,
    size: 15,
    font: fontBold,
    color: ink,
  });
  page.drawText("Cut out and stick your 19 virtue merit badges!", {
    x: MARGIN,
    y: PAGE_H - MARGIN - 32,
    size: 9,
    font,
    color: soft,
  });

  const gridTop = PAGE_H - MARGIN - TITLE_BAND;
  const gridH = gridTop - MARGIN;
  const cellW = (PAGE_W - 2 * MARGIN) / COLS;
  const cellH = gridH / ROWS;
  const badge = Math.min(cellW, cellH) - 34; // leave room for the caption

  const stickersDir = path.join(process.cwd(), "public", "stickers");

  for (let i = 0; i < STICKER_SLOT_COUNT; i++) {
    const slot = i + 1;
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const cellX = MARGIN + col * cellW;
    const cellTop = gridTop - row * cellH;
    const badgeX = cellX + (cellW - badge) / 2;
    const badgeY = cellTop - badge - 6;

    let drawn = false;
    try {
      const file = path.join(stickersDir, `slot-${String(slot).padStart(2, "0")}.png`);
      if (fs.existsSync(file)) {
        const img = await pdf.embedPng(fs.readFileSync(file));
        page.drawImage(img, { x: badgeX, y: badgeY, width: badge, height: badge });
        drawn = true;
      }
    } catch {
      // fall through to placeholder
    }

    if (!drawn) {
      // Numbered placeholder circle-ish box until the real badge is delivered
      page.drawRectangle({
        x: badgeX,
        y: badgeY,
        width: badge,
        height: badge,
        borderColor: soft,
        borderWidth: 1,
        color: rgb(0.95, 0.94, 0.91),
      });
      const numStr = String(slot);
      const numW = fontBold.widthOfTextAtSize(numStr, 20);
      page.drawText(numStr, {
        x: badgeX + (badge - numW) / 2,
        y: badgeY + badge / 2 - 8,
        size: 20,
        font: fontBold,
        color: soft,
      });
    }

    // Caption: page number + virtue
    const meta = PAGE_STICKER_META[i];
    const label = meta ? `${slot}. ${meta.virtue}` : `${slot}`;
    const labelSize = 7.5;
    const labelW = font.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: cellX + (cellW - labelW) / 2,
      y: badgeY - 11,
      size: labelSize,
      font,
      color: ink,
    });
  }

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="geezy-goober-sticker-sheet.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
