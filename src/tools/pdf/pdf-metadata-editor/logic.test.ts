import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { readPdfMetadata, writePdfMetadata } from "./logic";

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle("Original Title");
  doc.setAuthor("Test Author");
  return doc.save();
}

describe("readPdfMetadata", () => {
  it("reads metadata from a PDF", async () => {
    const pdf = await makePdf();
    const res = await readPdfMetadata(pdf);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.metadata.title).toBe("Original Title");
      expect(res.output.metadata.author).toBe("Test Author");
    }
  });

  it("returns empty strings for unset fields", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const pdf = await doc.save();
    const res = await readPdfMetadata(pdf);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.metadata.title).toBe("");
  });

  it("errors on invalid bytes", async () => {
    const res = await readPdfMetadata(new Uint8Array([1, 2, 3]));
    expect(res.ok).toBe(false);
  });
});

describe("writePdfMetadata", () => {
  it("writes all fields and reads them back", async () => {
    const pdf = await makePdf();
    const writeRes = await writePdfMetadata(pdf, {
      title: "New Title",
      author: "New Author",
      subject: "New Subject",
      keywords: "kw1, kw2",
      creator: "UnQTools",
      producer: "UnQTools",
    });
    expect(writeRes.ok).toBe(true);
    if (writeRes.ok) {
      const readRes = await readPdfMetadata(writeRes.output);
      expect(readRes.ok).toBe(true);
      if (readRes.ok) {
        expect(readRes.output.metadata.title).toBe("New Title");
        expect(readRes.output.metadata.author).toBe("New Author");
        expect(readRes.output.metadata.subject).toBe("New Subject");
        expect(readRes.output.metadata.creator).toBe("UnQTools");
      }
    }
  });

  it("clears all fields when passed empty strings", async () => {
    const pdf = await makePdf();
    const writeRes = await writePdfMetadata(pdf, {
      title: "", author: "", subject: "", keywords: "", creator: "", producer: "",
    });
    expect(writeRes.ok).toBe(true);
    if (writeRes.ok) {
      const readRes = await readPdfMetadata(writeRes.output);
      expect(readRes.ok).toBe(true);
      if (readRes.ok) expect(readRes.output.metadata.title).toBe("");
    }
  });

  it("errors on invalid bytes", async () => {
    const res = await writePdfMetadata(new Uint8Array([1, 2, 3]), {
      title: "x", author: "", subject: "", keywords: "", creator: "", producer: "",
    });
    expect(res.ok).toBe(false);
  });
});
