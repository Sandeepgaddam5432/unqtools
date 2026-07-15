import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  getPageSizePoints, cmToPoints, getFontFamilyName, escapeXmlText,
  buildParagraphs, generateContentXml, generateStylesXml, generateMetaXml,
  generateManifestXml, convertPdfToOdt, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type OdtOptions, type OdtFontFamily, type OdtPageSize,
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

// ===== Page dimensions =====

describe("pdf-to-odt-converter getPageSizePoints", () => {
  it("returns A4 dimensions", () => {
    const d = getPageSizePoints("a4");
    expect(d.width).toBeCloseTo(595.276, 1);
    expect(d.height).toBeCloseTo(841.89, 1);
  });
  it("returns Letter dimensions", () => {
    const d = getPageSizePoints("letter");
    expect(d.width).toBe(612);
    expect(d.height).toBe(792);
  });
  it("returns Legal dimensions", () => {
    const d = getPageSizePoints("legal");
    expect(d.width).toBe(612);
    expect(d.height).toBe(1008);
  });
});

describe("pdf-to-odt-converter cmToPoints", () => {
  it("converts 1 inch (2.54cm) to 72 points", () => {
    expect(cmToPoints(2.54)).toBe(72);
  });
  it("converts 0 cm to 0 points", () => {
    expect(cmToPoints(0)).toBe(0);
  });
  it("converts 5cm to ~142 points", () => {
    expect(cmToPoints(5)).toBeGreaterThan(140);
    expect(cmToPoints(5)).toBeLessThan(145);
  });
});

describe("pdf-to-odt-converter getFontFamilyName", () => {
  it("returns Liberation Serif for serif", () => {
    expect(getFontFamilyName("serif")).toBe("Liberation Serif");
  });
  it("returns Liberation Sans for sans", () => {
    expect(getFontFamilyName("sans")).toBe("Liberation Sans");
  });
  it("returns Liberation Mono for mono", () => {
    expect(getFontFamilyName("mono")).toBe("Liberation Mono");
  });
});

// ===== escapeXmlText =====

