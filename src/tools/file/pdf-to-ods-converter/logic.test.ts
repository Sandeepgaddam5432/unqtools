import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  getDelimiterChar, sanitizeSheetName, splitLine, buildSheets,
  generateContentXml, generateStylesXml, generateMetaXml, generateManifestXml,
  convertPdfToOds, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type OdsOptions, type OdsDelimiter,
} from "./logic";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ===== Helpers =====

async function makeSimplePdf(textLines: string[], pageCount = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([612, 792]);
    let y = 750;
    for (const line of textLines) {
      page.drawText(line, { x: 50, y, size: 12, font, color: { type: "RGB", red: 0, green: 0, blue: 0 } as never });
      y -= 20;
    }
  }
  return await doc.save();
}

// ===== localStorage mock =====
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
});

// ===== Delimiter helpers =====

describe("pdf-to-ods-converter getDelimiterChar", () => {
  it("returns \\t for tab", () => {
    expect(getDelimiterChar("tab")).toBe("\t");
  });
  it("returns , for comma", () => {
    expect(getDelimiterChar("comma")).toBe(",");
  });
  it("returns ; for semicolon", () => {
    expect(getDelimiterChar("semicolon")).toBe(";");
  });
  it("returns | for pipe", () => {
    expect(getDelimiterChar("pipe")).toBe("|");
  });
  it("returns null for none", () => {
    expect(getDelimiterChar("none")).toBeNull();
  });
});

describe("pdf-to-ods-converter sanitizeSheetName", () => {
  it("strips illegal chars", () => {
    expect(sanitizeSheetName("a:b/c?d*e[f]g")).toBe("a_b_c_d_e_f_g");
  });
  it("limits to 31 chars", () => {
    expect(sanitizeSheetName("x".repeat(100)).length).toBe(31);
  });
  it("falls back to Sheet1 for empty", () => {
    expect(sanitizeSheetName("")).toBe("Sheet1");
  });
  it("trims whitespace", () => {
    expect(sanitizeSheetName("  Hello  ")).toBe("Hello");
  });
});

describe("pdf-to-ods-converter splitLine", () => {
  it("splits by tab", () => {
    expect(splitLine("a\tb\tc", "tab")).toEqual(["a", "b", "c"]);
  });
  it("splits by comma", () => {
    expect(splitLine("a,b,c", "comma")).toEqual(["a", "b", "c"]);
  });
  it("splits by semicolon", () => {
    expect(splitLine("a;b;c", "semicolon")).toEqual(["a", "b", "c"]);
  });
  it("splits by pipe", () => {
    expect(splitLine("a|b|c", "pipe")).toEqual(["a", "b", "c"]);
  });
  it("returns single cell for 'none' mode", () => {
    expect(splitLine("any text here", "none")).toEqual(["any text here"]);
  });
  it("trims whitespace from cells", () => {
    expect(splitLine("a , b , c", "comma")).toEqual(["a", "b", "c"]);
  });
});

// ===== buildSheets =====

describe("pdf-to-ods-converter buildSheets", () => {
  it("merges all pages into one sheet in single mode", () => {
    const sheets = buildSheets(["line1\nline2", "line3"], { ...DEFAULT_OPTIONS, sheetMode: "single" });
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.rows).toHaveLength(3);
  });
  it("creates one sheet per page in multi mode", () => {
    const sheets = buildSheets(["page1 line", "page2 line"], { ...DEFAULT_OPTIONS, sheetMode: "multi" });
    expect(sheets).toHaveLength(2);
    expect(sheets[0]!.name).toBe("Page 1");
    expect(sheets[1]!.name).toBe("Page 2");
  });
  it("skips empty lines", () => {
    const sheets = buildSheets(["\n\nHello\n\n"], DEFAULT_OPTIONS);
    expect(sheets[0]!.rows).toHaveLength(1);
  });
  it("skips empty pages in multi mode", () => {
    const sheets = buildSheets(["", "Hello", ""], { ...DEFAULT_OPTIONS, sheetMode: "multi" });
    expect(sheets).toHaveLength(1);
  });
  it("returns empty for all-empty input", () => {
    const sheets = buildSheets(["", ""], DEFAULT_OPTIONS);
    expect(sheets).toHaveLength(0);
  });
  it("uses chosen sheet name in single mode", () => {
    const sheets = buildSheets(["Hello"], { ...DEFAULT_OPTIONS, sheetName: "MySheet" });
    expect(sheets[0]!.name).toBe("MySheet");
  });
});

// ===== content.xml =====

