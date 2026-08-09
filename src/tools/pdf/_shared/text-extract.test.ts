import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseContentText, readPdfString, extractAllText } from "./text-extract";

describe("readPdfString", () => {
  it("decodes escapes and literals", () => {
    const { str, next } = readPdfString("(Hello \\n World \\(x\\))", 0);
    expect(str).toBe("Hello \n World (x)");
    expect(next).toBe(22); // index just past the closing paren
  });

  it("handles octal escapes", () => {
    const { str } = readPdfString("(\\101\\102)", 0);
    expect(str).toBe("AB");
  });
});

describe("parseContentText", () => {
  it("extracts simple Tj text", () => {
    const bytes = new TextEncoder().encode("BT /F1 12 Tf 72 720 Td (Hello World) Tj ET");
    const lines = parseContentText(bytes);
    expect(lines[0]!.text).toBe("Hello World");
  });

  it("splits lines on Td", () => {
    const bytes = new TextEncoder().encode("BT /F1 12 Tf 72 720 Td (Line one) Tj 0 -20 Td (Line two) Tj ET");
    const lines = parseContentText(bytes);
    expect(lines.map((l) => l.text)).toEqual(["Line one", "Line two"]);
  });

  it("joins TJ arrays", () => {
    const bytes = new TextEncoder().encode("BT /F1 10 Tf 10 10 Td [(A)(B)(C)] Tj ET");
    const lines = parseContentText(bytes);
    expect(lines[0]!.text).toBe("ABC");
  });

  it("records font size from Tf", () => {
    const bytes = new TextEncoder().encode("BT /F2 24 Tf 10 10 Td (Heading) Tj ET");
    const lines = parseContentText(bytes);
    expect(lines[0]!.fontSize).toBe(24);
  });

  it("skips non-text operators", () => {
    const bytes = new TextEncoder().encode("q 1 0 0 rg 0 0 100 100 re f Q BT (text) Tj ET");
    const lines = parseContentText(bytes);
    expect(lines.map((l) => l.text)).toEqual(["text"]);
  });
});

describe("extractAllText", () => {
  it("extracts text from a real pdf-lib document", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]);
    page.drawText("Hello from UnQTools", { x: 50, y: 300, size: 14, font });
    page.drawText("Second line of content", { x: 50, y: 270, size: 12, font });
    const bytes = await doc.save();

    const r = await extractAllText(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pageCount).toBe(1);
      expect(r.fullText).toContain("Hello from UnQTools");
      expect(r.fullText).toContain("Second line");
    }
  });

  it("multi-page extraction", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let p = 0; p < 3; p++) {
      const page = doc.addPage([300, 400]);
      page.drawText(`Page ${p + 1} content`, { x: 40, y: 300, size: 12, font });
    }
    const r = await extractAllText(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pages.length).toBe(3);
      expect(r.pages[2]!).toContain("Page 3");
    }
  });

  it("reports when a PDF has no extractable text", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]); // blank page, no content
    const r = await extractAllText(await doc.save());
    expect(r.ok).toBe(false);
  });
});
