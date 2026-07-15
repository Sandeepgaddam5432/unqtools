import { describe, it, expect, beforeEach } from "vitest";
import {
  parseJsonInput, flattenObject,
  detectColumns, inferCellType, toCellValue,
  generateSheetXml,
  convertJsonToXlsx,
  detectEncoding, stripBom, previewRows, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS,
  type ColumnDetectionMode,
} from "./logic";
import { SharedStrings } from "../csv-to-excel-converter/logic";

// ===== parseJsonInput =====

describe("json2xlsx parseJsonInput", () => {
  it("parses a JSON array of objects", () => {
    const r = parseJsonInput(`[{"a":1,"b":2},{"a":3,"b":4}]`);
    expect(r.shape).toBe("array");
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]).toEqual({ a: 1, b: 2 });
  });

  it("parses a single JSON object", () => {
    const r = parseJsonInput(`{"name":"Alice","age":30}`);
    expect(r.shape).toBe("object");
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]).toEqual({ name: "Alice", age: 30 });
  });

  it("parses JSONL (one object per line)", () => {
    const r = parseJsonInput(`{"a":1}\n{"a":2}\n{"a":3}`);
    expect(r.shape).toBe("jsonl");
    expect(r.rows.length).toBe(3);
    expect(r.lineCount).toBe(3);
  });

  it("parses JSONL with blank lines (skipped)", () => {
    const r = parseJsonInput(`{"a":1}\n\n{"a":2}\n`);
    expect(r.rows.length).toBe(2);
  });

  it("parses JSONL with mixed object/array lines", () => {
    const r = parseJsonInput(`{"a":1}\n[{"b":2},{"b":3}]`);
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]).toEqual({ a: 1 });
    expect(r.rows[1]).toEqual({ b: 2 });
    expect(r.rows[2]).toEqual({ b: 3 });
  });

  it("handles JSONL with primitive values", () => {
    const r = parseJsonInput(`42\n"hello"\ntrue`);
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]).toEqual({ value: 42 });
    expect(r.rows[1]).toEqual({ value: "hello" });
    expect(r.rows[2]).toEqual({ value: true });
  });

  it("returns errors for invalid JSONL lines", () => {
    const r = parseJsonInput(`{"a":1}\ninvalid\n{"a":2}`);
    expect(r.rows.length).toBe(2);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]!.line).toBe(2);
  });

  it("returns empty shape for empty input", () => {
    expect(parseJsonInput("").shape).toBe("empty");
    expect(parseJsonInput("   ").shape).toBe("empty");
  });

  it("returns errors for invalid JSON", () => {
    const r = parseJsonInput(`{invalid json}`);
    expect(r.shape).toBe("empty");
    expect(r.errors.length).toBe(1);
  });

  it("flattens nested objects in array rows", () => {
    const r = parseJsonInput(`[{"a":{"b":1}},{"a":{"b":2}}]`);
    expect(r.rows[0]).toEqual({ "a.b": 1 });
    expect(r.rows[1]).toEqual({ "a.b": 2 });
  });

  it("handles a single-line JSON array (no JSONL)", () => {
    const r = parseJsonInput(`[{"a":1},{"a":2}]`);
    expect(r.shape).toBe("array");
    expect(r.rows.length).toBe(2);
  });

  it("handles JSON array with primitive values (wrapped)", () => {
    const r = parseJsonInput(`[1, 2, 3]`);
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]).toEqual({ value: 1 });
  });
});

// ===== flattenObject =====

describe("json2xlsx flattenObject", () => {
  it("flattens a nested object using dot notation", () => {
    const flat = flattenObject({ a: { b: { c: 1 } } });
    expect(flat).toEqual({ "a.b.c": 1 });
  });

  it("preserves top-level keys", () => {
    const flat = flattenObject({ a: 1, b: 2 });
    expect(flat).toEqual({ a: 1, b: 2 });
  });

  it("handles arrays of primitives (stringified)", () => {
    const flat = flattenObject({ tags: ["a", "b", "c"] });
    expect(flat.tags).toBe(JSON.stringify(["a", "b", "c"]));
  });

  it("expands arrays of objects", () => {
    const flat = flattenObject({ items: [{ x: 1 }, { x: 2 }] });
    expect(flat["items[0].x"]).toBe(1);
    expect(flat["items[1].x"]).toBe(2);
  });

  it("respects maxDepth", () => {
    const flat = flattenObject({ a: { b: { c: 1 } } }, { maxDepth: 1 });
    expect(flat.a).toBe(JSON.stringify({ b: { c: 1 } }));
  });

  it("handles null values", () => {
    const flat = flattenObject({ a: null, b: { c: null } });
    expect(flat.a).toBeNull();
    expect(flat["b.c"]).toBeNull();
  });

  it("handles undefined values", () => {
    const flat = flattenObject({ a: undefined as unknown as string });
    expect(flat.a).toBeUndefined();
  });

  it("handles mixed nested and flat keys", () => {
    const flat = flattenObject({ id: 1, user: { name: "Alice", address: { city: "NYC" } } });
    expect(flat).toEqual({
      id: 1,
      "user.name": "Alice",
      "user.address.city": "NYC",
    });
  });

  it("handles custom separator", () => {
    const flat = flattenObject({ a: { b: 1 } }, { separator: "_" });
    expect(flat).toEqual({ a_b: 1 });
  });

  it("handles empty object", () => {
    expect(flattenObject({})).toEqual({});
  });
});

