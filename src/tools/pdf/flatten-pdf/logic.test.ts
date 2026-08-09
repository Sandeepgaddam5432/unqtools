import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFRef } from "pdf-lib";
import { flattenPdf, inspectPdf } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

/** Create a PDF whose first page carries one link annotation. */
async function makeAnnotatedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const dict = PDFDict.withContext(doc.context);
  dict.set(PDFName.of("Type"), PDFName.of("Annot"));
  dict.set(PDFName.of("Subtype"), PDFName.of("Link"));
  const rect = PDFArray.withContext(doc.context);
  for (const n of [0, 0, 10, 10]) rect.push(PDFNumber.of(n));
  dict.set(PDFName.of("Rect"), rect);
  const ref = doc.context.register(dict);
  const annots = PDFArray.withContext(doc.context);
  annots.push(ref);
  page.node.set(PDFName.of("Annots"), annots);
  return doc.save();
}

/** Create a PDF with one text form field. */
async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const tf = doc.getForm().createTextField("name");
  tf.addToPage(doc.getPages()[0]);
  return doc.save();
}

describe("flattenPdf", () => {
  it("preserves page count", async () => {
    const pdf = await makePdf(3);
    const r = await flattenPdf(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(3);
      expect(r.output.pageCount).toBe(3);
    }
  });

  it("drops form fields from source PDF", async () => {
    const pdf = await makePdf(2);
    const r = await flattenPdf(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      const form = doc.getForm();
      expect(form.getFields().length).toBe(0);
    }
  });

  it("preserves source metadata by default", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.setTitle("Original Title");
    const bytes = await doc.save();
    const r = await flattenPdf(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const out = await PDFDocument.load(r.output.bytes);
      expect(out.getTitle()).toBe("Original Title");
    }
  });

  it("errors on invalid bytes", async () => {
    const r = await flattenPdf(new Uint8Array([1]));
    expect(r.ok).toBe(false);
  });

  it("handles single page", async () => {
    const pdf = await makePdf(1);
    const r = await flattenPdf(pdf);
    expect(r.ok).toBe(true);
  });

  it("handles 10 pages", async () => {
    const pdf = await makePdf(10);
    const r = await flattenPdf(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await PDFDocument.load(r.output.bytes)).getPageCount()).toBe(10);
  });
});

describe("flatten advanced (inspect + options)", () => {
  it("inspectPdf counts annotations", async () => {
    const bytes = await makeAnnotatedPdf();
    const reloaded = await PDFDocument.load(bytes);
    const report = inspectPdf(reloaded);
    expect(report.annotations).toBeGreaterThanOrEqual(1);
  });

  it("inspectPdf counts form fields", async () => {
    const bytes = await makeFormPdf();
    const reloaded = await PDFDocument.load(bytes);
    const report = inspectPdf(reloaded);
    expect(report.fields).toBeGreaterThanOrEqual(1);
  });

  it("flatten removes annotations and reports pages", async () => {
    const bytes = await makeAnnotatedPdf();
    const r = await flattenPdf(bytes, { removeFields: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.annotationsRemoved).toBe(1);
      expect(r.output.pagesWithAnnotations).toContain(1);
      const out = await PDFDocument.load(r.output.bytes);
      const page0 = out.getPages()[0]!;
      expect(page0.node.get(PDFName.of("Annots"))).toBeUndefined();
    }
  });

  it("respects removeAnnotations=false", async () => {
    const pdf = await makePdf(2);
    const r = await flattenPdf(pdf, { removeFields: false, removeAnnotations: false, removeJavaScript: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.fieldsRemoved).toBe(0);
  });

  it("strips metadata when asked", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.setTitle("Secret Title");
    const bytes = await doc.save();
    const r = await flattenPdf(bytes, { stripMetadata: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const out = await PDFDocument.load(r.output.bytes);
      expect(out.getTitle() ?? "").toBe("");
      expect(r.output.metadataStripped).toBe(true);
    }
  });

  it("keeps metadata by default", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.setTitle("Keep Me");
    const bytes = await doc.save();
    const r = await flattenPdf(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const out = await PDFDocument.load(r.output.bytes);
      expect(out.getTitle()).toBe("Keep Me");
    }
  });
});
