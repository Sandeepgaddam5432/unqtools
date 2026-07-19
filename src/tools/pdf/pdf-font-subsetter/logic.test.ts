import { describe, it, expect, beforeEach } from "vitest";
import {
  SUBSET_MODES,
  MODE_LABELS,
  AUTO_SUBSET_RATIO_THRESHOLD,
  MIN_FONT_SIZE_TO_SUBSET,
  DEFAULT_OPTIONS,
  STANDARD_FONTS,
  UNICODE_BLOCKS,
  extractSubsetPrefix,
  isSubsetFont,
  normalizeFontName,
  isStandardFont,
  generateSubsetPrefix,
  prefixFontName,
  parseCustomFontList,
  estimateTotalGlyphs,
  countUsedGlyphs,
  estimateSubsetSize,
  calcSubsetRatio,
  calcSizeReduction,
  estimateBytesSaved,
  estimateGlyphCompression,
  decideSubsetting,
  buildSubsetPlan,
  applyAggressiveMode,
  buildCharacterCoverage,
  filterSubsettable,
  verifyEmbedding,
  recommendSubsetting,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type SubsetMode,
  type SubsetOptions,
  type FontUsageData,
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

function font(partial: Partial<FontUsageData> & { index: number; rawName: string }): FontUsageData {
  const rawName = partial.rawName;
  const name = partial.name ?? normalizeFontName(rawName);
  const existingPrefix = partial.existingPrefix ?? extractSubsetPrefix(rawName);
  return {
    index: partial.index,
    rawName,
    name,
    existingPrefix,
    isAlreadySubset: partial.isAlreadySubset ?? existingPrefix.length > 0,
    embedded: partial.embedded ?? true,
    isStandard: partial.isStandard ?? isStandardFont(name),
    fontFileSize: partial.fontFileSize ?? 50_000,
    distinctCharsUsed: partial.distinctCharsUsed ?? 50,
    usedCodePoints: partial.usedCodePoints ?? Array.from({ length: 50 }, (_, i) => 0x41 + i),
    estimatedTotalGlyphs: partial.estimatedTotalGlyphs ?? 500,
    fontType: partial.fontType ?? "TrueType",
    pagesUsed: partial.pagesUsed ?? [1, 2],
  };
}

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter constants", () => {
  it("exposes 3 subset modes", () => {
    expect(SUBSET_MODES).toHaveLength(3);
    expect(SUBSET_MODES).toContain("all-fonts");
    expect(SUBSET_MODES).toContain("custom-fonts");
    expect(SUBSET_MODES).toContain("automatic");
  });

  it("mode labels cover every mode", () => {
    for (const m of SUBSET_MODES) expect(typeof MODE_LABELS[m]).toBe("string");
  });

  it("default options are sensible", () => {
    expect(DEFAULT_OPTIONS.subsetMode).toBe("all-fonts");
    expect(DEFAULT_OPTIONS.preserveOriginals).toBe(false);
    expect(DEFAULT_OPTIONS.aggressiveMode).toBe(false);
    expect(DEFAULT_OPTIONS.targetSize).toBe(0);
  });

  it("exposes 14 standard fonts", () => {
    expect(STANDARD_FONTS.size).toBe(14);
    expect(STANDARD_FONTS.has("Helvetica")).toBe(true);
    expect(STANDARD_FONTS.has("Times-Roman")).toBe(true);
    expect(STANDARD_FONTS.has("Courier")).toBe(true);
    expect(STANDARD_FONTS.has("Symbol")).toBe(true);
    expect(STANDARD_FONTS.has("ZapfDingbats")).toBe(true);
  });

  it("exposes Unicode blocks for the coverage report", () => {
    expect(UNICODE_BLOCKS.length).toBeGreaterThanOrEqual(10);
    expect(UNICODE_BLOCKS.some((b) => b.name === "Basic Latin")).toBe(true);
    expect(UNICODE_BLOCKS.some((b) => b.name === "CJK Unified Ideographs")).toBe(true);
  });

  it("exposes threshold constants", () => {
    expect(AUTO_SUBSET_RATIO_THRESHOLD).toBeGreaterThan(0);
    expect(AUTO_SUBSET_RATIO_THRESHOLD).toBeLessThanOrEqual(1);
    expect(MIN_FONT_SIZE_TO_SUBSET).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter name handling", () => {
  it("extracts subset prefix", () => {
    expect(extractSubsetPrefix("ABCDEF+Helvetica")).toBe("ABCDEF");
    expect(extractSubsetPrefix("Helvetica")).toBe("");
  });

  it("detects subset fonts", () => {
    expect(isSubsetFont("ABCDEF+Helvetica")).toBe(true);
    expect(isSubsetFont("Helvetica")).toBe(false);
  });

  it("normalizes by stripping prefix", () => {
    expect(normalizeFontName("ABCDEF+Helvetica")).toBe("Helvetica");
    expect(normalizeFontName("  Helvetica  ")).toBe("Helvetica");
    expect(normalizeFontName("Helvetica-Bold")).toBe("Helvetica-Bold");
  });

  it("detects standard fonts", () => {
    expect(isStandardFont("Helvetica")).toBe(true);
    expect(isStandardFont("Helvetica-Bold")).toBe(true);
    expect(isStandardFont("Helvetica Neue")).toBe(false);
    expect(isStandardFont("")).toBe(false);
  });

  it("generates a 6-letter uppercase prefix without seed", () => {
    const p = generateSubsetPrefix();
    expect(p).toHaveLength(6);
    expect(p).toMatch(/^[A-Z]{6}$/);
  });

  it("generates a deterministic prefix with seed", () => {
    const a = generateSubsetPrefix(42);
    const b = generateSubsetPrefix(42);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Z]{6}$/);
  });

  it("applies prefix to a font name", () => {
    expect(prefixFontName("Helvetica", "ABCDEF")).toBe("ABCDEF+Helvetica");
  });

  it("strips an existing prefix before re-prefixing", () => {
    expect(prefixFontName("XYZWAB+Helvetica", "ABCDEF")).toBe("ABCDEF+Helvetica");
  });

  it("sanitizes and pads an invalid prefix", () => {
    const out = prefixFontName("Helvetica", "abc123");
    expect(out).toMatch(/^[A-Z]{6}\+Helvetica$/);
  });

  it("pads a short prefix to 6 chars", () => {
    const out = prefixFontName("Helvetica", "AB");
    expect(out).toMatch(/^ABAAAA\+Helvetica$/);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter custom list parser", () => {
  it("parses newline-separated names", () => {
    expect(parseCustomFontList("Helvetica\nArial\nRoboto")).toEqual(["Helvetica", "Arial", "Roboto"]);
  });

  it("parses comma-separated names", () => {
    expect(parseCustomFontList("Helvetica, Arial, Roboto")).toEqual(["Helvetica", "Arial", "Roboto"]);
  });

  it("strips existing subset prefixes", () => {
    expect(parseCustomFontList("ABCDEF+Helvetica\nXYZWAB+Arial")).toEqual(["Helvetica", "Arial"]);
  });

  it("skips blank entries", () => {
    expect(parseCustomFontList("Helvetica\n\n  \nArial")).toEqual(["Helvetica", "Arial"]);
  });

  it("returns empty for empty input", () => {
    expect(parseCustomFontList("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter glyph estimation", () => {
  it("estimates glyphs for TrueType", () => {
    const n = estimateTotalGlyphs("TrueType", 50_000, 100);
    expect(n).toBeGreaterThanOrEqual(256);
    expect(n).toBeLessThanOrEqual(500);
  });

  it("estimates glyphs for CID fonts", () => {
    const n = estimateTotalGlyphs("CIDFontType2", 500_000, 2000);
    expect(n).toBeGreaterThanOrEqual(2000);
  });

  it("estimates glyphs for Type1", () => {
    const n = estimateTotalGlyphs("Type1", 40_000, 100);
    expect(n).toBeGreaterThanOrEqual(224);
  });

  it("returns distinct chars for Type3", () => {
    expect(estimateTotalGlyphs("Type3", 10_000, 80)).toBe(80);
  });

  it("counts used glyphs with .notdef", () => {
    expect(countUsedGlyphs(50, false)).toBe(51);
    expect(countUsedGlyphs(0, false)).toBe(1);
  });

  it("aggressive mode prunes ~10%", () => {
    const normal = countUsedGlyphs(100, false);
    const aggressive = countUsedGlyphs(100, true);
    expect(aggressive).toBeLessThan(normal);
    expect(aggressive).toBeGreaterThan(0);
  });

  it("estimates subset size with ratio", () => {
    const size = estimateSubsetSize(100_000, 50, 500);
    expect(size).toBeLessThan(100_000);
    expect(size).toBeGreaterThan(2048);
  });

  it("subset size never exceeds original", () => {
    const size = estimateSubsetSize(1000, 500, 100);
    expect(size).toBeLessThanOrEqual(1000);
  });

  it("subset size has minimum overhead", () => {
    const size = estimateSubsetSize(10_000, 1, 5000);
    expect(size).toBeGreaterThanOrEqual(2048);
  });

  it("calculates subset ratio clamped to [0,1]", () => {
    expect(calcSubsetRatio(50, 500)).toBeCloseTo(0.1, 1);
    expect(calcSubsetRatio(500, 500)).toBe(1);
    expect(calcSubsetRatio(0, 500)).toBe(0);
    expect(calcSubsetRatio(50, 0)).toBe(1);
  });

  it("calculates size reduction percentage", () => {
    expect(calcSizeReduction(100, 75)).toBe(25);
    expect(calcSizeReduction(100, 100)).toBe(0);
    expect(calcSizeReduction(0, 0)).toBe(0);
    expect(calcSizeReduction(100, 150)).toBe(0); // never negative
  });

  it("estimates bytes saved", () => {
    expect(estimateBytesSaved(1000, 600)).toBe(400);
    expect(estimateBytesSaved(500, 800)).toBe(0); // never negative
  });

  it("estimates glyph compression", () => {
    expect(estimateGlyphCompression(50_000, 500)).toBe(100);
    expect(estimateGlyphCompression(50_000, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter decideSubsetting", () => {
  it("skips non-embedded fonts", () => {
    const f = font({ index: 0, rawName: "Arial", embedded: false });
    const d = decideSubsetting(f, "all-fonts", []);
    expect(d.willSubset).toBe(false);
    expect(d.reason).toContain("not embedded");
  });

  it("skips standard fonts", () => {
    const f = font({ index: 0, rawName: "Helvetica", isStandard: true });
    const d = decideSubsetting(f, "all-fonts", []);
    expect(d.willSubset).toBe(false);
    expect(d.reason).toContain("Standard PDF font");
  });

  it("skips tiny fonts", () => {
    const f = font({ index: 0, rawName: "TinyFont", fontFileSize: 100 });
    const d = decideSubsetting(f, "all-fonts", []);
    expect(d.willSubset).toBe(false);
    expect(d.reason).toContain("tiny");
  });

  it("subsets all in all-fonts mode", () => {
    const f = font({ index: 0, rawName: "Roboto", fontFileSize: 50_000 });
    const d = decideSubsetting(f, "all-fonts", []);
    expect(d.willSubset).toBe(true);
  });

  it("custom-fonts mode matches by name (case-insensitive)", () => {
    const f = font({ index: 0, rawName: "Roboto" });
    expect(decideSubsetting(f, "custom-fonts", ["roboto"]).willSubset).toBe(true);
    expect(decideSubsetting(f, "custom-fonts", ["arial"]).willSubset).toBe(false);
  });

  it("automatic mode subsets when ratio is low", () => {
    const f = font({ index: 0, rawName: "BigFont", distinctCharsUsed: 50, estimatedTotalGlyphs: 1000, fontFileSize: 200_000 });
    const d = decideSubsetting(f, "automatic", []);
    expect(d.willSubset).toBe(true);
    expect(d.reason).toContain("Automatic mode");
  });

  it("automatic mode skips when ratio is high", () => {
    const f = font({ index: 0, rawName: "SmallFont", distinctCharsUsed: 480, estimatedTotalGlyphs: 500, fontFileSize: 20_000 });
    const d = decideSubsetting(f, "automatic", []);
    expect(d.willSubset).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter buildSubsetPlan", () => {
  it("builds a plan for all-fonts mode", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 500 }),
      font({ index: 1, rawName: "Arial", fontFileSize: 80_000, distinctCharsUsed: 60, estimatedTotalGlyphs: 600 }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS });
    expect(plan.totalFonts).toBe(2);
    expect(plan.fontsToSubset).toBe(2);
    expect(plan.fontsSkipped).toBe(0);
    expect(plan.estimatedTotalBytesSaved).toBeGreaterThan(0);
    expect(plan.estimatedReductionPct).toBeGreaterThan(0);
    expect(plan.entries[0].newBaseFontName).toMatch(/^[A-Z]{6}\+Roboto$/);
    expect(plan.entries[1].newBaseFontName).toMatch(/^[A-Z]{6}\+Arial$/);
  });

  it("skips standard and non-embedded fonts", () => {
    const fonts = [
      font({ index: 0, rawName: "Helvetica", isStandard: true }),
      font({ index: 1, rawName: "Arial", embedded: false }),
      font({ index: 2, rawName: "Roboto", fontFileSize: 50_000 }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS });
    expect(plan.fontsToSubset).toBe(1);
    expect(plan.fontsSkipped).toBe(2);
  });

  it("custom-fonts mode only subsets listed fonts", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000 }),
      font({ index: 1, rawName: "Arial", fontFileSize: 50_000 }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS, subsetMode: "custom-fonts", customFontList: "Roboto" });
    expect(plan.fontsToSubset).toBe(1);
    expect(plan.entries[0].willSubset).toBe(true);
    expect(plan.entries[1].willSubset).toBe(false);
  });

  it("aggressive mode reduces estimated subset size", () => {
    const fonts = [
      font({ index: 0, rawName: "CIDFont", fontFileSize: 200_000, distinctCharsUsed: 200, estimatedTotalGlyphs: 2000, fontType: "CIDFontType2" }),
    ];
    const normalPlan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS, aggressiveMode: false });
    const aggressivePlan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS, aggressiveMode: true });
    expect(aggressivePlan.entries[0].estimatedSubsetSize).toBeLessThan(normalPlan.entries[0].estimatedSubsetSize);
  });

  it("handles empty font list", () => {
    const plan = buildSubsetPlan([], { ...DEFAULT_OPTIONS });
    expect(plan.totalFonts).toBe(0);
    expect(plan.fontsToSubset).toBe(0);
    expect(plan.estimatedTotalBytesSaved).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter applyAggressiveMode", () => {
  it("prunes composite fonts only", () => {
    const fonts = [
      font({ index: 0, rawName: "TrueTypeFont", fontFileSize: 50_000, fontType: "TrueType" }),
      font({ index: 1, rawName: "CIDFont", fontFileSize: 200_000, fontType: "CIDFontType2" }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS, aggressiveMode: false });
    const aggressive = applyAggressiveMode(plan, fonts);
    expect(aggressive.affectedFonts).toBe(1);
    expect(aggressive.extraBytesSaved).toBeGreaterThan(0);
  });

  it("does not affect non-subsetted fonts", () => {
    const fonts = [
      font({ index: 0, rawName: "Helvetica", isStandard: true }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS });
    const aggressive = applyAggressiveMode(plan, fonts);
    expect(aggressive.affectedFonts).toBe(0);
    expect(aggressive.extraBytesSaved).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter character coverage", () => {
  it("builds coverage report by Unicode block", () => {
    const fonts = [
      font({
        index: 0,
        rawName: "Arial",
        usedCodePoints: [0x41, 0x42, 0x43, 0xE9, 0x20AC], // Basic Latin + Latin-1 + Currency
      }),
    ];
    const report = buildCharacterCoverage(fonts);
    expect(report).toHaveLength(1);
    const entry = report[0];
    expect(entry.totalChars).toBe(5);
    const blockNames = entry.blocks.map((b) => b.name);
    expect(blockNames).toContain("Basic Latin");
    expect(blockNames).toContain("Latin-1 Supplement");
    expect(blockNames).toContain("Currency Symbols");
  });

  it("counts other for code points outside known blocks", () => {
    const fonts = [
      font({
        index: 0,
        rawName: "Arial",
        usedCodePoints: [0x41, 0xFFFFF], // 0xFFFFF is in a supplementary plane
      }),
    ];
    const report = buildCharacterCoverage(fonts);
    expect(report[0].otherCount).toBe(1);
  });

  it("returns empty for empty font list", () => {
    expect(buildCharacterCoverage([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter filterSubsettable & verifyEmbedding", () => {
  it("filters out non-embedded, standard, and tiny fonts", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000 }),
      font({ index: 1, rawName: "Helvetica", isStandard: true }),
      font({ index: 2, rawName: "Arial", embedded: false }),
      font({ index: 3, rawName: "Tiny", fontFileSize: 100 }),
    ];
    expect(filterSubsettable(fonts)).toHaveLength(1);
  });

  it("verifies embedding state with messages", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000, embedded: true }),
      font({ index: 1, rawName: "Arial", embedded: false, fontFileSize: 0 }),
      font({ index: 2, rawName: "Helvetica", isStandard: true, fontFileSize: 0 }),
    ];
    const v = verifyEmbedding(fonts);
    expect(v).toHaveLength(3);
    expect(v[0].embedded).toBe(true);
    expect(v[0].message).toContain("properly embedded");
    expect(v[1].embedded).toBe(false);
    expect(v[1].message).toContain("referenced but not embedded");
    expect(v[2].message).toContain("Standard PDF font");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter recommendSubsetting", () => {
  it("recommends fonts with significant savings", () => {
    const fonts = [
      font({ index: 0, rawName: "BigFont", fontFileSize: 500_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 5000 }),
      font({ index: 1, rawName: "TinyFont", fontFileSize: 2000, distinctCharsUsed: 5, estimatedTotalGlyphs: 100 }),
    ];
    const recs = recommendSubsetting(fonts);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs[0].name).toBe("BigFont");
    expect(recs[0].priority).toBe("high");
  });

  it("skips already-subsetted fonts", () => {
    const fonts = [
      font({ index: 0, rawName: "ABCDEF+Roboto", isAlreadySubset: true, fontFileSize: 500_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 5000 }),
    ];
    expect(recommendSubsetting(fonts)).toEqual([]);
  });

  it("skips fonts with high usage ratio", () => {
    const fonts = [
      font({ index: 0, rawName: "FullFont", fontFileSize: 500_000, distinctCharsUsed: 4990, estimatedTotalGlyphs: 5000 }),
    ];
    expect(recommendSubsetting(fonts)).toEqual([]);
  });

  it("sorts by estimated savings descending", () => {
    const fonts = [
      font({ index: 0, rawName: "Small", fontFileSize: 50_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 500 }),
      font({ index: 1, rawName: "Big", fontFileSize: 500_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 5000 }),
    ];
    const recs = recommendSubsetting(fonts);
    expect(recs[0].name).toBe("Big");
    expect(recs[1].name).toBe("Small");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter computeSummaryStats", () => {
  it("computes summary stats from plan and font data", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 500 }),
      font({ index: 1, rawName: "ABCDEF+Arial", isAlreadySubset: true, fontFileSize: 10_000, distinctCharsUsed: 60, estimatedTotalGlyphs: 100 }),
      font({ index: 2, rawName: "Helvetica", isStandard: true, fontFileSize: 0, distinctCharsUsed: 30, estimatedTotalGlyphs: 0 }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS });
    const stats = computeSummaryStats(plan, fonts);
    expect(stats.totalFonts).toBe(3);
    expect(stats.alreadySubsetted).toBe(1);
    expect(stats.standardFonts).toBe(1);
    expect(stats.totalCharsUsed).toBe(140);
    expect(stats.estimatedReductionPct).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter renderers", () => {
  it("renderTextReport produces a readable report", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 500 }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS });
    const stats = computeSummaryStats(plan, fonts);
    const text = renderTextReport(plan, stats);
    expect(text).toContain("PDF Font Subsetting Report");
    expect(text).toContain("Roboto");
    expect(text).toContain("Will subset: yes");
  });

  it("renderCsvReport produces a CSV header", () => {
    const plan = buildSubsetPlan([], { ...DEFAULT_OPTIONS });
    const csv = renderCsvReport(plan);
    expect(csv).toContain("index,name,original_size");
  });

  it("renderCsvReport produces rows for fonts", () => {
    const fonts = [
      font({ index: 0, rawName: "Roboto", fontFileSize: 50_000, distinctCharsUsed: 50, estimatedTotalGlyphs: 500 }),
    ];
    const plan = buildSubsetPlan(fonts, { ...DEFAULT_OPTIONS });
    const csv = renderCsvReport(plan);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 row
    expect(lines[1]).toContain("Roboto");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      originalSize: 100_000,
      subsetSize: 70_000,
      reductionPercent: 30,
      fontsSubset: 3,
      mode: "all-fonts",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("test.pdf");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `test-${i}.pdf`,
        originalSize: 100_000,
        subsetSize: 70_000,
        reductionPercent: 30,
        fontsSubset: 3,
        mode: "all-fonts",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      originalSize: 100_000,
      subsetSize: 70_000,
      reductionPercent: 30,
      fontsSubset: 3,
      mode: "all-fonts",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, subsetMode: "custom-fonts", customFontList: "Roboto\nArial" });
    expect(url).toContain("mode=custom-fonts");
    expect(url).toContain("fonts=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("mode=custom-fonts&fonts=Roboto&keep=1&agg=1&target=100");
    expect(p.subsetMode).toBe("custom-fonts");
    expect(p.customFontList).toBe("Roboto");
    expect(p.preserveOriginals).toBe(true);
    expect(p.aggressiveMode).toBe(true);
    expect(p.targetSize).toBe(100);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("filters unknown modes", () => {
    const p = parseShareUrl("mode=unknown-mode");
    expect(p.subsetMode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("pdf-font-subsetter validateOptions", () => {
  it("validates default options", () => {
    const r = validateOptions(DEFAULT_OPTIONS);
    expect(r.ok).toBe(true);
  });

  it("rejects unknown mode", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, subsetMode: "bogus" as SubsetMode });
    expect(r.ok).toBe(false);
  });

  it("requires font list for custom-fonts mode", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, subsetMode: "custom-fonts", customFontList: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no font names");
  });

  it("accepts custom-fonts mode with list", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, subsetMode: "custom-fonts", customFontList: "Roboto" });
    expect(r.ok).toBe(true);
  });

  it("rejects negative target size", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, targetSize: -5 });
    expect(r.ok).toBe(false);
  });
});

// Reference imports to avoid unused warnings in some TS configs.
export type _Unused = SubsetMode | SubsetOptions;