// ===== detectColumns =====

describe("json2xlsx detectColumns", () => {
  it("uses first row's keys in 'first' mode", () => {
    const rows = [{ a: 1, b: 2 }, { a: 3, c: 4 }];
    expect(detectColumns(rows, { mode: "first" })).toEqual(["a", "b"]);
  });

  it("unions all keys in 'union' mode", () => {
    const rows = [{ a: 1, b: 2 }, { a: 3, c: 4 }];
    const cols = detectColumns(rows, { mode: "union" });
    expect(cols.sort()).toEqual(["a", "b", "c"]);
  });

  it("intersects keys in 'intersection' mode", () => {
    const rows = [{ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }];
    expect(detectColumns(rows, { mode: "intersection" })).toEqual(["a", "b"]);
  });

  it("returns empty for empty rows", () => {
    expect(detectColumns([], { mode: "first" })).toEqual([]);
  });

  it("uses explicit columns when provided", () => {
    const rows = [{ a: 1, b: 2 }];
    expect(detectColumns(rows, { mode: "first", columns: ["x", "y"] })).toEqual(["x", "y"]);
  });

  it("returns intersection even when one row has zero matching keys", () => {
    const rows = [{ a: 1 }, { b: 2 }];
    expect(detectColumns(rows, { mode: "intersection" })).toEqual([]);
  });
});

// ===== inferCellType =====

describe("json2xlsx inferCellType", () => {
  it("detects numbers", () => {
    expect(inferCellType(42)).toBe("number");
    expect(inferCellType(3.14)).toBe("number");
    expect(inferCellType(-7)).toBe("number");
    expect(inferCellType(0)).toBe("number");
  });
  it("treats NaN and Infinity as text", () => {
    expect(inferCellType(NaN)).toBe("text");
    expect(inferCellType(Infinity)).toBe("text");
  });
  it("detects booleans", () => {
    expect(inferCellType(true)).toBe("boolean");
    expect(inferCellType(false)).toBe("boolean");
  });
  it("detects ISO dates", () => {
    expect(inferCellType("2026-01-15")).toBe("date");
    expect(inferCellType("2026-01-15T10:30:00")).toBe("date");
    expect(inferCellType("2026-01-15T10:30:00Z")).toBe("date");
    expect(inferCellType("2026-01-15 10:30")).toBe("date");
  });
  it("detects text", () => {
    expect(inferCellType("hello")).toBe("text");
    expect(inferCellType("")).toBe("text");
  });
  it("returns empty for null/undefined", () => {
    expect(inferCellType(null)).toBe("empty");
    expect(inferCellType(undefined)).toBe("empty");
  });
  it("treats objects as text", () => {
    expect(inferCellType({ a: 1 })).toBe("text");
    expect(inferCellType([1, 2, 3])).toBe("text");
  });
});

// ===== toCellValue =====

describe("json2xlsx toCellValue", () => {
  it("converts number", () => {
    const c = toCellValue(42);
    expect(c.type).toBe("number");
    expect(c.raw).toBe("42");
  });
  it("converts boolean to 0/1", () => {
    expect(toCellValue(true).raw).toBe("1");
    expect(toCellValue(false).raw).toBe("0");
  });
  it("converts date string", () => {
    const c = toCellValue("2026-01-15");
    expect(c.type).toBe("date");
    expect(c.raw).toBe("2026-01-15");
  });
  it("returns empty for null", () => {
    expect(toCellValue(null).type).toBe("empty");
    expect(toCellValue(null).raw).toBe("");
  });
  it("returns text for strings", () => {
    expect(toCellValue("hello").type).toBe("text");
    expect(toCellValue("hello").raw).toBe("hello");
  });
  it("forceText overrides detection", () => {
    expect(toCellValue(42, true).type).toBe("text");
    expect(toCellValue(true, true).type).toBe("text");
  });
});

