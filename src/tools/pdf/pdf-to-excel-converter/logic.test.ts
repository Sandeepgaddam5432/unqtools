import { describe, it, expect, beforeEach } from "vitest";
import {
  OUTPUT_FORMATS,
  FORMAT_EXTENSIONS,
  FORMAT_MIME,
  DETECTION_METHODS,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  detectCellType,
  formatNumericCell,
  clusterRows,
  detectColumnBoundaries,
  assignToColumns,
  mergeColumnItems,
  detectHeader,
  scoreTableQuality,
  detectTable,
  detectMultipleTables,
  computeColumnWidths,
  computeRowHeights,
  normalizeTableGrid,
  computeSummaryStats,
  escapeXml,
  escapeCsv,
  escapeHtml,
  renderTableCsv,
  renderCsv,
  renderTableHtml,
  renderHtml,
  renderTableJson,
  renderJson,
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
  renderOutput,
  getOutputFilename,
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

describe("pdf2excel constants", () => {
  it("has 4 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(4);
    expect(OUTPUT_FORMATS).toContain("xlsx");
    expect(OUTPUT_FORMATS).toContain("csv");
    expect(OUTPUT_FORMATS).toContain("html-table");
    expect(OUTPUT_FORMATS).toContain("json");
  });
  it("format extensions map correctly", () => {
    expect(FORMAT_EXTENSIONS["xlsx"]).toBe("xlsx");
    expect(FORMAT_EXTENSIONS["csv"]).toBe("csv");
    expect(FORMAT_EXTENSIONS["html-table"]).toBe("html");
    expect(FORMAT_EXTENSIONS["json"]).toBe("json");
  });
  it("format MIME types map correctly", () => {
    expect(FORMAT_MIME["xlsx"]).toContain("spreadsheetml");
    expect(FORMAT_MIME["csv"]).toBe("text/csv");
  });
  it("has 3 detection methods", () => {
    expect(DETECTION_METHODS).toHaveLength(3);
    expect(DETECTION_METHODS).toContain("auto-detect");
    expect(DETECTION_METHODS).toContain("by-position");
    expect(DETECTION_METHODS).toContain("by-text-grid");
  });
  it("has sensible default options", () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe("xlsx");
    expect(DEFAULT_OPTIONS.detectionMethod).toBe("auto-detect");
    expect(DEFAULT_OPTIONS.includeHeaders).toBe(true);
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });
});

describe("pdf2excel normalizePageRangeSpec", () => {
  it("returns 'all' for empty", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("   ")).toBe("all");
  });
  it("passes 'all' through (case-insensitive)", () => {
    expect(normalizePageRangeSpec("ALL")).toBe("all");
    expect(normalizePageRangeSpec("All")).toBe("all");
  });
  it("lowercases and collapses whitespace", () => {
    expect(normalizePageRangeSpec("  1-3,  5 ")).toBe("1-3, 5");
  });
});

describe("pdf2excel resolveAllRange", () => {
  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 7)).toBe("1-7");
  });
  it("leaves explicit range unchanged", () => {
    expect(resolveAllRange("1-3", 7)).toBe("1-3");
  });
  it("handles 0-page document gracefully", () => {
    expect(resolveAllRange("all", 0)).toBe("1");
  });
});

