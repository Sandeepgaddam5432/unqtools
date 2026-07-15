import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  splitLine, resolveDelimiter,
  convertPdfToExcel, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type ExcelOptions,
} from "./logic";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ===== Helpers =====

async function makeSimplePdf(textLines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  let y = 750;
  for (const line of textLines) {
    page.drawText(line, { x: 50, y, size: 12, font, color: { type: "RGB", red: 0, green: 0, blue: 0 } as never });
    y -= 20;
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

// ===== splitLine =====

describe("pdf-to-excel-converter splitLine", () => {
  it("splits by comma", () => {
    expect(splitLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });
  it("splits by tab", () => {
    expect(splitLine("a\tb\tc", "\t")).toEqual(["a", "b", "c"]);
  });
  it("splits by semicolon", () => {
    expect(splitLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });
  it("splits by pipe", () => {
    expect(splitLine("a|b|c", "|")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields", () => {
    expect(splitLine('"a,b",c', ",")).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes inside fields", () => {
    expect(splitLine('"she said ""hi""",c', ",")).toEqual(['she said "hi"', "c"]);
  });
  it("returns whole line for empty delimiter", () => {
    expect(splitLine("hello", "")).toEqual(["hello"]);
  });
  it("handles empty cells", () => {
    expect(splitLine("a,,c", ",")).toEqual(["a", "", "c"]);
  });
});

// ===== resolveDelimiter =====

describe("pdf-to-excel-converter resolveDelimiter", () => {
  it("returns the chosen delimiter", () => {
    expect(resolveDelimiter({ ...DEFAULT_OPTIONS, delimiter: "," })).toBe(",");
    expect(resolveDelimiter({ ...DEFAULT_OPTIONS, delimiter: "\t" })).toBe("\t");
    expect(resolveDelimiter({ ...DEFAULT_OPTIONS, delimiter: ";" })).toBe(";");
    expect(resolveDelimiter({ ...DEFAULT_OPTIONS, delimiter: "|" })).toBe("|");
  });
  it("returns custom delimiter when delimiter is space", () => {
    expect(resolveDelimiter({ ...DEFAULT_OPTIONS, delimiter: " ", customDelimiter: "::" })).toBe("::");
  });
  it("returns space when no custom delimiter", () => {
    expect(resolveDelimiter({ ...DEFAULT_OPTIONS, delimiter: " ", customDelimiter: "" })).toBe(" ");
  });
});

// ===== convertPdfToExcel =====

describe("pdf-to-excel-converter convertPdfToExcel", () => {
  it("converts a simple PDF to XLSX", async () => {
    const pdfBytes = await makeSimplePdf(["a,b,c", "1,2,3"]);
    const result = await convertPdfToExcel(pdfBytes, { ...DEFAULT_OPTIONS, delimiter: "," });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.pageCount).toBe(1);
      expect(result.output.rowCount).toBe(2);
      expect(result.output.columnCount).toBe(3);
      expect(result.output.cellCount).toBe(6);
    }
  });

  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToExcel(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });

  it("respects page range option", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 3; i++) {
      const page = doc.addPage([612, 792]);
      page.drawText(`row${i + 1}`, { x: 50, y: 750, size: 12, font, color: { type: "RGB", red: 0, green: 0, blue: 0 } as never });
    }
    const pdfBytes = await doc.save();
    const result = await convertPdfToExcel(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });

  it("creates one sheet per page by default", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i++) {
      const page = doc.addPage([612, 792]);
      page.drawText(`page ${i + 1} content`, { x: 50, y: 750, size: 12, font, color: { type: "RGB", red: 0, green: 0, blue: 0 } as never });
    }
    const pdfBytes = await doc.save();
    const result = await convertPdfToExcel(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(2);
      expect(result.output.rowCount).toBe(2);
    }
  });

  it("creates one sheet when singleSheet is true", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i++) {
      const page = doc.addPage([612, 792]);
      page.drawText(`page ${i + 1} content`, { x: 50, y: 750, size: 12, font, color: { type: "RGB", red: 0, green: 0, blue: 0 } as never });
    }
    const pdfBytes = await doc.save();
    const result = await convertPdfToExcel(pdfBytes, { ...DEFAULT_OPTIONS, singleSheet: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(2);
      expect(result.output.rowCount).toBe(2);
    }
  });

  it("handles custom delimiter", async () => {
    const pdfBytes = await makeSimplePdf(["a::b::c"]);
    const result = await convertPdfToExcel(pdfBytes, { ...DEFAULT_OPTIONS, delimiter: " ", customDelimiter: "::" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.columnCount).toBe(3);
    }
  });

  it("uses custom sheet name", async () => {
    const pdfBytes = await makeSimplePdf(["a,b,c"]);
    const result = await convertPdfToExcel(pdfBytes, { ...DEFAULT_OPTIONS, sheetName: "MySheet" }, "out.xlsx");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("out.xlsx");
    }
  });
});

// ===== Utilities =====

describe("pdf-to-excel-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-excel-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, xlsxBytes: 2000,
      pageCount: 5, rowCount: 50, convertedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, xlsxBytes: 2000,
      pageCount: 5, rowCount: 50, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-excel-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/pdf-to-excel-converter" } };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", delimiter: ";", sheetName: "Data" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("delim=%3B");
    expect(url).toContain("sheet=Data");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&delim=%7C&sheet=Data&single=true&header=false&auto=true");
    expect(parsed).toEqual({
      pageRange: "1-3",
      delimiter: "|",
      sheetName: "Data",
      singleSheet: true,
      hasHeader: false,
      autoDetectTypes: true,
    });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("handles tab delimiter encoding", () => {
    const parsed = parseShareUrl("#delim=\\t");
    expect(parsed?.delimiter).toBe("\t");
  });
  it("falls back to comma for invalid delimiter", () => {
    const parsed = parseShareUrl("#delim=invalid");
    expect(parsed?.delimiter).toBe(",");
  });
});
