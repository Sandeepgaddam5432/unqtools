import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addStamp } from "./logic";
async function makePdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) doc.addPage([595, 842]); return doc.save(); }
const baseOpts = { text: "APPROVED", includeDate: false, fontSize: 24, color: "red", position: "center" as const, rotation: 0 as const };
describe("addStamp", () => {
  it("adds stamp to all pages", async () => { const pdf = await makePdf(3); const r = await addStamp(pdf, baseOpts); expect(r.ok).toBe(true); if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBe(3); });
  it("adds stamp to selected pages only", async () => { const pdf = await makePdf(3); const r = await addStamp(pdf, { ...baseOpts, pages: "2" }); expect(r.ok).toBe(true); });
  it("appends date when includeDate is true", async () => { const pdf = await makePdf(1); const r = await addStamp(pdf, { ...baseOpts, includeDate: true }); expect(r.ok).toBe(true); });
  it("errors on empty text", async () => { const pdf = await makePdf(1); const r = await addStamp(pdf, { ...baseOpts, text: "" }); expect(r.ok).toBe(false); });
  it("errors on invalid page range", async () => { const pdf = await makePdf(2); const r = await addStamp(pdf, { ...baseOpts, pages: "9" }); expect(r.ok).toBe(false); });
  it("errors on invalid bytes", async () => { const r = await addStamp(new Uint8Array([1]), baseOpts); expect(r.ok).toBe(false); });
  it("handles all position options", async () => { const pdf = await makePdf(6); const positions = ["top-left","top-center","top-right","center","bottom-left","bottom-right"] as const; for (const p of positions) { const r = await addStamp(pdf, { ...baseOpts, position: p }); expect(r.ok).toBe(true); } });
  it("handles rotation -45", async () => { const pdf = await makePdf(1); const r = await addStamp(pdf, { ...baseOpts, rotation: -45 }); expect(r.ok).toBe(true); });
  it("handles custom fontSize", async () => { const pdf = await makePdf(1); const r = await addStamp(pdf, { ...baseOpts, fontSize: 48 }); expect(r.ok).toBe(true); });
});
