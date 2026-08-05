import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  getPageSizePoints,
  isPostscriptMagic,
  extractDscComment, extractBoundingBox,
  escapePsString, parsePsString, tokenizePsLine,
  parsePostscript, wrapLine,
  convertPsToPdf,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type PsFont, type PsPageSize,
} from "./logic";

// ===== getPageSizePoints =====

describe("postscript-to-pdf getPageSizePoints", () => {
  it("returns A4 dimensions", () => {
    const p = getPageSizePoints("a4");
    expect(p.width).toBeCloseTo(595.276, 1);
    expect(p.height).toBeCloseTo(841.89, 1);
  });
  it("returns Letter dimensions", () => {
    const p = getPageSizePoints("letter");
    expect(p.width).toBe(612);
    expect(p.height).toBe(792);
  });
  it("returns Legal dimensions", () => {
    const p = getPageSizePoints("legal");
    expect(p.width).toBe(612);
    expect(p.height).toBe(1008);
  });
});

// ===== isPostscriptMagic =====

describe("postscript-to-pdf isPostscriptMagic", () => {
  it("returns true for %!PS header", () => {
    expect(isPostscriptMagic("%!PS-Adobe-3.0\n")).toBe(true);
  });
  it("returns true with leading whitespace", () => {
    expect(isPostscriptMagic("  %!PS-Adobe-3.0\n")).toBe(true);
  });
  it("returns false for non-PS content", () => {
    expect(isPostscriptMagic("hello world")).toBe(false);
  });
  it("returns false for empty", () => {
    expect(isPostscriptMagic("")).toBe(false);
  });
});

// ===== extractDscComment =====

describe("postscript-to-pdf extractDscComment", () => {
  it("extracts %%Title:", () => {
    expect(extractDscComment("%%Title: My Document\n", "Title")).toBe("My Document");
  });
  it("extracts %%Creator:", () => {
    expect(extractDscComment("%%Creator: ghostscript\n", "Creator")).toBe("ghostscript");
  });
  it("returns null when not found", () => {
    expect(extractDscComment("hello world", "Title")).toBeNull();
  });
});

// ===== extractBoundingBox =====

describe("postscript-to-pdf extractBoundingBox", () => {
  it("extracts 4 values", () => {
    expect(extractBoundingBox("%%BoundingBox: 0 0 612 792\n")).toEqual([0, 0, 612, 792]);
  });
  it("returns null when missing", () => {
    expect(extractBoundingBox("no bbox here")).toBeNull();
  });
  it("handles negative values", () => {
    expect(extractBoundingBox("%%BoundingBox: -10 -20 100 200\n")).toEqual([-10, -20, 100, 200]);
  });
});

// ===== escapePsString / parsePsString =====

describe("postscript-to-pdf escapePsString/parsePsString", () => {
  it("wraps in parens", () => {
    expect(escapePsString("hello")).toBe("(hello)");
  });
  it("escapes parens", () => {
    expect(escapePsString("a(b)c")).toBe("(a\\(b\\)c)");
  });
  it("escapes backslash", () => {
    expect(escapePsString("a\\b")).toBe("(a\\\\b)");
  });
  it("roundtrips through parsePsString", () => {
    const text = "hello (world) \\ test";
    const escaped = escapePsString(text);
    const parsed = parsePsString(escaped);
    expect(parsed).toBe(text);
  });
  it("parsePsString returns null for non-string", () => {
    expect(parsePsString("hello")).toBeNull();
  });
  it("parsePsString returns null for empty token", () => {
    expect(parsePsString("")).toBeNull();
  });
});

// ===== tokenizePsLine =====

describe("postscript-to-pdf tokenizePsLine", () => {
  it("tokenizes simple operators", () => {
    expect(tokenizePsLine("100 200 moveto")).toEqual(["100", "200", "moveto"]);
  });
  it("preserves string literals", () => {
    expect(tokenizePsLine("(hello world) show")).toEqual(["(hello world)", "show"]);
  });
  it("handles nested parens", () => {
    expect(tokenizePsLine("(hello (nested) world) show")).toEqual(["(hello (nested) world)", "show"]);
  });
  it("skips comment lines", () => {
    expect(tokenizePsLine("% this is a comment")).toEqual([]);
  });
  it("handles empty lines", () => {
    expect(tokenizePsLine("")).toEqual([]);
  });
  it("handles escaped parens in strings", () => {
    expect(tokenizePsLine("(hello\\) world) show")).toEqual(["(hello\\) world)", "show"]);
  });
});

// ===== parsePostscript =====

