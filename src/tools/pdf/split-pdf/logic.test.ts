import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { formatSplitName, previewSplit, splitPdf } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("splitPdf", () => {
  it("splits one file per page in single mode", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "single", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.length).toBe(3);
      expect(result.output.map((f) => f.name)).toEqual([
        "doc-page-1.pdf",
        "doc-page-2.pdf",
        "doc-page-3.pdf",
      ]);
      expect(await countPages(result.output[0].bytes)).toBe(1);
    }
  });

  it("splits into chunks in every-N mode, last chunk smaller", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, { mode: "every", every: 2, baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.map((f) => f.pageCount)).toEqual([2, 2, 1]);
      expect(result.output.map((f) => f.name)).toEqual([
        "doc-part-1.pdf",
        "doc-part-2.pdf",
        "doc-part-3.pdf",
      ]);
      expect(await countPages(result.output[2].bytes)).toBe(1);
    }
  });

  it("returns one file when chunk size exceeds the page count", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "every", every: 10, baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.length).toBe(1);
      expect(result.output[0].pageCount).toBe(3);
    }
  });

  it("rejects a chunk size below 1", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "every", every: 0, baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("splits by custom ranges — each group becomes a file", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "1-2, 4", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.map((f) => f.pageCount)).toEqual([2, 1]);
      expect(result.output[0].name).toBe("doc-pages-1-2.pdf");
      expect(result.output[1].name).toBe("doc-pages-4.pdf");
      expect(await countPages(result.output[0].bytes)).toBe(2);
    }
  });

  it("allows overlapping range groups", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "1-3, 2-5", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output.map((f) => f.pageCount)).toEqual([3, 4]);
  });

  it("rejects an empty ranges spec", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "  ", baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-bounds ranges", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "9", baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const result = await splitPdf(new Uint8Array([1, 2, 3]), { mode: "single", baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("derives output names from the base filename, with a fallback", async () => {
    const pdf = await makePdf(1);
    const named = await splitPdf(pdf, { mode: "single", baseName: "My Report.pdf" });
    expect(named.ok).toBe(true);
    if (named.ok) expect(named.output[0].name).toBe("My Report-page-1.pdf");
    const unnamed = await splitPdf(pdf, { mode: "single", baseName: "" });
    expect(unnamed.ok).toBe(true);
    if (unnamed.ok) expect(unnamed.output[0].name).toBe("split-page-1.pdf");
  });
});

describe("splitPdf — v7.1 advanced features", () => {
  it("supports a custom filename template with {base} {n} {start} {end} {count}", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, {
      mode: "ranges",
      ranges: "1-3, 4-5",
      baseName: "report.pdf",
      filenameTemplate: "{base}_part{n}_p{start}-{end}_of{count}",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output[0].name).toBe("report_part1_p1-3_of3.pdf");
      expect(result.output[1].name).toBe("report_part2_p4-5_of2.pdf");
    }
  });

  it("reverses the output order when reverse is true", async () => {
    const pdf = await makePdf(6);
    const result = await splitPdf(pdf, {
      mode: "every",
      every: 2,
      baseName: "doc.pdf",
      reverse: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toHaveLength(3);
      // Reversed: part 3 first (pages 5-6), part 1 last (pages 1-2)
      expect(result.output[0].startPage).toBe(5);
      expect(result.output[0].endPage).toBe(6);
      expect(result.output[2].startPage).toBe(1);
      expect(result.output[2].endPage).toBe(2);
    }
  });

  it("sets creator metadata + creation date on each split file", async () => {
    const pdf = await makePdf(2);
    const result = await splitPdf(pdf, { mode: "single", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output[0].bytes);
      // Note: pdf-lib always overrides Producer on save with "pdf-lib (https://...)"
      // so we only assert on Creator (which we can control).
      expect(doc.getCreator()).toContain("UnQTools");
      expect(doc.getCreationDate()).toBeInstanceOf(Date);
      expect(doc.getModificationDate()).toBeInstanceOf(Date);
    }
  });

  it("includes startPage + endPage on each SplitOutputFile", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, {
      mode: "ranges",
      ranges: "2-3, 5",
      baseName: "doc.pdf",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output[0].startPage).toBe(2);
      expect(result.output[0].endPage).toBe(3);
      expect(result.output[1].startPage).toBe(5);
      expect(result.output[1].endPage).toBe(5);
    }
  });
});

