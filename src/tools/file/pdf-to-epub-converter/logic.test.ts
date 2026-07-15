import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  isHeading, escapeXhtml, textToXhtmlParagraphs, countWords,
  splitIntoChapters,
  generateMimetype, generateContainerXml, generateContentOpf, generateNcx,
  generateNav, generateChapterXhtml, generateStylesheet,
  convertPdfToEpub, generateUuid, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type EpubOptions, type ChapterMode,
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

// ===== isHeading =====

describe("pdf-to-epub-converter isHeading", () => {
  it("detects Markdown headings", () => {
    expect(isHeading("# Chapter 1")).toBe(true);
    expect(isHeading("## Section 2")).toBe(true);
  });
  it("detects 'Chapter N' pattern", () => {
    expect(isHeading("Chapter 1")).toBe(true);
    expect(isHeading("Chapter 12: The Beginning")).toBe(true);
  });
  it("detects 'Part N' pattern", () => {
    expect(isHeading("Part 1")).toBe(true);
  });
  it("detects ALL CAPS headings", () => {
    expect(isHeading("INTRODUCTION")).toBe(true);
    expect(isHeading("PART ONE")).toBe(true);
  });
  it("rejects empty lines", () => {
    expect(isHeading("")).toBe(false);
    expect(isHeading("   ")).toBe(false);
  });
  it("rejects very long lines", () => {
    expect(isHeading("A".repeat(200))).toBe(false);
  });
  it("rejects normal sentences", () => {
    expect(isHeading("The quick brown fox jumps over the lazy dog.")).toBe(false);
  });
});

// ===== escapeXhtml =====

describe("pdf-to-epub-converter escapeXhtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeXhtml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &#39; f");
  });
  it("returns empty for empty input", () => {
    expect(escapeXhtml("")).toBe("");
  });
  it("does not modify plain text", () => {
    expect(escapeXhtml("Hello, World!")).toBe("Hello, World!");
  });
});

// ===== textToXhtmlParagraphs =====

describe("pdf-to-epub-converter textToXhtmlParagraphs", () => {
  it("wraps each non-empty line in <p>", () => {
    const xhtml = textToXhtmlParagraphs("Line 1\n\nLine 2");
    expect(xhtml).toContain("<p>Line 1</p>");
    expect(xhtml).toContain("<p>Line 2</p>");
  });
  it("skips empty lines", () => {
    const xhtml = textToXhtmlParagraphs("\n\nHello\n\n");
    expect(xhtml.match(/<p>/g)?.length).toBe(1);
  });
  it("escapes XML chars", () => {
    const xhtml = textToXhtmlParagraphs("a < b");
    expect(xhtml).toContain("&lt;");
  });
});

// ===== countWords =====

describe("pdf-to-epub-converter countWords", () => {
  it("counts words in plain text", () => {
    expect(countWords("one two three")).toBe(3);
  });
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
  it("returns 0 for whitespace only", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });
});

// ===== splitIntoChapters =====

describe("pdf-to-epub-converter splitIntoChapters", () => {
  it("splits by page in 'page' mode", () => {
    const chapters = splitIntoChapters(["Page 1 text", "Page 2 text"], "page");
    expect(chapters).toHaveLength(2);
    expect(chapters[0]!.title).toContain("Page 1");
  });
  it("skips empty pages", () => {
    const chapters = splitIntoChapters(["", "Hello", ""], "page");
    expect(chapters).toHaveLength(1);
  });
  it("splits by headings in 'heading' mode", () => {
    const text = "INTRODUCTION\nIntro text.\nCHAPTER 1\nChapter text.";
    const chapters = splitIntoChapters([text], "heading");
    expect(chapters).toHaveLength(2);
    expect(chapters[0]!.title).toBe("INTRODUCTION");
    expect(chapters[1]!.title).toBe("CHAPTER 1");
  });
  it("merges all text in 'single' mode", () => {
    const chapters = splitIntoChapters(["Page 1", "Page 2"], "single");
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.title).toBe("Full Text");
  });
  it("computes word and char counts per chapter", () => {
    const chapters = splitIntoChapters(["one two three four five"], "page");
    expect(chapters[0]!.wordCount).toBe(5);
    expect(chapters[0]!.charCount).toBe(23);
  });
  it("uses first line as title in page mode (when short)", () => {
    const chapters = splitIntoChapters(["Short Title\nbody text here"], "page");
    expect(chapters[0]!.title).toBe("Short Title");
  });
  it("falls back to 'Page N' when first line is too long", () => {
    const longLine = "x".repeat(100);
    const chapters = splitIntoChapters([longLine], "page");
    expect(chapters[0]!.title).toBe("Page 1");
  });
});

// ===== EPUB XML generation =====

describe("pdf-to-epub-converter generateMimetype", () => {
  it("returns the EPUB mimetype string", () => {
    expect(generateMimetype()).toBe("application/epub+zip");
  });
});

describe("pdf-to-epub-converter generateContainerXml", () => {
  it("points to OEBPS/content.opf", () => {
    const xml = generateContainerXml();
    expect(xml).toContain("OEBPS/content.opf");
    expect(xml).toContain("application/oebps-package+xml");
  });
});

