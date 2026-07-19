import { describe, it, expect, beforeEach } from "vitest";
import {
  OUTPUT_FORMATS,
  FORMAT_LABELS,
  FORMAT_EXTENSIONS,
  FORMAT_MIME,
  DETECTION_METHODS,
  DEFAULT_OPTIONS,
  MIN_CONFIDENCE,
  MAX_CONFIDENCE,
  normalizePageRangeSpec,
  resolveAllRange,
  expandPageRange,
  detectCellType,
  formatNumericCell,
  clusterRows,
  detectColumnBoundaries,
  assignToColumns,
  mergeColumnItems,
  detectGridLines,
  detectHeader,
  detectMergedCells,
  scoreConfidence,
  scoreTableQuality,
  computeTableBoundary,
  computeColumnWidths,
  computeRowHeights,
  normalizeTableGrid,
  detectTable,
  detectMultipleTables,
  parseUserRules,
  computeSummaryStats,
  escapeXml,
  escapeCsv,
  escapeHtml,
  escapeMarkdown,
  renderTableCsv,
  renderCsv,
  renderTableHtml,
  renderHtml,
  renderTableJson,
  renderJson,
  renderTableMarkdown,
  renderMarkdown,
  renderOutput,
  getOutputFilename,
  buildSharedStrings,
  columnLetter,
  buildSheetXml,
  buildWorkbookXml,
  buildContentTypesXml,
  buildRootRelsXml,
  crc32,
  utf8Encode,
  buildZip,
  buildXlsxPackage,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TextPosition,
  type DetectedTable,
  type ExtractionResult,
  type ConvertOptions,
  type OutputFormat,
  type DetectionMethod,
  type UserRule,
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

function tp(text: string, x: number, y: number, pageNumber = 1, fontSize = 10, bold = false): TextPosition {
  return { text, x, y, pageNumber, fontSize, bold };
}

describe("pdf-table-extractor constants", () => {
  it("has 5 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(5);
    expect(OUTPUT_FORMATS).toContain("csv");
    expect(OUTPUT_FORMATS).toContain("excel-xlsx");
    expect(OUTPUT_FORMATS).toContain("html-table");
    expect(OUTPUT_FORMATS).toContain("json");
    expect(OUTPUT_FORMATS).toContain("markdown-table");
  });
  it("format labels are populated", () => {
    for (const f of OUTPUT_FORMATS) {
      expect(FORMAT_LABELS[f]).toBeTruthy();
    }
  });
  it("format extensions map correctly", () => {
    expect(FORMAT_EXTENSIONS["csv"]).toBe("csv");
    expect(FORMAT_EXTENSIONS["excel-xlsx"]).toBe("xlsx");
    expect(FORMAT_EXTENSIONS["html-table"]).toBe("html");
    expect(FORMAT_EXTENSIONS["json"]).toBe("json");
    expect(FORMAT_EXTENSIONS["markdown-table"]).toBe("md");
  });
  it("format MIME types map correctly", () => {
    expect(FORMAT_MIME["excel-xlsx"]).toContain("spreadsheetml");
    expect(FORMAT_MIME["csv"]).toBe("text/csv");
    expect(FORMAT_MIME["markdown-table"]).toBe("text/markdown");
  });
  it("has 4 detection methods", () => {
    expect(DETECTION_METHODS).toHaveLength(4);
    expect(DETECTION_METHODS).toContain("auto-detect");
    expect(DETECTION_METHODS).toContain("by-grid-lines");
    expect(DETECTION_METHODS).toContain("by-text-alignment");
    expect(DETECTION_METHODS).toContain("by-rules");
  });
  it("has sensible default options", () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe("csv");
    expect(DEFAULT_OPTIONS.detectionMethod).toBe("auto-detect");
    expect(DEFAULT_OPTIONS.includeHeaders).toBe(true);
    expect(DEFAULT_OPTIONS.mergeCells).toBe(true);
    expect(DEFAULT_OPTIONS.minConfidence).toBe(0.5);
  });
  it("confidence bounds are 0-1", () => {
    expect(MIN_CONFIDENCE).toBe(0);
    expect(MAX_CONFIDENCE).toBe(1);
  });
});

