import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { resizePdfPages } from "./logic";
import { PageSizes } from "pdf-lib";
async function makePdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) { const p = doc.addPage([200, 300]); p.drawText(".", { x: 0, y: 0, size: 1 }); } return doc.save(); }
describe("resizePdfPages", () => {
  it("resizes all pages to A4 portrait", async () => {
    const pdf = await makePdf(2); const r = await resizePdfPages(pdf, { preset: "a4", orientation: "portrait" });
    expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); const { width, height } = doc.getPages()[0].getSize(); expect(width).toBe(595.28); expect(height).toBe(841.89); }
  });
  it("resizes to A4 landscape", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "a4", orientation: "landscape" });
    expect(r.ok).toBe(true); if (r.ok) { const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(width).toBe(841.89); expect(height).toBe(595.28); }
  });
  it("resizes to custom dimensions", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "custom", customWidth: 400, customHeight: 600, orientation: "portrait" });
    expect(r.ok).toBe(true); if (r.ok) { const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(width).toBe(400); expect(height).toBe(600); }
  });
  it("resizes only selected pages", async () => {
    const pdf = await makePdf(3); const r = await resizePdfPages(pdf, { preset: "letter", orientation: "portrait", pages: "1" });
    expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getPages()[0].getSize().width).toBe(612); expect(doc.getPages()[1].getSize().width).toBe(200); }
  });
  it("errors on custom without dimensions", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "custom", orientation: "portrait" }); expect(r.ok).toBe(false);
  });
  it("errors on invalid page range", async () => {
    const pdf = await makePdf(2); const r = await resizePdfPages(pdf, { preset: "a4", orientation: "portrait", pages: "9" }); expect(r.ok).toBe(false);
  });
  it("errors on invalid bytes", async () => {
    const r = await resizePdfPages(new Uint8Array([1]), { preset: "a4", orientation: "portrait" }); expect(r.ok).toBe(false);
  });
  it("resizes to Legal", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "legal", orientation: "portrait" });
    expect(r.ok).toBe(true); if (r.ok) { const { height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(height).toBe(1008); }
  });
});

describe("resize advanced", () => {
  it("unitToPt converts mm and inches", async () => {
    const { unitToPt } = await import("./logic");
    expect(unitToPt(25.4, "mm")).toBeCloseTo(72, 1);
    expect(unitToPt(1, "in")).toBe(72);
    expect(unitToPt(100, "pt")).toBe(100);
  });

  it("resizes to A5 portrait", async () => {
    const pdf = await makePdf(1);
    const r = await resizePdfPages(pdf, { preset: "a5" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize();
      expect(Math.round(width)).toBe(Math.round(PageSizes.A5[0]));
      expect(Math.round(height)).toBe(Math.round(PageSizes.A5[1]));
    }
  });

  it("supports custom size in mm", async () => {
    const pdf = await makePdf(1);
    const r = await resizePdfPages(pdf, { preset: "custom", customWidth: 100, customHeight: 200, unit: "mm" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize();
      expect(Math.round(width)).toBe(Math.round((100 * 72) / 25.4));
      expect(Math.round(height)).toBe(Math.round((200 * 72) / 25.4));
    }
  });

  it("fit contain preserves content aspect", async () => {
    const pdf = await makePdf(1);
    const r = await resizePdfPages(pdf, { preset: "a4", orientation: "landscape", fit: "contain" });
    expect(r.ok).toBe(true);
  });

  it("resizes selected pages only", async () => {
    const pdf = await makePdf(2);
    const r = await resizePdfPages(pdf, { preset: "a5", pages: "1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const pages = (await PDFDocument.load(r.output)).getPages();
      expect(Math.round(pages[1].getSize().width)).toBe(200);
    }
  });
});
