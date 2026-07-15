import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  escapeHtml, generateHtml, convertPdfToHtml, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type HtmlOptions,
} from "./logic";
import { extractPdfText, type PdfTextResult } from "../pdf-to-text-converter/logic";
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

function makeFakeResult(text: string, pageCount = 1): PdfTextResult {
  return {
    pages: Array.from({ length: pageCount }, (_, i) => ({
      pageNumber: i + 1,
      text,
      lineCount: text.split("\n").length,
      wordCount: text.split(/\s+/).filter((s) => s.length > 0).length,
      charCount: text.length,
    })),
    pageCount,
    totalWordCount: text.split(/\s+/).filter((s) => s.length > 0).length * pageCount,
    totalCharCount: text.length * pageCount,
    totalLineCount: text.split("\n").length * pageCount,
  };
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

describe("pdf-to-html-converter escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &#39; f");
  });
  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
  it("does not modify plain text", () => {
    expect(escapeHtml("Hello, World!")).toBe("Hello, World!");
  });
});

// ===== generateHtml =====

describe("pdf-to-html-converter generateHtml", () => {
  it("generates a complete HTML5 document", () => {
    const result = makeFakeResult("Hello");
    const html = generateHtml(result, DEFAULT_OPTIONS);
    expect(html.html).toContain("<!DOCTYPE html>");
    expect(html.html).toContain("<html");
    expect(html.html).toContain("<head>");
    expect(html.html).toContain("<body>");
    expect(html.html).toContain("Hello");
  });

  it("wraps text lines in <p> tags", () => {
    const result = makeFakeResult("Line 1\nLine 2");
    const html = generateHtml(result, DEFAULT_OPTIONS);
    expect(html.html).toContain("<p>Line 1</p>");
    expect(html.html).toContain("<p>Line 2</p>");
  });

  it("wraps each page in a <section>", () => {
    const result = makeFakeResult("Hello", 2);
    const html = generateHtml(result, DEFAULT_OPTIONS);
    expect(html.html).toContain('<section id="page-1"');
    expect(html.html).toContain('<section id="page-2"');
  });

  it("inserts HR separator by default", () => {
    const result = makeFakeResult("Hello", 2);
    const html = generateHtml(result, DEFAULT_OPTIONS);
    expect(html.html).toContain('<hr class="page-break">');
  });

  it("inserts DIV separator when chosen", () => {
    const result = makeFakeResult("Hello", 2);
    const html = generateHtml(result, { ...DEFAULT_OPTIONS, pageSeparator: "div" });
    expect(html.html).toContain('<div class="page-break"');
  });

  it("omits separator when 'none' is chosen", () => {
    const result = makeFakeResult("Hello", 2);
    const html = generateHtml(result, { ...DEFAULT_OPTIONS, pageSeparator: "none", customCss: "" });
    expect(html.html).not.toContain('<hr class="page-break"');
    expect(html.html).not.toContain('<div class="page-break"');
  });

  it("includes custom CSS in <style>", () => {
    const result = makeFakeResult("Hello");
    const html = generateHtml(result, { ...DEFAULT_OPTIONS, customCss: "body { color: red; }" });
    expect(html.html).toContain("body { color: red; }");
  });

  it("escapes HTML special characters in text", () => {
    const result = makeFakeResult("a < b > c");
    const html = generateHtml(result, DEFAULT_OPTIONS);
    expect(html.html).toContain("&lt;");
    expect(html.html).toContain("&gt;");
  });

  it("sets document title", () => {
    const result = makeFakeResult("Hello");
    const html = generateHtml(result, { ...DEFAULT_OPTIONS, title: "My Doc" });
    expect(html.html).toContain("<title>My Doc</title>");
    expect(html.html).toContain("<h1>My Doc</h1>");
  });

  it("computes htmlBytes correctly", () => {
    const result = makeFakeResult("Hello");
    const html = generateHtml(result, DEFAULT_OPTIONS);
    expect(html.htmlBytes).toBeGreaterThan(0);
    expect(html.htmlBytes).toBe(new TextEncoder().encode(html.html).length);
  });
});

// ===== convertPdfToHtml (end-to-end) =====

describe("pdf-to-html-converter convertPdfToHtml", () => {
  it("converts a simple PDF to HTML", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToHtml(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.html).toContain("Hello, World!");
      expect(result.output.html).toContain("Second line.");
      expect(result.output.pageCount).toBe(1);
    }
  });

  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToHtml(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
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
    const result = await convertPdfToHtml(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });

  it("applies custom title", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToHtml(pdfBytes, { ...DEFAULT_OPTIONS, title: "Custom Title" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.html).toContain("<title>Custom Title</title>");
    }
  });

  it("computes word count correctly", async () => {
    const pdfBytes = await makeSimplePdf(["one two three"]);
    const result = await convertPdfToHtml(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.wordCount).toBeGreaterThanOrEqual(3);
    }
  });
});

// ===== Utilities =====

describe("pdf-to-html-converter utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-html-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, htmlBytes: 2000,
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
      fileName: "test.pdf", pdfBytes: 1000, htmlBytes: 2000,
      pageCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-html-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/pdf-to-html-converter" } };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", title: "My Doc" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("title=My+Doc");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&sep=div&bom=true&title=Custom");
    expect(parsed).toEqual({
      pageRange: "1-3",
      title: "Custom",
      pageSeparator: "div",
      addBom: true,
    });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to 'hr' for invalid separator", () => {
    const parsed = parseShareUrl("#sep=invalid");
    expect(parsed?.pageSeparator).toBe("hr");
  });
});
