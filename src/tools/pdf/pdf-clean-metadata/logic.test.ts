import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { cleanMetadata, inspectMetadata, META_FIELDS } from "./logic";

async function makePdf(meta = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 300]);
  page.drawText("hi", { x: 5, y: 5, size: 8 });
  if (meta) {
    doc.setTitle("Secret Title");
    doc.setAuthor("Secret Author");
    doc.setSubject("Top Secret");
    doc.setKeywords(["kw"]);
    doc.setCreator("UnQTools");
    doc.setProducer("UnQTools");
  }
  return doc.save();
}

describe("inspectMetadata", () => {
  it("detects present fields", async () => {
    const doc = await PDFDocument.load(await makePdf(true));
    const info = inspectMetadata(doc);
    expect(info.fields).toContain("Title");
    expect(info.fields).toContain("Author");
    expect(info.infoPresent).toBe(true);
  });

  it("finds no user metadata on a clean PDF (only pdf-lib defaults)", async () => {
    const doc = await PDFDocument.load(await makePdf(false));
    const info = inspectMetadata(doc);
    // pdf-lib always stamps Creator/Producer; user fields must be absent.
    expect(info.fields).not.toContain("Title");
    expect(info.fields).not.toContain("Author");
    expect(info.fields.length).toBeLessThanOrEqual(2);
  });
});

describe("cleanMetadata", () => {
  it("wipes all metadata fields", async () => {
    const r = await cleanMetadata(await makePdf(true));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getTitle() ?? "").toBe("");
      expect(doc.getAuthor() ?? "").toBe("");
      expect(doc.getSubject() ?? "").toBe("");
      expect((doc.getKeywords() ?? []).length).toBe(0);
      expect(r.output.fieldsRemoved.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps page count", async () => {
    const r = await cleanMetadata(await makePdf(true));
    expect(r.ok).toBe(true);
    if (r.ok) expect((await PDFDocument.load(r.output.bytes)).getPageCount()).toBe(1);
  });

  it("reports size savings", async () => {
    const r = await cleanMetadata(await makePdf(true));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.cleanedSize).toBeLessThanOrEqual(r.output.originalSize);
  });

  it("handles a PDF with no user metadata", async () => {
    const r = await cleanMetadata(await makePdf(false));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.fieldsRemoved).not.toContain("Title");
  });

  it("rejects corrupt PDFs", async () => {
    const r = await cleanMetadata(new Uint8Array([1, 2, 3]));
    expect(r.ok).toBe(false);
  });
});

describe("META_FIELDS", () => {
  it("covers the standard six", () => {
    expect(META_FIELDS).toEqual(["Title", "Author", "Subject", "Keywords", "Creator", "Producer"]);
  });
});
