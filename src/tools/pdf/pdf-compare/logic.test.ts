import { describe, expect, it, beforeEach } from "vitest";
import {
  COMPARISON_MODES,
  MODE_LABELS,
  DEFAULT_OPTIONS,
  parseComparePageRange,
  computePageOverlap,
  normalizeWhitespace,
  normalizeCase,
  normalizeText,
  levenshteinDistance,
  similarityScore,
  compareTextLines,
  computeDiffStats,
  buildPageDiff,
  compareMetadata,
  compareStructure,
  computePageCountDiff,
  computeFontUsageDiff,
  findSignificantChanges,
  computeSummaryStats,
  renderTextDiff,
  renderHtmlDiff,
  renderCsvDiff,
  renderJsonDiff,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type CompareOptions,
  type PdfSnapshot,
  type ComparisonResult,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("pdf-compare constants", () => {
  it("has 4 comparison modes", () => {
    expect(COMPARISON_MODES).toHaveLength(4);
    expect(COMPARISON_MODES).toContain("text-only");
    expect(COMPARISON_MODES).toContain("metadata-only");
    expect(COMPARISON_MODES).toContain("full");
    expect(COMPARISON_MODES).toContain("structure");
  });

  it("has labels for every mode", () => {
    for (const m of COMPARISON_MODES) expect(MODE_LABELS[m]).toBeTruthy();
  });

  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.comparisonMode).toBe("full");
    expect(DEFAULT_OPTIONS.ignoreWhitespace).toBe(true);
    expect(DEFAULT_OPTIONS.ignoreCase).toBe(false);
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });
});

// ---------------------------------------------------------------------------
// Page-range parsing
// ---------------------------------------------------------------------------