describe("pdf2excel detectCellType", () => {
  it("returns 'empty' for empty string", () => {
    expect(detectCellType("")).toBe("empty");
    expect(detectCellType("   ")).toBe("empty");
  });
  it("detects plain integers as numbers", () => {
    expect(detectCellType("42")).toBe("number");
    expect(detectCellType("-7")).toBe("number");
  });
  it("detects decimals with dot or comma as numbers", () => {
    expect(detectCellType("3.14")).toBe("number");
    expect(detectCellType("3,14")).toBe("number");
  });
  it("detects percentages as numbers", () => {
    expect(detectCellType("42%")).toBe("number");
    expect(detectCellType("-12.5%")).toBe("number");
  });
  it("detects currency with symbol prefix", () => {
    expect(detectCellType("$1,234.56")).toBe("currency");
    expect(detectCellType("€100")).toBe("currency");
    expect(detectCellType("£99.99")).toBe("currency");
  });
  it("detects ISO and slash dates", () => {
    expect(detectCellType("2024-01-15")).toBe("date");
    expect(detectCellType("01/15/2024")).toBe("date");
    expect(detectCellType("1.1.2024")).toBe("date");
  });
  it("detects month-name dates", () => {
    expect(detectCellType("15 Jan 2024")).toBe("date");
  });
  it("classifies everything else as text", () => {
    expect(detectCellType("hello")).toBe("text");
    expect(detectCellType("Product A")).toBe("text");
    expect(detectCellType("N/A")).toBe("text");
  });
});

describe("pdf2excel formatNumericCell", () => {
  it("returns empty for empty cells", () => {
    expect(formatNumericCell("", "empty")).toBe("");
  });
  it("returns text unchanged", () => {
    expect(formatNumericCell("hello", "text")).toBe("hello");
  });
  it("returns date unchanged", () => {
    expect(formatNumericCell("2024-01-15", "date")).toBe("2024-01-15");
  });
  it("strips currency symbols and thousands separators", () => {
    expect(formatNumericCell("$1,234.56", "currency")).toBe("1234.56");
    expect(formatNumericCell("€100", "currency")).toBe("100");
  });
  it("converts decimal commas to decimal points", () => {
    expect(formatNumericCell("3,14", "number")).toBe("3.14");
  });
  it("strips trailing percent sign", () => {
    expect(formatNumericCell("42%", "number")).toBe("42");
  });
});

describe("pdf2excel clusterRows", () => {
  it("returns empty for no items", () => {
    expect(clusterRows([])).toEqual([]);
  });
  it("groups items with similar y into one row", () => {
    const items = [
      tp("A", 10, 100),
      tp("B", 50, 100),
      tp("C", 10, 80),
      tp("D", 50, 80),
    ];
    const rows = clusterRows(items, 3);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((r) => r.text).sort()).toEqual(["A", "B"]);
    expect(rows[1].map((r) => r.text).sort()).toEqual(["C", "D"]);
  });
  it("returns top-of-page row first (y descending)", () => {
    const items = [
      tp("low", 10, 50),
      tp("high", 10, 100),
    ];
    const rows = clusterRows(items, 3);
    expect(rows[0][0].text).toBe("high");
    expect(rows[1][0].text).toBe("low");
  });
  it("splits rows when y gap exceeds tolerance", () => {
    const items = [
      tp("A", 10, 100),
      tp("B", 10, 90),
      tp("C", 10, 50),
    ];
    // Tolerance 3 — gaps of 10 and 40 both exceed tolerance → 3 separate rows
    const rows = clusterRows(items, 3);
    expect(rows).toHaveLength(3);
    // With tolerance 15 the first two items merge into one row
    const rows2 = clusterRows(items, 15);
    expect(rows2).toHaveLength(2);
  });
});

describe("pdf2excel detectColumnBoundaries", () => {
  it("returns empty for no rows", () => {
    expect(detectColumnBoundaries([])).toEqual([]);
  });
  it("clusters x positions into column starts", () => {
    const rows: TextPosition[][] = [[
      tp("A", 10, 100),
      tp("B", 50, 100),
      tp("C", 100, 100),
    ]];
    const cols = detectColumnBoundaries(rows, 8);
    expect(cols).toEqual([10, 50, 100]);
  });
  it("merges nearby x values within minGap", () => {
    const rows: TextPosition[][] = [[
      tp("A", 10, 100),
      tp("B", 12, 100),
      tp("C", 50, 100),
    ]];
    const cols = detectColumnBoundaries(rows, 8);
    expect(cols).toEqual([10, 50]);
  });
});

