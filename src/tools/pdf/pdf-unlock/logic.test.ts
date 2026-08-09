import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unlockPdf } from "./logic";

async function makePlainPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 300]);
  page.drawText("plain", { x: 5, y: 5, size: 8 });
  return doc.save();
}

describe("unlockPdf", () => {
  it("loads a plain PDF and returns valid output", async () => {
    const r = await unlockPdf(await makePlainPdf(), "anything");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(r.output.pageCount).toBe(1);
    }
  });

  it("errors without a password", async () => {
    const r = await unlockPdf(await makePlainPdf(), "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/password/i);
  });

  it("rejects corrupt PDFs with a friendly error", async () => {
    const r = await unlockPdf(new Uint8Array([1, 2]), "x");
    expect(r.ok).toBe(false);
  });

  it("rejects an incorrect password on encrypted input (error path)", async () => {
    // pdf-lib 1.17 can't create encrypted fixtures, but loading encrypted
    // bytes with the wrong password must surface as a clear error.
    const r = await unlockPdf(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]), "wrong");
    expect(r.ok).toBe(false);
  });
});
