import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  getPageSizePoints, escapePsString, wrapLine,
  generateHeader, generateFooter, generatePage, generatePostScript,
  convertPdfToPostScript, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type PsOptions, type PsFont, type PsPageSize,
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

// ===== Page sizes =====

describe("pdf-to-postscript-converter getPageSizePoints", () => {
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

// ===== escapePsString =====

describe("pdf-to-postscript-converter escapePsString", () => {
  it("escapes backslashes", () => {
    expect(escapePsString("a\\b")).toBe("a\\\\b");
  });
  it("escapes parens", () => {
    expect(escapePsString("(hello)")).toBe("\\(hello\\)");
  });
  it("does not modify plain text", () => {
    expect(escapePsString("Hello, World!")).toBe("Hello, World!");
  });
  it("returns empty for empty input", () => {
    expect(escapePsString("")).toBe("");
  });
});

// ===== wrapLine =====

describe("pdf-to-postscript-converter wrapLine", () => {
  it("returns the line unchanged if within limit", () => {
    expect(wrapLine("hello world", 80)).toEqual(["hello world"]);
  });
  it("wraps long lines at word boundaries", () => {
    const result = wrapLine("one two three four five six seven eight nine ten", 15);
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((l) => l.length <= 15 || !l.includes(" "))).toBe(true);
  });
  it("returns empty array for empty input", () => {
    expect(wrapLine("", 80)).toEqual([""]);
  });
  it("does not wrap when maxChars is 0", () => {
    const long = "a".repeat(200);
    expect(wrapLine(long, 0)).toEqual([long]);
  });
  it("puts long single words on their own line", () => {
    const result = wrapLine("short supercalifragilisticexpialidocious short", 10);
    expect(result.some((l) => l.includes("supercali"))).toBe(true);
  });
});

// ===== generateHeader =====

describe("pdf-to-postscript-converter generateHeader", () => {
  it("starts with %!PS-Adobe-3.0", () => {
    const header = generateHeader(DEFAULT_OPTIONS, 3);
    expect(header.startsWith("%!PS-Adobe-3.0")).toBe(true);
  });
  it("includes page count", () => {
    const header = generateHeader(DEFAULT_OPTIONS, 5);
    expect(header).toContain("%%Pages: 5");
  });
  it("includes title", () => {
    const header = generateHeader({ ...DEFAULT_OPTIONS, title: "My Doc" }, 1);
    expect(header).toContain("%%Title: My Doc");
  });
  it("includes creator", () => {
    const header = generateHeader(DEFAULT_OPTIONS, 1);
    expect(header).toContain("UnQTools");
  });
});

// ===== generateFooter =====

describe("pdf-to-postscript-converter generateFooter", () => {
  it("ends with %%EOF", () => {
    const footer = generateFooter();
    expect(footer).toContain("%%EOF");
  });
});

// ===== generatePage =====

describe("pdf-to-postscript-converter generatePage", () => {
  it("includes %%Page directive", () => {
    const page = generatePage(1, ["Hello"], DEFAULT_OPTIONS);
    expect(page).toContain("%%Page: 1 1");
  });
  it("includes font setup", () => {
    const page = generatePage(1, ["Hello"], DEFAULT_OPTIONS);
    expect(page).toContain("Helvetica");
    expect(page).toContain("findfont");
    expect(page).toContain("scalefont");
    expect(page).toContain("setfont");
  });
  it("includes show operator with text", () => {
    const page = generatePage(1, ["Hello, World!"], DEFAULT_OPTIONS);
    expect(page).toContain("(Hello, World!) show");
  });
  it("escapes parens in text", () => {
    const page = generatePage(1, ["(test)"], DEFAULT_OPTIONS);
    expect(page).toContain("\\(test\\)");
  });
  it("ends with showpage", () => {
    const page = generatePage(1, ["Hello"], DEFAULT_OPTIONS);
    expect(page).toContain("showpage");
  });
  it("positions text starting from top margin", () => {
    const page = generatePage(1, ["Hello"], { ...DEFAULT_OPTIONS, margin: 72, pageSize: "letter" });
    // Letter height = 792, margin = 72, top = 720
    expect(page).toContain("720 moveto");
  });
  it("uses chosen font family", () => {
    const page = generatePage(1, ["Hello"], { ...DEFAULT_OPTIONS, font: "Courier" });
    expect(page).toContain("/Courier findfont");
  });
  it("uses chosen font size", () => {
    const page = generatePage(1, ["Hello"], { ...DEFAULT_OPTIONS, fontSize: 16 });
    expect(page).toContain("16 scalefont");
  });
});

// ===== generatePostScript =====

describe("pdf-to-postscript-converter generatePostScript", () => {
  it("combines header, pages, and footer", () => {
    const ps = generatePostScript([["Hello"], ["World"]], DEFAULT_OPTIONS);
    expect(ps.startsWith("%!PS-Adobe-3.0")).toBe(true);
    expect(ps).toContain("%%Page: 1 1");
    expect(ps).toContain("%%Page: 2 2");
    expect(ps).toContain("showpage");
    expect(ps.endsWith("%%EOF\n")).toBe(true);
  });
  it("declares correct page count in header", () => {
    const ps = generatePostScript([["a"], ["b"], ["c"]], DEFAULT_OPTIONS);
    expect(ps).toContain("%%Pages: 3");
  });
});

// ===== convertPdfToPostScript =====

describe("pdf-to-postscript-converter convertPdfToPostScript", () => {
  it("converts a simple PDF to PostScript", async () => {
    const pdfBytes = await makeSimplePdf(["Hello, World!", "Second line."]);
    const result = await convertPdfToPostScript(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.source).toContain("%!PS-Adobe-3.0");
      expect(result.output.source).toContain("Hello, World!");
      expect(result.output.pageCount).toBe(1);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.psBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToPostScript(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToPostScript(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToPostScript(pdfBytes, DEFAULT_OPTIONS, "custom.ps");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.ps");
    }
  });
  it("uses Courier font when chosen", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToPostScript(pdfBytes, { ...DEFAULT_OPTIONS, font: "Courier" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.source).toContain("/Courier findfont");
    }
  });
});

// ===== formatBytes =====

describe("pdf-to-postscript-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-postscript-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, psBytes: 2000,
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
      fileName: "test.pdf", pdfBytes: 1000, psBytes: 2000,
      pageCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-postscript-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-postscript-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", font: "Courier", pageSize: "a4" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("font=Courier");
    expect(url).toContain("page=a4");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&font=Times-Roman&fs=14&page=legal&margin=80&wrap=60&lh=1.5");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.font).toBe("Times-Roman");
    expect(parsed?.fontSize).toBe(14);
    expect(parsed?.pageSize).toBe("legal");
    expect(parsed?.margin).toBe(80);
    expect(parsed?.wrapWidth).toBe(60);
    expect(parsed?.lineHeight).toBe(1.5);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to Helvetica for invalid font", () => {
    const parsed = parseShareUrl("#font=Invalid");
    expect(parsed?.font).toBe("Helvetica");
  });
});
