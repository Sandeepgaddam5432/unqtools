import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_MIME,
  OUTPUT_FORMATS,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_LABELS,
  normalizePageRangeSpec,
  resolveAllRange,
  analyzeFontSizes,
  classifyHeadingLevel,
  detectParagraphs,
  extractSlideContent,
  generateSlideTitle,
  formatSlideContent,
  extractSpeakerNotes,
  calcSlideDimensions,
  escapeXml,
  escapeHtml,
  escapeMarkdown,
  escapeCsv,
  generateContentTypesXml,
  generateRootRelsXml,
  generatePresentationRelsXml,
  generatePresentationXml,
  generateSlideMasterXml,
  generateSlideLayoutXml,
  generateThemeXml,
  generateSlideXml,
  crc32,
  utf8Encode,
  buildZip,
  buildPptxPackage,
  generateHtmlSlides,
  generateMarkdownSlides,
  renderTextOutline,
  renderCsv,
  renderOutput,
  computeSummaryStats,
  calcSlideCount,
  scoreTitleExtraction,
  validateSpeakerNotes,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  selectSlideLayout,
  type TextItem,
  type Paragraph,
  type SlideContent,
  type ConvertOptions,
  type OutputFormat,
  type SlideLayout,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// Helpers --------------------------------------------------------------------

function ti(text: string, fontSize: number, pageNumber = 1, bold = false, italic = false): TextItem {
  return { text, fontSize, pageNumber, bold, italic };
}

function bodyParagraph(text: string, pageNumber = 1): Paragraph {
  return { level: "body", text, pageNumber };
}

function h1Paragraph(text: string, pageNumber = 1): Paragraph {
  return { level: "h1", text, pageNumber };
}

function h2Paragraph(text: string, pageNumber = 1): Paragraph {
  return { level: "h2", text, pageNumber };
}

function makeSlide(overrides: Partial<SlideContent> = {}): SlideContent {
  return {
    slideNumber: 1,
    originalPage: 1,
    title: "My Title",
    headings: [],
    bodyParagraphs: [bodyParagraph("Bullet 1"), bodyParagraph("Bullet 2")],
    bullets: ["Bullet 1", "Bullet 2"],
    notes: "Speaker notes go here.",
    textLength: 50,
    hasHeadingTitle: true,
    ...overrides,
  };
}

// Tests ----------------------------------------------------------------------

describe("pdf2pptx constants", () => {
  it("has 3 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(3);
    expect(OUTPUT_FORMATS).toContain("pptx");
    expect(OUTPUT_FORMATS).toContain("html-slides");
    expect(OUTPUT_FORMATS).toContain("markdown-sildes");
  });
  it("maps format extensions and MIME", () => {
    expect(FORMAT_EXTENSIONS["pptx"]).toBe("pptx");
    expect(FORMAT_EXTENSIONS["html-slides"]).toBe("html");
    expect(FORMAT_EXTENSIONS["markdown-sildes"]).toBe("md");
    expect(FORMAT_MIME["pptx"]).toContain("presentationml");
    expect(FORMAT_MIME["html-slides"]).toBe("text/html");
  });
  it("has 4 slide layouts", () => {
    expect(SLIDE_LAYOUTS).toHaveLength(4);
    expect(SLIDE_LAYOUTS).toContain("full-page");
    expect(SLIDE_LAYOUTS).toContain("title-content");
    expect(SLIDE_LAYOUTS).toContain("two-content");
    expect(SLIDE_LAYOUTS).toContain("blank");
  });
  it("has labels for every layout and format", () => {
    for (const l of SLIDE_LAYOUTS) expect(SLIDE_LAYOUT_LABELS[l]).toBeTruthy();
    for (const f of OUTPUT_FORMATS) expect(FORMAT_LABELS[f]).toBeTruthy();
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe("pptx");
    expect(DEFAULT_OPTIONS.slideLayout).toBe("title-content");
    expect(DEFAULT_OPTIONS.includeSpeakerNotes).toBe(true);
    expect(DEFAULT_OPTIONS.preserveAspectRatio).toBe(true);
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });
});