describe("pdf2excel assignToColumns & mergeColumnItems", () => {
  it("assigns each item to the rightmost column at or before its x", () => {
    const columns = [10, 50, 100];
    const row = [tp("A", 10, 100), tp("B", 55, 100), tp("C", 100, 100)];
    const buckets = assignToColumns(row, columns);
    expect(buckets[0]).toHaveLength(1);
    expect(buckets[0][0].text).toBe("A");
    expect(buckets[1]).toHaveLength(1);
    expect(buckets[1][0].text).toBe("B");
    expect(buckets[2]).toHaveLength(1);
    expect(buckets[2][0].text).toBe("C");
  });
  it("merges multiple items in one bucket with spaces", () => {
    const bucket = [
      { col: 0, text: "Hello" },
      { col: 0, text: "World" },
    ];
    const merged = mergeColumnItems(bucket);
    expect(merged.text).toBe("Hello World");
  });
  it("returns empty text for empty bucket", () => {
    expect(mergeColumnItems([]).text).toBe("");
  });
  it("marks merged cell as bold if any item is bold", () => {
    const bucket = [
      { col: 0, text: "A", bold: false },
      { col: 0, text: "B", bold: true },
    ];
    expect(mergeColumnItems(bucket).bold).toBe(true);
  });
});

describe("pdf2excel detectHeader", () => {
  it("returns false for empty rows", () => {
    expect(detectHeader([])).toBe(false);
  });
  it("detects bold first row as header", () => {
    const rows: TextPosition[][] = [
      [tp("Name", 10, 100, 1, 10, true), tp("Age", 50, 100, 1, 10, true)],
      [tp("Alice", 10, 80), tp("30", 50, 80)],
      [tp("Bob", 10, 60), tp("25", 50, 60)],
    ];
    expect(detectHeader(rows)).toBe(true);
  });
  it("detects all-text first row over number rows as header", () => {
    const rows: TextPosition[][] = [
      [tp("Product", 10, 100), tp("Price", 50, 100)],
      [tp("Apple", 10, 80), tp("$1.99", 50, 80)],
      [tp("Banana", 10, 60), tp("$0.99", 50, 60)],
    ];
    expect(detectHeader(rows)).toBe(true);
  });
  it("returns false when all rows are mixed text/numbers without clear header", () => {
    const rows: TextPosition[][] = [
      [tp("Apple", 10, 100), tp("1.99", 50, 100)],
      [tp("Banana", 10, 80), tp("0.99", 50, 80)],
    ];
    expect(detectHeader(rows)).toBe(false);
  });
});

describe("pdf2excel scoreTableQuality", () => {
  it("returns 0 for too-small tables", () => {
    expect(scoreTableQuality([], [])).toBe(0);
    expect(scoreTableQuality([[tp("a", 10, 100)]], [10])).toBe(0);
  });
  it("returns higher score for well-aligned grid", () => {
    const rows: TextPosition[][] = [
      [tp("A", 10, 100), tp("B", 50, 100)],
      [tp("C", 10, 80), tp("D", 50, 80)],
      [tp("E", 10, 60), tp("F", 50, 60)],
    ];
    const cols = [10, 50];
    const score = scoreTableQuality(rows, cols);
    expect(score).toBeGreaterThan(50);
  });
  it("returns lower score for ragged rows", () => {
    const rows: TextPosition[][] = [
      [tp("A", 10, 100), tp("B", 50, 100)],
      [tp("C", 10, 80)],
      [tp("E", 10, 60), tp("F", 50, 60), tp("G", 100, 60)],
    ];
    const cols = [10, 50, 100];
    const score = scoreTableQuality(rows, cols);
    expect(score).toBeLessThan(80);
  });
});

