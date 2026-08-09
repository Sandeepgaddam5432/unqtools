import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractText } from "./logic";

async function makePdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  lines.forEach((l, i) => page.drawText(l, { x: 40, y: 340 - i * 24, size: 12, font }));
  return doc.save();
}

describe("extractText", () => {
  it("extracts text from a PDF", async () => {
    const r = await extractText(await makePdf(["Hello world", "Second line"]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pageCount).toBe(1);
      expect(r.output.text).toContain("Hello world");
      expect(r.output.text).toContain("Second line");
      expect(r.output.totalChars).toBeGreaterThan(0);
    }
  });

  it("returns TXT bytes", async () => {
    const r = await extractText(await makePdf(["Just a test"]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const txt = new TextDecoder().decode(r.output.bytes);
      expect(txt).toContain("Just a test");
    }
  });

  it("handles multi-page", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let p = 0; p < 2; p++) {
      const page = doc.addPage([300, 400]);
      page.drawText(`Page ${p + 1}`, { x: 40, y: 300, size: 12, font });
    }
    const r = await extractText(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pages.length).toBe(2);
  });

  it("reports scanned/image PDFs gracefully", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]);
    const r = await extractText(await doc.save());
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await extractText(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
