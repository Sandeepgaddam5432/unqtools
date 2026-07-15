import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  getSlideDimensionsCm, buildSlides, countWords, escapeXml,
  generateSlideXml, generateContentXml, generateStylesXml, generateMetaXml,
  generateManifestXml, convertPdfToOdp, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type OdpOptions, type OdpLayout, type OdpRatio,
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

// ===== Slide dimensions =====

describe("pdf-to-odp-converter getSlideDimensionsCm", () => {
  it("returns 16:9 dimensions in cm", () => {
    const d = getSlideDimensionsCm("16:9");
    expect(d.width).toBeCloseTo(33.867, 1);
    expect(d.height).toBeCloseTo(19.05, 1);
  });
  it("returns 4:3 dimensions in cm", () => {
    const d = getSlideDimensionsCm("4:3");
    expect(d.width).toBeCloseTo(25.4, 1);
    expect(d.height).toBeCloseTo(19.05, 1);
  });
  it("returns A4 portrait dimensions in cm", () => {
    const d = getSlideDimensionsCm("a4");
    expect(d.width).toBeCloseTo(21.0, 1);
    expect(d.height).toBeCloseTo(29.7, 1);
  });
});

// ===== countWords =====

describe("pdf-to-odp-converter countWords", () => {
  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
  });
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
});

// ===== escapeXml =====

describe("pdf-to-odp-converter escapeXml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
  });
  it("returns empty for empty input", () => {
    expect(escapeXml("")).toBe("");
  });
});

// ===== buildSlides =====

describe("pdf-to-odp-converter buildSlides", () => {
  it("uses first line as title in title-bullets layout", () => {
    const slides = buildSlides(["My Title\nBullet 1\nBullet 2"], DEFAULT_OPTIONS);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.title).toBe("My Title");
    expect(slides[0]!.bullets).toEqual(["Bullet 1", "Bullet 2"]);
  });
  it("uses empty title in bullets-only layout", () => {
    const slides = buildSlides(["My Title\nBullet 1"], { ...DEFAULT_OPTIONS, layout: "bullets-only" });
    expect(slides[0]!.title).toBe("");
    expect(slides[0]!.bullets).toEqual(["My Title", "Bullet 1"]);
  });
  it("skips empty pages", () => {
    const slides = buildSlides(["", "Hello"], DEFAULT_OPTIONS);
    expect(slides).toHaveLength(1);
  });
  it("computes word count per slide", () => {
    const slides = buildSlides(["title text\nbullet one"], DEFAULT_OPTIONS);
    expect(slides[0]!.wordCount).toBe(4);
  });
});

// ===== generateSlideXml =====

describe("pdf-to-odp-converter generateSlideXml", () => {
  it("generates a draw:page element", () => {
    const slide = { number: 1, title: "Title", bullets: ["B1", "B2"], wordCount: 3 };
    const xml = generateSlideXml(slide, DEFAULT_OPTIONS);
    expect(xml).toContain("<draw:page");
    expect(xml).toContain("Title");
    expect(xml).toContain("B1");
    expect(xml).toContain("B2");
  });
  it("omits title frame in bullets-only layout", () => {
    const slide = { number: 1, title: "", bullets: ["B1"], wordCount: 1 };
    const xml = generateSlideXml(slide, { ...DEFAULT_OPTIONS, layout: "bullets-only" });
    expect(xml).not.toContain("TitleFrame");
  });
});

// ===== generateContentXml =====

describe("pdf-to-odp-converter generateContentXml", () => {
  it("produces a valid ODF presentation document", () => {
    const slides = [{ number: 1, title: "T", bullets: ["B"], wordCount: 2 }];
    const xml = generateContentXml(slides, DEFAULT_OPTIONS);
    expect(xml).toContain("<office:document-content");
    expect(xml).toContain("<office:presentation>");
    expect(xml).toContain("<draw:page");
  });
  it("declares SlideStyle with the chosen background color", () => {
    const slides = [{ number: 1, title: "T", bullets: [], wordCount: 1 }];
    const xml = generateContentXml(slides, { ...DEFAULT_OPTIONS, backgroundColor: "FFEEFF" });
    expect(xml).toContain("FFEEFF");
    expect(xml).toContain('style:name="SlideStyle"');
  });
  it("declares TitlePara with the chosen title color", () => {
    const slides = [{ number: 1, title: "T", bullets: [], wordCount: 1 }];
    const xml = generateContentXml(slides, { ...DEFAULT_OPTIONS, titleColor: "ABCDEF" });
    expect(xml).toContain("#ABCDEF");
  });
  it("uses chosen body font size", () => {
    const slides = [{ number: 1, title: "T", bullets: [], wordCount: 1 }];
    const xml = generateContentXml(slides, { ...DEFAULT_OPTIONS, fontSize: 22 });
    expect(xml).toContain("22pt");
  });
});

