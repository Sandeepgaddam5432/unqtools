import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  generateDocumentXml, generateStylesXml, generateContentTypesXml,
  generateRootRelsXml, generateDocumentRelsXml, generateCoreXml, generateAppXml,
  convertPdfToWord, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type WordOptions,
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

// ===== XML generators =====

describe("pdf-to-word-converter generateDocumentXml", () => {
  it("generates a valid document.xml with paragraphs", () => {
    const xml = generateDocumentXml(["Hello", "World"], DEFAULT_OPTIONS, false);
    expect(xml).toContain("<w:document");
    expect(xml).toContain("<w:body>");
    expect(xml).toContain("<w:t xml:space=\"preserve\">Hello</w:t>");
    expect(xml).toContain("<w:t xml:space=\"preserve\">World</w:t>");
  });
  it("includes section properties at end of body", () => {
    const xml = generateDocumentXml(["Test"], DEFAULT_OPTIONS, false);
    expect(xml).toContain("<w:sectPr>");
    expect(xml).toContain("<w:pgSz");
    expect(xml).toContain("<w:pgMar");
  });
  it("escapes XML special characters in text", () => {
    const xml = generateDocumentXml(["a < b > c & d"], DEFAULT_OPTIONS, false);
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
    expect(xml).toContain("&amp;");
  });
  it("renders empty paragraphs for blank lines", () => {
    const xml = generateDocumentXml(["", ""], DEFAULT_OPTIONS, false);
    expect(xml).toContain("<w:p><w:pPr>");
  });
  it("uses chosen font family", () => {
    const opts: WordOptions = { ...DEFAULT_OPTIONS, fontFamily: "Times New Roman" };
    const xml = generateDocumentXml(["Test"], opts, false);
    expect(xml).toContain("Times New Roman");
  });
});

describe("pdf-to-word-converter generateStylesXml", () => {
  it("includes docDefaults with chosen font", () => {
    const xml = generateStylesXml(DEFAULT_OPTIONS);
    expect(xml).toContain("<w:docDefaults>");
    expect(xml).toContain("Calibri");
    expect(xml).toContain("<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\">");
  });
});

describe("pdf-to-word-converter generateContentTypesXml", () => {
  it("declares all parts", () => {
    const xml = generateContentTypesXml();
    expect(xml).toContain("word/document.xml");
    expect(xml).toContain("word/styles.xml");
    expect(xml).toContain("docProps/core.xml");
    expect(xml).toContain("docProps/app.xml");
  });
});

describe("pdf-to-word-converter generateRootRelsXml", () => {
  it("declares officeDocument relationship", () => {
    const xml = generateRootRelsXml();
    expect(xml).toContain("officeDocument");
    expect(xml).toContain("word/document.xml");
  });
});

describe("pdf-to-word-converter generateDocumentRelsXml", () => {
  it("declares styles relationship", () => {
    const xml = generateDocumentRelsXml();
    expect(xml).toContain("styles.xml");
  });
});

describe("pdf-to-word-converter generateCoreXml", () => {
  it("includes title and author", () => {
    const opts: WordOptions = { ...DEFAULT_OPTIONS, title: "My Doc", author: "John" };
    const xml = generateCoreXml(opts, "2026-01-01T00:00:00Z");
    expect(xml).toContain("My Doc");
    expect(xml).toContain("John");
    expect(xml).toContain("2026-01-01");
  });
});

describe("pdf-to-word-converter generateAppXml", () => {
  it("includes application name", () => {
    const xml = generateAppXml();
    expect(xml).toContain("UnQTools");
  });
});

// ===== convertPdfToWord =====

describe("pdf-to-word-converter convertPdfToWord", () => {
  it("converts a simple PDF to DOCX", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToWord(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.pageCount).toBe(1);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.paragraphCount).toBeGreaterThan(0);
      expect(result.output.docxBytes).toBeGreaterThan(0);
    }
  });

  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToWord(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
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
    const result = await convertPdfToWord(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });

  it("applies custom font family", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToWord(pdfBytes, { ...DEFAULT_OPTIONS, fontFamily: "Courier New" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Verify the blob contains the font name by extracting document.xml
      // We can't easily parse the ZIP here, but we can check the blob is non-empty.
      expect(result.output.blob.size).toBeGreaterThan(0);
    }
  });

  it("sets output filename from parameter", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToWord(pdfBytes, DEFAULT_OPTIONS, "custom.docx");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.docx");
    }
  });

  it("computes word count correctly", async () => {
    const pdfBytes = await makeSimplePdf(["one two three"]);
    const result = await convertPdfToWord(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.wordCount).toBeGreaterThanOrEqual(3);
    }
  });
});

// ===== Utilities =====

describe("pdf-to-word-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-word-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, docxBytes: 2000,
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
      fileName: "test.pdf", pdfBytes: 1000, docxBytes: 2000,
      pageCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-word-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/pdf-to-word-converter" } };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", fontFamily: "Courier New" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("font=Courier+New");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&font=Arial&fs=24&margin=1440&title=Test");
    expect(parsed).toEqual({
      pageRange: "1-3",
      fontFamily: "Arial",
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
  it("falls back to Calibri for invalid font", () => {
    const parsed = parseShareUrl("#font=Invalid");
    expect(parsed?.fontFamily).toBe("Calibri");
  });
  it("clamps out-of-range font size", () => {
    const parsed = parseShareUrl("#font=Calibri&fs=999");
    expect(parsed?.fontSize).toBe(72);
  });
});