describe("pdf-to-ods-converter generateContentXml", () => {
  it("produces a valid ODF spreadsheet content document", () => {
    const sheets = [{ name: "Sheet1", rows: [["a", "b"], ["c", "d"]] }];
    const xml = generateContentXml(sheets, DEFAULT_OPTIONS);
    expect(xml).toContain("<office:document-content");
    expect(xml).toContain("<office:spreadsheet>");
    expect(xml).toContain("Sheet1");
    expect(xml).toContain("<table:table-row");
  });
  it("declares HeaderCell style when hasHeader is true", () => {
    const sheets = [{ name: "Sheet1", rows: [["h1", "h2"]] }];
    const xml = generateContentXml(sheets, { ...DEFAULT_OPTIONS, hasHeader: true });
    expect(xml).toContain('style:name="HeaderCell"');
    expect(xml).toContain('table:style-name="HeaderCell"');
  });
  it("does not declare HeaderCell when hasHeader is false", () => {
    const sheets = [{ name: "Sheet1", rows: [["h1"]] }];
    const xml = generateContentXml(sheets, { ...DEFAULT_OPTIONS, hasHeader: false });
    expect(xml).not.toContain('style:name="HeaderCell"');
  });
  it("emits float cell type for numeric values", () => {
    const sheets = [{ name: "Sheet1", rows: [["42"]] }];
    const xml = generateContentXml(sheets, DEFAULT_OPTIONS);
    expect(xml).toContain('office:value-type="float"');
    expect(xml).toContain('office:value="42"');
  });
  it("emits string cell type for text values", () => {
    const sheets = [{ name: "Sheet1", rows: [["hello"]] }];
    const xml = generateContentXml(sheets, DEFAULT_OPTIONS);
    expect(xml).toContain('office:value-type="string"');
  });
  it("emits empty cell for empty string", () => {
    const sheets = [{ name: "Sheet1", rows: [[""]] }];
    const xml = generateContentXml(sheets, DEFAULT_OPTIONS);
    expect(xml).toContain("<table:table-cell/>");
  });
  it("escapes XML chars in cell text", () => {
    const sheets = [{ name: "Sheet1", rows: [["a < b & c"]] }];
    const xml = generateContentXml(sheets, DEFAULT_OPTIONS);
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&amp;");
  });
});

// ===== styles.xml =====

describe("pdf-to-ods-converter generateStylesXml", () => {
  it("declares default table-cell style", () => {
    const xml = generateStylesXml();
    expect(xml).toContain('style:family="table-cell"');
    expect(xml).toContain("Liberation Sans");
  });
});

// ===== meta.xml =====

describe("pdf-to-ods-converter generateMetaXml", () => {
  it("includes title and author", () => {
    const xml = generateMetaXml({ ...DEFAULT_OPTIONS, title: "Sheet", author: "Bob" }, { rowCount: 5, columnCount: 3, sheetCount: 1 });
    expect(xml).toContain("<dc:title>Sheet</dc:title>");
    expect(xml).toContain("<dc:creator>Bob</dc:creator>");
  });
  it("includes document-statistic", () => {
    const xml = generateMetaXml(DEFAULT_OPTIONS, { rowCount: 10, columnCount: 3, sheetCount: 2 });
    expect(xml).toContain("meta:document-statistic");
    expect(xml).toContain('meta:table-count="2"');
  });
});

// ===== manifest.xml =====

describe("pdf-to-ods-converter generateManifestXml", () => {
  it("declares all 4 files with ODS media type", () => {
    const xml = generateManifestXml();
    expect(xml).toContain("application/vnd.oasis.opendocument.spreadsheet");
    expect(xml).toContain("content.xml");
    expect(xml).toContain("styles.xml");
    expect(xml).toContain("meta.xml");
  });
});

// ===== convertPdfToOds =====

describe("pdf-to-ods-converter convertPdfToOds", () => {
  it("converts a simple PDF to ODS", async () => {
    const pdfBytes = await makeSimplePdf(["a\tb\tc", "1\t2\t3"]);
    const result = await convertPdfToOds(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.rowCount).toBeGreaterThan(0);
      expect(result.output.cellCount).toBeGreaterThan(0);
      expect(result.output.odsBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToOds(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToOds(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });
  it("uses multi-sheet mode", async () => {
    const pdfBytes = await makeSimplePdf(["line1"], 3);
    const result = await convertPdfToOds(pdfBytes, { ...DEFAULT_OPTIONS, sheetMode: "multi" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.sheetCount).toBe(3);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToOds(pdfBytes, DEFAULT_OPTIONS, "custom.ods");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.ods");
    }
  });
});

// ===== formatBytes =====

describe("pdf-to-ods-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-ods-converter history", () => {
  it("returns empty list when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.pdf", pdfBytes: 1000, odsBytes: 2000,
      sheetCount: 1, rowCount: 5, cellCount: 25,
      convertedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.pdf");
  });
  it("clears history", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.pdf", pdfBytes: 1000, odsBytes: 2000,
      sheetCount: 1, rowCount: 5, cellCount: 25,
      convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-ods-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-ods-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", delimiter: "comma", sheetMode: "multi" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("delim=comma");
    expect(url).toContain("mode=multi");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&delim=pipe&mode=multi&header=false&sheet=Data");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.delimiter).toBe("pipe");
    expect(parsed?.sheetMode).toBe("multi");
    expect(parsed?.hasHeader).toBe(false);
    expect(parsed?.sheetName).toBe("Data");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to tab for invalid delimiter", () => {
    const parsed = parseShareUrl("#delim=invalid");
    expect(parsed?.delimiter).toBe("tab");
  });
});
