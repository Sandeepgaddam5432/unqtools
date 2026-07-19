import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_FONT_TYPES,
  EXTRACTION_MODES,
  MODE_LABELS,
  FORMAT_FILTERS,
  FORMAT_FILTER_LABELS,
  OUTPUT_FORMATS,
  OUTPUT_EXTENSIONS,
  OUTPUT_MIME,
  DEFAULT_OPTIONS,
  STANDARD_FONTS,
  detectFontType,
  isCidFont,
  extractSubsetPrefix,
  isSubsetFont,
  normalizeFontName,
  formatFontName,
  isEmbedded,
  isStandardFont,
  getStandardFontName,
  sanitizeFontName,
  getFontFilename,
  suggestFontExtension,
  filterFontsByFormat,
  filterFontsBySubset,
  applyFontFilters,
  computeSummaryStats,
  detectFontDuplicates,
  rankFontsByUsage,
  recommendSubsetting,
  checkFontCompatibility,
  renderTextList,
  renderJsonMetadata,
  renderCsvList,
  renderOutput,
  getOutputFilename,
  crc32,
  utf8Encode,
  buildZip,
  buildFontPackage,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type FontInfo,
  type FontType,
  type FontOptions,
  type ExtractionMode,
  type FontFormatFilter,
  type OutputFormat,
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

