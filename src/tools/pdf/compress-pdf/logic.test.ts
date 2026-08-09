import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  compressPdf,
  compressPdfs,
  canReencodeImages,
  findJpegStreams,
  planTargetCompression,
  presetFor,
  QUALITY_PRESETS,
  TARGET_LADDER,
} from "./logic";

async function makePdf(pages: number, withMetadata = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  if (withMetadata) {
    doc.setTitle("Test Title");
    doc.setAuthor("Test Author");
    doc.setSubject("Test Subject");
    doc.setKeywords(["kw1", "kw2"]);
    doc.setCreator("Test Creator");
  }
  return doc.save();
}

describe("compressPdf (structural path — Node has no canvas)", () => {
  it("compresses a PDF and returns smaller or equal bytes", async () => {
    const pdf = await makePdf(5);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.compressedSize).toBeLessThanOrEqual(result.output.originalSize);
      expect(result.output.reductionPercent).toBeGreaterThanOrEqual(0);
      expect(result.output.imagesRecompressed).toBe(0);
    }
  });

  it("returns valid PDF bytes that can be re-loaded", async () => {
    const pdf = await makePdf(3);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("preserves page count after compression", async () => {
    const pdf = await makePdf(7);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getPageCount()).toBe(7);
    }
  });

  it("strips metadata when stripMetadata is true", async () => {
    const pdf = await makePdf(2, true);
    const result = await compressPdf(pdf, { stripMetadata: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getTitle() ?? "").toBe("");
      expect(doc.getAuthor() ?? "").toBe("");
      expect(doc.getSubject() ?? "").toBe("");
      expect(doc.getCreator() ?? "").toBe("");
      expect(result.output.metadataStripped).toBe(true);
    }
  });

  it("keeps metadata when stripMetadata is false", async () => {
    const pdf = await makePdf(2, true);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getTitle()).toBe("Test Title");
    }
  });

  it("rejects corrupt PDFs with a friendly error", async () => {
    const junk = new Uint8Array([37, 80, 68, 70, 1, 2, 3]); // "%PDF" + junk
    const result = await compressPdf(junk);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/corrupted|password/i);
  });

  it("handles an empty page range gracefully", async () => {
    const pdf = await makePdf(4);
    const result = await compressPdf(pdf, {});
    expect(result.ok).toBe(true);
  });

  it("quality preset values stay within valid bounds", () => {
    for (const p of Object.values(QUALITY_PRESETS)) {
      expect(p.quality).toBeGreaterThanOrEqual(0.1);
      expect(p.quality).toBeLessThanOrEqual(1);
      expect(p.scale).toBeGreaterThan(0);
      expect(p.scale).toBeLessThanOrEqual(1);
    }
  });
});

describe("presets & target planning (pure)", () => {
  it("presetFor returns the preset values", () => {
    expect(presetFor("maximum").quality).toBe(0.45);
    expect(presetFor("normal").scale).toBe(0.9);
  });

  it("planTargetCompression clamps tiny targets and picks start index", () => {
    const small = planTargetCompression(30);
    expect(small.startIndex).toBe(1);
    const big = planTargetCompression(500);
    expect(big.startIndex).toBe(0);
    expect(big.maxAttempts).toBe(TARGET_LADDER.length);
    expect(planTargetCompression(5).maxAttempts).toBeLessThanOrEqual(TARGET_LADDER.length);
  });

  it("TARGET_LADDER is strictly ordered most→least aggressive", () => {
    for (let i = 1; i < TARGET_LADDER.length; i++) {
      expect(TARGET_LADDER[i]!.quality).toBeLessThan(TARGET_LADDER[i - 1]!.quality);
    }
  });
});

describe("image helpers", () => {
  it("canReencodeImages is false in Node (no canvas)", () => {
    expect(canReencodeImages()).toBe(false);
  });

  it("findJpegStreams returns nothing for a text-only PDF", async () => {
    const pdf = await makePdf(2);
    const doc = await PDFDocument.load(pdf);
    expect(findJpegStreams(doc)).toEqual([]);
  });
});

describe("compressPdfs batch", () => {
  it("returns per-file results without throwing", async () => {
    const files = [
      { name: "a.pdf", bytes: await makePdf(2) },
      { name: "b.pdf", bytes: await makePdf(3) },
    ];
    const out = await compressPdfs(files, { stripMetadata: true });
    expect(out.length).toBe(2);
    expect(out.every((r) => r.ok)).toBe(true);
    expect(out[0]!.name).toBe("a.pdf");
    expect(out[0]!.result?.metadataStripped).toBe(true);
  });

  it("reports per-file errors without failing the batch", async () => {
    const files = [
      { name: "good.pdf", bytes: await makePdf(1) },
      { name: "bad.pdf", bytes: new Uint8Array([1, 2, 3]) },
    ];
    const out = await compressPdfs(files);
    expect(out[0]!.ok).toBe(true);
    expect(out[1]!.ok).toBe(false);
    expect(out[1]!.error).toBeTruthy();
  });
});
