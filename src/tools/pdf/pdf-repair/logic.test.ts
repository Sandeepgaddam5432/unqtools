import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { repairPdf } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 300]);
  return doc.save();
}

describe("repairPdf", () => {
  it("round-trips a healthy PDF", async () => {
    const r = await repairPdf(await makePdf(3));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pageCount).toBe(3);
      expect(r.output.notes.length).toBeGreaterThan(0);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("recovers a PDF with junk appended", async () => {
    const clean = await makePdf(2);
    const junk = new Uint8Array([...clean, 0x0a, 0x0a, ...new TextEncoder().encode("garbage trailer junk")]);
    const r = await repairPdf(junk);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageCount).toBe(2);
  });

  it("rejects hopeless bytes", async () => {
    const r = await repairPdf(new Uint8Array([1, 2, 3]));
    expect(r.ok).toBe(false);
  });
});
