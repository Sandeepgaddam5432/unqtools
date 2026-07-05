import { describe, expect, it } from "vitest";
import { parsePageRanges, stripPdfExtension } from "./page-ranges";

describe("parsePageRanges", () => {
  it("parses a simple range", () => {
    const r = parsePageRanges("1-3", 10);
    expect(r).toEqual({ ok: true, output: [0, 1, 2] });
  });

  it("parses a single page", () => {
    const r = parsePageRanges("5", 10);
    expect(r).toEqual({ ok: true, output: [4] });
  });

  it("parses mixed pages and ranges, preserving order", () => {
    const r = parsePageRanges("4, 1-2", 10);
    expect(r).toEqual({ ok: true, output: [3, 0, 1] });
  });

  it("supports open-ended ranges to the last page", () => {
    const r = parsePageRanges("3-", 5);
    expect(r).toEqual({ ok: true, output: [2, 3, 4] });
  });

  it("supports open-start ranges from the first page", () => {
    const r = parsePageRanges("-2", 5);
    expect(r).toEqual({ ok: true, output: [0, 1] });
  });

  it("tolerates whitespace and trailing commas", () => {
    const r = parsePageRanges(" 1 - 2 , 4 , ", 5);
    expect(r).toEqual({ ok: true, output: [0, 1, 3] });
  });

  it("allows duplicate pages", () => {
    const r = parsePageRanges("2,2", 5);
    expect(r).toEqual({ ok: true, output: [1, 1] });
  });

  it("rejects an empty spec", () => {
    expect(parsePageRanges("", 5).ok).toBe(false);
    expect(parsePageRanges("   ", 5).ok).toBe(false);
    expect(parsePageRanges(",,,", 5).ok).toBe(false);
  });

  it("rejects page zero", () => {
    expect(parsePageRanges("0", 5).ok).toBe(false);
  });

  it("rejects out-of-bounds pages and ranges", () => {
    expect(parsePageRanges("6", 5).ok).toBe(false);
    expect(parsePageRanges("4-9", 5).ok).toBe(false);
  });

  it("rejects reversed ranges", () => {
    expect(parsePageRanges("5-2", 5).ok).toBe(false);
  });

  it("rejects garbage tokens and a bare dash", () => {
    expect(parsePageRanges("abc", 5).ok).toBe(false);
    expect(parsePageRanges("-", 5).ok).toBe(false);
  });

  it("rejects when the document has no pages", () => {
    expect(parsePageRanges("1", 0).ok).toBe(false);
  });
});

describe("stripPdfExtension", () => {
  it("strips .pdf case-insensitively", () => {
    expect(stripPdfExtension("report.pdf")).toBe("report");
    expect(stripPdfExtension("REPORT.PDF")).toBe("REPORT");
  });

  it("leaves other names untouched and only strips the final extension", () => {
    expect(stripPdfExtension("notes.txt")).toBe("notes.txt");
    expect(stripPdfExtension("report.pdf.pdf")).toBe("report.pdf");
  });
});
