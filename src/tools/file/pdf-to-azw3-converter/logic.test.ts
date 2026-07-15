import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  escapeHtml, isHeading, buildParagraphs, buildCoverPage, buildHtmlBody, splitTextRecords,
  generatePalmDbHeader, generateRecordInfoTable, generatePalmDocHeader,
  generateMobiHeader, generateExthHeader, generateKf8BoundaryRecord,
  assembleRecord0, assembleAzw3, convertPdfToAzw3, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  readAscii,
  type Azw3Options, type Azw3Encoding, type Azw3ChapterMode,
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

// ===== escapeHtml =====

describe("pdf-to-azw3-converter escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &#39; f");
  });
  it("returns empty for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ===== isHeading =====

describe("pdf-to-azw3-converter isHeading", () => {
  it("detects Markdown headings", () => {
    expect(isHeading("# Chapter 1")).toBe(true);
  });
  it("detects 'Chapter N' pattern", () => {
    expect(isHeading("Chapter 1")).toBe(true);
  });
  it("detects ALL CAPS headings", () => {
    expect(isHeading("INTRODUCTION")).toBe(true);
  });
  it("rejects empty lines", () => {
    expect(isHeading("")).toBe(false);
  });
  it("rejects long lines", () => {
    expect(isHeading("x".repeat(200))).toBe(false);
  });
});

// ===== buildParagraphs =====

describe("pdf-to-azw3-converter buildParagraphs", () => {
  it("wraps each non-empty line in <p>", () => {
    const html = buildParagraphs("Line 1\nLine 2");
    expect(html).toContain("<p>Line 1</p>");
    expect(html).toContain("<p>Line 2</p>");
  });
  it("escapes HTML chars", () => {
    const html = buildParagraphs("a < b > c & d");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
  });
});

// ===== buildCoverPage =====

describe("pdf-to-azw3-converter buildCoverPage", () => {
  it("includes title and author", () => {
    const html = buildCoverPage({ ...DEFAULT_OPTIONS, title: "My Book", author: "Jane" });
    expect(html).toContain("<h1");
    expect(html).toContain("My Book");
    expect(html).toContain("Jane");
  });
  it("includes the cover subtitle", () => {
    const html = buildCoverPage({ ...DEFAULT_OPTIONS, coverSubtitle: "Special Edition" });
    expect(html).toContain("Special Edition");
  });
});

// ===== buildHtmlBody =====

describe("pdf-to-azw3-converter buildHtmlBody", () => {
  it("uses page mode by default", () => {
    const html = buildHtmlBody(["My Page\nbody"], DEFAULT_OPTIONS);
    expect(html).toContain("<h1>My Page</h1>");
    expect(html).toContain("<p>body</p>");
    expect(html).toContain("<mbp:pagebreak/>");
  });
  it("merges all text in single mode", () => {
    const html = buildHtmlBody(["Page 1", "Page 2"], { ...DEFAULT_OPTIONS, chapterMode: "single" });
    expect(html).toContain("<p>Page 1</p>");
    expect(html).toContain("<p>Page 2</p>");
    expect(html).not.toContain("<mbp:pagebreak/>");
  });
  it("splits at headings in heading mode", () => {
    const html = buildHtmlBody(["INTRODUCTION\nbody.\nCHAPTER ONE\nbody 1."], { ...DEFAULT_OPTIONS, chapterMode: "heading" });
    expect(html).toContain("<h1>INTRODUCTION</h1>");
    expect(html).toContain("<h1>CHAPTER ONE</h1>");
  });
});

// ===== splitTextRecords =====

describe("pdf-to-azw3-converter splitTextRecords", () => {
  it("returns one record for short text", () => {
    const records = splitTextRecords("Hello", "utf-8");
    expect(records).toHaveLength(1);
  });
  it("splits long text into 4096-byte chunks", () => {
    const long = "x".repeat(10000);
    const records = splitTextRecords(long, "utf-8");
    expect(records.length).toBe(3);
    expect(records[0]!.length).toBe(4096);
  });
});

// ===== PalmDB header =====

describe("pdf-to-azw3-converter generatePalmDbHeader", () => {
  it("returns a 78-byte header", () => {
    expect(generatePalmDbHeader("Test", 5).length).toBe(78);
  });
  it("writes 'BOOK' type and 'MOBI' creator", () => {
    const header = generatePalmDbHeader("Test", 1);
    expect(readAscii(header, 60, 4)).toBe("BOOK");
    expect(readAscii(header, 64, 4)).toBe("MOBI");
  });
  it("writes record count", () => {
    const header = generatePalmDbHeader("T", 42);
    expect((header[76]! << 8) | header[77]!).toBe(42);
  });
});

// ===== Record info table =====

describe("pdf-to-azw3-converter generateRecordInfoTable", () => {
  it("returns 8 bytes per record", () => {
    const table = generateRecordInfoTable([
      { offset: 100, uniqueId: 0 },
      { offset: 200, uniqueId: 1 },
    ]);
    expect(table.length).toBe(16);
  });
});

// ===== PalmDOC header =====

describe("pdf-to-azw3-converter generatePalmDocHeader", () => {
  it("returns 16 bytes with compression=1", () => {
    const header = generatePalmDocHeader(1000, 5);
    expect(header.length).toBe(16);
    expect((header[0]! << 8) | header[1]!).toBe(1);
  });
  it("writes record size 4096", () => {
    const header = generatePalmDocHeader(1000, 5);
    expect((header[10]! << 8) | header[11]!).toBe(4096);
  });
});

// ===== MOBI header (KF8) =====

describe("pdf-to-azw3-converter generateMobiHeader", () => {
  it("returns 232 bytes with 'MOBI' identifier", () => {
    const header = generateMobiHeader(DEFAULT_OPTIONS, 1000, 5);
    expect(header.length).toBe(232);
    expect(readAscii(header, 0, 4)).toBe("MOBI");
  });
  it("writes MOBI type 6 (KF8)", () => {
    const header = generateMobiHeader(DEFAULT_OPTIONS, 1000, 5);
    const type = (header[8]! << 24) | (header[9]! << 16) | (header[10]! << 8) | header[11]!;
    expect(type).toBe(6);
  });
  it("writes file version 8 (KF8)", () => {
    const header = generateMobiHeader(DEFAULT_OPTIONS, 1000, 5);
    const ver = (header[20]! << 24) | (header[21]! << 16) | (header[22]! << 8) | header[23]!;
    expect(ver).toBe(8);
  });
  it("writes UTF-8 encoding (65001) when chosen", () => {
    const header = generateMobiHeader({ ...DEFAULT_OPTIONS, encoding: "utf-8" }, 1000, 5);
    const enc = (header[12]! << 24) | (header[13]! << 16) | (header[14]! << 8) | header[15]!;
    expect(enc).toBe(65001);
  });
});

// ===== EXTH header =====

describe("pdf-to-azw3-converter generateExthHeader", () => {
  it("writes 'EXTH' identifier", () => {
    const header = generateExthHeader(DEFAULT_OPTIONS);
    expect(readAscii(header, 0, 4)).toBe("EXTH");
  });
  it("writes 4 records (author, title, language, cover)", () => {
    const header = generateExthHeader(DEFAULT_OPTIONS);
    const count = (header[8]! << 24) | (header[9]! << 16) | (header[10]! << 8) | header[11]!;
    expect(count).toBe(4);
  });
  it("includes author and title in data", () => {
    const header = generateExthHeader({ ...DEFAULT_OPTIONS, author: "Alice", title: "My Book" });
    const text = new TextDecoder().decode(header);
    expect(text).toContain("Alice");
    expect(text).toContain("My Book");
  });
});

// ===== KF8 boundary record =====

describe("pdf-to-azw3-converter generateKf8BoundaryRecord", () => {
  it("returns 8 bytes with 'BOUNDARY' marker", () => {
    const rec = generateKf8BoundaryRecord();
    expect(rec.length).toBe(8);
    expect(readAscii(rec, 0, 8)).toBe("BOUNDARY");
  });
});

// ===== assembleRecord0 =====

describe("pdf-to-azw3-converter assembleRecord0", () => {
  it("contains PalmDOC + MOBI + EXTH", () => {
    const rec = assembleRecord0(DEFAULT_OPTIONS, 1000, 5);
    expect(rec.length).toBeGreaterThanOrEqual(16 + 232 + 12);
    expect((rec[0]! << 8) | rec[1]!).toBe(1); // PalmDOC compression=1
    expect(readAscii(rec, 16, 4)).toBe("MOBI");
    expect(readAscii(rec, 248, 4)).toBe("EXTH");
  });
});

// ===== assembleAzw3 =====

describe("pdf-to-azw3-converter assembleAzw3", () => {
  it("produces a complete AZW3 file", () => {
    const bytes = assembleAzw3(["Hello, World!"], DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(78);
    expect(readAscii(bytes, 60, 4)).toBe("BOOK");
    expect(readAscii(bytes, 64, 4)).toBe("MOBI");
    const recCount = (bytes[76]! << 8) | bytes[77]!;
    expect(recCount).toBeGreaterThanOrEqual(3); // record0 + at least 1 text record + boundary
  });
  it("places record 0 at the first offset", () => {
    const bytes = assembleAzw3(["Hello"], DEFAULT_OPTIONS);
    const firstOffset = (bytes[78]! << 24) | (bytes[79]! << 16) | (bytes[80]! << 8) | bytes[81]!;
    expect((bytes[firstOffset]! << 8) | bytes[firstOffset + 1]!).toBe(1);
  });
  it("ends with a 'BOUNDARY' record", () => {
    const bytes = assembleAzw3(["Hello"], DEFAULT_OPTIONS);
    const recCount = (bytes[76]! << 8) | bytes[77]!;
    // The last record is the boundary marker — read its offset from the record info table
    const lastRecInfoOffset = 78 + (recCount - 1) * 8;
    const lastOffset = (bytes[lastRecInfoOffset]! << 24) | (bytes[lastRecInfoOffset + 1]! << 16) | (bytes[lastRecInfoOffset + 2]! << 8) | bytes[lastRecInfoOffset + 3]!;
    expect(readAscii(bytes, lastOffset, 8)).toBe("BOUNDARY");
  });
});

// ===== convertPdfToAzw3 =====

describe("pdf-to-azw3-converter convertPdfToAzw3", () => {
  it("converts a simple PDF to AZW3", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToAzw3(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.recordCount).toBeGreaterThanOrEqual(3);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.azw3Bytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToAzw3(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToAzw3(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToAzw3(pdfBytes, DEFAULT_OPTIONS, "custom.azw3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.azw3");
    }
  });
});

// ===== formatBytes =====

describe("pdf-to-azw3-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-azw3-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, azw3Bytes: 2000,
      recordCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, azw3Bytes: 2000,
      recordCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-azw3-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-azw3-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", chapterMode: "heading", encoding: "cp1252" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("mode=heading");
    expect(url).toContain("enc=cp1252");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&mode=single&enc=utf-8&title=MyBook&author=Jane&lang=fr");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.chapterMode).toBe("single");
    expect(parsed?.encoding).toBe("utf-8");
    expect(parsed?.title).toBe("MyBook");
    expect(parsed?.author).toBe("Jane");
    expect(parsed?.language).toBe("fr");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to page mode for invalid chapter mode", () => {
    const parsed = parseShareUrl("#mode=invalid");
    expect(parsed?.chapterMode).toBe("page");
  });
});