function font(partial: Partial<FontInfo> & { index: number; rawName: string }): FontInfo {
  const rawName = partial.rawName;
  const name = partial.name ?? normalizeFontName(rawName);
  const subsetPrefix = partial.subsetPrefix ?? extractSubsetPrefix(rawName);
  const isSubset = partial.isSubset ?? subsetPrefix.length > 0;
  return {
    index: partial.index,
    rawName,
    name,
    subsetPrefix,
    isSubset,
    type: partial.type ?? "TrueType",
    embedded: partial.embedded ?? false,
    isStandard: partial.isStandard ?? isStandardFont(name),
    fontFileBytes: partial.fontFileBytes ?? null,
    fontFileExtension: partial.fontFileExtension ?? "ttf",
    pagesUsed: partial.pagesUsed ?? [1],
    charCount: partial.charCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
describe("pdf-font constants", () => {
  it("exposes 7 font types", () => {
    expect(ALL_FONT_TYPES).toHaveLength(7);
    expect(ALL_FONT_TYPES).toContain("TrueType");
    expect(ALL_FONT_TYPES).toContain("Type1");
    expect(ALL_FONT_TYPES).toContain("OpenType");
    expect(ALL_FONT_TYPES).toContain("CIDFontType0");
    expect(ALL_FONT_TYPES).toContain("CIDFontType2");
    expect(ALL_FONT_TYPES).toContain("Type3");
    expect(ALL_FONT_TYPES).toContain("Unknown");
  });
  it("exposes 4 extraction modes", () => {
    expect(EXTRACTION_MODES).toHaveLength(4);
    expect(MODE_LABELS["extract-font-files"]).toBeTruthy();
  });
  it("exposes 5 format filters", () => {
    expect(FORMAT_FILTERS).toHaveLength(5);
    for (const f of FORMAT_FILTERS) expect(typeof FORMAT_FILTER_LABELS[f]).toBe("string");
  });
  it("exposes 3 output formats with extensions and MIME", () => {
    expect(OUTPUT_FORMATS).toHaveLength(3);
    for (const f of OUTPUT_FORMATS) {
      expect(typeof OUTPUT_EXTENSIONS[f]).toBe("string");
      expect(OUTPUT_MIME[f]).toMatch(/^[a-z]+\/[a-z.-]+$/);
    }
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.extractionMode).toBe("list-only");
    expect(DEFAULT_OPTIONS.fontFormatFilter).toBe("all");
    expect(DEFAULT_OPTIONS.includeSubsets).toBe(true);
    expect(DEFAULT_OPTIONS.outputFormat).toBe("json-metadata");
  });
  it("has 14 standard PDF fonts", () => {
    expect(STANDARD_FONTS.size).toBe(14);
    expect(STANDARD_FONTS.has("Helvetica")).toBe(true);
    expect(STANDARD_FONTS.has("Times-Roman")).toBe(true);
    expect(STANDARD_FONTS.has("Courier")).toBe(true);
    expect(STANDARD_FONTS.has("Symbol")).toBe(true);
    expect(STANDARD_FONTS.has("ZapfDingbats")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font type detection", () => {
  it("detects TrueType", () => {
    expect(detectFontType("TrueType")).toBe("TrueType");
  });
  it("detects Type1", () => {
    expect(detectFontType("Type1")).toBe("Type1");
  });
  it("detects Type3", () => {
    expect(detectFontType("Type3")).toBe("Type3");
  });
  it("detects CIDFontType0", () => {
    expect(detectFontType("CIDFontType0")).toBe("CIDFontType0");
  });
  it("detects CIDFontType2", () => {
    expect(detectFontType("CIDFontType2")).toBe("CIDFontType2");
  });
  it("returns OpenType when isOpenTypeFile is true", () => {
    expect(detectFontType("Type1", true)).toBe("OpenType");
    expect(detectFontType("CIDFontType0", true)).toBe("OpenType");
  });
  it("returns Unknown for unrecognized subtypes", () => {
    expect(detectFontType("WeirdType")).toBe("Unknown");
    expect(detectFontType("")).toBe("Unknown");
  });
  it("isCidFont identifies CID variants", () => {
    expect(isCidFont("CIDFontType0")).toBe(true);
    expect(isCidFont("CIDFontType2")).toBe(true);
    expect(isCidFont("TrueType")).toBe(false);
    expect(isCidFont("Type1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font name normalization & subset detection", () => {
  it("extracts subset prefix", () => {
    expect(extractSubsetPrefix("ABCDEF+Helvetica")).toBe("ABCDEF");
    expect(extractSubsetPrefix("Helvetica")).toBe("");
  });
  it("requires prefix to be 6 uppercase letters", () => {
    expect(extractSubsetPrefix("ABCDE+Helvetica")).toBe("");
    expect(extractSubsetPrefix("abcdef+Helvetica")).toBe("");
    expect(extractSubsetPrefix("ABCDE1+Helvetica")).toBe("");
  });
  it("isSubsetFont returns boolean", () => {
    expect(isSubsetFont("ABCDEF+Helvetica")).toBe(true);
    expect(isSubsetFont("Helvetica")).toBe(false);
  });
  it("normalizeFontName strips subset prefix", () => {
    expect(normalizeFontName("ABCDEF+Helvetica")).toBe("Helvetica");
    expect(normalizeFontName("Helvetica")).toBe("Helvetica");
    expect(normalizeFontName("  ABCDEF+Helvetica  ")).toBe("Helvetica");
  });
  it("formatFontName reattaches prefix", () => {
    expect(formatFontName({ name: "Helvetica", isSubset: true, subsetPrefix: "ABCDEF" })).toBe("ABCDEF+Helvetica");
    expect(formatFontName({ name: "Helvetica", isSubset: false, subsetPrefix: "" })).toBe("Helvetica");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font standard font detection", () => {
  it("isStandardFont returns true for standard fonts", () => {
    expect(isStandardFont("Helvetica")).toBe(true);
    expect(isStandardFont("Times-Bold")).toBe(true);
    expect(isStandardFont("Courier-Oblique")).toBe(true);
    expect(isStandardFont("MyCustomFont")).toBe(false);
  });
  it("getStandardFontName returns the name or null", () => {
    expect(getStandardFontName("Helvetica")).toBe("Helvetica");
    expect(getStandardFontName("MyCustomFont")).toBeNull();
  });
  it("isEmbedded considers standard fonts as always available", () => {
    const f = font({ index: 0, rawName: "Helvetica", embedded: false, isStandard: true });
    expect(isEmbedded(f)).toBe(true);
  });
  it("isEmbedded returns embedded flag for non-standard", () => {
    const f = font({ index: 0, rawName: "MyCustom", embedded: false });
    expect(isEmbedded(f)).toBe(false);
    const f2 = font({ index: 0, rawName: "MyCustom", embedded: true });
    expect(isEmbedded(f2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font filename helpers", () => {
  it("sanitizeFontName replaces unsafe chars", () => {
    expect(sanitizeFontName("Helvetica-Bold")).toBe("Helvetica-Bold");
    expect(sanitizeFontName("My Font/Name")).toBe("My_Font_Name");
    expect(sanitizeFontName("")).toBe("font");
  });
  it("suggestFontExtension maps types to extensions", () => {
    expect(suggestFontExtension("TrueType")).toBe("ttf");
    expect(suggestFontExtension("Type1")).toBe("pfb");
    expect(suggestFontExtension("OpenType")).toBe("otf");
    expect(suggestFontExtension("CIDFontType0")).toBe("otf");
    expect(suggestFontExtension("CIDFontType2")).toBe("ttf");
    expect(suggestFontExtension("Type3")).toBe("bin");
    expect(suggestFontExtension("Unknown")).toBe("bin");
  });
  it("suggestFontExtension prefers fontFileSubtype for OpenType/CFF", () => {
    expect(suggestFontExtension("Type1", "OpenType")).toBe("otf");
    expect(suggestFontExtension("Type1", "CFFFont")).toBe("cff");
  });
  it("getFontFilename builds correct filename", () => {
    const f = font({ index: 0, rawName: "Helvetica", type: "TrueType", fontFileExtension: "ttf" });
    expect(getFontFilename(f)).toBe("Helvetica.ttf");
  });
  it("getFontFilename includes subset prefix", () => {
    const f = font({ index: 0, rawName: "ABCDEF+Helvetica", type: "TrueType", fontFileExtension: "ttf" });
    expect(getFontFilename(f)).toBe("ABCDEF+Helvetica.ttf");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font filtering", () => {
  const fonts: FontInfo[] = [
    font({ index: 0, rawName: "Helvetica", type: "TrueType" }),
    font({ index: 1, rawName: "ABCDEF+Custom", type: "Type1" }),
    font({ index: 2, rawName: "MyOpen", type: "OpenType" }),
    font({ index: 3, rawName: "CIDCFF", type: "CIDFontType0" }),
    font({ index: 4, rawName: "CIDTT", type: "CIDFontType2" }),
  ];
  it("returns all when filter is 'all'", () => {
    expect(filterFontsByFormat(fonts, "all")).toHaveLength(5);
  });
  it("filters by truetype (includes CIDFontType2)", () => {
    const r = filterFontsByFormat(fonts, "truetype");
    expect(r).toHaveLength(2);
    expect(r.map((f) => f.type).sort()).toEqual(["CIDFontType2", "TrueType"]);
  });
  it("filters by type1", () => {
    expect(filterFontsByFormat(fonts, "type1")).toHaveLength(1);
    expect(filterFontsByFormat(fonts, "type1")[0].name).toBe("Custom");
  });
  it("filters by opentype (includes CIDFontType0)", () => {
    const r = filterFontsByFormat(fonts, "opentype");
    expect(r).toHaveLength(2);
  });
  it("filters by cid (CIDFontType0 + CIDFontType2)", () => {
    const r = filterFontsByFormat(fonts, "cid");
    expect(r).toHaveLength(2);
  });
  it("filterFontsBySubset removes subsets when false", () => {
    expect(filterFontsBySubset(fonts, false)).toHaveLength(4);
    expect(filterFontsBySubset(fonts, true)).toHaveLength(5);
  });
  it("applyFontFilters chains both filters", () => {
    const r = applyFontFilters(fonts, {
      extractionMode: "list-only",
      fontFormatFilter: "type1",
      includeSubsets: false,
      outputFormat: "json-metadata",
    });
    expect(r).toHaveLength(0); // the Type1 font is a subset, filtered out
  });
  it("applyFontFilters keeps non-subset Type1", () => {
    const fonts2: FontInfo[] = [
      font({ index: 0, rawName: "PlainType1", type: "Type1" }),
    ];
    const r = applyFontFilters(fonts2, {
      extractionMode: "list-only",
      fontFormatFilter: "type1",
      includeSubsets: false,
      outputFormat: "json-metadata",
    });
    expect(r).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font summary stats", () => {
  it("aggregates counts correctly", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "Helvetica", type: "TrueType", embedded: true, charCount: 100, pagesUsed: [1, 2] }),
      font({ index: 1, rawName: "ABCDEF+Custom", type: "Type1", embedded: true, charCount: 200, pagesUsed: [1] }),
      font({ index: 2, rawName: "NotEmbedded", type: "TrueType", embedded: false, charCount: 50, pagesUsed: [3] }),
    ];
    const s = computeSummaryStats(fonts);
    expect(s.totalFonts).toBe(3);
    expect(s.embeddedCount).toBe(2);
    expect(s.notEmbeddedCount).toBe(1);
    expect(s.subsettedCount).toBe(1);
    expect(s.byType.TrueType).toBe(2);
    expect(s.byType.Type1).toBe(1);
    expect(s.totalChars).toBe(350);
    expect(s.totalPagesWithFonts).toBe(3);
    expect(s.avgCharsPerFont).toBe(117); // round(350/3) = 117
  });
  it("detects duplicates", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "Helvetica", type: "TrueType", embedded: true }),
      font({ index: 1, rawName: "Helvetica", type: "TrueType", embedded: true }),
      font({ index: 2, rawName: "Other", type: "Type1", embedded: true }),
    ];
    const s = computeSummaryStats(fonts);
    expect(s.duplicatedCount).toBe(2); // 2 of the 3 Helvetica entries are duplicates
  });
  it("handles empty input", () => {
    const s = computeSummaryStats([]);
    expect(s.totalFonts).toBe(0);
    expect(s.embeddedCount).toBe(0);
    expect(s.totalChars).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font duplication detector", () => {
  it("groups duplicate fonts", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "Helvetica", embedded: true, fontFileBytes: new Uint8Array(100) }),
      font({ index: 1, rawName: "Helvetica", embedded: true, fontFileBytes: new Uint8Array(150) }),
      font({ index: 2, rawName: "Custom", embedded: true }),
    ];
    const dups = detectFontDuplicates(fonts);
    expect(dups).toHaveLength(1);
    expect(dups[0].name).toBe("Helvetica");
    expect(dups[0].count).toBe(2);
    expect(dups[0].indices).toEqual([0, 1]);
    expect(dups[0].totalBytes).toBe(250);
  });
  it("returns empty when no duplicates", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "A" }),
      font({ index: 1, rawName: "B" }),
    ];
    expect(detectFontDuplicates(fonts)).toEqual([]);
  });
  it("separates embedded from referenced copies of the same font", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "Helvetica", embedded: true }),
      font({ index: 1, rawName: "Helvetica", embedded: false }),
    ];
    expect(detectFontDuplicates(fonts)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font usage ranking", () => {
  it("ranks by character count descending", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "A", charCount: 100, pagesUsed: [1, 2, 3] }),
      font({ index: 1, rawName: "B", charCount: 500, pagesUsed: [1] }),
      font({ index: 2, rawName: "C", charCount: 300, pagesUsed: [1, 2] }),
    ];
    const r = rankFontsByUsage(fonts, "chars");
    expect(r[0].name).toBe("B");
    expect(r[1].name).toBe("C");
    expect(r[2].name).toBe("A");
  });
  it("ranks by page count descending", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "A", charCount: 100, pagesUsed: [1, 2, 3] }),
      font({ index: 1, rawName: "B", charCount: 500, pagesUsed: [1] }),
    ];
    const r = rankFontsByUsage(fonts, "pages");
    expect(r[0].name).toBe("A");
    expect(r[1].name).toBe("B");
  });
  it("handles empty input", () => {
    expect(rankFontsByUsage([], "chars")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font subsetting recommender", () => {
  it("recommends subsetting for large embedded non-subsetted fonts", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "BigFont", type: "TrueType", embedded: true, isSubset: false, fontFileBytes: new Uint8Array(10000) }),
      font({ index: 1, rawName: "ABCDEF+Small", type: "TrueType", embedded: true, isSubset: true, fontFileBytes: new Uint8Array(1000) }),
      font({ index: 2, rawName: "Tiny", type: "TrueType", embedded: true, isSubset: false, fontFileBytes: new Uint8Array(500) }),
      font({ index: 3, rawName: "Helvetica", type: "TrueType", embedded: true, isSubset: false, isStandard: true, fontFileBytes: new Uint8Array(5000) }),
    ];
    const recs = recommendSubsetting(fonts);
    expect(recs).toHaveLength(1);
    expect(recs[0].name).toBe("BigFont");
    expect(recs[0].estimatedSizeReductionBytes).toBe(7000);
  });
  it("returns empty when all fonts are already subsetted or standard", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "ABCDEF+Sub", embedded: true, isSubset: true, fontFileBytes: new Uint8Array(5000) }),
      font({ index: 1, rawName: "Helvetica", embedded: true, isStandard: true, fontFileBytes: new Uint8Array(5000) }),
    ];
    expect(recommendSubsetting(fonts)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font compatibility checker", () => {
  it("marks standard fonts as compatible", () => {
    const fonts: FontInfo[] = [font({ index: 0, rawName: "Helvetica", isStandard: true, embedded: false })];
    const r = checkFontCompatibility(fonts);
    expect(r[0].compatible).toBe(true);
    expect(r[0].note).toContain("Standard");
  });
  it("marks non-embedded non-standard fonts as incompatible", () => {
    const fonts: FontInfo[] = [font({ index: 0, rawName: "Custom", isStandard: false, embedded: false, type: "TrueType" })];
    const r = checkFontCompatibility(fonts);
    expect(r[0].compatible).toBe(false);
    expect(r[0].note).toContain("Not embedded");
  });
  it("marks Type3 fonts as incompatible", () => {
    const fonts: FontInfo[] = [font({ index: 0, rawName: "Bitmap", type: "Type3", embedded: true })];
    const r = checkFontCompatibility(fonts);
    expect(r[0].compatible).toBe(false);
    expect(r[0].note).toContain("Type3");
  });
  it("marks CID fonts as compatible", () => {
    const fonts: FontInfo[] = [font({ index: 0, rawName: "CIDFont", type: "CIDFontType0", embedded: true })];
    const r = checkFontCompatibility(fonts);
    expect(r[0].compatible).toBe(true);
  });
  it("marks embedded TrueType as compatible", () => {
    const fonts: FontInfo[] = [font({ index: 0, rawName: "Custom", type: "TrueType", embedded: true })];
    const r = checkFontCompatibility(fonts);
    expect(r[0].compatible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font renderers", () => {
  const fonts: FontInfo[] = [
    font({ index: 0, rawName: "Helvetica", type: "TrueType", embedded: true, charCount: 100, pagesUsed: [1, 2] }),
    font({ index: 1, rawName: "ABCDEF+Custom", type: "Type1", embedded: true, charCount: 200, pagesUsed: [1], fontFileBytes: new Uint8Array([1, 2, 3]), fontFileExtension: "pfb" }),
  ];
  const summary = computeSummaryStats(fonts);

  it("renderTextList produces a report", () => {
    const txt = renderTextList(fonts, summary);
    expect(txt).toContain("PDF Font Report");
    expect(txt).toContain("Total fonts: 2");
    expect(txt).toContain("Font #1: Helvetica");
    expect(txt).toContain("Font #2: ABCDEF+Custom");
    expect(txt).toContain("Type: TrueType");
    expect(txt).toContain("Type: Type1");
  });
  it("renderJsonMetadata produces valid JSON", () => {
    const json = renderJsonMetadata(fonts, summary);
    const parsed = JSON.parse(json);
    expect(parsed.summary.totalFonts).toBe(2);
    expect(parsed.summary.embeddedCount).toBe(2);
    expect(parsed.fonts).toHaveLength(2);
    expect(parsed.fonts[0].name).toBe("Helvetica");
    expect(parsed.fonts[1].isSubset).toBe(true);
    expect(parsed.fonts[1].fontFileBytes).toBe(3);
  });
  it("renderCsvList has header and one row per font", () => {
    const csv = renderCsvList(fonts);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("index,raw_name,name,type,embedded,subset,is_standard,pages_used,char_count,font_file_bytes");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("0,Helvetica,Helvetica,TrueType,true,false,true");
    expect(lines[2]).toContain("ABCDEF+Custom");
  });
  it("renderOutput dispatches to json", () => {
    const r = renderOutput(fonts, summary, "json-metadata");
    expect(() => JSON.parse(r)).not.toThrow();
  });
  it("renderOutput dispatches to csv", () => {
    const r = renderOutput(fonts, summary, "csv-list");
    expect(r).toContain("index,raw_name");
  });
  it("renderOutput returns placeholder for zip", () => {
    const r = renderOutput(fonts, summary, "zip-of-fonts");
    expect(r).toContain("ZIP");
  });
  it("getOutputFilename builds correct filename", () => {
    expect(getOutputFilename("json-metadata", "report.pdf")).toBe("report-fonts.json");
    expect(getOutputFilename("zip-of-fonts", "My Doc.pdf")).toBe("My_Doc-fonts.zip");
    expect(getOutputFilename("csv-list", "data")).toBe("data-fonts.csv");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font ZIP builder", () => {
  it("crc32 matches known value for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("crc32 matches known value for 'abc'", () => {
    // CRC-32 of "abc" = 0x352441c2
    expect(crc32(utf8Encode("abc"))).toBe(0x352441c2);
  });
  it("buildZip produces a non-empty archive", () => {
    const zip = buildZip([
      { name: "hello.txt", bytes: utf8Encode("Hello, world!") },
    ]);
    expect(zip.length).toBeGreaterThan(0);
    // ZIP local header signature
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });
  it("buildZip includes end-of-central-directory signature", () => {
    const zip = buildZip([{ name: "a.txt", bytes: utf8Encode("a") }]);
    // EOCD signature 0x06054b50 should appear near the end
    const len = zip.length;
    const sig = zip[len - 22] | (zip[len - 21] << 8) | (zip[len - 20] << 16) | (zip[len - 19] << 24);
    expect(sig >>> 0).toBe(0x06054b50);
  });
  it("buildFontPackage includes only embedded fonts and a README", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "Embedded", type: "TrueType", embedded: true, fontFileBytes: new Uint8Array([1, 2, 3, 4]) }),
      font({ index: 1, rawName: "NotEmbedded", type: "TrueType", embedded: false, fontFileBytes: null }),
      font({ index: 2, rawName: "Embedded2", type: "TrueType", embedded: true, fontFileBytes: new Uint8Array([5, 6, 7, 8]) }),
    ];
    const zip = buildFontPackage(fonts);
    expect(zip.length).toBeGreaterThan(0);
    // We can count file entries by counting local-file-header signatures
    let count = 0;
    for (let i = 0; i < zip.length - 4; i++) {
      if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x03 && zip[i + 3] === 0x04) count++;
    }
    expect(count).toBe(3); // 2 fonts + 1 README
  });
  it("buildFontPackage resolves filename collisions", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "Same", type: "TrueType", embedded: true, fontFileBytes: new Uint8Array([1]), fontFileExtension: "ttf" }),
      font({ index: 1, rawName: "Same", type: "TrueType", embedded: true, fontFileBytes: new Uint8Array([2]), fontFileExtension: "ttf" }),
    ];
    const zip = buildFontPackage(fonts);
    // Just verify it doesn't throw and produces a valid ZIP signature
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
  it("buildFontPackage handles no embedded fonts", () => {
    const fonts: FontInfo[] = [
      font({ index: 0, rawName: "NotEmbedded", embedded: false, fontFileBytes: null }),
    ];
    const zip = buildFontPackage(fonts);
    // Only the README should be present
    let count = 0;
    for (let i = 0; i < zip.length - 4; i++) {
      if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x03 && zip[i + 3] === 0x04) count++;
    }
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", totalFonts: 5, embeddedCount: 3, subsettedCount: 2, extractionMode: "list-only" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.pdf");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, totalFonts: i, embeddedCount: 0, subsettedCount: 0, extractionMode: "full" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", totalFonts: 1, embeddedCount: 1, subsettedCount: 0, extractionMode: "list-only" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font shareable URL", () => {
  it("builds share URL with non-default options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      extractionMode: "extract-font-files",
      fontFormatFilter: "truetype",
      includeSubsets: false,
      outputFormat: "zip-of-fonts",
    });
    expect(url).toContain("mode=extract-font-files");
    expect(url).toContain("filter=truetype");
    expect(url).toContain("subsets=0");
    expect(url).toContain("out=zip-of-fonts");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds minimal share URL for defaults", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).toBe("?");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=full&filter=cid&subsets=0&out=csv-list");
    expect(p.extractionMode).toBe("full");
    expect(p.fontFormatFilter).toBe("cid");
    expect(p.includeSubsets).toBe(false);
    expect(p.outputFormat).toBe("csv-list");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown values", () => {
    const p = parseShareUrl("mode=invalid&filter=invalid&out=invalid");
    expect(p.extractionMode).toBeUndefined();
    expect(p.fontFormatFilter).toBeUndefined();
    expect(p.outputFormat).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font validateOptions", () => {
  const valid: FontOptions = {
    extractionMode: "list-only",
    fontFormatFilter: "all",
    includeSubsets: true,
    outputFormat: "json-metadata",
  };
  it("accepts valid options", () => {
    const r = validateOptions(valid);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown mode", () => {
    const r = validateOptions({ ...valid, extractionMode: "weird" as ExtractionMode });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown filter", () => {
    const r = validateOptions({ ...valid, fontFormatFilter: "weird" as FontFormatFilter });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown output format", () => {
    const r = validateOptions({ ...valid, outputFormat: "yaml" as OutputFormat });
    expect(r.ok).toBe(false);
  });
  it("rejects missing options", () => {
    const r = validateOptions(null as unknown as FontOptions);
    expect(r.ok).toBe(false);
  });
});