describe("pdf-table-extractor page range", () => {
  it("normalizes empty/all/*", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("ALL")).toBe("all");
    expect(normalizePageRangeSpec("*")).toBe("all");
  });
  it("strips whitespace", () => {
    expect(normalizePageRangeSpec("  1 - 3 , 5 ")).toBe("1-3,5");
  });
  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
    expect(resolveAllRange("all", 0)).toBe("1");
  });
  it("expands all to indices", () => {
    expect(expandPageRange("all", 4)).toEqual([0, 1, 2, 3]);
  });
  it("supports ranges + single pages + open-ended", () => {
    expect(expandPageRange("2-4", 5)).toEqual([1, 2, 3]);
    expect(expandPageRange("1,3,5", 5)).toEqual([0, 2, 4]);
    expect(expandPageRange("3-", 5)).toEqual([2, 3, 4]);
    expect(expandPageRange("-2", 5)).toEqual([0, 1]);
  });
  it("returns null for invalid", () => {
    expect(expandPageRange("abc", 5)).toBeNull();
    expect(expandPageRange("6", 5)).toBeNull();
  });
});

describe("pdf-table-extractor cell-type detection", () => {
  it("detects integers + decimals", () => {
    expect(detectCellType("42")).toBe("number");
    expect(detectCellType("-3.14")).toBe("number");
    expect(detectCellType("1,234,567")).toBe("number");
  });
  it("detects currency", () => {
    expect(detectCellType("$1,234.56")).toBe("currency");
    expect(detectCellType("€100")).toBe("currency");
    expect(detectCellType("USD 50.00")).toBe("currency");
  });
  it("detects dates", () => {
    expect(detectCellType("01/15/2024")).toBe("date");
    expect(detectCellType("2024-12-31")).toBe("date");
    expect(detectCellType("15 Jan 2024")).toBe("date");
  });
  it("detects percentages as number", () => {
    expect(detectCellType("42%")).toBe("number");
    expect(detectCellType("-3.14%")).toBe("number");
  });
  it("returns text for non-numeric", () => {
    expect(detectCellType("Hello")).toBe("text");
  });
  it("returns empty for empty", () => {
    expect(detectCellType("")).toBe("empty");
    expect(detectCellType("   ")).toBe("empty");
  });
});

describe("pdf-table-extractor formatNumericCell", () => {
  it("strips currency + thousands + decimal comma", () => {
    expect(formatNumericCell("$1,234.56", "currency")).toBe("1234.56");
    expect(formatNumericCell("€1.234,56", "currency")).toBe("1234.56");
    expect(formatNumericCell("USD 50.00", "currency")).toBe("50.00");
  });
  it("strips percent sign", () => {
    expect(formatNumericCell("42%", "number")).toBe("42");
  });
  it("leaves text + dates unchanged", () => {
    expect(formatNumericCell("Hello", "text")).toBe("Hello");
    expect(formatNumericCell("2024-01-15", "date")).toBe("2024-01-15");
  });
  it("returns empty for empty cells", () => {
    expect(formatNumericCell("", "empty")).toBe("");
  });
});

describe("pdf-table-extractor clusterRows", () => {
  it("clusters items by y within tolerance", () => {
    const items = [
      tp("A", 0, 100),
      tp("B", 50, 100),
      tp("C", 0, 50),
      tp("D", 50, 50),
    ];
    const rows = clusterRows(items, 3);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(2);
    expect(rows[1]).toHaveLength(2);
  });
  it("returns [] for empty input", () => {
    expect(clusterRows([], 3)).toEqual([]);
  });
  it("puts top-of-page first (descending y)", () => {
    const items = [tp("low", 0, 10), tp("high", 0, 100)];
    const rows = clusterRows(items, 3);
    expect(rows[0][0].text).toBe("high");
  });
});