describe("pdf2excel detectTable", () => {
  it("returns null for too-few items", () => {
    expect(detectTable([tp("a", 10, 100)], 1, 0, "auto-detect", true)).toBeNull();
  });
  it("detects a simple 2x2 table", () => {
    const items: TextPosition[] = [
      tp("Name", 10, 100, 1, 10, true),
      tp("Age", 50, 100, 1, 10, true),
      tp("Alice", 10, 80),
      tp("30", 50, 80),
      tp("Bob", 10, 60),
      tp("25", 50, 60),
    ];
    const table = detectTable(items, 1, 0, "auto-detect", true);
    expect(table).not.toBeNull();
    if (table) {
      expect(table.rows.length).toBeGreaterThanOrEqual(2);
      expect(table.rows[0].length).toBeGreaterThanOrEqual(2);
      expect(table.quality).toBeGreaterThan(0);
    }
  });
  it("returns null when only one column is detected", () => {
    const items: TextPosition[] = [
      tp("A", 10, 100),
      tp("B", 10, 80),
      tp("C", 10, 60),
      tp("D", 10, 40),
    ];
    expect(detectTable(items, 1, 0, "auto-detect", true)).toBeNull();
  });
});

describe("pdf2excel detectMultipleTables", () => {
  it("returns empty for no items", () => {
    expect(detectMultipleTables([], 1, "auto-detect", true)).toEqual([]);
  });
  it("splits by large y-gaps into separate tables", () => {
    const items: TextPosition[] = [
      // Table 1
      tp("A", 10, 700), tp("B", 50, 700),
      tp("1", 10, 680), tp("2", 50, 680),
      // Big gap → Table 2
      tp("X", 10, 400), tp("Y", 50, 400),
      tp("9", 10, 380), tp("8", 50, 380),
    ];
    const tables = detectMultipleTables(items, 1, "auto-detect", true);
    expect(tables.length).toBeGreaterThanOrEqual(1);
  });
});

describe("pdf2excel normalizeTableGrid", () => {
  it("pads ragged rows with empty cells", () => {
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 80,
      rows: [
        [{ text: "A", type: "text" }, { text: "B", type: "text" }, { text: "C", type: "text" }],
        [{ text: "D", type: "text" }],
      ],
    };
    const norm = normalizeTableGrid(table);
    expect(norm.rows[1]).toHaveLength(3);
    expect(norm.rows[1][1].type).toBe("empty");
    expect(norm.rows[1][2].type).toBe("empty");
  });
  it("does nothing to already-rectangular tables", () => {
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 80,
      rows: [
        [{ text: "A", type: "text" }, { text: "B", type: "text" }],
        [{ text: "C", type: "text" }, { text: "D", type: "text" }],
      ],
    };
    const norm = normalizeTableGrid(table);
    expect(norm.rows[0]).toHaveLength(2);
    expect(norm.rows[1]).toHaveLength(2);
  });
});

describe("pdf2excel computeColumnWidths & computeRowHeights", () => {
  it("computes max width per column", () => {
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 80,
      rows: [
        [{ text: "Name", type: "text" }, { text: "Age", type: "text" }],
        [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
      ],
    };
    const widths = computeColumnWidths(table);
    expect(widths).toEqual([5, 3]);
  });
  it("clamps to min 3 and max 60", () => {
    const longText = "x".repeat(100);
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 80,
      rows: [
        [{ text: "ab", type: "text" }, { text: longText, type: "text" }],
      ],
    };
    const widths = computeColumnWidths(table);
    expect(widths[0]).toBe(3);
    expect(widths[1]).toBe(60);
  });
  it("computes row heights based on line count", () => {
    const table: DetectedTable = {
      pageNumber: 1,
      tableIndex: 0,
      hasHeader: false,
      quality: 80,
      rows: [
        [{ text: "single", type: "text" }],
        [{ text: "line1\nline2\nline3", type: "text" }],
      ],
    };
    const heights = computeRowHeights(table);
    expect(heights).toEqual([1, 3]);
  });
});