describe("pdf-compare parseComparePageRange", () => {
  it("returns all indices for 'all'", () => {
    const r = parseComparePageRange("all", 5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns all indices for empty input", () => {
    const r = parseComparePageRange("", 3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toEqual([0, 1, 2]);
  });

  it("parses explicit ranges", () => {
    const r = parseComparePageRange("1-2, 4", 5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toEqual([0, 1, 3]);
  });

  it("errors when document has no pages", () => {
    const r = parseComparePageRange("all", 0);
    expect(r.ok).toBe(false);
  });

  it("errors on out-of-range pages", () => {
    const r = parseComparePageRange("10", 5);
    expect(r.ok).toBe(false);
  });
});

describe("pdf-compare computePageOverlap", () => {
  it("returns indices present in both lists", () => {
    expect(computePageOverlap([0, 1, 2, 3], [1, 3, 5])).toEqual([1, 3]);
  });

  it("returns empty when no overlap", () => {
    expect(computePageOverlap([0, 1], [2, 3])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

describe("pdf-compare normalizeWhitespace", () => {
  it("collapses runs of spaces and tabs", () => {
    expect(normalizeWhitespace("a    b\t\tc")).toBe("a b c");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello  ")).toBe("hello");
  });

  it("normalizes CRLF to LF", () => {
    expect(normalizeWhitespace("a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("pdf-compare normalizeCase", () => {
  it("lowercases text", () => {
    expect(normalizeCase("Hello WORLD")).toBe("hello world");
  });
});

describe("pdf-compare normalizeText", () => {
  it("applies both normalizers when both options set", () => {
    const opts: CompareOptions = {
      comparisonMode: "text-only",
      ignoreWhitespace: true,
      ignoreCase: true,
      pageRange: "all",
    };
    expect(normalizeText("  Hello   WORLD  ", opts)).toBe("hello world");
  });

  it("skips normalization when both options off", () => {
    const opts: CompareOptions = {
      comparisonMode: "text-only",
      ignoreWhitespace: false,
      ignoreCase: false,
      pageRange: "all",
    };
    expect(normalizeText("  Hello   WORLD  ", opts)).toBe("  Hello   WORLD  ");
  });
});

// ---------------------------------------------------------------------------
// Levenshtein & similarity
// ---------------------------------------------------------------------------

describe("pdf-compare levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("abc", "abc")).toBe(0);
  });

  it("returns the length of the other string when one is empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("computes edit distance for substitution", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("computes edit distance for insertion", () => {
    expect(levenshteinDistance("abc", "aXbc")).toBe(1);
  });

  it("returns 0 for two empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });
});

describe("pdf-compare similarityScore", () => {
  it("returns 100 for identical strings", () => {
    expect(similarityScore("abc", "abc")).toBe(100);
  });

  it("returns 0 for completely different strings of equal length", () => {
    expect(similarityScore("abc", "xyz")).toBe(0);
  });

  it("returns 100 for two empty strings", () => {
    expect(similarityScore("", "")).toBe(100);
  });

  it("returns a value between 0 and 100 for partial similarity", () => {
    const s = similarityScore("kitten", "sitting");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// compareTextLines
// ---------------------------------------------------------------------------

describe("pdf-compare compareTextLines", () => {
  const opts: CompareOptions = {
    comparisonMode: "text-only",
    ignoreWhitespace: false,
    ignoreCase: false,
    pageRange: "all",
  };

  it("marks identical lines as unchanged", () => {
    const diff = compareTextLines("a\nb\nc", "a\nb\nc", opts);
    expect(diff.every((l) => l.type === "unchanged")).toBe(true);
  });

  it("marks added lines", () => {
    const diff = compareTextLines("a\nb", "a\nb\nc", opts);
    expect(diff.some((l) => l.type === "added" && l.content === "c")).toBe(true);
  });

  it("marks removed lines", () => {
    const diff = compareTextLines("a\nb\nc", "a\nb", opts);
    expect(diff.some((l) => l.type === "removed" && l.content === "c")).toBe(true);
  });

  it("pairs similar removed+added as modified when similarity ≥ 50%", () => {
    const diff = compareTextLines("hello world", "hello worlD", opts);
    // 'hello world' vs 'hello worlD' — differ by 1 char → high similarity → "modified"
    expect(diff.some((l) => l.type === "modified")).toBe(true);
  });

  it("does not pair dissimilar removed+added as modified", () => {
    const diff = compareTextLines("apple", "zebra", opts);
    // similarity 0 — should be a removed + added pair, not a modified
    expect(diff.some((l) => l.type === "modified")).toBe(false);
    expect(diff.some((l) => l.type === "removed")).toBe(true);
    expect(diff.some((l) => l.type === "added")).toBe(true);
  });

  it("respects ignoreCase", () => {
    const caseOpts: CompareOptions = { ...opts, ignoreCase: true };
    const diff = compareTextLines("Hello", "hello", caseOpts);
    expect(diff.every((l) => l.type === "unchanged")).toBe(true);
  });

  it("respects ignoreWhitespace", () => {
    const wsOpts: CompareOptions = { ...opts, ignoreWhitespace: true };
    const diff = compareTextLines("a  b", "a b", wsOpts);
    expect(diff.every((l) => l.type === "unchanged")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeDiffStats
// ---------------------------------------------------------------------------

describe("pdf-compare computeDiffStats", () => {
  it("counts each diff type", () => {
    const stats = computeDiffStats([
      { type: "added", lineNum: 1, content: "x" },
      { type: "added", lineNum: 2, content: "y" },
      { type: "removed", lineNum: 1, content: "z" },
      { type: "unchanged", lineNum: 1, content: "k" },
      { type: "modified", lineNum: 3, content: "m", oldContent: "n" },
    ]);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(1);
    expect(stats.modified).toBe(1);
    expect(stats.total).toBe(5);
  });

  it("returns zeros for empty input", () => {
    const stats = computeDiffStats([]);
    expect(stats.added).toBe(0);
    expect(stats.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildPageDiff
// ---------------------------------------------------------------------------

describe("pdf-compare buildPageDiff", () => {
  const opts: CompareOptions = {
    comparisonMode: "text-only",
    ignoreWhitespace: false,
    ignoreCase: false,
    pageRange: "all",
  };

  it("returns a 0-similarity diff when bothExist is false", () => {
    const p = buildPageDiff(5, "a", "b", false, opts);
    expect(p.bothExist).toBe(false);
    expect(p.similarity).toBe(0);
    expect(p.lines).toEqual([]);
  });

  it("returns 100-similarity for identical text", () => {
    const p = buildPageDiff(1, "hello\nworld", "hello\nworld", true, opts);
    expect(p.similarity).toBe(100);
    expect(p.unchanged).toBe(2);
  });

  it("counts added and removed lines correctly", () => {
    const p = buildPageDiff(1, "a\nb", "a\nc", true, opts);
    // 'a' unchanged, 'b' removed, 'c' added (similarity of 'b' and 'c' = 0, so not modified)
    expect(p.unchanged).toBe(1);
    expect(p.added + p.modified).toBe(1);
    expect(p.removed + p.modified).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// compareMetadata
// ---------------------------------------------------------------------------

describe("pdf-compare compareMetadata", () => {
  it("returns 0 differences for identical metadata", () => {
    const meta = { Title: "T", Author: "A" };
    const d = compareMetadata(meta, meta);
    expect(d.differences).toBe(0);
    expect(d.fields.length).toBeGreaterThan(0);
  });

  it("counts differing fields", () => {
    const d = compareMetadata(
      { Title: "A", Author: "X" },
      { Title: "B", Author: "X" }
    );
    expect(d.differences).toBe(1);
    const title = d.fields.find((f) => f.field === "Title");
    expect(title?.same).toBe(false);
    expect(title?.value1).toBe("A");
    expect(title?.value2).toBe("B");
  });

  it("treats missing fields as empty strings", () => {
    const d = compareMetadata({}, { Title: "T" });
    const title = d.fields.find((f) => f.field === "Title");
    expect(title?.value1).toBe("");
    expect(title?.value2).toBe("T");
    expect(title?.same).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// compareStructure
// ---------------------------------------------------------------------------

describe("pdf-compare compareStructure", () => {
  const snap1: PdfSnapshot = {
    pageCount: 3,
    pageTexts: ["a", "b", "c"],
    pageSizes: ["612x792", "612x792", "612x792"],
    fonts: ["Helvetica", "Times-Roman"],
    imageCounts: [0, 1, 2],
    metadata: {},
  };
  const snap2: PdfSnapshot = {
    pageCount: 4,
    pageTexts: ["a", "b", "c", "d"],
    pageSizes: ["612x792", "612x792", "612x792", "612x792"],
    fonts: ["Helvetica", "Courier"],
    imageCounts: [0, 1, 2, 3],
    metadata: {},
  };

  it("reports page-count delta", () => {
    const s = compareStructure(snap1, snap2);
    expect(s.pageCountDelta).toBe(1);
  });

  it("flags differing fonts", () => {
    const s = compareStructure(snap1, snap2);
    expect(s.fontsDiffer).toBe(true);
    expect(s.fonts1).toContain("Times-Roman");
    expect(s.fonts2).toContain("Courier");
  });

  it("flags differing image counts", () => {
    const s = compareStructure(snap1, snap2);
    expect(s.imageCountsDiffer).toBe(true);
  });

  it("does not flag identical sizes when only counts differ", () => {
    const s = compareStructure(snap1, snap2);
    expect(s.sizesDiffer).toBe(false); // both use only "612x792"
  });

  it("flags differing sizes", () => {
    const s = compareStructure(
      { ...snap1, pageSizes: ["612x792", "612x792", "612x792"] },
      { ...snap2, pageSizes: ["612x792", "400x600"] }
    );
    expect(s.sizesDiffer).toBe(true);
  });

  it("returns no differences for identical snapshots", () => {
    const s = compareStructure(snap1, snap1);
    expect(s.pageCountDelta).toBe(0);
    expect(s.sizesDiffer).toBe(false);
    expect(s.fontsDiffer).toBe(false);
    expect(s.imageCountsDiffer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computePageCountDiff & computeFontUsageDiff
// ---------------------------------------------------------------------------

describe("pdf-compare computePageCountDiff", () => {
  it("reports positive delta when doc2 has more pages", () => {
    expect(computePageCountDiff(3, 5)).toEqual({
      count1: 3, count2: 5, delta: 2, added: 2, removed: 0,
    });
  });

  it("reports negative delta when doc1 has more pages", () => {
    expect(computePageCountDiff(5, 3)).toEqual({
      count1: 5, count2: 3, delta: -2, added: 0, removed: 2,
    });
  });

  it("reports zero delta when page counts match", () => {
    expect(computePageCountDiff(4, 4)).toEqual({
      count1: 4, count2: 4, delta: 0, added: 0, removed: 0,
    });
  });
});

describe("pdf-compare computeFontUsageDiff", () => {
  it("counts font occurrences and computes deltas", () => {
    const diff = computeFontUsageDiff(
      ["Helvetica", "Helvetica", "Times-Roman"],
      ["Helvetica", "Courier"]
    );
    const helv = diff.find((d) => d.font === "Helvetica");
    const times = diff.find((d) => d.font === "Times-Roman");
    const courier = diff.find((d) => d.font === "Courier");
    expect(helv).toEqual({ font: "Helvetica", count1: 2, count2: 1, delta: -1 });
    expect(times).toEqual({ font: "Times-Roman", count1: 1, count2: 0, delta: -1 });
    expect(courier).toEqual({ font: "Courier", count1: 0, count2: 1, delta: 1 });
  });

  it("returns empty for two empty lists", () => {
    expect(computeFontUsageDiff([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findSignificantChanges & computeSummaryStats
// ---------------------------------------------------------------------------

describe("pdf-compare findSignificantChanges", () => {
  it("returns pages with the most differences, top N", () => {
    const pageDiffs = [
      { page: 1, bothExist: true, lines: [], similarity: 100, added: 0, removed: 0, modified: 0, unchanged: 5 },
      { page: 2, bothExist: true, lines: [], similarity: 80, added: 3, removed: 1, modified: 0, unchanged: 2 },
      { page: 3, bothExist: true, lines: [], similarity: 50, added: 5, removed: 5, modified: 2, unchanged: 0 },
    ];
    const sig = findSignificantChanges(pageDiffs, 2);
    expect(sig).toHaveLength(2);
    expect(sig[0].page).toBe(3); // 12 differences
    expect(sig[1].page).toBe(2); // 4 differences
  });

  it("filters out pages with zero differences", () => {
    const pageDiffs = [
      { page: 1, bothExist: true, lines: [], similarity: 100, added: 0, removed: 0, modified: 0, unchanged: 5 },
      { page: 2, bothExist: true, lines: [], similarity: 80, added: 1, removed: 0, modified: 0, unchanged: 4 },
    ];
    const sig = findSignificantChanges(pageDiffs, 5);
    expect(sig).toHaveLength(1);
    expect(sig[0].page).toBe(2);
  });
});

describe("pdf-compare computeSummaryStats", () => {
  it("aggregates text differences and overall similarity", () => {
    const pageDiffs = [
      { page: 1, bothExist: true, lines: [], similarity: 90, added: 1, removed: 0, modified: 0, unchanged: 5 },
      { page: 2, bothExist: true, lines: [], similarity: 70, added: 2, removed: 1, modified: 1, unchanged: 3 },
    ];
    const meta = { fields: [], differences: 2 };
    const struct = {
      pageCount1: 2, pageCount2: 2, pageCountDelta: 0,
      pageSizes1: [], pageSizes2: [], sizesDiffer: false,
      fonts1: [], fonts2: [], fontsDiffer: false,
      imageCounts1: [], imageCounts2: [], imageCountsDiffer: false,
    };
    const s = computeSummaryStats("full", pageDiffs, meta, struct);
    expect(s.pagesCompared).toBe(2);
    expect(s.textDifferences).toBe(5); // 1 + 2 + 1 + 1
    expect(s.metadataDifferences).toBe(2);
    expect(s.structureDifferences).toBe(0);
    expect(s.overallSimilarity).toBe(80); // (90 + 70) / 2
  });

  it("counts structure differences", () => {
    const meta = { fields: [], differences: 0 };
    const struct = {
      pageCount1: 3, pageCount2: 5, pageCountDelta: 2,
      pageSizes1: [], pageSizes2: [], sizesDiffer: true,
      fonts1: [], fonts2: [], fontsDiffer: true,
      imageCounts1: [], imageCounts2: [], imageCountsDiffer: false,
    };
    const s = computeSummaryStats("structure", [], meta, struct);
    expect(s.structureDifferences).toBe(3); // page count + sizes + fonts
  });
});

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

describe("pdf-compare renderTextDiff", () => {
  it("includes section headers and per-page diffs", () => {
    const pageDiffs = [
      {
        page: 1, bothExist: true,
        lines: [
          { type: "added" as const, lineNum: 1, content: "new line" },
          { type: "removed" as const, lineNum: 1, content: "old line" },
          { type: "unchanged" as const, lineNum: 2, content: "shared" },
        ],
        similarity: 50, added: 1, removed: 1, modified: 0, unchanged: 1,
      },
    ];
    const meta = {
      fields: [{ field: "Title", value1: "Old", value2: "New", same: false }],
      differences: 1,
    };
    const struct = {
      pageCount1: 1, pageCount2: 1, pageCountDelta: 0,
      pageSizes1: ["612x792"], pageSizes2: ["612x792"], sizesDiffer: false,
      fonts1: ["Helvetica"], fonts2: ["Helvetica"], fontsDiffer: false,
      imageCounts1: [0], imageCounts2: [0], imageCountsDiffer: false,
    };
    const pc = { count1: 1, count2: 1, delta: 0, added: 0, removed: 0 };
    const text = renderTextDiff(pageDiffs, meta, struct, pc);
    expect(text).toContain("PDF Comparison Report");
    expect(text).toContain("Page count");
    expect(text).toContain("Structure");
    expect(text).toContain("Metadata");
    expect(text).toContain("Title");
    expect(text).toContain("Per-page text diff");
    expect(text).toContain("@@ Page 1 @@");
    expect(text).toContain("+ new line");
    expect(text).toContain("- old line");
    expect(text).toContain("  shared");
  });
});

describe("pdf-compare renderHtmlDiff", () => {
  it("wraps diffs in HTML spans", () => {
    const pageDiffs = [
      {
        page: 1, bothExist: true,
        lines: [
          { type: "added" as const, lineNum: 1, content: "new" },
          { type: "removed" as const, lineNum: 1, content: "old" },
          { type: "modified" as const, lineNum: 2, content: "newer", oldContent: "older" },
          { type: "unchanged" as const, lineNum: 3, content: "same" },
        ],
        similarity: 50, added: 1, removed: 1, modified: 1, unchanged: 1,
      },
    ];
    const html = renderHtmlDiff(pageDiffs);
    expect(html).toContain("page-diff");
    expect(html).toContain("add");
    expect(html).toContain("del");
    expect(html).toContain("mod");
    expect(html).toContain("ctx");
  });

  it("escapes HTML special characters in content", () => {
    const pageDiffs = [
      {
        page: 1, bothExist: true,
        lines: [{ type: "added" as const, lineNum: 1, content: "<script>alert('x')</script>" }],
        similarity: 0, added: 1, removed: 0, modified: 0, unchanged: 0,
      },
    ];
    const html = renderHtmlDiff(pageDiffs);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders missing pages", () => {
    const pageDiffs = [
      { page: 1, bothExist: false, lines: [], similarity: 0, added: 0, removed: 0, modified: 0, unchanged: 0 },
    ];
    const html = renderHtmlDiff(pageDiffs);
    expect(html).toContain("missing");
  });
});

describe("pdf-compare renderCsvDiff", () => {
  it("emits a header row plus one row per diff line", () => {
    const pageDiffs = [
      {
        page: 1, bothExist: true,
        lines: [
          { type: "added" as const, lineNum: 1, content: "x" },
          { type: "removed" as const, lineNum: 1, content: "y" },
        ],
        similarity: 50, added: 1, removed: 1, modified: 0, unchanged: 0,
      },
    ];
    const csv = renderCsvDiff(pageDiffs);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("page,line_num,type,content,old_content");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("1,1,added,x,");
    expect(lines[2]).toBe("1,1,removed,y,");
  });

  it("escapes commas in content", () => {
    const pageDiffs = [
      {
        page: 1, bothExist: true,
        lines: [{ type: "added" as const, lineNum: 1, content: "a,b" }],
        similarity: 0, added: 1, removed: 0, modified: 0, unchanged: 0,
      },
    ];
    const csv = renderCsvDiff(pageDiffs);
    expect(csv).toContain('"a,b"');
  });

  it("marks missing pages with type=missing", () => {
    const pageDiffs = [
      { page: 1, bothExist: false, lines: [], similarity: 0, added: 0, removed: 0, modified: 0, unchanged: 0 },
    ];
    const csv = renderCsvDiff(pageDiffs);
    expect(csv).toContain("1,,missing,,");
  });
});

describe("pdf-compare renderJsonDiff", () => {
  it("serializes the full comparison result to JSON", () => {
    const result: ComparisonResult = {
      mode: "full",
      options: DEFAULT_OPTIONS,
      pageDiffs: [],
      metadataDiff: { fields: [], differences: 0 },
      structureDiff: {
        pageCount1: 1, pageCount2: 1, pageCountDelta: 0,
        pageSizes1: ["612x792"], pageSizes2: ["612x792"], sizesDiffer: false,
        fonts1: ["Helvetica"], fonts2: ["Helvetica"], fontsDiffer: false,
        imageCounts1: [0], imageCounts2: [0], imageCountsDiffer: false,
      },
      pageCountDiff: { count1: 1, count2: 1, delta: 0, added: 0, removed: 0 },
      fontUsageDiff: [{ font: "Helvetica", count1: 1, count2: 1, delta: 0 }],
      summary: {
        mode: "full",
        pagesCompared: 0,
        textDifferences: 0,
        metadataDifferences: 0,
        structureDifferences: 0,
        overallSimilarity: 100,
        significantChanges: [],
      },
    };
    const json = renderJsonDiff(result);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("full");
    expect(parsed.summary.overallSimilarity).toBe(100);
    expect(parsed.fontUsageDiff[0].font).toBe("Helvetica");
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("pdf-compare history", () => {
  it("returns empty when nothing stored", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and reloads entries (newest first)", () => {
    saveHistory({
      ts: 1000,
      fileName1: "a.pdf",
      fileName2: "b.pdf",
      mode: "full",
      pagesCompared: 3,
      overallSimilarity: 90,
      textDifferences: 1,
      metadataDifferences: 0,
    });
    const second = saveHistory({
      ts: 2000,
      fileName1: "c.pdf",
      fileName2: "d.pdf",
      mode: "text-only",
      pagesCompared: 5,
      overallSimilarity: 80,
      textDifferences: 3,
      metadataDifferences: 0,
    });
    expect(second).toHaveLength(2);
    expect(second[0].fileName1).toBe("c.pdf");
    expect(second[1].fileName1).toBe("a.pdf");
  });

  it("caps history at HISTORY_MAX=20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName1: `a${i}.pdf`,
        fileName2: `b${i}.pdf`,
        mode: "full",
        pagesCompared: 0,
        overallSimilarity: 0,
        textDifferences: 0,
        metadataDifferences: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clearHistory empties the store", () => {
    saveHistory({
      ts: 1,
      fileName1: "a.pdf",
      fileName2: "b.pdf",
      mode: "full",
      pagesCompared: 0,
      overallSimilarity: 0,
      textDifferences: 0,
      metadataDifferences: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("pdf-compare shareable URL", () => {
  it("buildShareUrl includes only non-default params", () => {
    const url = buildShareUrl(DEFAULT_OPTIONS);
    // Defaults: mode=full (not encoded), ws=true (not encoded), case=false (not encoded), range=all (not encoded)
    expect(url).not.toContain("mode=");
    expect(url).not.toContain("ws=");
    expect(url).not.toContain("case=");
    expect(url).not.toContain("range=");
  });

  it("buildShareUrl encodes non-default options", () => {
    const url = buildShareUrl({
      comparisonMode: "text-only",
      ignoreWhitespace: false,
      ignoreCase: true,
      pageRange: "1-3",
    });
    expect(url).toContain("mode=text-only");
    expect(url).toContain("ws=0");
    expect(url).toContain("case=0");
    expect(url).toContain("range=1-3");
  });

  it("parseShareUrl round-trips default options", () => {
    const parsed = parseShareUrl(buildShareUrl(DEFAULT_OPTIONS));
    expect(parsed).toEqual({});
  });

  it("parseShareUrl round-trips non-default options", () => {
    const opts = {
      comparisonMode: "structure" as const,
      ignoreWhitespace: false,
      ignoreCase: true,
      pageRange: "1-3",
    };
    const parsed = parseShareUrl(buildShareUrl(opts));
    expect(parsed).toEqual(opts);
  });

  it("parseShareUrl ignores unknown mode values", () => {
    const parsed = parseShareUrl("#mode=bogus");
    expect(parsed.comparisonMode).toBeUndefined();
  });

  it("parseShareUrl returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
    expect(parseShareUrl("#")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validateOptions
// ---------------------------------------------------------------------------

describe("pdf-compare validateOptions", () => {
  it("passes for valid options", () => {
    const r = validateOptions(DEFAULT_OPTIONS);
    expect(r.ok).toBe(true);
  });

  it("fails for unknown mode", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      comparisonMode: "bogus" as never,
    });
    expect(r.ok).toBe(false);
  });

  it("fails for invalid page-range syntax", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      pageRange: "abc!def",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid page range/);
  });

  it("normalizes page range to 'all' when empty", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageRange).toBe("all");
  });
});
