import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { splitBySize } from "./logic";

const TINY_PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

/** Image-heavy doc so real file sizes exceed the split target. */
async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([400, 400]);
    for (let j = 0; j < 50; j++) {
      const img = await doc.embedPng(TINY_PNG);
      page.drawImage(img, { x: (j % 10) * 40, y: Math.floor(j / 10) * 40, width: 30, height: 30 });
    }
  }
  return doc.save();
}

describe("splitBySize", () => {
  it("produces at least one part with all pages", async () => {
    const pdf = await makePdf(4);
    const r = await splitBySize(pdf, { targetKB: 1000, baseName: "doc" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.parts.length).toBeGreaterThanOrEqual(1);
      expect(r.output.totalPages).toBe(4);
    }
  });

  it("splits into multiple parts when the target is tiny", async () => {
    const pdf = await makePdf(8);
    const r = await splitBySize(pdf, { targetKB: 10, baseName: "doc" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.parts.length).toBeGreaterThan(1);
      const total = r.output.parts.reduce((acc, p) => acc + p.pageCount, 0);
      expect(total).toBe(8);
    }
  });

  it("names parts sequentially and reports ranges", async () => {
    const pdf = await makePdf(5);
    const r = await splitBySize(pdf, { targetKB: 100, baseName: "report" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.parts[0]!.name).toBe("report-1.pdf");
      expect(r.output.parts[0]!.startPage).toBe(1);
    }
  });

  it("clamps tiny targets", async () => {
    const pdf = await makePdf(2);
    const r = await splitBySize(pdf, { targetKB: 1, baseName: "x" });
    expect(r.ok).toBe(true);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await splitBySize(new Uint8Array([1, 2]), { targetKB: 100, baseName: "x" });
    expect(r.ok).toBe(false);
  });
});
