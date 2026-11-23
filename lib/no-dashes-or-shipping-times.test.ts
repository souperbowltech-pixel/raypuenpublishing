import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const repo = path.resolve(__dirname, "..");
const sourceDirs = ["app", "components", "lib"];
const temporaryDirs: string[] = [];

function sourceFiles(root: string): string[] {
  return sourceDirs.flatMap((dir) =>
    (fs.readdirSync(path.join(root, dir), { recursive: true }) as string[])
      .filter((file) => /\.(?:[cm]?[jt]sx?|css|json|md)$/.test(file))
      .map((file) => path.join(dir, file).split(path.sep).join("/"))
  );
}

function dashViolations(root: string): string[] {
  return sourceFiles(root).flatMap((file) =>
    fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/)
      .flatMap((line, index) => /[\u2013\u2014]/u.test(line) ? [`${file}:${index + 1}`] : [])
  );
}

function businessDaysInCopy(file: string, text: string): boolean {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const copy: string[] = [];
  const visit = (node: ts.Node) => {
    // The parser excludes comments and decodes JavaScript string escapes.
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      copy.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  // Joining also covers copy split over nested JSX tags or string fragments.
  return /\bbusiness\s+days\b/i.test(copy.join(" ").replace(/&(?:nbsp|#0*32|#x0*20);/gi, " "));
}

function shippingViolations(root: string): string[] {
  return sourceFiles(root)
    .filter((file) => /\.[jt]sx?$/.test(file) && !/\.(?:test|spec)\.[jt]sx?$/.test(file))
    .filter((file) => businessDaysInCopy(file, fs.readFileSync(path.join(root, file), "utf8")));
}

function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puen-copy-"));
  temporaryDirs.push(root);
  for (const dir of sourceDirs) fs.mkdirSync(path.join(root, dir));
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryDirs.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("source copy regression guards", () => {
  it("contains no em or en dashes in app, components or lib, including comments and tests", () => {
    expect(dashViolations(repo)).toEqual([]);
  });

  it("contains no business days in production copy", () => {
    expect(shippingViolations(repo)).toEqual([]);
  });

  it("accepts empty folders and ordinary punctuation without treating returns as shipping", () => {
    expect(dashViolations(fixture({}))).toEqual([]);
    const root = fixture({
      "lib/book.ts": 'export const copy = "Printed for you and sent to the address you gave. Returns within 30 days.";',
      "app/globals.css": "/* Plain punctuation: commas, brackets (and semicolons); */",
    });
    expect(dashViolations(root)).toEqual([]);
    expect(shippingViolations(root)).toEqual([]);
  });

  it("reports both prohibited characters in nested code, comments, CSS and tests with line numbers", () => {
    const root = fixture({
      "app/nested/page.tsx": 'export const title = "Books\u2014stories";\r\n// Ages 3\u20137',
      "components/card.test.tsx": '// Regression\u2014fixture',
      "lib/nested/style.css": "/* palette\u2013note */",
    });
    expect(dashViolations(root).sort()).toEqual([
      "app/nested/page.tsx:1", "app/nested/page.tsx:2",
      "components/card.test.tsx:1", "lib/nested/style.css:1",
    ]);
  });

  it.each([
    ['export const shipping = "Within 2 business days";', "lib/book.ts"],
    ['export const shipping = `Within ${count} BUSINESS\\nDAYS`;', "lib/book.ts"],
    ['export const shipping = "business\\u0020days";', "lib/book.ts"],
    ["export default () => <p>Within 2 business\n days</p>;", "app/page.tsx"],
    ["export default () => <p>business <strong>days</strong></p>;", "components/card.tsx"],
    ["export default () => <p>business&nbsp;days</p>;", "components/card.tsx"],
    ['export const shipping = "business " + "days";', "lib/book.ts"],
  ])("rejects a shipping-time regression in visible copy: %s", (copy, file) => {
    expect(shippingViolations(fixture({ [file]: copy }))).toEqual([file]);
  });

  it("ignores historical comments and test assertions for shipping copy", () => {
    const root = fixture({
      "lib/book.ts": '// Never promise business days.\nexport const note = "Printed to order.";',
      "app/page.tsx": 'export default () => <p>{/* No business days */}Printed to order.</p>;',
      "components/card.test.tsx": 'expect(html).not.toContain("business days");',
    });
    expect(shippingViolations(root)).toEqual([]);
  });

  it("fails on a missing source folder instead of silently passing an incomplete scan", () => {
    const root = fixture({});
    fs.rmdirSync(path.join(root, "lib"));
    expect(() => dashViolations(root)).toThrow(/ENOENT/);
    expect(() => shippingViolations(root)).toThrow(/ENOENT/);
  });
});