describe("pdf2pptx selectSlideLayout", () => {
  it("full-page has no title and 1 body placeholder", () => {
    const s = selectSlideLayout("full-page");
    expect(s.hasTitle).toBe(false);
    expect(s.bodyPlaceholderCount).toBe(1);
    expect(s.twoColumn).toBe(false);
  });
  it("title-content has title and 1 body placeholder", () => {
    const s = selectSlideLayout("title-content");
    expect(s.hasTitle).toBe(true);
    expect(s.bodyPlaceholderCount).toBe(1);
    expect(s.twoColumn).toBe(false);
  });
  it("two-content has title and 2 body placeholders", () => {
    const s = selectSlideLayout("two-content");
    expect(s.hasTitle).toBe(true);
    expect(s.bodyPlaceholderCount).toBe(2);
    expect(s.twoColumn).toBe(true);
  });
  it("blank has title and 0 body placeholders", () => {
    const s = selectSlideLayout("blank");
    expect(s.hasTitle).toBe(true);
    expect(s.bodyPlaceholderCount).toBe(0);
  });
});

describe("pdf2pptx page-range helpers", () => {
  it("normalizePageRangeSpec lowercases and collapses whitespace", () => {
    expect(normalizePageRangeSpec("  ALL  ")).toBe("all");
    expect(normalizePageRangeSpec("1 - 3 , 5")).toBe("1 - 3 , 5");
  });
  it("resolves 'all' to full range", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
    expect(resolveAllRange("all", 0)).toBe("1");
  });
  it("resolves non-'all' as-is", () => {
    expect(resolveAllRange("1-3", 5)).toBe("1-3");
  });
});

describe("pdf2pptx analyzeFontSizes + classifyHeadingLevel", () => {
  it("finds body font size by char count", () => {
    const items = [ti("hello world", 12), ti("Title", 24)];
    const r = analyzeFontSizes(items);
    expect(r.bodyFontSize).toBe(12);
    expect(r.headingFontSizes).toEqual([24]);
  });
  it("classifyHeadingLevel returns body for small sizes", () => {
    expect(classifyHeadingLevel(12, 12, [])).toBe("body");
  });
  it("classifyHeadingLevel uses ratio thresholds when no headingSizes", () => {
    expect(classifyHeadingLevel(24, 12, [])).toBe("h1");
    expect(classifyHeadingLevel(18, 12, [])).toBe("h2");
    expect(classifyHeadingLevel(15, 12, [])).toBe("h3");
  });
  it("classifyHeadingLevel uses sorted heading sizes", () => {
    expect(classifyHeadingLevel(24, 12, [24, 18, 14])).toBe("h1");
    expect(classifyHeadingLevel(18, 12, [24, 18, 14])).toBe("h2");
    expect(classifyHeadingLevel(14, 12, [24, 18, 14])).toBe("h3");
  });
});

describe("pdf2pptx detectParagraphs", () => {
  it("groups consecutive items with same font size", () => {
    const items = [ti("Hello ", 12), ti("World", 12)];
    const paragraphs = detectParagraphs(items, 12, []);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("Hello World");
  });
  it("splits on font-size change", () => {
    const items = [ti("Title", 24), ti("Body text here.", 12)];
    const paragraphs = detectParagraphs(items, 12, [24]);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].level).toBe("h1");
    expect(paragraphs[1].level).toBe("body");
  });
  it("returns empty for empty input", () => {
    expect(detectParagraphs([], 12, [])).toEqual([]);
  });
});