describe("pdf-to-epub-converter generateContentOpf", () => {
  it("includes metadata (title, author, language)", () => {
    const opts: EpubOptions = { ...DEFAULT_OPTIONS, title: "My Book", author: "Jane" };
    const chapters = [{ number: 1, title: "Ch 1", bodyHtml: "<p>Hi</p>", wordCount: 1, charCount: 2 }];
    const xml = generateContentOpf(opts, chapters, "urn:uuid:test");
    expect(xml).toContain("<dc:title>My Book</dc:title>");
    expect(xml).toContain("<dc:creator>Jane</dc:creator>");
    expect(xml).toContain("<dc:language>en</dc:language>");
    expect(xml).toContain("urn:uuid:test");
  });
  it("declares nav, ncx, css, and chapter items", () => {
    const chapters = [
      { number: 1, title: "Ch 1", bodyHtml: "", wordCount: 0, charCount: 0 },
      { number: 2, title: "Ch 2", bodyHtml: "", wordCount: 0, charCount: 0 },
    ];
    const xml = generateContentOpf(DEFAULT_OPTIONS, chapters, "id");
    expect(xml).toContain('id="nav"');
    expect(xml).toContain('id="ncx"');
    expect(xml).toContain('id="css"');
    expect(xml).toContain('id="chap1"');
    expect(xml).toContain('id="chap2"');
  });
  it("spine references nav (linear=no) and all chapters", () => {
    const chapters = [{ number: 1, title: "Ch 1", bodyHtml: "", wordCount: 0, charCount: 0 }];
    const xml = generateContentOpf(DEFAULT_OPTIONS, chapters, "id");
    expect(xml).toContain('<itemref idref="nav" linear="no"/>');
    expect(xml).toContain('<itemref idref="chap1"/>');
  });
});

describe("pdf-to-epub-converter generateNcx", () => {
  it("generates navPoint entries per chapter", () => {
    const chapters = [
      { number: 1, title: "First", bodyHtml: "", wordCount: 0, charCount: 0 },
      { number: 2, title: "Second", bodyHtml: "", wordCount: 0, charCount: 0 },
    ];
    const xml = generateNcx(DEFAULT_OPTIONS, chapters, "id");
    expect(xml).toContain("navpoint-1");
    expect(xml).toContain("First");
    expect(xml).toContain("chapter1.xhtml");
  });
});

describe("pdf-to-epub-converter generateNav", () => {
  it("generates EPUB 3 nav with chapter list", () => {
    const chapters = [{ number: 1, title: "Chap", bodyHtml: "", wordCount: 0, charCount: 0 }];
    const xml = generateNav(DEFAULT_OPTIONS, chapters);
    expect(xml).toContain('epub:type="toc"');
    expect(xml).toContain("Table of Contents");
    expect(xml).toContain('href="chapter1.xhtml"');
  });
});

describe("pdf-to-epub-converter generateChapterXhtml", () => {
  it("wraps body in XHTML with title heading", () => {
    const ch = { number: 1, title: "Chapter Title", bodyHtml: "      <p>Body text</p>", wordCount: 2, charCount: 9 };
    const xml = generateChapterXhtml(ch, DEFAULT_OPTIONS);
    expect(xml).toContain("<html");
    expect(xml).toContain("<h1>Chapter Title</h1>");
    expect(xml).toContain("<p>Body text</p>");
    expect(xml).toContain("<title>Chapter Title</title>");
  });
});

describe("pdf-to-epub-converter generateStylesheet", () => {
  it("includes the chosen font size", () => {
    const css = generateStylesheet({ ...DEFAULT_OPTIONS, fontSize: 20 });
    expect(css).toContain("font-size: 20px");
  });
  it("includes custom CSS appended", () => {
    const css = generateStylesheet({ ...DEFAULT_OPTIONS, customCss: ".custom { color: red; }" });
    expect(css).toContain(".custom { color: red; }");
  });
  it("clamps font size", () => {
    const css = generateStylesheet({ ...DEFAULT_OPTIONS, fontSize: 9999 });
    expect(css).toContain("font-size: 36px");
  });
});

// ===== convertPdfToEpub =====

describe("pdf-to-epub-converter convertPdfToEpub", () => {
  it("converts a simple PDF to EPUB", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToEpub(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.chapterCount).toBeGreaterThan(0);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.epubBytes).toBeGreaterThan(0);
    }
  });

  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToEpub(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });

  it("respects page range option", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToEpub(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.chapterCount).toBe(1);
    }
  });

  it("uses heading mode", async () => {
    const pdfBytes = await makeSimplePdf(["INTRODUCTION", "Intro text", "CHAPTER ONE", "Chapter text"]);
    const result = await convertPdfToEpub(pdfBytes, { ...DEFAULT_OPTIONS, chapterMode: "heading" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.chapterCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses single mode", async () => {
    const pdfBytes = await makeSimplePdf(["Hello", "World"], 2);
    const result = await convertPdfToEpub(pdfBytes, { ...DEFAULT_OPTIONS, chapterMode: "single" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.chapterCount).toBe(1);
    }
  });

  it("sets output filename from parameter", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToEpub(pdfBytes, DEFAULT_OPTIONS, "custom.epub");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.epub");
    }
  });
});

// ===== UUID =====

describe("pdf-to-epub-converter generateUuid", () => {
  it("returns a 36-character UUID string", () => {
    const uuid = generateUuid();
    expect(uuid).toHaveLength(36);
  });
  it("includes hyphens at correct positions", () => {
    const uuid = generateUuid();
    expect(uuid[8]).toBe("-");
    expect(uuid[13]).toBe("-");
    expect(uuid[18]).toBe("-");
    expect(uuid[23]).toBe("-");
  });
  it("has '4' at position 14 (version 4 UUID)", () => {
    const uuid = generateUuid();
    expect(uuid[14]).toBe("4");
  });
});

// ===== formatBytes =====

describe("pdf-to-epub-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-epub-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, epubBytes: 2000,
      chapterCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, epubBytes: 2000,
      chapterCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-epub-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-epub-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", title: "My Book", chapterMode: "heading" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("mode=heading");
    expect(url).toContain("title=My+Book");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&mode=single&fs=20&lang=fr");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.chapterMode).toBe("single");
    expect(parsed?.fontSize).toBe(20);
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
