import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  getSlideDimensions, buildSlides, countWords,
  generateSlideXml, generatePresentationXml, generateContentTypesXml,
  generateRootRelsXml, generatePresentationRelsXml, generateSlideRelsXml,
  generateSlideMasterXml, generateSlideMasterRelsXml,
  generateSlideLayoutXml, generateSlideLayoutRelsXml,
  generateThemeXml, generatePresPropsXml, generateViewPropsXml,
  convertPdfToPptx, formatBytes, xmlEscape,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type PptxOptions, type SlideLayout,
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

describe("pdf-to-powerpoint-converter getSlideDimensions", () => {
  it("returns 16:9 dimensions in EMUs", () => {
    const d = getSlideDimensions("16:9");
    expect(d.width).toBe(12192000);
    expect(d.height).toBe(6858000);
  });
  it("returns 4:3 dimensions in EMUs", () => {
    const d = getSlideDimensions("4:3");
    expect(d.width).toBe(9144000);
    expect(d.height).toBe(6858000);
  });
});

// ===== countWords =====

describe("pdf-to-powerpoint-converter countWords", () => {
  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
  });
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
});

// ===== buildSlides =====

describe("pdf-to-powerpoint-converter buildSlides", () => {
  it("inserts a title slide when insertTitleSlide is true", () => {
    const slides = buildSlides(["page one content"], { ...DEFAULT_OPTIONS, insertTitleSlide: true });
    expect(slides[0]!.title).toBe(DEFAULT_OPTIONS.titleSlideTitle);
    expect(slides.length).toBe(2);
  });
  it("does not insert title slide when insertTitleSlide is false", () => {
    const slides = buildSlides(["page one content"], { ...DEFAULT_OPTIONS, insertTitleSlide: false });
    expect(slides.length).toBe(1);
  });
  it("uses first line as title in title-content layout", () => {
    const slides = buildSlides(["First Line\nSecond Line\nThird Line"], {
      ...DEFAULT_OPTIONS, layout: "title-content", insertTitleSlide: false,
    });
    expect(slides[0]!.title).toBe("First Line");
    expect(slides[0]!.bullets).toEqual(["Second Line", "Third Line"]);
  });
  it("uses empty title in content-only layout", () => {
    const slides = buildSlides(["First Line\nSecond Line"], {
      ...DEFAULT_OPTIONS, layout: "content-only", insertTitleSlide: false,
    });
    expect(slides[0]!.title).toBe("");
    expect(slides[0]!.bullets).toEqual(["First Line", "Second Line"]);
  });
  it("skips empty pages", () => {
    const slides = buildSlides(["", "Hello"], { ...DEFAULT_OPTIONS, insertTitleSlide: false });
    expect(slides.length).toBe(1);
  });
  it("computes word count per slide", () => {
    const slides = buildSlides(["title text here\nbullet one"], {
      ...DEFAULT_OPTIONS, insertTitleSlide: false, layout: "title-content",
    });
    expect(slides[0]!.wordCount).toBe(5);
  });
});

// ===== Slide XML generation =====

describe("pdf-to-powerpoint-converter generateSlideXml", () => {
  it("generates a valid slide XML", () => {
    const slide = { number: 1, title: "My Title", bullets: ["Bullet 1", "Bullet 2"], wordCount: 5 };
    const xml = generateSlideXml(slide, DEFAULT_OPTIONS, false);
    expect(xml).toContain("<p:sld");
    expect(xml).toContain("My Title");
    expect(xml).toContain("Bullet 1");
    expect(xml).toContain("Bullet 2");
  });
  it("includes accent color in title", () => {
    const slide = { number: 1, title: "T", bullets: [], wordCount: 1 };
    const xml = generateSlideXml(slide, { ...DEFAULT_OPTIONS, accentColor: "FF0000" }, false);
    expect(xml).toContain("FFFF0000");
  });
  it("title slide layout differs from content slide", () => {
    const slide = { number: 1, title: "T", bullets: ["sub"], wordCount: 2 };
    const titleXml = generateSlideXml(slide, DEFAULT_OPTIONS, true);
    const contentXml = generateSlideXml(slide, DEFAULT_OPTIONS, false);
    expect(titleXml).not.toEqual(contentXml);
    expect(titleXml).toContain('algn="ctr"');
  });
});

describe("pdf-to-powerpoint-converter generatePresentationXml", () => {
  it("includes sldId entries per slide", () => {
    const xml = generatePresentationXml(3, DEFAULT_OPTIONS);
    expect(xml).toContain("<p:sldId ");
    expect(xml).toContain('r:id="rId2"');
    expect(xml).toContain('r:id="rId4"');
    expect(xml).toContain('cx="12192000"');
  });
  it("uses 4:3 dimensions when chosen", () => {
    const xml = generatePresentationXml(1, { ...DEFAULT_OPTIONS, aspectRatio: "4:3" });
    expect(xml).toContain('cx="9144000"');
  });
});

describe("pdf-to-powerpoint-converter generateContentTypesXml", () => {
  it("includes slide overrides", () => {
    const xml = generateContentTypesXml(2);
    expect(xml).toContain("slides/slide1.xml");
    expect(xml).toContain("slides/slide2.xml");
    expect(xml).toContain("presentationml.slide+xml");
  });
});

describe("pdf-to-powerpoint-converter generateRootRelsXml", () => {
  it("declares officeDocument relationship", () => {
    const xml = generateRootRelsXml();
    expect(xml).toContain("officeDocument");
    expect(xml).toContain("ppt/presentation.xml");
  });
});