describe("postscript-to-pdf parsePostscript", () => {
  it("parses a simple PS with one show", () => {
    const ps = "%!PS-Adobe-3.0\n(hello world) show\nshowpage\n";
    const result = parsePostscript(ps);
    expect(result.hasPsHeader).toBe(true);
    expect(result.pageCount).toBe(1);
    expect(result.pages[0]!.textLines).toEqual(["hello world"]);
  });
  it("detects multiple pages via showpage", () => {
    const ps = "%!PS\n(page 1) show\nshowpage\n(page 2) show\nshowpage\n";
    const result = parsePostscript(ps);
    expect(result.pageCount).toBe(2);
    expect(result.pages[0]!.textLines).toEqual(["page 1"]);
    expect(result.pages[1]!.textLines).toEqual(["page 2"]);
  });
  it("detects DSC %%Page: comments", () => {
    const ps = "%!PS\n%%Page: one 1\n(content 1) show\n%%Page: two 2\n(content 2) show\n";
    const result = parsePostscript(ps);
    expect(result.pageCount).toBe(2);
    expect(result.pages[0]!.label).toBe("one");
    expect(result.pages[1]!.label).toBe("two");
  });
  it("counts words correctly", () => {
    const ps = "(hello world foo bar) show\nshowpage\n";
    const result = parsePostscript(ps);
    expect(result.wordCount).toBe(4);
  });
  it("counts characters correctly", () => {
    const ps = "(hello) show\nshowpage\n";
    const result = parsePostscript(ps);
    expect(result.charCount).toBe(5);
  });
  it("extracts %%Title:", () => {
    const ps = "%!PS\n%%Title: My Document\n(content) show\nshowpage\n";
    const result = parsePostscript(ps);
    expect(result.title).toBe("My Document");
  });
  it("extracts %%BoundingBox (EPS)", () => {
    const ps = "%!PS\n%%BoundingBox: 0 0 100 200\n(content) show\nshowpage\n";
    const result = parsePostscript(ps);
    expect(result.boundingBox).toEqual([0, 0, 100, 200]);
  });
  it("has hasPsHeader=true for %!PS files", () => {
    expect(parsePostscript("%!PS-Adobe-3.0\n").hasPsHeader).toBe(true);
  });
  it("has hasPsHeader=false for non-PS files", () => {
    expect(parsePostscript("hello world").hasPsHeader).toBe(false);
  });
  it("creates at least one page for empty PS", () => {
    const result = parsePostscript("%!PS\n");
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });
  it("creates at least one page for PS without showpage", () => {
    const result = parsePostscript("%!PS\n(text) show\n");
    expect(result.pageCount).toBe(1);
  });
});

// ===== wrapLine =====

describe("postscript-to-pdf wrapLine", () => {
  it("returns single line when short enough", () => {
    expect(wrapLine("hello", 80)).toEqual(["hello"]);
  });
  it("wraps long line at word boundaries", () => {
    const wrapped = wrapLine("the quick brown fox jumps over the lazy dog", 15);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) {
      expect(line.length).toBeLessThanOrEqual(15);
    }
  });
  it("returns empty array for empty input", () => {
    expect(wrapLine("", 80)).toEqual([""]);
  });
});

// ===== convertPsToPdf =====

describe("postscript-to-pdf convertPsToPdf", () => {
  it("produces non-empty PDF", async () => {
    const ps = "%!PS-Adobe-3.0\n(hello world) show\nshowpage\n";
    const result = await convertPsToPdf(ps, DEFAULT_OPTIONS, "out.pdf");
    expect(result.pdfBytes.length).toBeGreaterThan(0);
    expect(result.pdfSize).toBeGreaterThan(0);
  });
  it("PDF starts with %PDF magic", async () => {
    const ps = "%!PS\n(test) show\nshowpage\n";
    const result = await convertPsToPdf(ps);
    const magic = new TextDecoder().decode(result.pdfBytes.subarray(0, 4));
    expect(magic).toBe("%PDF");
  });
  it("preserves page count from PS", async () => {
    const ps = "%!PS\n(p1) show\nshowpage\n(p2) show\nshowpage\n(p3) show\nshowpage\n";
    const result = await convertPsToPdf(ps);
    expect(result.parse.pageCount).toBe(3);
  });
  it("uses configured font", async () => {
    const ps = "%!PS\n(test) show\nshowpage\n";
    const result = await convertPsToPdf(ps, { ...DEFAULT_OPTIONS, font: "Courier" });
    expect(result.options.font).toBe("Courier");
  });
  it("uses configured page size", async () => {
    const ps = "%!PS\n(test) show\nshowpage\n";
    const result = await convertPsToPdf(ps, { ...DEFAULT_OPTIONS, pageSize: "a4" });
    expect(result.options.pageSize).toBe("a4");
  });
  it("handles empty PS source", async () => {
    const result = await convertPsToPdf("%!PS\n");
    expect(result.pdfBytes.length).toBeGreaterThan(0);
  });
  it("sets PDF title from options", async () => {
    const ps = "%!PS\n(test) show\nshowpage\n";
    const result = await convertPsToPdf(ps, { ...DEFAULT_OPTIONS, title: "Custom Title" });
    expect(result.options.title).toBe("Custom Title");
  });
});

// ===== formatBytes =====

describe("postscript-to-pdf formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History (localStorage) =====

describe("postscript-to-pdf history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "doc.ps", pageCount: 5, wordCount: 1000, pdfSize: 50000,
      convertedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.ps`, pageCount: 1, wordCount: 10, pdfSize: 1000,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.ps", pageCount: 1, wordCount: 10, pdfSize: 1000,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("postscript-to-pdf share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/postscript-to-pdf-converter",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({ font: "Courier", fontSize: 14, pageSize: "a4", margin: 30 });
    expect(url).toContain("font=Courier");
    expect(url).toContain("size=14");
    expect(url).toContain("page=a4");
    expect(url).toContain("margin=30");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ font: "Times-Roman", fontSize: 10, pageSize: "legal", margin: 72 });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.font).toBe("Times-Roman");
    expect(parsed?.fontSize).toBe(10);
    expect(parsed?.pageSize).toBe("legal");
    expect(parsed?.margin).toBe(72);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("clamps font size to valid range", () => {
    expect(parseShareUrl("#font=Helvetica&size=99")?.fontSize).toBe(24);
    expect(parseShareUrl("#font=Helvetica&size=1")?.fontSize).toBe(8);
  });
  it("defaults to Helvetica for unknown font", () => {
    expect(parseShareUrl("#font=invalid")?.font).toBe("Helvetica");
  });
});