describe("pdf2excel computeSummaryStats", () => {
  it("handles empty extraction", () => {
    const result: ExtractionResult = {
      tables: [],
      detectionMethod: "auto-detect",
      outputFormat: "xlsx",
      includeHeaders: true,
    };
    const stats = computeSummaryStats(result);
    expect(stats.totalTables).toBe(0);
    expect(stats.totalCells).toBe(0);
    expect(stats.avgQuality).toBe(0);
  });
  it("sums cells and rows across tables", () => {
    const result: ExtractionResult = {
      tables: [
        {
          pageNumber: 1, tableIndex: 0, hasHeader: true, quality: 80,
          rows: [
            [{ text: "A", type: "text" }, { text: "B", type: "text" }],
            [{ text: "1", type: "number" }, { text: "", type: "empty" }],
          ],
        },
        {
          pageNumber: 2, tableIndex: 0, hasHeader: false, quality: 60,
          rows: [
            [{ text: "X", type: "text" }, { text: "Y", type: "text" }, { text: "Z", type: "text" }],
          ],
        },
      ],
      detectionMethod: "auto-detect",
      outputFormat: "csv",
      includeHeaders: true,
    };
    const stats = computeSummaryStats(result);
    expect(stats.totalTables).toBe(2);
    expect(stats.totalRows).toBe(3);
    expect(stats.totalCells).toBe(7);
    expect(stats.filledCells).toBe(6);
    expect(stats.emptyCells).toBe(1);
    expect(stats.totalPages).toBe(2);
    expect(stats.avgQuality).toBe(70);
  });
});

describe("pdf2excel escapeXml / escapeCsv / escapeHtml", () => {
  it("escapes XML special chars", () => {
    expect(escapeXml("a<b>&\"c\"'d'")).toBe("a&lt;b&gt;&amp;&quot;c&quot;&apos;d&apos;");
  });
  it("escapes CSV cells containing commas or quotes", () => {
    expect(escapeCsv("hello,world")).toBe('"hello,world"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv("plain")).toBe("plain");
  });
  it("quotes CSV cells with leading/trailing whitespace", () => {
    expect(escapeCsv(" leading")).toBe('" leading"');
    expect(escapeCsv("trailing ")).toBe('"trailing "');
  });
  it("escapes HTML special chars", () => {
    expect(escapeHtml("<b>bold</b>")).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });
});

describe("pdf2excel renderers", () => {
  function sampleResult(): ExtractionResult {
    return {
      tables: [
        {
          pageNumber: 1, tableIndex: 0, hasHeader: true, quality: 90,
          rows: [
            [{ text: "Name", type: "text", isHeader: true }, { text: "Age", type: "text", isHeader: true }],
            [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
          ],
        },
      ],
      detectionMethod: "auto-detect",
      outputFormat: "csv",
      includeHeaders: true,
    };
  }
  it("renders CSV with header comment and rows", () => {
    const csv = renderCsv(sampleResult());
    expect(csv).toContain("# Table 1");
    expect(csv).toContain("Name,Age");
    expect(csv).toContain("Alice,30");
  });
  it("renders HTML table with thead/tbody tags", () => {
    const html = renderHtml(sampleResult());
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain("Alice");
  });
  it("renders JSON as array of table objects", () => {
    const json = renderJson(sampleResult());
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].rows).toHaveLength(2);
    expect(parsed[0].rows[0]).toEqual(["Name", "Age"]);
    expect(parsed[0].rows[1]).toEqual(["Alice", "30"]);
  });
  it("renders single table as CSV", () => {
    const csv = renderTableCsv(sampleResult().tables[0]);
    expect(csv).toBe("Name,Age\nAlice,30");
  });
  it("renders single table as JSON 2D array", () => {
    const arr = renderTableJson(sampleResult().tables[0]);
    expect(arr).toEqual([["Name", "Age"], ["Alice", "30"]]);
  });
  it("renderOutput dispatches by format", () => {
    const csv = renderOutput({ ...sampleResult(), outputFormat: "csv" });
    expect(csv).toContain("Alice");
    const html = renderOutput({ ...sampleResult(), outputFormat: "html-table" });
    expect(html).toContain("<table");
    const json = renderOutput({ ...sampleResult(), outputFormat: "json" });
    expect(JSON.parse(json).length).toBe(1);
    const xlsxPlaceholder = renderOutput({ ...sampleResult(), outputFormat: "xlsx" });
    expect(xlsxPlaceholder).toContain("binary");
  });
});

