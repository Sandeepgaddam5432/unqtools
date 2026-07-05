import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addWatermark } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return doc.save();
}

describe("addWatermark", () => {
  it("adds a diagonal watermark to all pages", async () => {
    const pdf = await makePdf(2);
    const res = await addWatermark(pdf, {
      text: "DRAFT", placement: "diagonal", opacity: 0.3, fontSize: 48, color: "#808080",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = await PDFDocument.load(res.output);
      expect(doc.getPageCount()).toBe(2);
    }
  });

  it("adds a tiled watermark", async () => {
    const pdf = await makePdf(1);
    const res = await addWatermark(pdf, {
      text: "CONFIDENTIAL", placement: "tiled", opacity: 0.2, fontSize: 24, color: "#ff0000",
    });
    expect(res.ok).toBe(true);
  });

  it("adds a centered watermark", async () => {
    const pdf = await makePdf(1);
    const res = await addWatermark(pdf, {
      text: "SAMPLE", placement: "centered", opacity: 0.5, fontSize: 60, color: "#000000",
    });
    expect(res.ok).toBe(true);
  });

  it("watermarks only specified pages", async () => {
    const pdf = await makePdf(4);
    const res = await addWatermark(pdf, {
      text: "TOP SECRET", placement: "diagonal", opacity: 0.4, fontSize: 36, color: "#000080",
      pages: "2-3",
    });
    expect(res.ok).toBe(true);
  });

  it("errors on empty text", async () => {
    const pdf = await makePdf(1);
    const res = await addWatermark(pdf, {
      text: "  ", placement: "diagonal", opacity: 0.3, fontSize: 48, color: "#808080",
    });
    expect(res.ok).toBe(false);
  });

  it("errors on invalid page spec", async () => {
    const pdf = await makePdf(2);
    const res = await addWatermark(pdf, {
      text: "DRAFT", placement: "diagonal", opacity: 0.3, fontSize: 48, color: "#808080",
      pages: "99",
    });
    expect(res.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const res = await addWatermark(new Uint8Array([1, 2, 3]), {
      text: "DRAFT", placement: "diagonal", opacity: 0.3, fontSize: 48, color: "#808080",
    });
    expect(res.ok).toBe(false);
  });
});
