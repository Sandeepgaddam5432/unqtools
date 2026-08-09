import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractImages, findImageStreams, imageFilename } from "./logic";

const TINY_PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

describe("imageFilename", () => {
  it("builds safe names with correct extensions", () => {
    expect(imageFilename(1, "jpg")).toBe("image-01.jpg");
    expect(imageFilename(3, "png")).toBe("image-03.png");
    expect(imageFilename(2, "unknown")).toBe("image-02.bin");
  });
});

describe("extractImages", () => {
  it("extracts an embedded PNG", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    const img = await doc.embedPng(TINY_PNG);
    page.drawImage(img, { x: 10, y: 10, width: 50, height: 50 });
    const r = await extractImages(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.count).toBeGreaterThanOrEqual(1);
      const img0 = r.output.images[0]!;
      expect(img0.format).toBe("png");
      expect(img0.width).toBeGreaterThan(0);
      expect(img0.bytes.length).toBeGreaterThan(0);
    }
  });

  it("reports when no images exist", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    page.drawText("text only", { x: 10, y: 10, size: 8 });
    const r = await extractImages(await doc.save());
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await extractImages(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});

describe("findImageStreams", () => {
  it("returns empty for a text PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    expect(findImageStreams(doc)).toEqual([]);
  });
});
