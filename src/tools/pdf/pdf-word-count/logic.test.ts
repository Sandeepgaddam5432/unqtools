import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { countWords, countSentences, countParagraphs, readingMinutes, analyzeText } from "./logic";

describe("countWords", () => {
  it("counts space-separated words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("handles punctuation and contractions", () => {
    expect(countWords("Hello, world! It's fine.")).toBe(4);
    expect(countWords("café naïve")).toBe(2);
  });
});

describe("countSentences", () => {
  it("counts sentence terminators", () => {
    expect(countSentences("One. Two! Three?")).toBe(3);
    expect(countSentences("No end")).toBe(0);
  });
});

describe("countParagraphs", () => {
  it("counts blank-line separated blocks", () => {
    expect(countParagraphs("Para one\n\nPara two\n\nPara three")).toBe(3);
    expect(countParagraphs("Single")).toBe(1);
  });
});

describe("readingMinutes", () => {
  it("scales with word count", () => {
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(100)).toBe(0.5);
  });
});

describe("analyzeText", () => {
  it("computes stats from a real PDF", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]);
    page.drawText("The quick brown fox. Jumps over!", { x: 40, y: 300, size: 12, font });
    page.drawText("Second sentence here.", { x: 40, y: 270, size: 12, font });
    const r = await analyzeText(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.words).toBeGreaterThanOrEqual(8);
      expect(r.output.chars).toBeGreaterThan(0);
      expect(r.output.sentences).toBeGreaterThanOrEqual(2);
      expect(r.output.pages).toBe(1);
      expect(r.output.perPage.length).toBe(1);
      expect(r.output.readingMinutes).toBeGreaterThan(0);
    }
  });

  it("reports scanned PDFs gracefully", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]);
    const r = await analyzeText(await doc.save());
    expect(r.ok).toBe(false);
  });
});