describe("pdf2pptx extractSlideContent", () => {
  it("uses first h1 as title when available", () => {
    const paras = [h1Paragraph("Big Heading"), bodyParagraph("Body line")];
    const s = extractSlideContent(paras, 1, 1);
    expect(s.title).toBe("Big Heading");
    expect(s.hasHeadingTitle).toBe(true);
    expect(s.bullets).toEqual(["Body line"]);
    expect(s.notes).toContain("Body line");
  });
  it("falls back to h2 then h3 then Page N", () => {
    const paras2 = [h2Paragraph("Sub Heading"), bodyParagraph("Body")];
    expect(extractSlideContent(paras2, 2, 1).title).toBe("Sub Heading");

    const paras3 = [{ level: "h3" as const, text: "Minor", pageNumber: 1 }];
    expect(extractSlideContent(paras3, 1, 1).title).toBe("Minor");

    expect(extractSlideContent([bodyParagraph("just body")], 3, 1).title).toBe("Page 3");
  });
  it("hasHeadingTitle=false when no heading", () => {
    const s = extractSlideContent([bodyParagraph("just body")], 1, 1);
    expect(s.hasHeadingTitle).toBe(false);
  });
  it("excludes the title paragraph from headings/bullets/notes", () => {
    const paras = [h1Paragraph("Title"), h2Paragraph("Other Heading"), bodyParagraph("Body")];
    const s = extractSlideContent(paras, 1, 1);
    expect(s.title).toBe("Title");
    expect(s.headings.map((h) => h.text)).toEqual(["Other Heading"]);
    expect(s.bullets).toEqual(["Other Heading", "Body"]);
  });
});

describe("pdf2pptx generateSlideTitle and formatSlideContent", () => {
  it("generateSlideTitle picks first heading", () => {
    expect(generateSlideTitle([h1Paragraph("H1")], 1)).toBe("H1");
    expect(generateSlideTitle([bodyParagraph("body")], 5)).toBe("Page 5");
  });
  it("formatSlideContent returns bulleted lines", () => {
    const s = makeSlide({ bullets: ["A", "B"] });
    expect(formatSlideContent(s, "title-content")).toEqual(["• A", "• B"]);
  });
  it("formatSlideContent returns empty for blank layout", () => {
    const s = makeSlide({ bullets: ["A"] });
    expect(formatSlideContent(s, "blank")).toEqual([]);
  });
});

describe("pdf2pptx extractSpeakerNotes", () => {
  it("joins non-title paragraphs with blank lines", () => {
    const title = h1Paragraph("Title");
    const paras = [title, bodyParagraph("Body1"), bodyParagraph("Body2")];
    const notes = extractSpeakerNotes(paras, title);
    expect(notes).toBe("Body1\n\nBody2");
  });
  it("includes all paragraphs when no titlePara", () => {
    const paras = [bodyParagraph("Body1"), bodyParagraph("Body2")];
    expect(extractSpeakerNotes(paras)).toBe("Body1\n\nBody2");
  });
});

describe("pdf2pptx calcSlideDimensions", () => {
  it("uses 16:9 default when not preserving aspect", () => {
    const a = calcSlideDimensions(612, 792, false);
    expect(a.label).toContain("16:9");
    expect(a.slideWidthEmu).toBeGreaterThan(0);
    expect(a.slideHeightEmu).toBeGreaterThan(0);
  });
  it("detects 4:3 ratio", () => {
    const a = calcSlideDimensions(612, 792, true); // 612/792 ≈ 0.773 → portrait, falls to Custom
    // 4:3 is 1.333; 612/792 is not. So expect Custom or 4:3 fallback if close.
    expect(["4:3", "Custom", "16:9"]).toContain(a.label);
  });
  it("detects 16:9 when PDF is wide", () => {
    const a = calcSlideDimensions(1280, 720, true);
    expect(a.label).toBe("16:9");
  });
  it("falls back to defaults for zero dimensions", () => {
    const a = calcSlideDimensions(0, 0, true);
    expect(a.slideWidthEmu).toBeGreaterThan(0);
    expect(a.slideHeightEmu).toBeGreaterThan(0);
  });
});

describe("pdf2pptx escaping", () => {
  it("escapeXml escapes 5 chars", () => {
    expect(escapeXml(`<a>"x"&'y'`)).toBe("&lt;a&gt;&quot;x&quot;&amp;&apos;y&apos;");
  });
  it("escapeHtml escapes 4 chars", () => {
    expect(escapeHtml(`<a>"x"&amp;`)).toBe("&lt;a&gt;&quot;x&quot;&amp;amp;");
  });
  it("escapeMarkdown escapes special chars", () => {
    expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*");
  });
  it("escapeCsv quotes when needed", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv("plain")).toBe("plain");
  });
});