// ===== generateSheetXml =====

describe("json2xlsx generateSheetXml", () => {
  it("generates valid worksheet XML", () => {
    const sheet = {
      name: "Sheet1",
      columns: ["a", "b"],
      rows: [{ a: 1, b: 2 }],
    };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("<worksheet");
    expect(result.xml).toContain("<sheetData>");
    expect(result.xml).toContain("<c r=\"A1\"");
    expect(result.xml).toContain("<v>1</v>"); // number value
  });

  it("emits boolean cells with t=b", () => {
    const sheet = {
      name: "Sheet1",
      columns: ["flag"],
      rows: [{ flag: true }],
    };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("t=\"b\"");
    expect(result.xml).toContain("<v>1</v>");
  });

  it("emits shared strings for text cells", () => {
    const sheet = {
      name: "Sheet1",
      columns: ["name"],
      rows: [{ name: "Alice" }],
    };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("t=\"s\"");
  });

  it("emits empty cells with no value", () => {
    const sheet = {
      name: "Sheet1",
      columns: ["a", "b"],
      rows: [{ a: 1 }], // missing 'b'
    };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("<c r=\"B2\"/>"); // empty cell
  });

  it("includes column widths when autoFit is on", () => {
    const sheet = {
      name: "Sheet1",
      columns: ["name", "age"],
      rows: [{ name: "Alice", age: 30 }],
    };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("<cols>");
    expect(result.xml).toContain("customWidth");
  });

  it("forceText=true forces all cells to text", () => {
    const sheet = {
      name: "Sheet1",
      columns: ["v"],
      rows: [{ v: 42 }],
    };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, { ...DEFAULT_OPTIONS, forceText: true }, ss);
    expect(result.xml).toContain("t=\"s\"");
    expect(result.xml).not.toContain("<v>42</v>"); // shouldn't have raw number
  });
});

// ===== convertJsonToXlsx (top-level) =====

describe("json2xlsx convertJsonToXlsx", () => {
  it("converts a single JSON array to XLSX", async () => {
    const result = convertJsonToXlsx(
      [{ fileName: "data.json", content: `[{"name":"Alice","age":30},{"name":"Bob","age":25}]` }],
      DEFAULT_OPTIONS,
      "data.xlsx",
    );
    expect(result.fileName).toBe("data.xlsx");
    expect(result.stats.sheetCount).toBe(1);
    expect(result.stats.totalRows).toBe(2);
    expect(result.stats.totalCells).toBe(4);
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(0x50); // ZIP magic
    expect(buf[1]).toBe(0x4b);
  });

  it("converts multiple JSON files into multi-sheet workbook", () => {
    const result = convertJsonToXlsx([
      { fileName: "a.json", content: `[{"x":1}]` },
      { fileName: "b.json", content: `[{"x":2}]` },
    ]);
    expect(result.stats.sheetCount).toBe(2);
    expect(result.stats.totalRows).toBe(2);
  });

  it("converts JSONL input", () => {
    const result = convertJsonToXlsx([
      { fileName: "logs.jsonl", content: `{"ts":"2026-01-01","msg":"hello"}\n{"ts":"2026-01-02","msg":"world"}` },
    ]);
    expect(result.stats.sheetCount).toBe(1);
    expect(result.stats.totalRows).toBe(2);
  });

  it("flattens nested objects", () => {
    const result = convertJsonToXlsx([
      { fileName: "data.json", content: `[{"user":{"name":"Alice"},"age":30}]` },
    ]);
    expect(result.stats.totalCells).toBe(2); // user.name + age
  });

  it("throws on empty input", () => {
    expect(() => convertJsonToXlsx([])).toThrow();
  });

  it("handles empty JSON array", () => {
    const result = convertJsonToXlsx([{ fileName: "empty.json", content: `[]` }]);
    expect(result.stats.totalRows).toBe(0);
  });

  it("uses union column detection", () => {
    const result = convertJsonToXlsx(
      [{ fileName: "data.json", content: `[{"a":1},{"b":2}]` }],
      { ...DEFAULT_OPTIONS, columnMode: "union" },
    );
    // Union mode picks up both 'a' and 'b' columns. With 2 rows × 2 cols,
    // total cells = 4 (missing values become empty cells in the XLSX).
    expect(result.stats.totalCells).toBe(4);
    expect(result.stats.totalRows).toBe(2);
  });

  it("uses intersection column detection", () => {
    const result = convertJsonToXlsx(
      [{ fileName: "data.json", content: `[{"a":1,"b":2},{"a":3,"b":4,"c":5}]` }],
      { ...DEFAULT_OPTIONS, columnMode: "intersection" },
    );
    // Only 'a' and 'b' are in every row → 2 cols × 2 rows = 4 cells
    expect(result.stats.totalCells).toBe(4);
  });

  it("respects flattenDepth", () => {
    const result = convertJsonToXlsx(
      [{ fileName: "data.json", content: `[{"a":{"b":{"c":1}}}]` }],
      { ...DEFAULT_OPTIONS, flattenDepth: 1 },
    );
    // With depth=1, "a" is a key but its value (object) gets stringified.
    expect(result.stats.totalCells).toBe(1);
  });

  it("uses custom sheet name", () => {
    const result = convertJsonToXlsx(
      [{ fileName: "data.json", content: `[{"a":1}]`, sheetName: "MySheet" }],
    );
    expect(result.stats.sheetCount).toBe(1);
  });

  it("preserves boolean and number cell types", async () => {
    const result = convertJsonToXlsx(
      [{ fileName: "data.json", content: `[{"flag":true,"count":42}]` }],
    );
    // Verify the generated XLSX contains the expected cell types by re-reading it
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    const text = new TextDecoder().decode(buf);
    // The sheet1.xml should contain t="b" for boolean and a raw number for the count
    expect(text).toContain("t=\"b\"");
    expect(text).toContain("<v>42</v>");
  });
});

