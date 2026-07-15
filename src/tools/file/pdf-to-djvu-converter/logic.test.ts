import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  generateHeader, generateMetaChunk, generateTextChunk, generatePageBreakChunk, generateEndChunk,
  assembleDjvu, convertPdfToDjvu, hexDump, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  readAscii,
  type DjvuOptions, type DjvuEncoding,
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

// ===== Header generation =====

describe("pdf-to-djvu-converter generateHeader", () => {
  it("returns a 64-byte header", () => {
    const header = generateHeader(3, 64, 200, 1000);
    expect(header.length).toBe(64);
  });
  it("includes the magic string", () => {
    const header = generateHeader(1, 64, 100, 500);
    // Magic is "AT&T DjVu Simplified\n"
    expect(readAscii(header, 0, 21)).toContain("AT&T DjVu Simplified");
  });
  it("writes version 1 at offset 24", () => {
    const header = generateHeader(1, 64, 100, 500);
    const ver = (header[24]! << 24) | (header[25]! << 16) | (header[26]! << 8) | header[27]!;
    expect(ver).toBe(1);
  });
  it("writes page count at offset 28", () => {
    const header = generateHeader(42, 64, 100, 500);
    const count = (header[28]! << 24) | (header[29]! << 16) | (header[30]! << 8) | header[31]!;
    expect(count).toBe(42);
  });
  it("writes compression method 'STOR' at offset 44", () => {
    const header = generateHeader(1, 64, 100, 500);
    expect(readAscii(header, 44, 4)).toBe("STOR");
  });
  it("writes total size at offset 40", () => {
    const header = generateHeader(1, 64, 100, 4096);
    const size = (header[40]! << 24) | (header[41]! << 16) | (header[42]! << 8) | header[43]!;
    expect(size).toBe(4096);
  });
});

// ===== META chunk =====

describe("pdf-to-djvu-converter generateMetaChunk", () => {
  it("starts with 'META' identifier", () => {
    const chunk = generateMetaChunk(DEFAULT_OPTIONS);
    expect(readAscii(chunk, 0, 4)).toBe("META");
  });
  it("writes length after identifier", () => {
    const chunk = generateMetaChunk(DEFAULT_OPTIONS);
    const len = (chunk[4]! << 24) | (chunk[5]! << 16) | (chunk[6]! << 8) | chunk[7]!;
    expect(len).toBeGreaterThan(0);
    expect(chunk.length).toBe(8 + len);
  });
  it("includes title in JSON content", () => {
    const chunk = generateMetaChunk({ ...DEFAULT_OPTIONS, title: "My Doc" });
    const json = new TextDecoder().decode(chunk.subarray(8));
    expect(json).toContain("My Doc");
    expect(json).toContain("title");
  });
  it("includes author in JSON content", () => {
    const chunk = generateMetaChunk({ ...DEFAULT_OPTIONS, author: "Jane" });
    const json = new TextDecoder().decode(chunk.subarray(8));
    expect(json).toContain("Jane");
    expect(json).toContain("author");
  });
});

// ===== TEXT chunk =====

describe("pdf-to-djvu-converter generateTextChunk", () => {
  it("starts with 'TEXT' identifier", () => {
    const chunk = generateTextChunk(1, "Hello", "utf-8");
    expect(readAscii(chunk, 0, 4)).toBe("TEXT");
  });
  it("writes page number at offset 4", () => {
    const chunk = generateTextChunk(7, "Hello", "utf-8");
    const page = (chunk[4]! << 24) | (chunk[5]! << 16) | (chunk[6]! << 8) | chunk[7]!;
    expect(page).toBe(7);
  });
  it("writes text length at offset 8", () => {
    const chunk = generateTextChunk(1, "Hello, World!", "utf-8");
    const len = (chunk[8]! << 24) | (chunk[9]! << 16) | (chunk[10]! << 8) | chunk[11]!;
    expect(len).toBe(13);
  });
  it("includes text content after header", () => {
    const chunk = generateTextChunk(1, "Hello", "utf-8");
    const text = new TextDecoder().decode(chunk.subarray(12));
    expect(text).toBe("Hello");
  });
});

// ===== Page break chunk =====

describe("pdf-to-djvu-converter generatePageBreakChunk", () => {
  it("returns 4 bytes with 'PGBR' marker", () => {
    const chunk = generatePageBreakChunk();
    expect(chunk.length).toBe(4);
    expect(readAscii(chunk, 0, 4)).toBe("PGBR");
  });
});

