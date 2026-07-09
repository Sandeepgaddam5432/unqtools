import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { drawSignature } from "./logic";
async function makePdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) doc.addPage([595, 842]); return doc.save(); }
// Minimal 1x1 red PNG
const PNG_1x1 = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD2, 0xFE, 0xCA, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
const baseOpts = { signatureBytes: PNG_1x1, signatureMime: "image/png", page: 1, x: 100, y: 100, width: 200, height: 80 };
describe("drawSignature", () => {
  it("places signature on page 1", async () => { const pdf = await makePdf(3); const r = await drawSignature(pdf, baseOpts); expect(r.ok).toBe(true); if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBe(3); });
  it("places signature on page 2", async () => { const pdf = await makePdf(3); const r = await drawSignature(pdf, { ...baseOpts, page: 2 }); expect(r.ok).toBe(true); });
  it("errors on page 0", async () => { const pdf = await makePdf(2); const r = await drawSignature(pdf, { ...baseOpts, page: 0 }); expect(r.ok).toBe(false); });
  it("errors on page > total", async () => { const pdf = await makePdf(2); const r = await drawSignature(pdf, { ...baseOpts, page: 5 }); expect(r.ok).toBe(false); });
  it("errors on invalid PDF bytes", async () => { const r = await drawSignature(new Uint8Array([1]), baseOpts); expect(r.ok).toBe(false); });
  it("clamps position within page bounds", async () => { const pdf = await makePdf(1); const r = await drawSignature(pdf, { ...baseOpts, x: -50, y: -50, width: 9999, height: 9999 }); expect(r.ok).toBe(true); });
  it("errors on invalid image bytes", async () => { const pdf = await makePdf(1); const r = await drawSignature(pdf, { ...baseOpts, signatureBytes: new Uint8Array([1, 2, 3]) }); expect(r.ok).toBe(false); });
});
