import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  writeU16BE, writeU32BE, writeAscii, writePaddedAscii, readAscii,
  escapeHtml, isHeading,
  buildParagraphs, buildHtmlBody, splitTextRecords,
  generatePalmDbHeader, generateRecordInfoTable, generatePalmDocHeader,
  generateMobiHeader, generateExthHeader, assembleRecord0, assembleMobi,
  convertPdfToMobi, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type MobiOptions, type MobiEncoding, type MobiChapterMode,
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

// ===== Byte writers =====

describe("pdf-to-mobi-converter writeU16BE", () => {
  it("writes 16-bit big-endian", () => {
    const bytes = new Uint8Array(2);
    writeU16BE(bytes, 0, 0x1234);
    expect(bytes[0]).toBe(0x12);
    expect(bytes[1]).toBe(0x34);
  });
  it("handles max value", () => {
    const bytes = new Uint8Array(2);
    writeU16BE(bytes, 0, 0xffff);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xff);
  });
});

describe("pdf-to-mobi-converter writeU32BE", () => {
  it("writes 32-bit big-endian", () => {
    const bytes = new Uint8Array(4);
    writeU32BE(bytes, 0, 0x12345678);
    expect(bytes[0]).toBe(0x12);
    expect(bytes[1]).toBe(0x34);
    expect(bytes[2]).toBe(0x56);
    expect(bytes[3]).toBe(0x78);
  });
  it("handles 0xFFFFFFFF", () => {
    const bytes = new Uint8Array(4);
    writeU32BE(bytes, 0, 0xffffffff);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[3]).toBe(0xff);
  });
});

describe("pdf-to-mobi-converter writeAscii", () => {
  it("writes ASCII chars", () => {
    const bytes = new Uint8Array(4);
    writeAscii(bytes, 0, "BOOK");
    expect(readAscii(bytes, 0, 4)).toBe("BOOK");
  });
});

describe("pdf-to-mobi-converter writePaddedAscii", () => {
  it("pads short strings with nulls", () => {
    const bytes = new Uint8Array(8);
    writePaddedAscii(bytes, 0, "AB", 8);
    expect(bytes[0]).toBe("A".charCodeAt(0));
    expect(bytes[1]).toBe("B".charCodeAt(0));
    expect(bytes[2]).toBe(0);
    expect(bytes[7]).toBe(0);
  });
  it("truncates long strings", () => {
    const bytes = new Uint8Array(4);
    writePaddedAscii(bytes, 0, "ABCDEFGH", 4);
    expect(bytes[3]).toBe("D".charCodeAt(0));
  });
});

describe("pdf-to-mobi-converter readAscii", () => {
  it("reads ASCII chars", () => {
    const bytes = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
    expect(readAscii(bytes, 0, 4)).toBe("ABCD");
  });
});

// ===== escapeHtml =====

