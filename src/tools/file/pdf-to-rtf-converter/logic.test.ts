import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  escapeRtf, generateRtf,
  convertPdfToRtf, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type RtfOptions,
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

// ===== escapeRtf =====

describe("pdf-to-rtf-converter escapeRtf", () => {
  it("escapes backslash", () => {
    expect(escapeRtf("a\\b")).toBe("a\\\\b");
  });
  it("escapes braces", () => {
    expect(escapeRtf("a{b}c")).toBe("a\\{b\\}c");
  });
  it("encodes non-ASCII as \\uN?", () => {
    expect(escapeRtf("café")).toBe("caf\\u233?");
  });
  it("returns empty string for empty input", () => {
    expect(escapeRtf("")).toBe("");
  });
  it("does not modify plain ASCII", () => {
    expect(escapeRtf("Hello, World!")).toBe("Hello, World!");
  });
});

// ===== generateRtf =====

describe("pdf-to-rtf-converter generateRtf", () => {
  it("generates a valid RTF document", () => {
    const rtf = generateRtf(["Hello, World!"], DEFAULT_OPTIONS);
    expect(rtf).toContain("{\\rtf1");
    expect(rtf).toContain("\\ansi");
    expect(rtf).toContain("\\fonttbl");
    expect(rtf).toContain("Hello, World!");
  });

  it("inserts \\par after each line", () => {
    const rtf = generateRtf(["Line 1\nLine 2"], DEFAULT_OPTIONS);
    expect(rtf).toContain("Line 1\\par");
    expect(rtf).toContain("Line 2\\par");
  });

  it("inserts \\page between pages", () => {
    const rtf = generateRtf(["Page 1", "Page 2"], DEFAULT_OPTIONS);
    expect(rtf).toContain("\\page");
  });

  it("does not insert \\page after the last page", () => {
    const rtf = generateRtf(["Only page"], DEFAULT_OPTIONS);
    expect(rtf).not.toContain("\\page");
  });

  it("includes font table with chosen font", () => {
    const rtf = generateRtf(["Hi"], { ...DEFAULT_OPTIONS, fontFamily: "Times New Roman" });
    expect(rtf).toContain("Times New Roman");
  });

  it("includes font size as half-points", () => {
    const rtf = generateRtf(["Hi"], { ...DEFAULT_OPTIONS, fontSize: 28 });
    expect(rtf).toContain("\\fs28");
  });

  it("includes page margins in twips", () => {
    const rtf = generateRtf(["Hi"], { ...DEFAULT_OPTIONS, margin: 2160 });
    expect(rtf).toContain("\\margl2160");
    expect(rtf).toContain("\\margr2160");
    expect(rtf).toContain("\\margt2160");
    expect(rtf).toContain("\\margb2160");
  });

  it("includes title in info group", () => {
    const rtf = generateRtf(["Hi"], { ...DEFAULT_OPTIONS, title: "My Doc" });
    expect(rtf).toContain("\\info");
    expect(rtf).toContain("{\\title My Doc}");
  });

  it("escapes special characters in text", () => {
    const rtf = generateRtf(["a {b} c"], DEFAULT_OPTIONS);
    expect(rtf).toContain("a \\{b\\} c");
  });

  it("ends with closing brace", () => {
    const rtf = generateRtf(["Hi"], DEFAULT_OPTIONS);
    expect(rtf.endsWith("}")).toBe(true);
  });
});

// ===== convertPdfToRtf (end-to-end) =====

describe("pdf-to-rtf-converter convertPdfToRtf", () => {
  it("converts a simple PDF to RTF", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToRtf(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.rtf).toContain("Hello, World!");
      expect(result.output.rtf).toContain("Second line.");
      expect(result.output.pageCount).toBe(1);
      expect(result.output.paragraphCount).toBeGreaterThan(0);
    }
  });

  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToRtf(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
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
    const result = await convertPdfToRtf(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });

  it("applies custom font family", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToRtf(pdfBytes, { ...DEFAULT_OPTIONS, fontFamily: "Courier New" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.rtf).toContain("Courier New");
    }
  });

  it("computes word count correctly", async () => {
    const pdfBytes = await makeSimplePdf(["one two three"]);
    const result = await convertPdfToRtf(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.wordCount).toBeGreaterThanOrEqual(3);
    }
  });

  it("sets output filename from parameter", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToRtf(pdfBytes, DEFAULT_OPTIONS, "custom.rtf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.rtf");
    }
  });
});

// ===== Utilities =====

describe("pdf-to-rtf-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-rtf-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, rtfBytes: 2000,
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
      fileName: "test.pdf", pdfBytes: 1000, rtfBytes: 2000,
      pageCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-rtf-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/pdf-to-rtf-converter" } };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", fontFamily: "Times New Roman" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("font=Times+New+Roman");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&font=Courier+New&fs=24&margin=1440&title=Test");
    expect(parsed).toEqual({
      pageRange: "1-3",
      fontFamily: "Courier New",
      fontSize: 24,
      margin: 1440,
      title: "Test",
    });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to Arial for invalid font", () => {
    const parsed = parseShareUrl("#font=Invalid");
    expect(parsed?.fontFamily).toBe("Arial");
  });
  it("clamps out-of-range font size", () => {
    const parsed = parseShareUrl("#font=Arial&fs=999");
    expect(parsed?.fontSize).toBe(72);
  });
});