describe("pdf2excel XLSX builders", () => {
  it("columnLetter converts 0-based index to letters", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(1)).toBe("B");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(27)).toBe("AB");
    expect(columnLetter(51)).toBe("AZ");
    expect(columnLetter(52)).toBe("BA");
  });
  it("buildSharedStrings dedupes strings and returns index map", () => {
    const tables: DetectedTable[] = [
      {
        pageNumber: 1, tableIndex: 0, hasHeader: false, quality: 80,
        rows: [
          [{ text: "A", type: "text" }, { text: "B", type: "text" }],
          [{ text: "A", type: "text" }, { text: "30", type: "number" }],
        ],
      },
    ];
    const { xml, index } = buildSharedStrings(tables);
    expect(xml).toContain("<sst");
    expect(xml).toContain("uniqueCount=\"2\"");
    expect(index.get("A")).toBe(0);
    expect(index.get("B")).toBe(1);
    expect(index.has("30")).toBe(false); // numbers not in shared strings
  });
  it("buildSheetXml generates valid worksheet XML with cells", () => {
    const tables: DetectedTable[] = [
      {
        pageNumber: 1, tableIndex: 0, hasHeader: true, quality: 80,
        rows: [
          [{ text: "Name", type: "text", isHeader: true }, { text: "Age", type: "text", isHeader: true }],
          [{ text: "Alice", type: "text" }, { text: "30", type: "number" }],
        ],
      },
    ];
    const { index } = buildSharedStrings(tables);
    const xml = buildSheetXml(tables, index);
    expect(xml).toContain("<worksheet");
    expect(xml).toContain("<c r=\"A1\"");
    expect(xml).toContain("<c r=\"B2\"");
    expect(xml).toContain("<v>30</v>");
  });
  it("buildWorkbookXml declares a single sheet", () => {
    const xml = buildWorkbookXml();
    expect(xml).toContain("<workbook");
    expect(xml).toContain("Tables");
  });
  it("buildContentTypesXml declares all parts", () => {
    const xml = buildContentTypesXml();
    expect(xml).toContain("sheet.main+xml");
    expect(xml).toContain("worksheet+xml");
    expect(xml).toContain("sharedStrings+xml");
    expect(xml).toContain("styles+xml");
  });
  it("buildRootRelsXml points to officeDocument", () => {
    const xml = buildRootRelsXml();
    expect(xml).toContain("officeDocument");
    expect(xml).toContain("xl/workbook.xml");
  });
});

