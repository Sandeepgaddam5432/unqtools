import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { viewDocumentInfo } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Report");
  doc.setAuthor("Sandeep");
  for (let i = 0; i < pages; i++) doc.addPage([200, 300]);
  return doc.save();
}

describe("viewDocumentInfo", () => {
  it("reads metadata and page info", async () => {
    const r = await viewDocumentInfo(await makePdf(3));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.info.title).toBe("Report");
      expect(r.output.info.author).toBe("Sandeep");
      expect(r.output.info.pageCount).toBe(3);
      expect(r.output.info.pages.length).toBe(3);
      expect(r.output.info.pages[0]!.width).toBe(200);
      expect(r.output.info.encrypted).toBe(false);
    }
  });

  it("produces valid JSON", async () => {
    const r = await viewDocumentInfo(await makePdf(1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parsed = JSON.parse(r.output.json);
      expect(parsed.pageCount).toBe(1);
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await viewDocumentInfo(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
