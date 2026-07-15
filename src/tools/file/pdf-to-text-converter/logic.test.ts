import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  parsePageRange, decodePdfString, extractTextFromContentStream,
  extractPdfText, formatAsPlainText, computeStats, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type PdfTextResult, type PageText,
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

// ===== parsePageRange =====

describe("pdf-to-text-converter parsePageRange", () => {
  it("returns null for empty string (all pages)", () => {
    expect(parsePageRange("", 10)).toBeNull();
  });
  it("parses a single page", () => {
    expect(parsePageRange("3", 10)).toEqual([3]);
  });
  it("parses a range", () => {
    expect(parsePageRange("1-3", 10)).toEqual([1, 2, 3]);
  });
  it("parses a comma-separated list", () => {
    expect(parsePageRange("1,3,5", 10)).toEqual([1, 3, 5]);
  });
  it("parses a mixed list with ranges", () => {
    expect(parsePageRange("1-3,5,7-9", 10)).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });
  it("clamps out-of-range pages", () => {
    expect(parsePageRange("1-100", 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("deduplicates pages", () => {
    expect(parsePageRange("1,1,2,2,3", 5)).toEqual([1, 2, 3]);
  });
  it("ignores invalid entries", () => {
    expect(parsePageRange("abc,2,xyz", 5)).toEqual([2]);
  });
  it("handles reverse ranges", () => {
    expect(parsePageRange("5-3", 10)).toEqual([3, 4, 5]);
  });
});

// ===== decodePdfString =====

describe("pdf-to-text-converter decodePdfString", () => {
  it("decodes ASCII text", () => {
    const bytes = new TextEncoder().encode("Hello");
    expect(decodePdfString(bytes)).toBe("Hello");
  });
  it("decodes UTF-16BE with BOM", () => {
    // BOM + "Hi" in UTF-16BE
    const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]);
    expect(decodePdfString(bytes)).toBe("Hi");
  });
  it("returns empty string for empty input", () => {
    expect(decodePdfString(new Uint8Array(0))).toBe("");
  });
  it("decodes Latin-1 characters", () => {
    const bytes = new Uint8Array([0xc3, 0xa9]); // é in UTF-8 (but we treat as Latin-1)
    const result = decodePdfString(bytes);
    expect(result.length).toBe(2);
  });
});

// ===== extractTextFromContentStream =====

describe("pdf-to-text-converter extractTextFromContentStream", () => {
  it("extracts Tj operator text", () => {
    // BT /F1 12 Tf 50 750 Td (Hello, World!) Tj ET
    const stream = new TextEncoder().encode("BT /F1 12 Tf 50 750 Td (Hello, World!) Tj ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("Hello, World!"))).toBe(true);
  });

  it("extracts TJ array text", () => {
    // BT /F1 12 Tf 50 750 Td [(Hel) -10 (lo)] TJ ET
    const stream = new TextEncoder().encode("BT /F1 12 Tf 50 750 Td [(Hel) -10 (lo)] TJ ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("Hello"))).toBe(true);
  });

  it("extracts text from ' operator", () => {
    const stream = new TextEncoder().encode("BT /F1 12 Tf 50 750 Td (Line 1) ' (Line 2) ' ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("Line 1"))).toBe(true);
    expect(lines.some((l) => l.includes("Line 2"))).toBe(true);
  });

  it("extracts hex string text", () => {
    // "Hello" in hex: 48 65 6c 6c 6f
    const stream = new TextEncoder().encode("BT /F1 12 Tf 50 750 Td <48656c6c6f> Tj ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("Hello"))).toBe(true);
  });

  it("handles escaped parentheses in literal strings", () => {
    const stream = new TextEncoder().encode("BT (Hello \\(world\\)) Tj ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("Hello (world)"))).toBe(true);
  });

  it("handles octal escapes", () => {
    // \101 = 'A' (octal)
    const stream = new TextEncoder().encode("BT (\\101) Tj ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("A"))).toBe(true);
  });

  it("returns empty list for stream with no text operators", () => {
    const stream = new TextEncoder().encode("50 50 m 100 100 l S");
    const lines = extractTextFromContentStream(stream);
    expect(lines.length === 0 || lines.every((l) => l === "")).toBe(true);
  });

  it("ignores text outside BT/ET block", () => {
    const stream = new TextEncoder().encode("(Outside) Tj BT (Inside) Tj ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("Inside"))).toBe(true);
    expect(lines.some((l) => l === "Outside")).toBe(false);
  });

  it("handles multiple text blocks", () => {
    const stream = new TextEncoder().encode("BT (First) Tj ET BT (Second) Tj ET");
    const lines = extractTextFromContentStream(stream);
    expect(lines.some((l) => l.includes("First"))).toBe(true);
    expect(lines.some((l) => l.includes("Second"))).toBe(true);
  });
});

// ===== extractPdfText (end-to-end) =====

describe("pdf-to-text-converter extractPdfText", () => {
  it("extracts text from a simple PDF", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await extractPdfText(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
      const allText = result.output.pages.map((p) => p.text).join("\n");
      expect(allText).toContain("Hello, World!");
      expect(allText).toContain("Second line.");
    }
  });

  it("returns error for invalid PDF bytes", async () => {
    const result = await extractPdfText(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });

  it("respects page range option", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 3; i++) {
      const page = doc.addPage([612, 792]);
      page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 12, font, color: { type: "RGB", red: 0, green: 0, blue: 0 } as never });
    }
    const pdfBytes = await doc.save();
    const result = await extractPdfText(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "2" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
      expect(result.output.pages[0]!.pageNumber).toBe(2);
    }
  });

  it("applies lineNumbers option", async () => {
    const pdfBytes = await makeSimplePdf(["Line one.", "Line two."]);
    const result = await extractPdfText(pdfBytes, { ...DEFAULT_OPTIONS, lineNumbers: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pages[0]!.text).toContain("1:");
    }
  });

  it("applies removeEmptyLines option", async () => {
    const pdfBytes = await makeSimplePdf(["First", "Second"]);
    const result = await extractPdfText(pdfBytes, { ...DEFAULT_OPTIONS, removeEmptyLines: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should have no blank lines
      const lines = result.output.pages[0]!.text.split("\n");
      expect(lines.every((l) => l !== "")).toBe(true);
    }
  });

  it("computes word count correctly", async () => {
    const pdfBytes = await makeSimplePdf(["one two three"]);
    const result = await extractPdfText(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.totalWordCount).toBeGreaterThanOrEqual(3);
    }
  });
});

// ===== formatAsPlainText =====

describe("pdf-to-text-converter formatAsPlainText", () => {
  it("joins pages with separator", () => {
    const result: PdfTextResult = {
      pages: [
        { pageNumber: 1, text: "Page 1", lineCount: 1, wordCount: 2, charCount: 6 },
        { pageNumber: 2, text: "Page 2", lineCount: 1, wordCount: 2, charCount: 6 },
      ],
      pageCount: 2,
      totalWordCount: 4,
      totalCharCount: 12,
      totalLineCount: 2,
    };
    const text = formatAsPlainText(result, { ...DEFAULT_OPTIONS, pageSeparator: "---" });
    expect(text).toContain("Page 1");
    expect(text).toContain("Page 2");
    expect(text).toContain("---");
  });

  it("prepends BOM when addBom is true", () => {
    const result: PdfTextResult = {
      pages: [{ pageNumber: 1, text: "Hi", lineCount: 1, wordCount: 1, charCount: 2 }],
      pageCount: 1, totalWordCount: 1, totalCharCount: 2, totalLineCount: 1,
    };
    const text = formatAsPlainText(result, { ...DEFAULT_OPTIONS, addBom: true });
    expect(text.startsWith("\uFEFF")).toBe(true);
  });
});

// ===== computeStats =====

describe("pdf-to-text-converter computeStats", () => {
  it("computes totals", () => {
    const result: PdfTextResult = {
      pages: [
        { pageNumber: 1, text: "a b c", lineCount: 1, wordCount: 3, charCount: 5 },
        { pageNumber: 2, text: "d e", lineCount: 1, wordCount: 2, charCount: 3 },
      ],
      pageCount: 2, totalWordCount: 5, totalCharCount: 8, totalLineCount: 2,
    };
    const stats = computeStats(result);
    expect(stats.pageCount).toBe(2);
    expect(stats.wordCount).toBe(5);
    expect(stats.charCount).toBe(8);
    expect(stats.lineCount).toBe(2);
  });
});

// ===== Utilities =====

describe("pdf-to-text-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-text-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, pageCount: 5,
      wordCount: 200, extractedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, pageCount: 5,
      wordCount: 200, extractedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-text-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/pdf-to-text-converter" } };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", lineNumbers: true });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("ln=true");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&trim=true&empty=false&ln=true&bom=false");
    expect(parsed).toEqual({
      pageRange: "1-3",
      trimLines: true,
      removeEmptyLines: false,
      lineNumbers: true,
      addBom: false,
    });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
});