describe("pdf-table-extractor detectColumnBoundaries", () => {
  it("finds column boundaries from x positions", () => {
    const rows = [
      [tp("A", 10, 100), tp("B", 200, 100), tp("C", 400, 100)],
      [tp("D", 10, 50), tp("E", 200, 50), tp("F", 400, 50)],
    ];
    const cols = detectColumnBoundaries(rows, 8);
    expect(cols).toEqual([10, 200, 400]);
  });
  it("clusters nearby x values", () => {
    const rows = [
      [tp("A", 10, 100), tp("B", 12, 100), tp("C", 200, 100)],
    ];
    const cols = detectColumnBoundaries(rows, 8);
    expect(cols).toHaveLength(2);
  });
  it("returns [] for empty input", () => {
    expect(detectColumnBoundaries([], 8)).toEqual([]);
  });
});

describe("pdf-table-extractor assignToColumns + mergeColumnItems", () => {
  it("assigns items to buckets by x", () => {
    const cols = [10, 200, 400];
    const row = [tp("A", 10, 100), tp("B", 200, 100), tp("C", 400, 100)];
    const buckets = assignToColumns(row, cols);
    expect(buckets[0]).toHaveLength(1);
    expect(buckets[1]).toHaveLength(1);
    expect(buckets[2]).toHaveLength(1);
  });
  it("merges multiple items in a bucket into one string", () => {
    const merged = mergeColumnItems([tp("Hello", 10, 100), tp("World", 12, 100)]);
    expect(merged.text).toBe("Hello World");
    expect(merged.bold).toBe(false);
  });
  it("returns empty for empty bucket", () => {
    expect(mergeColumnItems([])).toEqual({ text: "" });
  });
});

describe("pdf-table-extractor detectGridLines", () => {
  it("clusters nearby horizontal + vertical lines", () => {
    const segments = [
      { orientation: "horizontal" as const, pos: 100, start: 10, end: 400 },
      { orientation: "horizontal" as const, pos: 101, start: 10, end: 400 },
      { orientation: "vertical" as const, pos: 200, start: 50, end: 300 },
      { orientation: "vertical" as const, pos: 202, start: 50, end: 300 },
    ];
    const lines = detectGridLines(segments, 2);
    expect(lines).toHaveLength(2);
    const horiz = lines.filter((l) => l.orientation === "horizontal");
    const vert = lines.filter((l) => l.orientation === "vertical");
    expect(horiz).toHaveLength(1);
    expect(vert).toHaveLength(1);
    expect(horiz[0].pos).toBeGreaterThan(100);
    expect(horiz[0].pos).toBeLessThan(101);
  });
  it("returns [] for empty input", () => {
    expect(detectGridLines([], 2)).toEqual([]);
  });
});

describe("pdf-table-extractor detectHeader", () => {
  it("detects bold-only first row as header", () => {
    const rows = [
      [tp("Name", 0, 100, 1, 10, true), tp("Age", 50, 100, 1, 10, true)],
      [tp("Alice", 0, 50), tp("30", 50, 50)],
      [tp("Bob", 0, 10), tp("25", 50, 10)],
    ];
    expect(detectHeader(rows)).toBe(true);
  });
  it("detects text-only first row over numeric below", () => {
    const rows = [
      [tp("Name", 0, 100), tp("Age", 50, 100)],
      [tp("Alice", 0, 50), tp("30", 50, 50)],
    ];
    expect(detectHeader(rows)).toBe(true);
  });
  it("returns false for empty rows", () => {
    expect(detectHeader([])).toBe(false);
    expect(detectHeader([[]])).toBe(false);
  });
});

