/** Build a six-page free kit from the canonical sample entries, without evaluating TS. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const output = option("--out");
if (!output) throw new Error("Provide --out <absolute PDF path>, outside public/.");
const outputPath = path.resolve(output);
const publicPath = path.join(root, "public") + path.sep;
if (outputPath.toLowerCase().startsWith(publicPath.toLowerCase())) throw new Error("The kit must remain outside public/.");
const artFolder = option("--coloring-dir") ? path.resolve(option("--coloring-dir")) : path.join(root, "public", "neighborhood");
const source = ts.createSourceFile("neighborhood.ts", fs.readFileSync(path.join(root, "lib", "neighborhood.ts"), "utf8"), ts.ScriptTarget.Latest, true);
let declaration;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "SAMPLE_ENTRIES") declaration = node;
  ts.forEachChild(node, visit);
}
visit(source);
function literal(node) {
  if (ts.isAsExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((property) => {
    if (!ts.isPropertyAssignment(property)) throw new Error("Unsupported sample property.");
    return [property.name.getText(source).replace(/^['"]|['"]$/g, ""), literal(property.initializer)];
  }));
  throw new Error("Sample data must contain literal values only.");
}
if (!declaration?.initializer) throw new Error("Canonical sample entries are missing.");
const entries = literal(declaration.initializer);
if (entries.length !== 3 || entries.map((e) => e.entry).join(",") !== "2,3,4") throw new Error("Review the three sample entries before changing the kit.");
const pdf = await PDFDocument.create();
const regular = await pdf.embedFont(StandardFonts.TimesRoman);
const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
const clean = (value) => String(value).replace(/[\u2013\u2014]/g, ", ").replace(/\s+/g, " ").trim();
function lines(text, font, size, width) {
  const out = []; let line = "";
  for (const word of clean(text).split(" ")) {
    const next = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; }
    else line = next;
    if (font.widthOfTextAtSize(line, size) > width) throw new Error("An unbreakable word exceeds the Guide column.");
  }
  if (line) out.push(line); return out;
}
for (const entry of entries) {
  const coloring = pdf.addPage([612, 792]);
  const art = await pdf.embedJpg(fs.readFileSync(path.join(artFolder, `page-${entry.page}.jpg`)));
  const scale = Math.min(576 / art.width, 756 / art.height);
  coloring.drawImage(art, { x: (612 - art.width * scale) / 2, y: (792 - art.height * scale) / 2,
    width: art.width * scale, height: art.height * scale });
  const guide = pdf.addPage([612, 792]);
  guide.drawText("The Neighborhood Chronicles: David and Goliath", { x: 40, y: 752, size: 12, font: regular });
  guide.drawText(`Parent's Guide: ${entry.trait}`, { x: 40, y: 722, size: 24, font: bold });
  guide.drawText(`Activity ${entry.entry} / ${entry.badge}`, { x: 40, y: 697, size: 12, font: regular });
  const badge = await pdf.embedPng(fs.readFileSync(path.join(root, "public", "neighborhood", `badge-${entry.entry}.png`)));
  const badgeSize = badge.scaleToFit(64, 72);
  guide.drawImage(badge, { x: 508, y: 675, width: badgeSize.width, height: badgeSize.height });
  let y = 657;
  const section = (heading, body) => {
    guide.drawText(heading, { x: 40, y, size: 14, font: bold }); y -= 19;
    for (const line of lines(body, regular, 13, 532)) {
      if (y < 46) throw new Error(`Guide text overflows for ${entry.trait}; do not silently truncate it.`);
      guide.drawText(line, { x: 40, y, size: 13, font: regular, color: rgb(0.1, 0.1, 0.1) }); y -= 17.5;
    }
    y -= 10;
  };
  section("What it means", entry.whatItMeans);
  section("Scripture", `${entry.scripture.text} (${entry.scripture.reference})`);
  section("The parable", entry.parable);
  section("The catch", entry.theCatch);
  section("Parent connection", entry.parentConnection);
  guide.drawText("Free family activity / Puen Publishing / Print the matching badge above", { x: 40, y: 25, size: 9, font: regular });
}
pdf.setTitle("The Neighborhood Chronicles: Free Character Starter Kit");
pdf.setAuthor("Puen Publishing");
pdf.setSubject("Three coloring activities and three matching Parent's Guide pages with badges");
const bytes = await pdf.save();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, bytes);
console.log(JSON.stringify({ output: outputPath, pages: pdf.getPageCount(), bytes: bytes.length,
  traits: entries.map((e) => e.trait), entries: entries.map((e) => e.entry) }));