describe("pdf-to-mobi-converter escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &#39; f");
  });
  it("returns empty for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ===== isHeading =====

describe("pdf-to-mobi-converter isHeading", () => {
  it("detects Markdown headings", () => {
    expect(isHeading("# Chapter 1")).toBe(true);
  });
  it("detects 'Chapter N' pattern", () => {
    expect(isHeading("Chapter 12")).toBe(true);
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

describe("pdf-to-mobi-converter buildParagraphs", () => {
  it("wraps each non-empty line in <p>", () => {
    const html = buildParagraphs("Line 1\nLine 2");
    expect(html).toContain("<p>Line 1</p>");
    expect(html).toContain("<p>Line 2</p>");
  });
  it("skips empty lines", () => {
    const html = buildParagraphs("\n\nHello\n\n");
    expect(html).toBe("<p>Hello</p>");
  });
  it("escapes HTML chars", () => {
    const html = buildParagraphs("a < b > c & d");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
  });
});

// ===== buildHtmlBody =====

describe("pdf-to-mobi-converter buildHtmlBody", () => {
  it("wraps pages in <h1> + paragraphs in page mode", () => {
    const html = buildHtmlBody(["My Page\nbody text"], { ...DEFAULT_OPTIONS, chapterMode: "page" });
    expect(html).toContain("<h1>My Page</h1>");
    expect(html).toContain("<p>body text</p>");
    expect(html).toContain("<mbp:pagebreak/>");
  });
  it("returns single body in single mode", () => {
    const html = buildHtmlBody(["Page 1 text", "Page 2 text"], { ...DEFAULT_OPTIONS, chapterMode: "single" });
    expect(html).toContain("<p>Page 1 text</p>");
    expect(html).toContain("<p>Page 2 text</p>");
    expect(html).not.toContain("<mbp:pagebreak/>");
  });
  it("splits at headings in heading mode", () => {
    const text = "INTRODUCTION\nIntro body.\nCHAPTER ONE\nBody 1.";
    const html = buildHtmlBody([text], { ...DEFAULT_OPTIONS, chapterMode: "heading" });
    expect(html).toContain("<h1>INTRODUCTION</h1>");
    expect(html).toContain("<h1>CHAPTER ONE</h1>");
  });
});

// ===== splitTextRecords =====

describe("pdf-to-mobi-converter splitTextRecords", () => {
  it("returns one record for short text", () => {
    const records = splitTextRecords("Hello", "utf-8");
    expect(records).toHaveLength(1);
    expect(records[0]!.length).toBe(5);
  });
  it("splits long text into 4096-byte chunks", () => {
    const long = "x".repeat(10000);
    const records = splitTextRecords(long, "utf-8");
    expect(records.length).toBe(3); // 10000 / 4096 ≈ 2.44 → 3 records
    expect(records[0]!.length).toBe(4096);
  });
  it("returns one empty record for empty text", () => {
    const records = splitTextRecords("", "utf-8");
    expect(records).toHaveLength(1);
    expect(records[0]!.length).toBe(0);
  });
});

// ===== PalmDB header =====

describe("pdf-to-mobi-converter generatePalmDbHeader", () => {
  it("returns a 78-byte header", () => {
    const header = generatePalmDbHeader("Test", 5);
    expect(header.length).toBe(78);
  });
  it("writes the book name in first 32 bytes", () => {
    const header = generatePalmDbHeader("My Book", 1);
    const name = readAscii(header, 0, 7);
    expect(name).toBe("My Book");
  });
  it("writes 'BOOK' type at offset 60", () => {
    const header = generatePalmDbHeader("T", 1);
    expect(readAscii(header, 60, 4)).toBe("BOOK");
  });
  it("writes 'MOBI' creator at offset 64", () => {
    const header = generatePalmDbHeader("T", 1);
    expect(readAscii(header, 64, 4)).toBe("MOBI");
  });
  it("writes record count at offset 76", () => {
    const header = generatePalmDbHeader("T", 42);
    expect((header[76]! << 8) | header[77]!).toBe(42);
  });
});

// ===== Record info table =====

describe("pdf-to-mobi-converter generateRecordInfoTable", () => {
  it("returns 8 bytes per record", () => {
    const table = generateRecordInfoTable([
      { offset: 100, uniqueId: 0 },
      { offset: 200, uniqueId: 1 },
    ]);
    expect(table.length).toBe(16);
  });
  it("writes offset in first 4 bytes BE", () => {
    const table = generateRecordInfoTable([{ offset: 0x12345678, uniqueId: 0 }]);
    expect(table[0]).toBe(0x12);
    expect(table[3]).toBe(0x78);
  });
  it("writes uniqueId in last 3 bytes", () => {
    const table = generateRecordInfoTable([{ offset: 0, uniqueId: 0x123456 }]);
    expect(table[5]).toBe(0x12);
    expect(table[6]).toBe(0x34);
    expect(table[7]).toBe(0x56);
  });
});

// ===== PalmDOC header =====

describe("pdf-to-mobi-converter generatePalmDocHeader", () => {
  it("returns 16 bytes", () => {
    const header = generatePalmDocHeader(1000, 5);
    expect(header.length).toBe(16);
  });
  it("writes compression=1 (none) at offset 0", () => {
    const header = generatePalmDocHeader(1000, 5);
    expect((header[0]! << 8) | header[1]!).toBe(1);
  });
  it("writes text length at offset 4", () => {
    const header = generatePalmDocHeader(0x12345678, 5);
    expect((header[4]! << 24) | (header[5]! << 16) | (header[6]! << 8) | header[7]!).toBe(0x12345678);
  });
  it("writes record size 4096 at offset 10", () => {
    const header = generatePalmDocHeader(1000, 5);
    expect((header[10]! << 8) | header[11]!).toBe(4096);
  });
});

// ===== MOBI header =====

describe("pdf-to-mobi-converter generateMobiHeader", () => {
  it("returns 232 bytes", () => {
    const header = generateMobiHeader(DEFAULT_OPTIONS, 1000, 5);
    expect(header.length).toBe(232);
  });
  it("writes 'MOBI' identifier at offset 0", () => {
    const header = generateMobiHeader(DEFAULT_OPTIONS, 1000, 5);
    expect(readAscii(header, 0, 4)).toBe("MOBI");
  });
  it("writes UTF-8 encoding (65001) when chosen", () => {
    const header = generateMobiHeader({ ...DEFAULT_OPTIONS, encoding: "utf-8" }, 1000, 5);
    const enc = (header[12]! << 24) | (header[13]! << 16) | (header[14]! << 8) | header[15]!;
    expect(enc).toBe(65001);
  });
  it("writes CP1252 encoding (1252) when chosen", () => {
    const header = generateMobiHeader({ ...DEFAULT_OPTIONS, encoding: "cp1252" }, 1000, 5);
    const enc = (header[12]! << 24) | (header[13]! << 16) | (header[14]! << 8) | header[15]!;
    expect(enc).toBe(1252);
  });
});

// ===== EXTH header =====

describe("pdf-to-mobi-converter generateExthHeader", () => {
  it("writes 'EXTH' identifier at offset 0", () => {
    const header = generateExthHeader(DEFAULT_OPTIONS);
    expect(readAscii(header, 0, 4)).toBe("EXTH");
  });
  it("writes 3 records (author, title, language)", () => {
    const header = generateExthHeader(DEFAULT_OPTIONS);
    const count = (header[8]! << 24) | (header[9]! << 16) | (header[10]! << 8) | header[11]!;
    expect(count).toBe(3);
  });
  it("includes author in record data", () => {
    const header = generateExthHeader({ ...DEFAULT_OPTIONS, author: "Jane Doe" });
    const text = new TextDecoder().decode(header);
    expect(text).toContain("Jane Doe");
  });
});

// ===== assembleRecord0 =====

describe("pdf-to-mobi-converter assembleRecord0", () => {
  it("contains PalmDOC + MOBI + EXTH sections", () => {
    const rec = assembleRecord0(DEFAULT_OPTIONS, 1000, 5);
    expect(rec.length).toBeGreaterThanOrEqual(16 + 232 + 12); // min sizes
    // PalmDOC at 0 (compression=1)
    expect((rec[0]! << 8) | rec[1]!).toBe(1);
    // MOBI at offset 16
    expect(readAscii(rec, 16, 4)).toBe("MOBI");
    // EXTH after MOBI header (offset 16+232=248)
    expect(readAscii(rec, 248, 4)).toBe("EXTH");
  });
});

// ===== assembleMobi =====

describe("pdf-to-mobi-converter assembleMobi", () => {
  it("produces a complete MOBI file", () => {
    const bytes = assembleMobi(["Hello, World!"], DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(78); // bigger than PalmDB header
    // Check PalmDB header
    expect(readAscii(bytes, 60, 4)).toBe("BOOK");
    expect(readAscii(bytes, 64, 4)).toBe("MOBI");
    // Record count should be at least 2 (record0 + 1 text record)
    const recCount = (bytes[76]! << 8) | bytes[77]!;
    expect(recCount).toBeGreaterThanOrEqual(2);
  });
  it("places record 0 at the first offset", () => {
    const bytes = assembleMobi(["Hello"], DEFAULT_OPTIONS);
    const firstOffset = (bytes[78]! << 24) | (bytes[79]! << 16) | (bytes[80]! << 8) | bytes[81]!;
    // Record 0 should start with PalmDOC compression=1
    expect((bytes[firstOffset]! << 8) | bytes[firstOffset + 1]!).toBe(1);
  });
});

// ===== convertPdfToMobi =====

describe("pdf-to-mobi-converter convertPdfToMobi", () => {
  it("converts a simple PDF to MOBI", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToMobi(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.recordCount).toBeGreaterThanOrEqual(2);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.mobiBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToMobi(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToMobi(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToMobi(pdfBytes, DEFAULT_OPTIONS, "custom.mobi");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.mobi");
    }
  });
});

// ===== formatBytes =====

describe("pdf-to-mobi-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-mobi-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, mobiBytes: 2000,
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
      fileName: "test.pdf", pdfBytes: 1000, mobiBytes: 2000,
      recordCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-mobi-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-mobi-converter" },
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
