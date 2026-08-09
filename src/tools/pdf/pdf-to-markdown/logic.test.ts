import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { linesToMarkdown, pdfToMarkdown } from "./logic";
import type { TextLine } from "../_shared/text-extract";

describe("linesToMarkdown", () => {
  it("turns large-font lines into headings", () => {
    const lines: TextLine[] = [
      { text: "Big Title", fontSize: 24 },
      { text: "Normal paragraph text here", fontSize: 12 },
      { text: "More body text", fontSize: 12 },
    ];
    const md = linesToMarkdown(lines, 12);
    expect(md).toContain("## Big Title");
    expect(md).toContain("Normal paragraph text here");
  });

  it("keeps bullet lines", () => {
    const md = linesToMarkdown([{ text: "- item one", fontSize: 12 }, { text: "- item two", fontSize: 12 }], 12);
    expect(md).toContain("- item one");
  });

  it("joins body lines into paragraphs", () => {
    const md = linesToMarkdown([{ text: "A", fontSize: 12 }, { text: "B", fontSize: 12 }], 12);
    expect(md).toContain("A B");
  });
});

describe("pdfToMarkdown", () => {
  it("converts a real PDF to markdown", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]);
    page.drawText("Main heading", { x: 40, y: 320, size: 22, font });
    page.drawText("Body paragraph with several words.", { x: 40, y: 290, size: 12, font });
    const r = await pdfToMarkdown(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.markdown).toContain("Main heading");
      expect(r.output.markdown).toContain("Body paragraph");
      const md = new TextDecoder().decode(r.output.bytes);
      expect(md.length).toBeGreaterThan(0);
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await pdfToMarkdown(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