// ===== End chunk =====

describe("pdf-to-djvu-converter generateEndChunk", () => {
  it("returns 4 bytes with 'ENDS' marker", () => {
    const chunk = generateEndChunk();
    expect(chunk.length).toBe(4);
    expect(readAscii(chunk, 0, 4)).toBe("ENDS");
  });
});

// ===== assembleDjvu =====

describe("pdf-to-djvu-converter assembleDjvu", () => {
  it("produces a complete DjVu file with all chunks", () => {
    const bytes = assembleDjvu(["Hello, World!"], DEFAULT_OPTIONS);
    expect(bytes.length).toBeGreaterThan(64); // bigger than header
    // Header
    expect(readAscii(bytes, 0, 21)).toContain("AT&T DjVu Simplified");
    expect(readAscii(bytes, 44, 4)).toBe("STOR");
    // After header, should be META chunk
    expect(readAscii(bytes, 64, 4)).toBe("META");
    // Last 4 bytes should be ENDS
    expect(readAscii(bytes, bytes.length - 4, 4)).toBe("ENDS");
  });
  it("includes a TEXT chunk for each non-empty page", () => {
    const bytes = assembleDjvu(["Page 1", "Page 2"], DEFAULT_OPTIONS);
    const text = new TextDecoder().decode(bytes);
    // Count occurrences of "TEXT" — should be at least 2 (one per page)
    const matches = text.match(/TEXT/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
  it("inserts PGBR chunks between pages when insertPageBreaks is true", () => {
    const bytes = assembleDjvu(["Page 1", "Page 2"], DEFAULT_OPTIONS);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("PGBR");
  });
  it("does not insert PGBR when insertPageBreaks is false", () => {
    const bytes = assembleDjvu(["Page 1", "Page 2"], { ...DEFAULT_OPTIONS, insertPageBreaks: false });
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain("PGBR");
  });
  it("skips empty pages", () => {
    const bytes = assembleDjvu(["", "Hello", ""], DEFAULT_OPTIONS);
    const text = new TextDecoder().decode(bytes);
    // Should contain "Hello" but only one TEXT chunk
    expect(text).toContain("Hello");
  });
});

// ===== convertPdfToDjvu =====

describe("pdf-to-djvu-converter convertPdfToDjvu", () => {
  it("converts a simple PDF to DjVu", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToDjvu(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.pageCount).toBe(1);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.djvuBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToDjvu(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToDjvu(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToDjvu(pdfBytes, DEFAULT_OPTIONS, "custom.djvu");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.djvu");
    }
  });
  it("uses latin-1 encoding when chosen", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToDjvu(pdfBytes, { ...DEFAULT_OPTIONS, encoding: "latin-1" });
    expect(result.ok).toBe(true);
  });
});

// ===== hexDump =====

describe("pdf-to-djvu-converter hexDump", () => {
  it("produces lines with offset + hex + ASCII", () => {
    const bytes = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
    const dump = hexDump(bytes);
    expect(dump).toContain("41");
    expect(dump).toContain("ABCD");
    expect(dump).toContain("|");
  });
  it("truncates long input", () => {
    const bytes = new Uint8Array(1000);
    const dump = hexDump(bytes, 100);
    expect(dump).toContain("truncated");
  });
  it("handles empty input", () => {
    const dump = hexDump(new Uint8Array(0));
    expect(dump).toBe("");
  });
});

// ===== formatBytes =====

describe("pdf-to-djvu-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-djvu-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, djvuBytes: 2000,
      pageCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, djvuBytes: 2000,
      pageCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-djvu-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-djvu-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", encoding: "latin-1", language: "fr" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("enc=latin-1");
    expect(url).toContain("lang=fr");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&enc=latin-1&lang=de&pb=false&title=MyDoc&author=Jane");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.encoding).toBe("latin-1");
    expect(parsed?.language).toBe("de");
    expect(parsed?.insertPageBreaks).toBe(false);
    expect(parsed?.title).toBe("MyDoc");
    expect(parsed?.author).toBe("Jane");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to utf-8 for invalid encoding", () => {
    const parsed = parseShareUrl("#enc=invalid");
    expect(parsed?.encoding).toBe("utf-8");
  });
});