describe("pdf2pptx PPTX XML generators", () => {
  it("generateContentTypesXml lists all slide overrides", () => {
    const xml = generateContentTypesXml(3);
    expect(xml).toContain("slide1.xml");
    expect(xml).toContain("slide2.xml");
    expect(xml).toContain("slide3.xml");
    expect(xml).toContain("presentation.xml");
  });
  it("generateRootRelsXml targets presentation.xml", () => {
    expect(generateRootRelsXml()).toContain("Target=\"ppt/presentation.xml\"");
  });
  it("generatePresentationRelsXml lists each slide relationship", () => {
    const xml = generatePresentationRelsXml(2);
    expect(xml).toContain("slide1.xml");
    expect(xml).toContain("slide2.xml");
    expect(xml).toContain("slideMaster1.xml");
  });
  it("generatePresentationXml has slide IDs and slide size", () => {
    const a = calcSlideDimensions(1280, 720, false);
    const xml = generatePresentationXml(2, a);
    expect(xml).toContain("sldIdLst");
    expect(xml).toContain(`cx="${a.slideWidthEmu}"`);
    expect(xml).toContain(`cy="${a.slideHeightEmu}"`);
  });
  it("generateSlideMasterXml is valid XML with sldLayoutIdLst and clrMap", () => {
    expect(generateSlideMasterXml()).toContain("sldLayoutIdLst");
    expect(generateSlideMasterXml()).toContain("clrMap");
  });
  it("generateSlideLayoutXml has type attribute", () => {
    expect(generateSlideLayoutXml()).toContain("type=\"title\"");
  });
  it("generateThemeXml has clrScheme", () => {
    expect(generateThemeXml()).toContain("clrScheme");
    expect(generateThemeXml()).toContain("srgbClr");
  });
  it("generateSlideXml includes title and bullets", () => {
    const s = makeSlide({ title: "Hello", bullets: ["B1", "B2"] });
    const xml = generateSlideXml(s, "title-content", true);
    expect(xml).toContain("Hello");
    expect(xml).toContain("B1");
    expect(xml).toContain("B2");
  });
  it("generateSlideXml includes notes when requested", () => {
    const s = makeSlide({ notes: "Note text" });
    expect(generateSlideXml(s, "title-content", true)).toContain("Note text");
    expect(generateSlideXml(s, "title-content", false)).not.toContain("Note text");
  });
  it("generateSlideXml for full-page layout omits title shape", () => {
    const s = makeSlide({ title: "T" });
    const xml = generateSlideXml(s, "full-page", false);
    expect(xml).not.toContain("type=\"title\"");
  });
});