describe("previewSplit", () => {
  it("returns the split plan without actually splitting", async () => {
    const pdf = await makePdf(6);
    const preview = await previewSplit(pdf, {
      mode: "every",
      every: 2,
      baseName: "doc.pdf",
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.output.totalParts).toBe(3);
      expect(preview.output.totalSourcePages).toBe(6);
      expect(preview.output.groups).toHaveLength(3);
      expect(preview.output.groups[0].partNumber).toBe(1);
      expect(preview.output.groups[0].startPage).toBe(1);
      expect(preview.output.groups[0].endPage).toBe(2);
      expect(preview.output.groups[0].pageCount).toBe(2);
      expect(preview.output.groups[0].label).toBe("Pages 1-2");
    }
  });

  it("returns human-readable label for single-page groups", async () => {
    const pdf = await makePdf(2);
    const preview = await previewSplit(pdf, { mode: "single", baseName: "doc.pdf" });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.output.groups[0].label).toBe("Page 1");
      expect(preview.output.groups[1].label).toBe("Page 2");
    }
  });

  it("computes filenames using the template", async () => {
    const pdf = await makePdf(4);
    const preview = await previewSplit(pdf, {
      mode: "every",
      every: 2,
      baseName: "report.pdf",
      filenameTemplate: "{base}-{n}-of-{count}",
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.output.groups[0].name).toBe("report-1-of-2.pdf");
      expect(preview.output.groups[1].name).toBe("report-2-of-2.pdf");
    }
  });

  it("reverses groups when reverse is true", async () => {
    const pdf = await makePdf(6);
    const preview = await previewSplit(pdf, {
      mode: "every",
      every: 2,
      baseName: "doc.pdf",
      reverse: true,
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.output.groups[0].startPage).toBe(5);
      expect(preview.output.groups[2].startPage).toBe(1);
    }
  });

  it("errors with a helpful message for empty ranges in 'ranges' mode", async () => {
    const pdf = await makePdf(3);
    const preview = await previewSplit(pdf, {
      mode: "ranges",
      ranges: "   ",
      baseName: "doc.pdf",
    });
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error).toContain("page ranges");
  });

  it("errors on chunk size < 1 in 'every' mode", async () => {
    const pdf = await makePdf(3);
    const preview = await previewSplit(pdf, {
      mode: "every",
      every: 0,
      baseName: "doc.pdf",
    });
    expect(preview.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const preview = await previewSplit(new Uint8Array([1, 2, 3]), {
      mode: "single",
      baseName: "doc.pdf",
    });
    expect(preview.ok).toBe(false);
  });
});

describe("formatSplitName", () => {
  it("substitutes all placeholders", () => {
    expect(
      formatSplitName("{base}-{n}-p{start}-{end}-{count}-{spec}", {
        base: "doc",
        n: 1,
        start: 1,
        end: 3,
        count: 3,
        spec: "1-3",
      })
    ).toBe("doc-1-p1-3-3-1-3.pdf");
  });

  it("falls back to {base}-{n} when template is empty", () => {
    expect(
      formatSplitName("", { base: "doc", n: 2, start: 4, end: 5, count: 2, spec: "4-5" })
    ).toBe("doc-2.pdf");
  });

  it("strips path separators from the user input to prevent directory traversal", () => {
    expect(
      formatSplitName("{base}/{n}", { base: "doc", n: 1, start: 1, end: 1, count: 1, spec: "1" })
    ).toBe("doc-1.pdf");
    expect(
      formatSplitName("{base}\\{n}", { base: "doc", n: 1, start: 1, end: 1, count: 1, spec: "1" })
    ).toBe("doc-1.pdf");
  });

  it("handles multiple uses of the same placeholder", () => {
    expect(
      formatSplitName("{n}-{n}-{base}", { base: "doc", n: 3, start: 1, end: 1, count: 1, spec: "1" })
    ).toBe("3-3-doc.pdf");
  });

  it("always appends .pdf extension", () => {
    expect(
      formatSplitName("custom-name", { base: "doc", n: 1, start: 1, end: 1, count: 1, spec: "1" })
    ).toBe("custom-name.pdf");
  });

  it("substitutes {spec} with the original user-typed range", () => {
    expect(
      formatSplitName("{base}-pages-{spec}", { base: "doc", n: 1, start: 1, end: 3, count: 3, spec: "1-3" })
    ).toBe("doc-pages-1-3.pdf");
  });
});