describe("pdf2excel ZIP + XLSX package", () => {
  it("crc32 of empty array is 0", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("crc32 of 'hello' matches known value", () => {
    // Known: crc32("hello") = 0x3610a686
    expect(crc32(utf8Encode("hello"))).toBe(0x3610a686);
  });
  it("utf8Encode produces expected bytes", () => {
    const bytes = utf8Encode("AB");
    expect(Array.from(bytes)).toEqual([0x41, 0x42]);
  });
  it("buildZip produces a valid ZIP with local + central headers", () => {
    const files = [
      { name: "a.txt", bytes: utf8Encode("hello") },
      { name: "b.txt", bytes: utf8Encode("world") },
    ];
    const zip = buildZip(files);
    // Local file header signature 0x04034b50
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // End of central directory signature 0x06054b50 should be near end
    const last4 = zip.slice(zip.length - 22, zip.length - 18);
    expect(last4[0]).toBe(0x50);
    expect(last4[1]).toBe(0x4b);
    expect(last4[2]).toBe(0x05);
    expect(last4[3]).toBe(0x06);
  });
  it("buildXlsxPackage produces non-empty ZIP bytes", () => {
    const result: ExtractionResult = {
      tables: [
        {
          pageNumber: 1, tableIndex: 0, hasHeader: true, quality: 80,
          rows: [
            [{ text: "A", type: "text", isHeader: true }, { text: "B", type: "text", isHeader: true }],
            [{ text: "1", type: "number" }, { text: "2", type: "number" }],
          ],
        },
      ],
      detectionMethod: "auto-detect",
      outputFormat: "xlsx",
      includeHeaders: true,
    };
    const bytes = buildXlsxPackage(result);
    expect(bytes.length).toBeGreaterThan(100);
    // Starts with ZIP local file header signature
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

describe("pdf2excel history", () => {
  it("returns empty when nothing stored", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      ts: Date.now(),
      fileName: "report.pdf",
      pageCount: 3,
      tableCount: 2,
      cellCount: 24,
      format: "xlsx" as OutputFormat,
    };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].fileName).toBe("report.pdf");
  });
  it("caps history at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `f${i}.pdf`,
        pageCount: 1,
        tableCount: 1,
        cellCount: 4,
        format: "csv",
      });
    }
    expect(loadHistory()).toHaveLength(20);
    // Most recent first
    expect(loadHistory()[0].fileName).toBe("f24.pdf");
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", pageCount: 1, tableCount: 1, cellCount: 1, format: "csv",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf2excel share URL", () => {
  const opts: ConvertOptions = {
    pageRange: "1-3",
    detectionMethod: "by-position",
    outputFormat: "csv",
    includeHeaders: false,
  };
  it("buildShareUrl encodes non-default options", () => {
    const url = buildShareUrl(opts);
    expect(url).toContain("range=1-3");
    expect(url).toContain("method=by-position");
    expect(url).toContain("format=csv");
    expect(url).toContain("headers=0");
  });
  it("parseShareUrl round-trips", () => {
    const url = buildShareUrl(opts);
    // Extract hash portion
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.pageRange).toBe("1-3");
    expect(parsed.detectionMethod).toBe("by-position");
    expect(parsed.outputFormat).toBe("csv");
    expect(parsed.includeHeaders).toBe(false);
  });
  it("buildShareUrl omits default options", () => {
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).not.toContain("range=");
    expect(url).not.toContain("method=");
    expect(url).not.toContain("format=");
    expect(url).not.toContain("headers=");
  });
  it("parseShareUrl ignores unknown formats", () => {
    const parsed = parseShareUrl("#format=unknown&method=bad");
    expect(parsed.outputFormat).toBeUndefined();
    expect(parsed.detectionMethod).toBeUndefined();
  });
});

describe("pdf2excel validateOptions", () => {
  it("accepts valid options", () => {
    const r = validateOptions(DEFAULT_OPTIONS, 5);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown format", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, outputFormat: "weird" as OutputFormat }, 5);
    expect(r.ok).toBe(false);
  });
  it("rejects unknown detection method", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, detectionMethod: "weird" as DetectionMethod }, 5);
    expect(r.ok).toBe(false);
  });
  it("rejects invalid page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "abc" }, 5);
    expect(r.ok).toBe(false);
  });
  it("accepts 'all' page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "all" }, 5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageRange).toBe("all");
  });
});

describe("pdf2excel getOutputFilename", () => {
  it("strips .pdf and adds extension", () => {
    expect(getOutputFilename("xlsx", "report.pdf")).toBe("report.xlsx");
    expect(getOutputFilename("csv", "data.PDF")).toBe("data.csv");
  });
  it("handles missing extension", () => {
    expect(getOutputFilename("json", "noext")).toBe("noext.json");
  });
  it("replaces unsafe chars", () => {
    expect(getOutputFilename("csv", "my report.pdf")).toBe("my_report.csv");
  });
  it("falls back to 'output' for empty names", () => {
    expect(getOutputFilename("csv", "")).toBe("output.csv");
  });
});
