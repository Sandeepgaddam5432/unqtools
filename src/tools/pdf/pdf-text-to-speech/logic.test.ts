import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prepareTts, speechSupported } from "./logic";

async function makePdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText(text, { x: 40, y: 300, size: 12, font });
  return doc.save();
}

describe("prepareTts", () => {
  it("extracts text for reading", async () => {
    const r = await prepareTts(await makePdf("Hello, this will be read aloud."));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.text).toContain("read aloud");
      expect(r.output.pageCount).toBe(1);
    }
  });

  it("reports speech support (false in Node)", () => {
    expect(speechSupported()).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await prepareTts(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
