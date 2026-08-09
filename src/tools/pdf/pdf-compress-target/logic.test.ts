import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { compressToTargetSize, planTargetCompression, TARGET_LADDER } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("compressToTargetSize (structural path in Node)", () => {
  it("returns valid output for a plain PDF", async () => {
    const pdf = await makePdf(3);
    const r = await compressToTargetSize(pdf, { targetKB: 200 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.compressedSize).toBeLessThanOrEqual(r.output.originalSize);
      expect(r.output.targetKB).toBe(200);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("clamps tiny targets to 20 KB", async () => {
    const pdf = await makePdf(1);
    const r = await compressToTargetSize(pdf, { targetKB: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.targetKB).toBe(20);
  });

  it("strips metadata when asked", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]);
    doc.setTitle("Secret");
    const pdf = await doc.save();
    const r = await compressToTargetSize(pdf, { targetKB: 100, stripMetadata: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const out = await PDFDocument.load(r.output.bytes);
      expect(out.getTitle() ?? "").toBe("");
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await compressToTargetSize(new Uint8Array([1, 2]), { targetKB: 100 });
    expect(r.ok).toBe(false);
  });
});

describe("planTargetCompression", () => {
  it("returns a valid ladder plan", () => {
    const plan = planTargetCompression(200);
    expect(plan.startIndex).toBe(0);
    expect(plan.maxAttempts).toBe(TARGET_LADDER.length);
    expect(TARGET_LADDER.length).toBeGreaterThan(5);
  });
});
