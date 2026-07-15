import { describe, it, expect, beforeEach } from "vitest";
import {
  detectDelimiter, parseCsvRows, parseCsv,
  detectCellType, toCellValue, dateToExcelSerial,
  SharedStrings, xmlEscape, xmlAttrEscape, sanitizeSheetName, columnLetter, computeColumnWidth,
  generateSheetXml, generateWorkbookXml, generateWorkbookRelsXml, generateContentTypesXml,
  generateRootRelsXml, generateStylesXml,
  createZipBlob,
  convertCsvsToXlsx,
  detectEncoding, stripBom, previewRows, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS,
} from "./logic";

// ===== detectDelimiter =====

describe("csv2xlsx detectDelimiter", () => {
  it("detects comma", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });
  it("detects tab", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });
  it("detects semicolon", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });
  it("detects pipe", () => {
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });
  it("defaults to comma for no delimiters", () => {
    expect(detectDelimiter("hello world")).toBe(",");
  });
});

// ===== parseCsvRows =====

describe("csv2xlsx parseCsvRows", () => {
  it("parses simple CSV", () => {
    expect(parseCsvRows("a,b\nc,d", ",")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("handles quoted fields", () => {
    expect(parseCsvRows('"hello, world",b', ",")).toEqual([["hello, world", "b"]]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsvRows('"say ""hi"""', ",")).toEqual([['say "hi"']]);
  });
  it("handles embedded newlines", () => {
    expect(parseCsvRows('"line1\nline2",b', ",")).toEqual([["line1\nline2", "b"]]);
  });
  it("handles CRLF", () => {
    expect(parseCsvRows("a,b\r\n1,2", ",")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("filters empty rows", () => {
    expect(parseCsvRows("a,b\n\n\nc,d", ",")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("trims whitespace when option set", () => {
    expect(parseCsvRows("  a  ,  b  ", ",", true)).toEqual([["a", "b"]]);
  });
});

// ===== parseCsv =====

describe("csv2xlsx parseCsv", () => {
  it("parses with header", () => {
    const parsed = parseCsv("name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(parsed.headers).toEqual(["name", "age"]);
    expect(parsed.rows).toEqual([["Alice", "30"]]);
  });
  it("parses without header", () => {
    const parsed = parseCsv("a,b\nc,d", { delimiter: ",", hasHeader: false });
    expect(parsed.headers).toEqual([]);
    expect(parsed.rows).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("auto-detects delimiter", () => {
    const parsed = parseCsv("a;b\nc;d", { delimiter: "auto", hasHeader: false });
    expect(parsed.rows).toEqual([["a", "b"], ["c", "d"]]);
  });
});

// ===== detectCellType =====

describe("csv2xlsx detectCellType", () => {
  it("detects integers", () => {
    expect(detectCellType("42")).toBe("number");
    expect(detectCellType("-7")).toBe("number");
    expect(detectCellType("0")).toBe("number");
  });
  it("detects decimals", () => {
    expect(detectCellType("3.14")).toBe("number");
    expect(detectCellType("-0.5")).toBe("number");
  });
  it("detects scientific notation", () => {
    expect(detectCellType("1e10")).toBe("number");
    expect(detectCellType("1.5E-3")).toBe("number");
  });
  it("detects percentages as number", () => {
    expect(detectCellType("50%")).toBe("number");
  });
  it("detects booleans", () => {
    expect(detectCellType("true")).toBe("boolean");
    expect(detectCellType("FALSE")).toBe("boolean");
    expect(detectCellType("yes")).toBe("boolean");
    expect(detectCellType("No")).toBe("boolean");
  });
  it("detects ISO dates", () => {
    expect(detectCellType("2026-01-15")).toBe("date");
  });
  it("detects slash dates", () => {
    expect(detectCellType("01/15/2026")).toBe("date");
    expect(detectCellType("1/15/26")).toBe("date");
  });
  it("detects ISO datetimes", () => {
    expect(detectCellType("2026-01-15T10:30:00")).toBe("date");
    expect(detectCellType("2026-01-15 10:30")).toBe("date");
  });
  it("detects times", () => {
    expect(detectCellType("10:30")).toBe("date");
    expect(detectCellType("10:30:45")).toBe("date");
  });
  it("treats plain text as text", () => {
    expect(detectCellType("hello world")).toBe("text");
    expect(detectCellType("00123")).toBe("text"); // leading zero
    expect(detectCellType("12-3")).toBe("text"); // not a date
  });
  it("treats empty string as text", () => {
    expect(detectCellType("")).toBe("text");
  });
});

// ===== toCellValue =====

describe("csv2xlsx toCellValue", () => {
  it("converts number", () => {
    const v = toCellValue("42");
    expect(v.type).toBe("number");
    expect(v.raw).toBe("42");
  });
  it("converts boolean true variants", () => {
    expect(toCellValue("true").raw).toBe("true");
    expect(toCellValue("YES").raw).toBe("true");
    expect(toCellValue("T").raw).toBe("true");
  });
  it("converts boolean false variants", () => {
    expect(toCellValue("false").raw).toBe("false");
    expect(toCellValue("no").raw).toBe("false");
  });
  it("converts percent to fraction", () => {
    expect(toCellValue("50%").raw).toBe("0.5");
  });
  it("forceText overrides detection", () => {
    expect(toCellValue("42", true).type).toBe("text");
  });
});

// ===== dateToExcelSerial =====

describe("csv2xlsx dateToExcelSerial", () => {
  it("converts 1900-01-01 to ~1", () => {
    // Excel treats 1900-01-01 as serial 1, but our epoch is 1899-12-30
    // 1900-01-01 should be ~2 days after epoch
    const serial = dateToExcelSerial("1900-01-01");
    expect(serial).toBeCloseTo(2, 0);
  });
  it("converts 2026-01-01 to a large serial", () => {
    const serial = dateToExcelSerial("2026-01-01");
    expect(serial).toBeGreaterThan(46000);
  });
  it("returns 0 for invalid date", () => {
    expect(dateToExcelSerial("not a date")).toBe(0);
  });
});

// ===== SharedStrings =====

describe("csv2xlsx SharedStrings", () => {
  it("deduplicates strings", () => {
    const ss = new SharedStrings();
    const idx1 = ss.add("hello");
    const idx2 = ss.add("hello");
    const idx3 = ss.add("world");
    expect(idx1).toBe(idx2);
    expect(idx3).toBe(1);
    expect(ss.size).toBe(2);
  });
  it("generates XML", () => {
    const ss = new SharedStrings();
    ss.add("hello");
    ss.add("world");
    const xml = ss.toXml();
    expect(xml).toContain("<si>");
    expect(xml).toContain("hello");
    expect(xml).toContain("world");
    expect(xml).toContain('uniqueCount="2"');
  });
  it("escapes XML chars in strings", () => {
    const ss = new SharedStrings();
    ss.add("a < b & c > d");
    const xml = ss.toXml();
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&gt;");
    expect(xml).not.toContain("a < b & c > d");
  });
});

// ===== XML escaping helpers =====

describe("csv2xlsx xmlEscape", () => {
  it("escapes all special chars", () => {
    expect(xmlEscape('a<b>"c"&d\'e')).toBe("a&lt;b&gt;&quot;c&quot;&amp;d&apos;e");
  });
  it("escapes ampersand first", () => {
    expect(xmlEscape("&amp;")).toBe("&amp;amp;");
  });
});

describe("csv2xlsx xmlAttrEscape", () => {
  it("escapes attribute chars", () => {
    expect(xmlAttrEscape('a"b<c>')).toBe("a&quot;b&lt;c&gt;");
  });
});

// ===== Sheet name + column helpers =====

describe("csv2xlsx sanitizeSheetName", () => {
  it("removes invalid chars", () => {
    expect(sanitizeSheetName("sheet:1")).toBe("sheet_1");
    expect(sanitizeSheetName("a/b\\c?d*e[f]g")).toBe("a_b_c_d_e_f_g");
  });
  it("truncates to 31 chars", () => {
    const long = "a".repeat(50);
    expect(sanitizeSheetName(long)).toHaveLength(31);
  });
  it("defaults to Sheet1 for empty", () => {
    expect(sanitizeSheetName("")).toBe("Sheet1");
  });
});

describe("csv2xlsx columnLetter", () => {
  it("returns A for 0", () => { expect(columnLetter(0)).toBe("A"); });
  it("returns Z for 25", () => { expect(columnLetter(25)).toBe("Z"); });
  it("returns AA for 26", () => { expect(columnLetter(26)).toBe("AA"); });
  it("returns AB for 27", () => { expect(columnLetter(27)).toBe("AB"); });
  it("returns ZZ for 701", () => { expect(columnLetter(701)).toBe("ZZ"); });
});

describe("csv2xlsx computeColumnWidth", () => {
  it("returns at least 8", () => {
    expect(computeColumnWidth(["a"])).toBeGreaterThanOrEqual(8);
  });
  it("caps at 50", () => {
    expect(computeColumnWidth(["a".repeat(100)])).toBe(50);
  });
  it("scales with content length", () => {
    const short = computeColumnWidth(["a", "b", "c"]);
    const long = computeColumnWidth(["aaaaaaaaaa", "bbbbbbbbbb"]);
    expect(long).toBeGreaterThan(short);
  });
});

// ===== Sheet XML generation =====

describe("csv2xlsx generateSheetXml", () => {
  it("generates valid worksheet XML", () => {
    const sheet = { name: "Sheet1", headers: ["a", "b"], rows: [["1", "2"]] };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("<worksheet");
    expect(result.xml).toContain("<sheetData>");
    expect(result.xml).toContain("<row");
    expect(result.xml).toContain("<c r=\"A1\"");
  });
  it("includes column widths when autoFit is on", () => {
    const sheet = { name: "Sheet1", headers: ["name", "age"], rows: [["Alice", "30"]] };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, DEFAULT_OPTIONS, ss);
    expect(result.xml).toContain("<cols>");
    expect(result.xml).toContain("customWidth");
  });
  it("emits number cells without shared strings", () => {
    const sheet = { name: "Sheet1", headers: [], rows: [["42"]] };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, { ...DEFAULT_OPTIONS, hasHeader: false }, ss);
    expect(result.xml).toContain("<v>42</v>");
    expect(result.xml).not.toContain("t=\"s\"");
  });
  it("emits boolean cells with t=b", () => {
    const sheet = { name: "Sheet1", headers: [], rows: [["true"]] };
    const ss = new SharedStrings();
    const result = generateSheetXml(sheet, { ...DEFAULT_OPTIONS, hasHeader: false }, ss);
    expect(result.xml).toContain("t=\"b\"");
  });
});

// ===== Workbook XML =====

describe("csv2xlsx generateWorkbookXml", () => {
  it("generates workbook with sheet entries", () => {
    const xml = generateWorkbookXml([{ name: "Sheet1", headers: [], rows: [] }]);
    expect(xml).toContain("<workbook");
    expect(xml).toContain("<sheets>");
    expect(xml).toContain("Sheet1");
  });
  it("escapes sheet names", () => {
    const xml = generateWorkbookXml([{ name: "a<b", headers: [], rows: [] }]);
    expect(xml).toContain("a&lt;b");
  });
});

describe("csv2xlsx generateWorkbookRelsXml", () => {
  it("generates relationships for sheets + sharedStrings + styles", () => {
    const xml = generateWorkbookRelsXml(2);
    expect(xml).toContain("rId1");
    expect(xml).toContain("rId2");
    expect(xml).toContain("sharedStrings");
    expect(xml).toContain("styles");
  });
});

describe("csv2xlsx generateContentTypesXml", () => {
  it("declares all parts", () => {
    const xml = generateContentTypesXml(2);
    expect(xml).toContain("<Types");
    expect(xml).toContain("Default Extension=\"rels\"");
    expect(xml).toContain("workbook.xml");
    expect(xml).toContain("sheet1.xml");
    expect(xml).toContain("sheet2.xml");
    expect(xml).toContain("sharedStrings.xml");
  });
});

describe("csv2xlsx generateStylesXml", () => {
  it("includes fonts, fills, cellXfs", () => {
    const xml = generateStylesXml();
    expect(xml).toContain("<fonts");
    expect(xml).toContain("<fills");
    expect(xml).toContain("<cellXfs");
    expect(xml).toContain("numFmtId=\"14\"");
  });
});

// ===== ZIP writer =====

describe("csv2xlsx createZipBlob", () => {
  it("creates a ZIP blob", async () => {
    const blob = createZipBlob([
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "b.txt", data: new TextEncoder().encode("world") },
    ]);
    expect(blob).toBeInstanceOf(Blob);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ===== Top-level conversion =====

describe("csv2xlsx convertCsvsToXlsx", () => {
  it("converts a single CSV to XLSX", async () => {
    const result = convertCsvsToXlsx([{
      fileName: "data.csv",
      content: "name,age\nAlice,30\nBob,25",
    }], DEFAULT_OPTIONS, "auto", "data.xlsx");
    expect(result.fileName).toBe("data.xlsx");
    expect(result.stats.sheetCount).toBe(1);
    expect(result.stats.totalRows).toBe(2);
    expect(result.stats.totalCells).toBe(4);
    expect(result.stats.xlsxBytes).toBeGreaterThan(0);
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    // ZIP signature
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });
  it("converts multiple CSVs into one multi-sheet workbook", async () => {
    const result = convertCsvsToXlsx([
      { fileName: "a.csv", content: "x,y\n1,2" },
      { fileName: "b.csv", content: "x,y\n3,4" },
    ]);
    expect(result.stats.sheetCount).toBe(2);
    expect(result.stats.totalRows).toBe(2);
  });
  it("throws on empty input", () => {
    expect(() => convertCsvsToXlsx([])).toThrow();
  });
  it("forceText=true forces all cells to text", () => {
    const result = convertCsvsToXlsx(
      [{ fileName: "data.csv", content: "v\n42" }],
      { ...DEFAULT_OPTIONS, forceText: true, hasHeader: false },
    );
    expect(result.stats.sheetCount).toBe(1);
  });
  it("uses custom sheet name", () => {
    const result = convertCsvsToXlsx(
      [{ fileName: "data.csv", content: "a,b\n1,2", sheetName: "MySheet" }],
    );
    expect(result.stats.sheetCount).toBe(1);
  });
  it("deduplicates shared strings", () => {
    const result = convertCsvsToXlsx(
      [{ fileName: "data.csv", content: "name\nAlice\nAlice\nBob" }],
    );
    expect(result.stats.sharedStringsCount).toBeLessThanOrEqual(3);
  });
});

// ===== Encoding =====

describe("csv2xlsx detectEncoding + stripBom", () => {
  it("detects UTF-8 BOM", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]))).toEqual({ encoding: "UTF-8", hasBom: true });
  });
  it("detects UTF-16LE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xff, 0xfe]))).toEqual({ encoding: "UTF-16LE", hasBom: true });
  });
  it("detects UTF-16BE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xfe, 0xff]))).toEqual({ encoding: "UTF-16BE", hasBom: true });
  });
  it("defaults to UTF-8 without BOM", () => {
    expect(detectEncoding(new Uint8Array([0x68, 0x69]))).toEqual({ encoding: "UTF-8", hasBom: false });
  });
  it("strips BOM from string", () => {
    expect(stripBom("\uFEFFhello")).toBe("hello");
    expect(stripBom("hello")).toBe("hello");
  });
});

// ===== Preview =====

describe("csv2xlsx previewRows", () => {
  it("returns limited rows as objects", () => {
    const headers = ["a", "b"];
    const rows = [["1", "2"], ["3", "4"], ["5", "6"]];
    const preview = previewRows(headers, rows, 2);
    expect(preview).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });
});

// ===== formatBytes =====

describe("csv2xlsx formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

// ===== History =====

describe("csv2xlsx history (localStorage)", () => {
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

describe("csv2xlsx share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/csv-to-excel-converter",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl(DEFAULT_OPTIONS, ";");
    expect(url).toContain("forceText=false");
    expect(url).toContain("styleHeader=true");
    expect(url).toContain("delim=");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, forceText: true }, "\t");
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.options.forceText).toBe(true);
    expect(parsed?.delimiter).toBe("\t");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});