describe("pdf-to-powerpoint-converter generatePresentationRelsXml", () => {
  it("declares slide relationships", () => {
    const xml = generatePresentationRelsXml(2);
    expect(xml).toContain('rId2"');
    expect(xml).toContain('rId3"');
    expect(xml).toContain("slides/slide1.xml");
    expect(xml).toContain("slides/slide2.xml");
  });
});

describe("pdf-to-powerpoint-converter generateSlideRelsXml", () => {
  it("declares slideLayout relationship", () => {
    const xml = generateSlideRelsXml();
    expect(xml).toContain("slideLayout");
    expect(xml).toContain("slideLayout1.xml");
  });
});

describe("pdf-to-powerpoint-converter generateSlideMasterXml", () => {
  it("contains clrMap and sldLayoutIdLst", () => {
    const xml = generateSlideMasterXml();
    expect(xml).toContain("<p:clrMap");
    expect(xml).toContain("<p:sldLayoutIdLst>");
  });
});

describe("pdf-to-powerpoint-converter generateSlideMasterRelsXml", () => {
  it("declares slideLayout and theme relationships", () => {
    const xml = generateSlideMasterRelsXml();
    expect(xml).toContain("slideLayout");
    expect(xml).toContain("theme");
  });
});

describe("pdf-to-powerpoint-converter generateSlideLayoutXml", () => {
  it("contains a name attribute", () => {
    const xml = generateSlideLayoutXml();
    expect(xml).toContain('name="Title Slide"');
    expect(xml).toContain("<p:sldLayout");
  });
});

describe("pdf-to-powerpoint-converter generateSlideLayoutRelsXml", () => {
  it("declares slideMaster relationship", () => {
    const xml = generateSlideLayoutRelsXml();
    expect(xml).toContain("slideMaster");
  });
});

describe("pdf-to-powerpoint-converter generateThemeXml", () => {
  it("includes the custom accent color", () => {
    const xml = generateThemeXml({ ...DEFAULT_OPTIONS, accentColor: "FF00FF" });
    expect(xml).toContain("FF00FF");
  });
  it("has a clrScheme and fontScheme", () => {
    const xml = generateThemeXml(DEFAULT_OPTIONS);
    expect(xml).toContain("<a:clrScheme");
    expect(xml).toContain("<a:fontScheme");
  });
});

describe("pdf-to-powerpoint-converter generatePresPropsXml", () => {
  it("returns valid presentationPr XML", () => {
    const xml = generatePresPropsXml();
    expect(xml).toContain("<p:presentationPr");
  });
});

describe("pdf-to-powerpoint-converter generateViewPropsXml", () => {
  it("returns valid viewPr XML", () => {
    const xml = generateViewPropsXml();
    expect(xml).toContain("<p:viewPr");
  });
});

// ===== convertPdfToPptx =====

describe("pdf-to-powerpoint-converter convertPdfToPptx", () => {
  it("converts a simple PDF to PPTX", async () => {
    const pdfBytes = await makeSimplePdf(["Title", "Bullet one", "Bullet two"]);
    const result = await convertPdfToPptx(pdfBytes, DEFAULT_OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.blob.size).toBeGreaterThan(0);
      expect(result.output.slideCount).toBeGreaterThanOrEqual(1);
      expect(result.output.pptxBytes).toBeGreaterThan(0);
    }
  });
  it("returns error for invalid PDF", async () => {
    const result = await convertPdfToPptx(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"], 3);
    const result = await convertPdfToPptx(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1", insertTitleSlide: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.slideCount).toBe(1);
    }
  });
  it("sets output filename", async () => {
    const pdfBytes = await makeSimplePdf(["Hello"]);
    const result = await convertPdfToPptx(pdfBytes, DEFAULT_OPTIONS, "custom.pptx");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.fileName).toBe("custom.pptx");
    }
  });
  it("uses content-only layout", async () => {
    const pdfBytes = await makeSimplePdf(["Hello", "World"]);
    const result = await convertPdfToPptx(pdfBytes, { ...DEFAULT_OPTIONS, layout: "content-only", insertTitleSlide: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.slides[0]!.title).toBe("");
    }
  });
});

// ===== xmlEscape =====

describe("pdf-to-powerpoint-converter xmlEscape", () => {
  it("escapes & < > \" '", () => {
    expect(xmlEscape(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
  });
});

// ===== formatBytes =====

describe("pdf-to-powerpoint-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-powerpoint-converter history", () => {
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
      fileName: "test.pdf", pdfBytes: 1000, pptxBytes: 2000,
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
      fileName: "test.pdf", pdfBytes: 1000, pptxBytes: 2000,
      slideCount: 5, wordCount: 200, convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-powerpoint-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-powerpoint-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", layout: "content-only", accentColor: "FF0000" });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("layout=content-only");
    expect(url).toContain("accent=FF0000");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&layout=content-only&fs=24&ratio=4:3&accent=ABCDEF");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.layout).toBe("content-only");
    expect(parsed?.fontSize).toBe(24);
    expect(parsed?.aspectRatio).toBe("4:3");
    expect(parsed?.accentColor).toBe("ABCDEF");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to title-content for invalid layout", () => {
    const parsed = parseShareUrl("#layout=invalid");
    expect(parsed?.layout).toBe("title-content");
  });
});
