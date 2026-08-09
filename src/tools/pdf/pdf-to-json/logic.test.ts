import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfToJson } from "./logic";

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("My Doc");
  doc.setAuthor("Sandeep");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText("Hello JSON world", { x: 40, y: 300, size: 12, font });
  return doc.save();
}

describe("pdfToJson", () => {
  it("extracts metadata and text into JSON", async () => {
    const r = await pdfToJson(await makePdf());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.json.metadata.title).toBe("My Doc");
      expect(r.output.json.metadata.author).toBe("Sandeep");
      expect(r.output.json.metadata.pageCount).toBe(1);
      expect(r.output.json.pages[0]!.text).toContain("Hello JSON world");
      expect(r.output.json.totalWords).toBeGreaterThan(0);
    }
  });

  it("produces valid JSON bytes", async () => {
    const r = await pdfToJson(await makePdf());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parsed = JSON.parse(new TextDecoder().decode(r.output.bytes));
      expect(parsed.pages.length).toBe(1);
      expect(parsed.metadata.title).toBe("My Doc");
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await pdfToJson(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
