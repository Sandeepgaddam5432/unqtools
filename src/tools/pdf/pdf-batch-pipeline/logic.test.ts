import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { runBatch } from "./logic";

async function makePdf(pages: number, meta = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  if (meta) doc.setTitle("Batch");
  return doc.save();
}

describe("runBatch", () => {
  it("rotates multiple files", async () => {
    const files = [
      { name: "a.pdf", bytes: await makePdf(2) },
      { name: "b.pdf", bytes: await makePdf(3) },
    ];
    const r = await runBatch(files, { op: "rotate", rotation: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.length).toBe(2);
      expect(r.output.every((f) => f.ok)).toBe(true);
      const doc = await PDFDocument.load(r.output[0]!.bytes!);
      expect(doc.getPages()[0].getRotation().angle).toBe(90);
    }
  });

  it("strips metadata from multiple files", async () => {
    const r = await runBatch([{ name: "a.pdf", bytes: await makePdf(1, true) }], { op: "strip-metadata" });
    expect(r.ok).toBe(true);
    if (r.ok && r.output[0]!.ok) {
      const doc = await PDFDocument.load(r.output[0]!.bytes!);
      expect(doc.getTitle() ?? "").toBe("");
    }
  });

  it("compresses multiple files", async () => {
    const r = await runBatch(
      [
        { name: "a.pdf", bytes: await makePdf(2) },
        { name: "b.pdf", bytes: await makePdf(1) },
      ],
      { op: "compress", compress: { stripMetadata: true } }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.every((f) => f.ok)).toBe(true);
  });

  it("watermarks multiple files", async () => {
    const r = await runBatch([{ name: "a.pdf", bytes: await makePdf(1) }], { op: "watermark", watermarkText: "DRAFT" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output[0]!.ok).toBe(true);
  });

  it("reports per-file errors without failing the batch", async () => {
    const r = await runBatch(
      [
        { name: "good.pdf", bytes: await makePdf(1) },
        { name: "bad.pdf", bytes: new Uint8Array([1, 2]) },
      ],
      { op: "rotate" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output[0]!.ok).toBe(true);
      expect(r.output[1]!.ok).toBe(false);
    }
  });

  it("errors without files or op", async () => {
    expect((await runBatch([], { op: "rotate" })).ok).toBe(false);
    expect((await runBatch([{ name: "a", bytes: new Uint8Array() }], { op: "" as never })).ok).toBe(false);
  });
});

void PDFName;
