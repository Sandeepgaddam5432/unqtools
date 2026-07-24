/**
 * PDF Page Organizer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { parsePageRanges, parseSplitRanges, applyOperations, summarizePlan, pageMappingToCsv, formatResultSummary } from "./logic";

describe("parsePageRanges", () => {
  it("parses single page", () => {
    expect(parsePageRanges("5", 10)).toEqual([4]);
  });
  it("parses comma-separated pages", () => {
    expect(parsePageRanges("1,3,5", 10)).toEqual([0, 2, 4]);
  });
  it("parses range with hyphen", () => {
    expect(parsePageRanges("1-3", 10)).toEqual([0, 1, 2]);
  });
  it("parses mixed ranges and singles", () => {
    expect(parsePageRanges("1-3,5,8-9", 10)).toEqual([0, 1, 2, 4, 7, 8]);
  });
  it("deduplicates overlapping ranges", () => {
    expect(parsePageRanges("1-3,2-4", 10)).toEqual([0, 1, 2, 3]);
  });
  it("ignores out-of-range pages", () => {
    expect(parsePageRanges("1,15,20-25", 10)).toEqual([0]);
  });
  it("handles whitespace", () => {
    expect(parsePageRanges(" 1 - 3 , 5 ", 10)).toEqual([0, 1, 2, 4]);
  });
  it("returns empty for empty input", () => {
    expect(parsePageRanges("", 10)).toEqual([]);
  });
});

describe("parseSplitRanges", () => {
  it("parses comma-separated ranges", () => {
    expect(parseSplitRanges("1-3,4-6", 6)).toEqual([[0, 1, 2], [3, 4, 5]]);
  });
  it("handles 'splitN' syntax", () => {
    const r = parseSplitRanges("split3", 9);
    expect(r.length).toBe(3);
    expect(r[0]).toEqual([0, 1, 2]);
  });
  it("handles 'everyN' syntax", () => {
    const r = parseSplitRanges("every2", 6);
    expect(r).toEqual([[0, 1], [2, 3], [4, 5]]);
  });
});

describe("applyOperations", () => {
  it("delete removes pages", () => {
    expect(applyOperations(5, [{ kind: "delete", pages: [1, 3] }])).toEqual([0, 2, 4]);
  });
  it("extract keeps only specified pages", () => {
    expect(applyOperations(5, [{ kind: "extract", pages: [0, 2] }])).toEqual([0, 2]);
  });
  it("duplicate adds duplicate after each occurrence", () => {
    expect(applyOperations(3, [{ kind: "duplicate", pages: [1] }])).toEqual([0, 1, 1, 2]);
  });
  it("reverse flips the order", () => {
    expect(applyOperations(4, [{ kind: "reverse" }])).toEqual([3, 2, 1, 0]);
  });
  it("reorder sets new order", () => {
    expect(applyOperations(3, [{ kind: "reorder", newOrder: [2, 0, 1] }])).toEqual([2, 0, 1]);
  });
  it("chained operations", () => {
    expect(applyOperations(5, [{ kind: "delete", pages: [1] }, { kind: "reverse" }])).toEqual([4, 3, 2, 0]);
  });
});

describe("summarizePlan", () => {
  it("describes no-op plan", () => {
    const s = summarizePlan([], 5);
    expect(s).toContain("No operations");
    expect(s).toContain("5 pages");
  });
  it("describes delete operation", () => {
    const s = summarizePlan([{ kind: "delete", pages: [0, 2] }], 5);
    expect(s).toContain("delete");
    expect(s).toContain("1, 3");
  });
  it("describes rotate operation with angle", () => {
    const s = summarizePlan([{ kind: "rotate", pages: [0], angle: 90 }], 5);
    expect(s).toContain("rotate");
    expect(s).toContain("90");
  });
});

describe("pageMappingToCsv", () => {
  it("generates CSV mapping", () => {
    const csv = pageMappingToCsv([2, 0, 1]);
    expect(csv.split("\n")[0]).toBe("NewPosition,OriginalPage");
    expect(csv).toContain("1,3");
    expect(csv).toContain("2,1");
  });
});

describe("formatResultSummary", () => {
  it("summarizes result", () => {
    const s = formatResultSummary(10, 7, [{ kind: "delete", pages: [0, 1, 2] }]);
    expect(s).toContain("Original pages: 10");
    expect(s).toContain("Final pages: 7");
    expect(s).toContain("Delta: -3");
  });
});