// ===== detectEncoding / stripBom =====

describe("json2xlsx detectEncoding", () => {
  it("detects UTF-8 BOM", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x68]))).toEqual({ encoding: "UTF-8", hasBom: true });
  });
  it("detects UTF-16LE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xff, 0xfe]))).toEqual({ encoding: "UTF-16LE", hasBom: true });
  });
  it("defaults to UTF-8 without BOM", () => {
    expect(detectEncoding(new Uint8Array([0x68, 0x69]))).toEqual({ encoding: "UTF-8", hasBom: false });
  });
});

describe("json2xlsx stripBom", () => {
  it("strips BOM from string", () => {
    expect(stripBom("\uFEFFhello")).toBe("hello");
  });
  it("returns string unchanged if no BOM", () => {
    expect(stripBom("hello")).toBe("hello");
  });
});

// ===== previewRows =====

describe("json2xlsx previewRows", () => {
  it("returns limited rows as objects", () => {
    const rows = [{ a: 1, b: "x" }, { a: 2, b: "y" }, { a: 3, b: "z" }];
    const preview = previewRows(["a", "b"], rows, 2);
    expect(preview.length).toBe(2);
    expect(preview[0]).toEqual({ a: "1", b: "x" });
    expect(preview[1]).toEqual({ a: "2", b: "y" });
  });

  it("handles null and undefined values", () => {
    const rows = [{ a: null, b: undefined as unknown as string }];
    const preview = previewRows(["a", "b"], rows);
    expect(preview[0]).toEqual({ a: "", b: "" });
  });

  it("stringifies object values", () => {
    const rows = [{ a: { x: 1 } }];
    const preview = previewRows(["a"], rows);
    expect(preview[0]!.a).toBe(JSON.stringify({ x: 1 }));
  });
});

// ===== formatBytes =====

describe("json2xlsx formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History (localStorage) =====

describe("json2xlsx history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      outputFileName: "out.xlsx", sheetCount: 2, totalRows: 10, totalCells: 20,
      xlsxBytes: 1024, convertedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        outputFileName: `f${i}.xlsx`, sheetCount: 1, totalRows: 1, totalCells: 1,
        xlsxBytes: 100, convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      outputFileName: "x.xlsx", sheetCount: 1, totalRows: 1, totalCells: 1,
      xlsxBytes: 100, convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("json2xlsx share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/json-to-excel-converter",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, columnMode: "union" });
    expect(url).toContain("mode=union");
    expect(url).toContain("forceText=false");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, forceText: true });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.forceText).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("parses depth as Infinity for non-positive values", () => {
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, flattenDepth: 0 });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.flattenDepth).toBe(Infinity);
  });
});