describe("pdf-to-odt-converter escapeXmlText", () => {
  it("escapes & < > \" '", () => {
    expect(escapeXmlText(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
  });
  it("strips control characters", () => {
    expect(escapeXmlText("a\x00b\x07c")).toBe("abc");
  });
  it("preserves tabs and newlines", () => {
    expect(escapeXmlText("a\tb\nc")).toBe("a\tb\nc");
  });
  it("returns empty for empty input", () => {
    expect(escapeXmlText("")).toBe("");
  });
});

// ===== buildParagraphs =====

describe("pdf-to-odt-converter buildParagraphs", () => {
  it("wraps each non-empty line in <text:p>", () => {
    const paragraphs = buildParagraphs(["Line 1\nLine 2"], DEFAULT_OPTIONS);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain("<text:p");
    expect(paragraphs[0]).toContain("Line 1");
  });
  it("applies Heading_20_1 style to first non-empty paragraph per page", () => {
    const paragraphs = buildParagraphs(["Title\nBody"], { ...DEFAULT_OPTIONS, markPageHeadings: true });
    expect(paragraphs[0]).toContain('text:style-name="Heading_20_1"');
    expect(paragraphs[1]).not.toContain('Heading_20_1');
  });
  it("does not apply heading style when markPageHeadings is false", () => {
    const paragraphs = buildParagraphs(["Title\nBody"], { ...DEFAULT_OPTIONS, markPageHeadings: false });
    expect(paragraphs[0]).not.toContain("Heading_20_1");
  });
  it("inserts PageBreak paragraph between pages when insertPageBreaks is true", () => {
    const paragraphs = buildParagraphs(["Page 1 text", "Page 2 text"], DEFAULT_OPTIONS);
    expect(paragraphs.some((p) => p.includes('style-name="PageBreak"'))).toBe(true);
  });
  it("does not insert PageBreak when insertPageBreaks is false", () => {
    const paragraphs = buildParagraphs(["Page 1 text", "Page 2 text"], { ...DEFAULT_OPTIONS, insertPageBreaks: false });
    expect(paragraphs.some((p) => p.includes('PageBreak'))).toBe(false);
  });
  it("does not insert PageBreak after the last page", () => {
    const paragraphs = buildParagraphs(["Page 1 text", "Page 2 text"], DEFAULT_OPTIONS);
    expect(paragraphs[paragraphs.length - 1]).not.toContain("PageBreak");
  });
  it("skips empty lines", () => {
    const paragraphs = buildParagraphs(["\n\nHello\n\n"], DEFAULT_OPTIONS);
    expect(paragraphs).toHaveLength(1);
  });
  it("skips empty pages", () => {
    const paragraphs = buildParagraphs(["", "Hello", ""], DEFAULT_OPTIONS);
    expect(paragraphs.filter((p) => !p.includes("PageBreak"))).toHaveLength(1);
  });
  it("escapes XML chars in text", () => {
    const paragraphs = buildParagraphs(["a < b > c & d"], DEFAULT_OPTIONS);
    expect(paragraphs[0]).toContain("&lt;");
    expect(paragraphs[0]).toContain("&gt;");
    expect(paragraphs[0]).toContain("&amp;");
  });
});

// ===== content.xml =====

describe("pdf-to-odt-converter generateContentXml", () => {
  it("produces a valid ODF content document", () => {
    const xml = generateContentXml(["<text:p>Hello</text:p>"], DEFAULT_OPTIONS);
    expect(xml).toContain("<office:document-content");
    expect(xml).toContain("office:version=\"1.2\"");
    expect(xml).toContain("<office:text>");
    expect(xml).toContain("Hello");
  });
  it("declares the PageBreak automatic style", () => {
    const xml = generateContentXml([], DEFAULT_OPTIONS);
    expect(xml).toContain("PageBreak");
    expect(xml).toContain("fo:break-before=\"page\"");
  });
});

// ===== styles.xml =====

describe("pdf-to-odt-converter generateStylesXml", () => {
  it("declares the Standard and Heading 1 styles", () => {
    const xml = generateStylesXml(DEFAULT_OPTIONS);
    expect(xml).toContain('style:name="Standard"');
    expect(xml).toContain('style:name="Heading_20_1"');
    expect(xml).toContain("Liberation Serif");
  });
  it("uses chosen font family", () => {
    const xml = generateStylesXml({ ...DEFAULT_OPTIONS, fontFamily: "mono" });
    expect(xml).toContain("Liberation Mono");
  });
  it("uses chosen font size", () => {
    const xml = generateStylesXml({ ...DEFAULT_OPTIONS, fontSize: 16 });
    expect(xml).toContain("16pt");
  });
  it("declares page layout with chosen page size", () => {
    const xml = generateStylesXml({ ...DEFAULT_OPTIONS, pageSize: "legal" });
    expect(xml).toContain("1008pt");
  });
});

// ===== meta.xml =====

describe("pdf-to-odt-converter generateMetaXml", () => {
  it("includes title and author", () => {
    const xml = generateMetaXml({ ...DEFAULT_OPTIONS, title: "My Doc", author: "John" });
    expect(xml).toContain("<dc:title>My Doc</dc:title>");
    expect(xml).toContain("<dc:creator>John</dc:creator>");
  });
  it("includes the generator name", () => {
    const xml = generateMetaXml(DEFAULT_OPTIONS);
    expect(xml).toContain("UnQTools");
  });
});

// ===== manifest.xml =====

describe("pdf-to-odt-converter generateManifestXml", () => {
  it("declares all 4 files", () => {
    const xml = generateManifestXml();
    expect(xml).toContain("content.xml");
    expect(xml).toContain("styles.xml");
    expect(xml).toContain("meta.xml");
    expect(xml).toContain("application/vnd.oasis.opendocument.text");
  });
});

// ===== convertPdfToOdt =====

describe("pdf-to-odt-converter convertPdfToOdt", () => {
  it("converts a simple PDF to ODT", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToOdt(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.paragraphCount).toBeGreaterThan(0);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.odtBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToOdt(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToOdt(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToOdt(pdfBytes, DEFAULT_OPTIONS, "custom.odt");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.odt");
    }
  });
  it("uses sans font family when chosen", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToOdt(pdfBytes, { ...DEFAULT_OPTIONS, fontFamily: "sans" });
    expect(result.ok).toBe(true);
  });
});

// ===== formatBytes =====

describe("pdf-to-odt-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-odt-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, odtBytes: 2000,
      paragraphCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, odtBytes: 2000,
      paragraphCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-odt-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-odt-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", fontFamily: "mono", pageSize: "legal" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("font=mono");
    expect(url).toContain("page=legal");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&fs=14&font=sans&page=letter&margin=1.5&pb=false&head=false");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.fontSize).toBe(14);
    expect(parsed?.fontFamily).toBe("sans");
    expect(parsed?.pageSize).toBe("letter");
    expect(parsed?.margin).toBe(1.5);
    expect(parsed?.insertPageBreaks).toBe(false);
    expect(parsed?.markPageHeadings).toBe(false);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to serif for invalid font", () => {
    const parsed = parseShareUrl("#font=invalid");
    expect(parsed?.fontFamily).toBe("serif");
  });
});