// ===== generateStylesXml =====

describe("pdf-to-odp-converter generateStylesXml", () => {
  it("declares page-layout with slide dimensions", () => {
    const xml = generateStylesXml(DEFAULT_OPTIONS);
    expect(xml).toContain('style:name="Mpm1"');
    expect(xml).toContain("33.867cm"); // 16:9 width
  });
  it("declares master-page named Standard", () => {
    const xml = generateStylesXml(DEFAULT_OPTIONS);
    expect(xml).toContain('style:name="Standard"');
  });
});

// ===== generateMetaXml =====

describe("pdf-to-odp-converter generateMetaXml", () => {
  it("includes title and author", () => {
    const xml = generateMetaXml({ ...DEFAULT_OPTIONS, title: "Slides", author: "Alice" }, { slideCount: 5 });
    expect(xml).toContain("<dc:title>Slides</dc:title>");
    expect(xml).toContain("<dc:creator>Alice</dc:creator>");
  });
  it("includes document-statistic with page count", () => {
    const xml = generateMetaXml(DEFAULT_OPTIONS, { slideCount: 10 });
    expect(xml).toContain("meta:document-statistic");
    expect(xml).toContain('meta:page-count="10"');
  });
});

// ===== generateManifestXml =====

describe("pdf-to-odp-converter generateManifestXml", () => {
  it("declares all 4 files with ODP media type", () => {
    const xml = generateManifestXml();
    expect(xml).toContain("application/vnd.oasis.opendocument.presentation");
    expect(xml).toContain("content.xml");
    expect(xml).toContain("styles.xml");
    expect(xml).toContain("meta.xml");
  });
});

// ===== convertPdfToOdp =====

describe("pdf-to-odp-converter convertPdfToOdp", () => {
  it("converts a simple PDF to ODP", async () => {
    const pdfBytes = await makeSimplePdf(["Title", "Bullet 1", "Bullet 2"]);
    const result = await convertPdfToOdp(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.slideCount).toBeGreaterThanOrEqual(1);
      expect(result.output.odpBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToOdp(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToOdp(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.slideCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToOdp(pdfBytes, DEFAULT_OPTIONS, "custom.odp");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.odp");
    }
  });
  it("uses bullets-only layout", async () => {
    const pdfBytes = await makeSimplePdf(["Hello", "World"]);
    const result = await convertPdfToOdp(pdfBytes, { ...DEFAULT_OPTIONS, layout: "bullets-only" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.slides[0]!.title).toBe("");
    }
  });
});

// ===== formatBytes =====

describe("pdf-to-odp-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-odp-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, odpBytes: 2000,
      slideCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
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
      fileName: "test.pdf", pdfBytes: 1000, odpBytes: 2000,
      slideCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-odp-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-odp-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", layout: "bullets-only", ratio: "4:3" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("layout=bullets-only");
    expect(url).toContain("ratio=4");  // 4:3 URL-encodes the colon
    expect(url).toContain("3");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&layout=bullets-only&ratio=a4&fs=20&bg=FFFFFF&title-color=FF0000");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.layout).toBe("bullets-only");
    expect(parsed?.ratio).toBe("a4");
    expect(parsed?.fontSize).toBe(20);
    expect(parsed?.backgroundColor).toBe("FFFFFF");
    expect(parsed?.titleColor).toBe("FF0000");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to title-bullets for invalid layout", () => {
    const parsed = parseShareUrl("#layout=invalid");
    expect(parsed?.layout).toBe("title-bullets");
  });
});