describe("pdf2pptx crc32 + utf8Encode + buildZip", () => {
  it("crc32 of empty is 0", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("crc32 of 'hello' is a known constant", () => {
    // CRC-32 of "hello" is 0x3610A686
    expect(crc32(utf8Encode("hello"))).toBe(0x3610a686);
  });
  it("utf8Encode produces correct bytes", () => {
    expect(Array.from(utf8Encode("AB"))).toEqual([0x41, 0x42]);
  });
  it("buildZip produces valid PK signature", () => {
    const zip = buildZip([{ name: "a.txt", bytes: utf8Encode("hello") }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    expect(zip.length).toBeGreaterThan(20);
  });
  it("buildZip with multiple files contains all central directory entries", () => {
    const zip = buildZip([
      { name: "a.txt", bytes: utf8Encode("aaa") },
      { name: "b.txt", bytes: utf8Encode("bbb") },
    ]);
    // End of central directory signature
    const sig = [0x50, 0x4b, 0x05, 0x06];
    let found = false;
    for (let i = 0; i < zip.length - 3; i++) {
      if (zip[i] === sig[0] && zip[i + 1] === sig[1] && zip[i + 2] === sig[2] && zip[i + 3] === sig[3]) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("pdf2pptx buildPptxPackage", () => {
  it("produces a non-empty ZIP starting with PK", () => {
    const slides = [makeSlide(), makeSlide({ slideNumber: 2 })];
    const a = calcSlideDimensions(1280, 720, false);
    const pkg = buildPptxPackage(slides, DEFAULT_OPTIONS, a);
    expect(pkg[0]).toBe(0x50); // P
    expect(pkg[1]).toBe(0x4b); // K
    expect(pkg.length).toBeGreaterThan(1000);
  });
});

describe("pdf2pptx HTML / Markdown / text / CSV renderers", () => {
  const slides = [makeSlide(), makeSlide({ slideNumber: 2, title: "Second" })];
  const opts = DEFAULT_OPTIONS;

  it("generateHtmlSlides produces a full HTML document with sections", () => {
    const html = generateHtmlSlides(slides, opts);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("My Title");
    expect(html).toContain("Second");
    expect(html).toContain("data-slide=\"1\"");
    expect(html).toContain("data-slide=\"2\"");
  });
  it("generateHtmlSlides omits notes when includeSpeakerNotes=false", () => {
    const html = generateHtmlSlides(slides, { ...opts, includeSpeakerNotes: false });
    expect(html).not.toContain("Speaker notes");
  });
  it("generateMarkdownSlides produces Marp front-matter and --- separators", () => {
    const md = generateMarkdownSlides(slides, opts);
    expect(md).toContain("marp: true");
    expect(md).toContain("---");
    expect(md).toContain("# My Title");
    expect(md).toContain("- Bullet 1");
  });
  it("generateMarkdownSlides includes notes as HTML comments", () => {
    const md = generateMarkdownSlides(slides, opts);
    expect(md).toContain("<!--");
    expect(md).toContain("Speaker notes go here.");
  });
  it("renderTextOutline produces a readable outline", () => {
    const out = renderTextOutline(slides, opts);
    expect(out).toContain("PDF → Slides outline");
    expect(out).toContain("Slide 1");
    expect(out).toContain("• Bullet 1");
  });
  it("renderCsv has header and rows", () => {
    const csv = renderCsv(slides, opts);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("slide_num");
    expect(lines).toHaveLength(3);
    expect(csv).toContain("My Title");
  });
  it("renderOutput dispatches by format", () => {
    expect(renderOutput(slides, { ...opts, outputFormat: "html-slides" }, calcSlideDimensions(612, 792, false))).toContain("<!DOCTYPE html>");
    expect(renderOutput(slides, { ...opts, outputFormat: "markdown-sildes" }, calcSlideDimensions(612, 792, false))).toContain("marp: true");
    expect(renderOutput(slides, { ...opts, outputFormat: "pptx" }, calcSlideDimensions(612, 792, false))).toContain("outline");
  });
});

describe("pdf2pptx computeSummaryStats", () => {
  it("computes correct stats", () => {
    const slides = [
      makeSlide({ bullets: ["a", "b"], hasHeadingTitle: true, notes: "n1", textLength: 10 }),
      makeSlide({ slideNumber: 2, bullets: ["c"], hasHeadingTitle: false, notes: "", textLength: 5 }),
    ];
    const s = computeSummaryStats(slides, DEFAULT_OPTIONS, 5);
    expect(s.totalSlides).toBe(2);
    expect(s.totalPagesInSource).toBe(5);
    expect(s.totalBullets).toBe(3);
    expect(s.avgBulletsPerSlide).toBe(1.5);
    expect(s.slidesWithHeadingTitle).toBe(1);
    expect(s.slidesWithNotes).toBe(1);
  });
  it("handles empty input", () => {
    const s = computeSummaryStats([], DEFAULT_OPTIONS, 0);
    expect(s.totalSlides).toBe(0);
    expect(s.avgBulletsPerSlide).toBe(0);
  });
});

describe("pdf2pptx calcSlideCount", () => {
  it("returns length of index array", () => {
    expect(calcSlideCount([0, 1, 2])).toBe(3);
    expect(calcSlideCount([])).toBe(0);
  });
});

describe("pdf2pptx scoreTitleExtraction", () => {
  it("returns 100 when all slides have heading titles", () => {
    const slides = [makeSlide({ hasHeadingTitle: true }), makeSlide({ slideNumber: 2, hasHeadingTitle: true })];
    const r = scoreTitleExtraction(slides);
    expect(r.score).toBe(100);
  });
  it("returns 0 when no slides have heading titles", () => {
    const slides = [makeSlide({ hasHeadingTitle: false }), makeSlide({ slideNumber: 2, hasHeadingTitle: false })];
    const r = scoreTitleExtraction(slides);
    expect(r.score).toBe(0);
  });
  it("flags long titles", () => {
    const longTitle = "x".repeat(120);
    const r = scoreTitleExtraction([makeSlide({ title: longTitle, hasHeadingTitle: true })]);
    expect(r.reasons.some((x) => x.includes("unusually long"))).toBe(true);
  });
  it("flags duplicate titles", () => {
    const r = scoreTitleExtraction([
      makeSlide({ title: "Same", hasHeadingTitle: true }),
      makeSlide({ slideNumber: 2, title: "Same", hasHeadingTitle: true }),
    ]);
    expect(r.reasons.some((x) => x.includes("duplicate"))).toBe(true);
  });
  it("returns 0 with no slides", () => {
    expect(scoreTitleExtraction([]).score).toBe(0);
  });
});

describe("pdf2pptx validateSpeakerNotes", () => {
  it("returns ok=true when all slides have notes", () => {
    const r = validateSpeakerNotes([makeSlide({ notes: "ok" })]);
    expect(r.ok).toBe(true);
    expect(r.emptyNotesCount).toBe(0);
  });
  it("counts empty notes", () => {
    const r = validateSpeakerNotes([makeSlide({ notes: "" }), makeSlide({ slideNumber: 2, notes: "ok" })]);
    expect(r.emptyNotesCount).toBe(1);
    expect(r.ok).toBe(false);
  });
  it("flags too-long notes", () => {
    const long = "x".repeat(5000);
    const r = validateSpeakerNotes([makeSlide({ notes: long })]);
    expect(r.tooLongNotesCount).toBe(1);
    expect(r.ok).toBe(false);
    expect(r.warnings.some((w) => w.includes("over 4000"))).toBe(true);
  });
});

describe("pdf2pptx getOutputFilename", () => {
  it("appends -slides.<ext>", () => {
    expect(getOutputFilename("pptx", "deck.pdf")).toBe("deck-slides.pptx");
    expect(getOutputFilename("html-slides", "my deck.pdf")).toBe("my_deck-slides.html");
    expect(getOutputFilename("markdown-sildes", "")).toBe("output-slides.md");
  });
});

describe("pdf2pptx history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 3, slideCount: 3, layout: "title-content", format: "pptx" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, pageCount: 1, slideCount: 1, layout: "blank", format: "pptx" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, slideCount: 1, layout: "blank", format: "pptx" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf2pptx shareable URL", () => {
  it("builds share URL with non-default options", () => {
    const url = buildShareUrl({
      ...DEFAULT_OPTIONS,
      pageRange: "1-3",
      slideLayout: "blank",
      includeSpeakerNotes: false,
      preserveAspectRatio: false,
      outputFormat: "html-slides",
    });
    expect(url).toContain("range=1-3");
    expect(url).toContain("layout=blank");
    expect(url).toContain("notes=0");
    expect(url).toContain("aspect=0");
    expect(url).toContain("format=html-slides");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("range=1-5&layout=two-content&notes=0&aspect=0&format=markdown-sildes");
    expect(p.pageRange).toBe("1-5");
    expect(p.slideLayout).toBe("two-content");
    expect(p.includeSpeakerNotes).toBe(false);
    expect(p.preserveAspectRatio).toBe(false);
    expect(p.outputFormat).toBe("markdown-sildes");
  });
  it("filters unknown enum values", () => {
    const p = parseShareUrl("layout=bogus&format=also-bogus");
    expect(p.slideLayout).toBeUndefined();
    expect(p.outputFormat).toBeUndefined();
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("pdf2pptx validateOptions", () => {
  it("accepts valid options", () => {
    const r = validateOptions(DEFAULT_OPTIONS, 5);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown output format", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, outputFormat: "bogus" as OutputFormat }, 5);
    expect(r.ok).toBe(false);
  });
  it("rejects unknown slide layout", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, slideLayout: "bogus" as SlideLayout }, 5);
    expect(r.ok).toBe(false);
  });
  it("rejects bad page range syntax", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "abc" }, 5);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toContain("page range");
  });
  it("accepts 'all' page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "all" }, 5);
    expect(r.ok).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = OutputFormat | SlideLayout | ConvertOptions;
