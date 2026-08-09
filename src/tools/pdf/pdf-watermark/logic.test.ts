import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addWatermark, anchorPoint } from "./logic";

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

describe("watermark advanced", () => {
  it("supports custom placement anchors", async () => {
    const pdf = await makePdf(1);
    const res = await addWatermark(pdf, {
      text: "TOP", placement: "custom", anchor: "top-right",
      opacity: 0.4, fontSize: 12, color: "#333333",
    });
    expect(res.ok).toBe(true);
  });

  it("supports rotation", async () => {
    const pdf = await makePdf(1);
    const res = await addWatermark(pdf, {
      text: "ROT", placement: "centered", rotateDeg: 90,
      opacity: 0.3, fontSize: 24,
    });
    expect(res.ok).toBe(true);
  });

  it("applies to selected pages only", async () => {
    const pdf = await makePdf(3);
    const res = await addWatermark(pdf, {
      text: "DRAFT", placement: "diagonal", opacity: 0.3, fontSize: 48, pages: "1,3",
    });
    expect(res.ok).toBe(true);
  });

  it("embeds a PNG image watermark", async () => {
    const pdf = await makePdf(1);
    const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const res = await addWatermark(pdf, {
      image: { imageBytes: png, widthPt: 60 },
      placement: "centered",
      opacity: 0.5,
    });
    expect(res.ok).toBe(true);
  });

  it("adds corner-stamp extras", async () => {
    const pdf = await makePdf(2);
    const res = await addWatermark(pdf, {
      text: "CONFIDENTIAL", placement: "diagonal", opacity: 0.25, fontSize: 48,
      extras: [{ text: "© 2026 UnQTools", fontSize: 9, anchor: "bottom-left" }],
    });
    expect(res.ok).toBe(true);
  });

  it("rejects empty text and no image", async () => {
    const pdf = await makePdf(1);
    const res = await addWatermark(pdf, { text: "  ", placement: "centered", opacity: 0.3 });
    expect(res.ok).toBe(false);
  });

  it("anchorPoint places items in corners", async () => {
    
    const tl = anchorPoint("top-left", 595, 842, 100, 20, 24);
    expect(tl.x).toBe(24);
    expect(tl.y).toBe(842 - 24 - 20);
    const br = anchorPoint("bottom-right", 595, 842, 100, 20, 24);
    expect(br.x).toBe(595 - 24 - 100);
    expect(br.y).toBe(24);
    const c = anchorPoint("center", 595, 842, 100, 20, 24);
    expect(c.x).toBe((595 - 100) / 2);
    expect(c.y).toBe((842 - 20) / 2);
  });
});
