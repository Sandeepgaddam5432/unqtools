import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { getMergeOutputName, mergePdfs, previewMerge } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("mergePdfs", () => {
  it("merges two PDFs keeping all pages", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const result = await mergePdfs([
      { name: "a.pdf", bytes: a },
      { name: "b.pdf", bytes: b },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(5);
  });

  it("passes a single file through with all pages", async () => {
    const a = await makePdf(3);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("honors per-file page ranges", async () => {
    const a = await makePdf(4);
    const b = await makePdf(4);
    const result = await mergePdfs([
      { name: "a.pdf", bytes: a, pages: "1-2" },
      { name: "b.pdf", bytes: b, pages: "4" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("treats an empty pages spec as all pages", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "   " }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(2);
  });

  it("supports duplicating pages via repeated entries", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "1,1,1" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("supports open-ended ranges", async () => {
    const a = await makePdf(4);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "2-" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("errors on an empty input list", async () => {
    const result = await mergePdfs([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("at least one");
  });

  it("errors with the file name when bytes are not a valid PDF", async () => {
    const result = await mergePdfs([{ name: "broken.pdf", bytes: new Uint8Array([1, 2, 3]) }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("broken.pdf");
  });

  it("errors with the file name when a page range is invalid", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "9" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("a.pdf");
  });

  it("merges three files in the given order by page count", async () => {
    const a = await makePdf(1);
    const b = await makePdf(2);
    const c = await makePdf(3);
    const result = await mergePdfs([
      { name: "a.pdf", bytes: a },
      { name: "b.pdf", bytes: b, pages: "1" },
      { name: "c.pdf", bytes: c, pages: "2-3" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(4);
  });
});

describe("mergePdfs — v7.1 advanced features", () => {
  it("sets metadata on the merged PDF when options.metadata is provided", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs(
      [{ name: "a.pdf", bytes: a }],
      { metadata: { title: "My Report", author: "Sandeep", subject: "Q3 Summary" } }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      expect(doc.getTitle()).toBe("My Report");
      expect(doc.getAuthor()).toBe("Sandeep");
      expect(doc.getSubject()).toBe("Q3 Summary");
      // Note: pdf-lib always overrides Producer on save with "pdf-lib (https://...)"
      // so we only assert on Creator (which we can control).
      expect(doc.getCreator()).toContain("UnQTools");
    }
  });

  it("sets creation + modification dates on the merged PDF", async () => {
    const a = await makePdf(1);
    const before = new Date();
    const result = await mergePdfs([{ name: "a.pdf", bytes: a }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      const created = doc.getCreationDate();
      const modified = doc.getModificationDate();
      expect(created).toBeInstanceOf(Date);
      expect(modified).toBeInstanceOf(Date);
      expect(created!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    }
  });

  it("skips metadata when options.metadata fields are empty", async () => {
    const a = await makePdf(1);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a }], {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      // pdf-lib returns undefined for unset fields (not "")
      expect(doc.getTitle() ?? "").toBe("");
    }
  });
});

describe("previewMerge", () => {
  it("returns a per-file preview without doing the merge", async () => {
    const a = await makePdf(3);
    const b = await makePdf(5);
    const preview = await previewMerge([
      { name: "a.pdf", bytes: a },
      { name: "b.pdf", bytes: b, pages: "1-2, 4" },
    ]);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.output.files).toHaveLength(2);
      expect(preview.output.files[0].name).toBe("a.pdf");
      expect(preview.output.files[0].totalSourcePages).toBe(3);
      expect(preview.output.files[0].selectedIndices).toEqual([0, 1, 2]);
      expect(preview.output.files[0].selectedLabel).toContain("All 3 pages");
      expect(preview.output.files[1].name).toBe("b.pdf");
      expect(preview.output.files[1].totalSourcePages).toBe(5);
      expect(preview.output.files[1].selectedIndices).toEqual([0, 1, 3]);
      expect(preview.output.files[1].selectedLabel).toContain("3 page");
      expect(preview.output.totalSelectedPages).toBe(6);
    }
  });

  it("returns the outputName (defaults to 'merged')", async () => {
    const a = await makePdf(1);
    const preview = await previewMerge([{ name: "a.pdf", bytes: a }]);
    expect(preview.ok).toBe(true);
    if (preview.ok) expect(preview.output.outputName).toBe("merged");
  });

  it("uses the provided outputName (stripping .pdf if present)", async () => {
    const a = await makePdf(1);
    const preview = await previewMerge(
      [{ name: "a.pdf", bytes: a }],
      { outputName: "final-report.pdf" }
    );
    expect(preview.ok).toBe(true);
    if (preview.ok) expect(preview.output.outputName).toBe("final-report");
  });

  it("errors on empty input list", async () => {
    const preview = await previewMerge([]);
    expect(preview.ok).toBe(false);
  });

  it("errors on invalid page range with file name in the message", async () => {
    const a = await makePdf(2);
    const preview = await previewMerge([{ name: "x.pdf", bytes: a, pages: "9" }]);
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error).toContain("x.pdf");
  });
});

describe("getMergeOutputName", () => {
  it("returns 'merged' when no outputName is provided", () => {
    expect(getMergeOutputName({})).toBe("merged");
  });

  it("strips trailing .pdf from the provided name", () => {
    expect(getMergeOutputName({ outputName: "report.pdf" })).toBe("report");
    expect(getMergeOutputName({ outputName: "REPORT.PDF" })).toBe("REPORT");
  });

  it("falls back to 'merged' for whitespace-only input", () => {
    expect(getMergeOutputName({ outputName: "   " })).toBe("merged");
  });

  it("preserves inner content untouched", () => {
    expect(getMergeOutputName({ outputName: "my report v2" })).toBe("my report v2");
  });
});