describe("pdf-table-extractor detectMergedCells", () => {
  it("detects rowSpan for repeated text in same column", () => {
    const rows = [
      [{ text: "A", type: "text" as const }, { text: "B", type: "text" as const }],
      [{ text: "A", type: "text" as const }, { text: "X", type: "text" as const }],
      [{ text: "A", type: "text" as const }, { text: "Y", type: "text" as const }],
    ];
    const merged = detectMergedCells(rows);
    expect(merged[0][0].rowSpan).toBe(3);
    // Continuations should be cleared
    expect(merged[1][0].text).toBe("");
    expect(merged[2][0].text).toBe("");
  });
  it("detects colSpan for repeated text in same row", () => {
    const rows = [
      [
        { text: "Hi", type: "text" as const },
        { text: "Hi", type: "text" as const },
        { text: "Hi", type: "text" as const },
      ],
    ];
    const merged = detectMergedCells(rows);
    expect(merged[0][0].colSpan).toBe(3);
    expect(merged[0][1].text).toBe("");
    expect(merged[0][2].text).toBe("");
  });
  it("returns empty rows unchanged", () => {
    expect(detectMergedCells([])).toEqual([]);
  });
});

describe("pdf-table-extractor scoreConfidence + scoreTableQuality", () => {
  it("returns 0 for too-few rows or columns", () => {
    expect(scoreConfidence([], [])).toBe(0);
    expect(scoreConfidence([[tp("a", 0, 0)]], [0])).toBe(0);
  });
  it("returns a value in [0, 1] for valid input", () => {
    const items = [
      tp("A", 10, 100), tp("B", 200, 100),
      tp("C", 10, 50), tp("D", 200, 50),
    ];
    const rows = clusterRows(items, 3);
    const cols = detectColumnBoundaries(rows, 8);
    const c = scoreConfidence(rows, cols);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
  it("scoreTableQuality is confidence × 100", () => {
    const items = [
      tp("A", 10, 100), tp("B", 200, 100),
      tp("C", 10, 50), tp("D", 200, 50),
    ];
    const rows = clusterRows(items, 3);
    const cols = detectColumnBoundaries(rows, 8);
    const q = scoreTableQuality(rows, cols);
    const c = scoreConfidence(rows, cols);
    expect(q).toBe(Math.round(c * 100));
  });
});

describe("pdf-table-extractor computeTableBoundary", () => {
  it("computes bounding rect of items", () => {
    const items = [
      tp("A", 10, 100, 1, 10),
      tp("BB", 200, 50, 1, 10),
    ];
    const b = computeTableBoundary(items);
    expect(b.x).toBe(10);
    expect(b.width).toBeGreaterThan(0);
    expect(b.height).toBeGreaterThan(0);
  });
  it("returns zero rect for empty items", () => {
    const b = computeTableBoundary([]);
    expect(b.x).toBe(0);
    expect(b.width).toBe(0);
  });
});

describe("pdf-table-extractor computeColumnWidths + computeRowHeights", () => {
  const table: DetectedTable = {
    pageNumber: 1,
    tableIndex: 0,
    hasHeader: true,
    quality: 80,
    confidence: 0.8,
    boundary: { x: 0, y: 0, width: 100, height: 50 },
    gridLines: [],
    rows: [
      [{ text: "Name", type: "text", isHeader: true }, { text: "Age", type: "number", isHeader: true }],
      [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
      [{ text: "Bob", type: "text" }, { text: "25", type: "number" }],
    ],
  };
  it("computeColumnWidths returns max chars per column (min 3, max 60)", () => {
    const w = computeColumnWidths(table);
    expect(w).toHaveLength(2);
    expect(w[0]).toBe(5); // "Alice" is 5 chars
    expect(w[1]).toBe(3);
  });
  it("computeRowHeights returns 1 for single-line cells", () => {
    const h = computeRowHeights(table);
    expect(h).toEqual([1, 1, 1]);
  });
  it("computeColumnWidths returns [] for empty table", () => {
    expect(computeColumnWidths({ ...table, rows: [] })).toEqual([]);
  });
});

describe("pdf-table-extractor normalizeTableGrid", () => {
  it("pads ragged rows to the max column count", () => {
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 50,
      confidence: 0.5,
      boundary: { x: 0, y: 0, width: 0, height: 0 },
      gridLines: [],
      rows: [
        [{ text: "A", type: "text" }, { text: "B", type: "text" }, { text: "C", type: "text" }],
        [{ text: "D", type: "text" }],
      ],
    };
    const norm = normalizeTableGrid(table);
    expect(norm.rows[1]).toHaveLength(3);
    expect(norm.rows[1][2].type).toBe("empty");
  });
  it("leaves already-rectangular tables unchanged", () => {
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 50,
      confidence: 0.5,
      boundary: { x: 0, y: 0, width: 0, height: 0 },
      gridLines: [],
      rows: [
        [{ text: "A", type: "text" }, { text: "B", type: "text" }],
        [{ text: "C", type: "text" }, { text: "D", type: "text" }],
      ],
    };
    const norm = normalizeTableGrid(table);
    expect(norm.rows).toEqual(table.rows);
  });
});

describe("pdf-table-extractor detectTable", () => {
  it("detects a simple 2×2 table", () => {
    const items = [
      tp("Name", 10, 100), tp("Age", 200, 100),
      tp("Alice", 10, 50), tp("30", 200, 50),
    ];
    const t = detectTable(items, 1, 0, "auto-detect", true, true);
    expect(t).not.toBeNull();
    expect(t!.rows.length).toBeGreaterThanOrEqual(2);
    expect(t!.rows[0].length).toBeGreaterThanOrEqual(2);
    expect(t!.confidence).toBeGreaterThan(0);
  });
  it("returns null for too-few items", () => {
    expect(detectTable([tp("a", 0, 0)], 1, 0, "auto-detect", true, true)).toBeNull();
  });
  it("returns null when only one column is found", () => {
    const items = [
      tp("A", 10, 100), tp("B", 11, 100),
      tp("C", 10, 50), tp("D", 11, 50),
    ];
    // All x clustered to single column
    expect(detectTable(items, 1, 0, "by-grid-lines", true, true)).toBeNull();
  });
  it("respects user rules for columnXs", () => {
    const items = [
      tp("A", 10, 100), tp("B", 200, 100),
      tp("C", 10, 50), tp("D", 200, 50),
    ];
    const rules: UserRule = { columnXs: [10, 200], minCols: 2 };
    const t = detectTable(items, 1, 0, "by-rules", true, true, rules);
    expect(t).not.toBeNull();
  });
});

describe("pdf-table-extractor detectMultipleTables", () => {
  it("splits items at large y-gaps", () => {
    const items = [
      tp("A", 10, 500), tp("B", 200, 500),
      tp("C", 10, 490), tp("D", 200, 490),
      // Large gap
      tp("E", 10, 100), tp("F", 200, 100),
      tp("G", 10, 90), tp("H", 200, 90),
    ];
    const tables = detectMultipleTables(items, 1, "auto-detect", true, true);
    expect(tables.length).toBeGreaterThanOrEqual(1);
  });
  it("returns [] for too-few items", () => {
    expect(detectMultipleTables([tp("a", 0, 0)], 1, "auto-detect", true, true)).toEqual([]);
  });
});

describe("pdf-table-extractor parseUserRules", () => {
  it("parses JSON rules", () => {
    const r = parseUserRules('{"columnXs": [50, 200, 350, 500], "rowYTolerance": 4}');
    expect(r).not.toBeNull();
    expect(r!.columnXs).toEqual([50, 200, 350, 500]);
    expect(r!.rowYTolerance).toBe(4);
  });
  it("parses line-based rules", () => {
    const r = parseUserRules("cols: 50, 200, 350\nytol: 4\nminrows: 2\nmincols: 2");
    expect(r).not.toBeNull();
    expect(r!.columnXs).toEqual([50, 200, 350]);
    expect(r!.rowYTolerance).toBe(4);
    expect(r!.minRows).toBe(2);
    expect(r!.minCols).toBe(2);
  });
  it("returns null for empty input", () => {
    expect(parseUserRules("")).toBeNull();
    expect(parseUserRules("   ")).toBeNull();
  });
  it("returns null for invalid JSON", () => {
    expect(parseUserRules("{not json")).toBeNull();
  });
  it("returns null when no rules recognized", () => {
    expect(parseUserRules("hello world")).toBeNull();
  });
});

describe("pdf-table-extractor computeSummaryStats", () => {
  it("aggregates stats across tables", () => {
    const result: ExtractionResult = {
      tables: [
        {
          pageNumber: 1, tableIndex: 0, hasHeader: true,
          quality: 80, confidence: 0.8,
          boundary: { x: 0, y: 0, width: 100, height: 50 },
          gridLines: [],
          rows: [
            [{ text: "Name", type: "text", isHeader: true }, { text: "Age", type: "number", isHeader: true }],
            [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
            [{ text: "Bob", type: "text" }, { text: "25", type: "number" }],
          ],
        },
      ],
      detectionMethod: "auto-detect",
      outputFormat: "csv",
      includeHeaders: true,
      mergeCells: true,
      minConfidence: 0.5,
    };
    const s = computeSummaryStats(result);
    expect(s.totalTables).toBe(1);
    expect(s.totalRows).toBe(3);
    expect(s.totalCells).toBe(6);
    expect(s.filledCells).toBe(6);
    expect(s.emptyCells).toBe(0);
    expect(s.byCellType.text).toBe(3);
    expect(s.byCellType.number).toBe(3);
    expect(s.avgQuality).toBe(80);
    expect(s.avgConfidence).toBeCloseTo(0.8, 5);
  });
});

describe("pdf-table-extractor escaping", () => {
  it("escapeXml escapes all 5 special chars", () => {
    expect(escapeXml(`<a>"b" & 'c'</a>`)).toContain("&lt;a&gt;");
    expect(escapeXml(`&`)).toBe("&amp;");
  });
  it("escapeCsv quotes when needed", () => {
    expect(escapeCsv("Hello, World")).toBe('"Hello, World"');
    expect(escapeCsv('Say "hi"')).toBe('"Say ""hi"""');
    expect(escapeCsv("plain")).toBe("plain");
  });
  it("escapeHtml escapes 4 special chars", () => {
    expect(escapeHtml(`<a href="x">`)).toContain("&lt;a href=&quot;x&quot;&gt;");
  });
  it("escapeMarkdown escapes pipes + newlines", () => {
    expect(escapeMarkdown("a|b")).toBe("a\\|b");
    expect(escapeMarkdown("a\nb")).toBe("a b");
  });
});

describe("pdf-table-extractor renderers", () => {
  const table: DetectedTable = {
    pageNumber: 1,
    tableIndex: 0,
    hasHeader: true,
    quality: 80,
    confidence: 0.8,
    boundary: { x: 0, y: 0, width: 100, height: 50 },
    gridLines: [],
    rows: [
      [{ text: "Name", type: "text", isHeader: true }, { text: "Age", type: "number", isHeader: true }],
      [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
    ],
  };
  const result: ExtractionResult = {
    tables: [table],
    detectionMethod: "auto-detect",
    outputFormat: "csv",
    includeHeaders: true,
    mergeCells: true,
    minConfidence: 0.5,
  };
  it("renderTableCsv produces comma-separated rows", () => {
    const csv = renderTableCsv(table);
    expect(csv).toContain("Name,Age");
    expect(csv).toContain("Alice,30");
  });
  it("renderCsv wraps tables with a comment header", () => {
    const csv = renderCsv(result);
    expect(csv).toContain("# Table 1");
    expect(csv).toContain("page 1");
  });
  it("renderTableHtml produces a <table>", () => {
    const html = renderTableHtml(table);
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("cell-text");
    expect(html).toContain("Alice");
  });
  it("renderHtml produces a full HTML document", () => {
    const html = renderHtml(result);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("<table");
  });
  it("renderTableJson returns 2D string array", () => {
    const arr = renderTableJson(table);
    expect(arr).toEqual([["Name", "Age"], ["Alice", "30"]]);
  });
  it("renderJson produces JSON with table metadata", () => {
    const json = renderJson(result);
    const parsed = JSON.parse(json);
    expect(parsed[0].page).toBe(1);
    expect(parsed[0].confidence).toBe(0.8);
    expect(parsed[0].rows[0]).toEqual(["Name", "Age"]);
  });
  it("renderTableMarkdown produces a Markdown table", () => {
    const md = renderTableMarkdown(table);
    expect(md).toContain("| Name | Age |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| Alice | 30 |");
  });
  it("renderMarkdown produces section headers per table", () => {
    const md = renderMarkdown(result);
    expect(md).toContain("## Table 1");
    expect(md).toContain("Confidence:");
  });
  it("renderOutput dispatches by format", () => {
    expect(renderOutput({ ...result, outputFormat: "csv" })).toContain("Name,Age");
    expect(renderOutput({ ...result, outputFormat: "html-table" })).toContain("<table");
    expect(renderOutput({ ...result, outputFormat: "json" })).toContain('"page"');
    expect(renderOutput({ ...result, outputFormat: "markdown-table" })).toContain("| Name");
    expect(renderOutput({ ...result, outputFormat: "excel-xlsx" })).toContain("XLSX");
  });
  it("getOutputFilename uses format extension", () => {
    expect(getOutputFilename("csv", "report.pdf")).toBe("report.csv");
    expect(getOutputFilename("excel-xlsx", "report.pdf")).toBe("report.xlsx");
    expect(getOutputFilename("markdown-table", "report.pdf")).toBe("report.md");
  });
});

describe("pdf-table-extractor XLSX generation", () => {
  const table: DetectedTable = {
    pageNumber: 1,
    tableIndex: 0,
    hasHeader: true,
    quality: 80,
    confidence: 0.8,
    boundary: { x: 0, y: 0, width: 100, height: 50 },
    gridLines: [],
    rows: [
      [{ text: "Name", type: "text", isHeader: true }, { text: "Age", type: "number", isHeader: true }],
      [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
    ],
  };
  const result: ExtractionResult = {
    tables: [table],
    detectionMethod: "auto-detect",
    outputFormat: "excel-xlsx",
    includeHeaders: true,
    mergeCells: true,
    minConfidence: 0.5,
  };
  it("buildSharedStrings collects unique strings", () => {
    const { xml, index } = buildSharedStrings([table]);
    expect(xml).toContain("<sst");
    expect(index.has("Name")).toBe(true);
    expect(index.has("Alice")).toBe(true);
  });
  it("columnLetter converts 0→A, 25→Z, 26→AA", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
  });
  it("buildSheetXml emits rows with cell refs", () => {
    const { index } = buildSharedStrings([table]);
    const sheetXml = buildSheetXml([table], index);
    expect(sheetXml).toContain("<row r=\"1\"");
    expect(sheetXml).toContain("r=\"A1\"");
    // Text-type cells reference shared strings by index.
    const aliceIdx = index.get("Alice");
    expect(aliceIdx).toBeDefined();
    expect(sheetXml).toContain(`<v>${aliceIdx}</v>`);
    // Number-type cells emit the raw value.
    expect(sheetXml).toContain("<v>30</v>");
  });
  it("buildWorkbookXml + ContentTypes + RootRels are valid XML", () => {
    expect(buildWorkbookXml()).toContain("<workbook");
    expect(buildContentTypesXml()).toContain("<Types");
    expect(buildRootRelsXml()).toContain("<Relationships");
  });
  it("buildXlsxPackage returns a valid ZIP byte array", () => {
    const bytes = buildXlsxPackage(result);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
    // ZIP files start with 0x50 0x4B ("PK")
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4B);
  });
});

describe("pdf-table-extractor crc32 + utf8Encode", () => {
  it("crc32 of empty array is 0", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("crc32 of 'Hello' is deterministic", () => {
    const c1 = crc32(utf8Encode("Hello"));
    const c2 = crc32(utf8Encode("Hello"));
    expect(c1).toBe(c2);
    expect(c1).not.toBe(0);
  });
  it("utf8Encode handles ASCII + Unicode", () => {
    expect(utf8Encode("abc").length).toBe(3);
    expect(utf8Encode("★")).toHaveLength(3); // U+2605 → 3 UTF-8 bytes
  });
});

describe("pdf-table-extractor buildZip", () => {
  it("packs multiple files into a ZIP starting with PK", () => {
    const files = [
      { name: "a.txt", bytes: utf8Encode("hello") },
      { name: "b.txt", bytes: utf8Encode("world") },
    ];
    const zip = buildZip(files);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4B); // K
    // End-of-central-directory signature should appear near the end
    const lastBytes = Array.from(zip.slice(-22));
    const sig = lastBytes[0] + (lastBytes[1] << 8) + (lastBytes[2] << 16) + (lastBytes[3] << 24);
    expect(sig >>> 0).toBe(0x06054b50);
  });
  it("preserves file contents (via CRC)", () => {
    const bytes = utf8Encode("test content");
    const zip = buildZip([{ name: "test.txt", bytes }]);
    // ZIP local file header starts at offset 0, file data starts after the 30-byte header + name length
    const nameLen = "test.txt".length;
    const dataStart = 30 + nameLen;
    const restored = zip.slice(dataStart, dataStart + bytes.length);
    expect(Array.from(restored)).toEqual(Array.from(bytes));
  });
});

describe("pdf-table-extractor history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveHistory({
      ts: 1000, fileName: "f.pdf", pageCount: 5,
      tableCount: 3, cellCount: 50, format: "csv", method: "auto-detect",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].fileName).toBe("f.pdf");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `f${i}.pdf`, pageCount: 1,
        tableCount: i, cellCount: i, format: "csv", method: "auto-detect",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clearHistory empties the store", () => {
    saveHistory({
      ts: 1, fileName: "x.pdf", pageCount: 1,
      tableCount: 1, cellCount: 1, format: "csv", method: "auto-detect",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-table-extractor share URL", () => {
  const opts: ConvertOptions = {
    pageRange: "1-3",
    detectionMethod: "by-grid-lines",
    outputFormat: "excel-xlsx",
    includeHeaders: false,
    mergeCells: false,
    minConfidence: 0.7,
  };
  it("buildShareUrl encodes options", () => {
    const url = buildShareUrl(opts);
    expect(url).toContain("range=1-3");
    expect(url).toContain("method=by-grid-lines");
    expect(url).toContain("format=excel-xlsx");
    expect(url).toContain("headers=0");
    expect(url).toContain("merge=0");
    expect(url).toContain("conf=0.7");
  });
  it("parseShareUrl round-trips options", () => {
    const url = buildShareUrl(opts);
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed.pageRange).toBe("1-3");
    expect(parsed.detectionMethod).toBe("by-grid-lines");
    expect(parsed.outputFormat).toBe("excel-xlsx");
    expect(parsed.includeHeaders).toBe(false);
    expect(parsed.mergeCells).toBe(false);
    expect(parsed.minConfidence).toBeCloseTo(0.7, 5);
  });
  it("parseShareUrl ignores unknown values", () => {
    const parsed = parseShareUrl("#method=unknown&format=bad");
    expect(parsed.detectionMethod).toBeUndefined();
    expect(parsed.outputFormat).toBeUndefined();
  });
  it("parseShareUrl returns {} for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
    expect(parseShareUrl("#")).toEqual({});
  });
});

describe("pdf-table-extractor validateOptions", () => {
  const base: ConvertOptions = {
    pageRange: "all",
    detectionMethod: "auto-detect",
    outputFormat: "csv",
    includeHeaders: true,
    mergeCells: true,
    minConfidence: 0.5,
  };
  it("passes for valid options", () => {
    const r = validateOptions(base, 5);
    expect(r.ok).toBe(true);
  });
  it("fails for unknown output format", () => {
    const r = validateOptions({ ...base, outputFormat: "xml" as OutputFormat }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for unknown detection method", () => {
    const r = validateOptions({ ...base, detectionMethod: "magic" as DetectionMethod }, 5);
    expect(r.ok).toBe(false);
  });
  it("fails for out-of-range minConfidence", () => {
    expect(validateOptions({ ...base, minConfidence: -1 }, 5).ok).toBe(false);
    expect(validateOptions({ ...base, minConfidence: 2 }, 5).ok).toBe(false);
  });
  it("fails for invalid page range", () => {
    expect(validateOptions({ ...base, pageRange: "abc" }, 5).ok).toBe(false);
  });
});
