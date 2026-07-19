import { describe, it, expect, beforeEach } from "vitest";
import {
  ANALYSIS_MODES,
  MODE_LABELS,
  DEFAULT_OPTIONS,
  DEFAULT_INK_THICKNESS_MM,
  POINTS_PER_MM,
  normalizePageRangeSpec,
  resolveAllRange,
  parseInkCosts,
  formatInkCosts,
  calculatePageArea,
  pointsToMm2,
  mm2ToMl,
  clampRgb,
  rgbToHex,
  hexToRgb,
  rgbToCmyk,
  isGrayColor,
  estimateTextArea,
  estimateGraphicsArea,
  estimateImageArea,
  coveragePct,
  aggregateColorCoverages,
  topColorsByArea,
  cmykChannelAreas,
  estimateInkVolume,
  estimateCost,
  analyzePage,
  detectHeavyUsage,
  rankByCost,
  computeSummaryStats,
  buildHistogram,
  generateRecommendations,
  renderTextReport,
  renderCsvReport,
  renderHtmlReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type AnalysisMode,
  type InkOptions,
  type PageContentStats,
  type ColorCoverageEntry,
  type PageInkAnalysis,
  type RGBColor,
  type CMYKColor,
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

function color(r: number, g: number, b: number, area: number): ColorCoverageEntry {
  const rgb: RGBColor = { r, g, b };
  return { color: rgb, hex: rgbToHex(rgb), area, cmyk: rgbToCmyk(rgb) };
}

function stats(
  pageNumber: number,
  width: number,
  height: number,
  textChars: number,
  avgFontSize: number,
  rectArea: number,
  imageArea: number,
  colorCoverages: ColorCoverageEntry[],
): PageContentStats {
  return { pageNumber, width, height, textChars, avgFontSize, rectArea, imageArea, colorCoverages };
}

// ---------------------------------------------------------------------------
describe("pdf-ink constants", () => {
  it("has 4 analysis modes", () => {
    expect(ANALYSIS_MODES).toHaveLength(4);
    expect(ANALYSIS_MODES).toContain("per-page");
    expect(ANALYSIS_MODES).toContain("per-channel-cmyk");
    expect(ANALYSIS_MODES).toContain("per-color");
    expect(ANALYSIS_MODES).toContain("total-document");
  });
  it("mode labels cover every mode", () => {
    for (const m of ANALYSIS_MODES) expect(typeof MODE_LABELS[m]).toBe("string");
  });
  it("default options are sensible", () => {
    expect(DEFAULT_OPTIONS.analysisMode).toBe("per-page");
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
    expect(DEFAULT_OPTIONS.coverageThreshold).toBe(50);
    expect(DEFAULT_OPTIONS.includeImages).toBe(true);
    expect(DEFAULT_OPTIONS.inkCostPerMl).toBe("0.05,0.06,0.07,0.08");
  });
  it("exposes ink thickness and points-per-mm constants", () => {
    expect(DEFAULT_INK_THICKNESS_MM).toBeGreaterThan(0);
    expect(POINTS_PER_MM).toBeCloseTo(72 / 25.4, 5);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink page-range normalization", () => {
  it("returns 'all' for empty", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("   ")).toBe("all");
  });
  it("passes 'all' through", () => {
    expect(normalizePageRangeSpec("all")).toBe("all");
    expect(normalizePageRangeSpec("ALL")).toBe("all");
  });
  it("lowercases and collapses whitespace", () => {
    expect(normalizePageRangeSpec("  1-3,  5 , 8-10 ")).toBe("1-3, 5 , 8-10");
  });
  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
    expect(resolveAllRange("1-3", 5)).toBe("1-3");
    expect(resolveAllRange("all", 0)).toBe("1");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink cost parsing", () => {
  it("parses 4 comma-separated costs", () => {
    const c = parseInkCosts("0.05,0.06,0.07,0.08");
    expect(c).toEqual({ c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
  });
  it("falls back to defaults on invalid input", () => {
    const c = parseInkCosts("not a number");
    expect(c).toEqual({ c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
  });
  it("falls back to defaults on partial input", () => {
    const c = parseInkCosts("0.10,0.20");
    expect(c).toEqual({ c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
  });
  it("ignores negative costs", () => {
    const c = parseInkCosts("0.05,-0.06,0.07,0.08");
    expect(c).toEqual({ c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
  });
  it("formats back to string", () => {
    expect(formatInkCosts({ c: 0.05, m: 0.06, y: 0.07, k: 0.08 })).toBe("0.05,0.06,0.07,0.08");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink page-area math", () => {
  it("computes page area", () => {
    expect(calculatePageArea(612, 792)).toBe(484704);
    expect(calculatePageArea(0, 100)).toBe(0);
    expect(calculatePageArea(-1, 100)).toBe(0);
  });
  it("converts square points to square mm", () => {
    // 1 point = 25.4/72 mm; 1 sq point = (25.4/72)^2 sq mm
    const mm2 = pointsToMm2(72 * 72);
    expect(mm2).toBeCloseTo(25.4 * 25.4, 2);
  });
  it("converts square mm to ml", () => {
    // 100 mm2 × 0.01 mm = 1 mm3 = 0.001 ml
    expect(mm2ToMl(100, 0.01)).toBeCloseTo(0.001, 6);
  });
  it("handles zero thickness", () => {
    expect(mm2ToMl(100, 0)).toBe(0);
  });
  it("handles negative thickness", () => {
    expect(mm2ToMl(100, -1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink color conversion", () => {
  it("clamps RGB values", () => {
    expect(clampRgb({ r: 300, g: -5, b: 128 })).toEqual({ r: 255, g: 0, b: 128 });
  });
  it("converts RGB to hex", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
  });
  it("parses hex back to RGB", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("invalid")).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("converts pure black to CMYK with k=1", () => {
    const c = rgbToCmyk({ r: 0, g: 0, b: 0 });
    expect(c).toEqual({ c: 0, m: 0, y: 0, k: 1 });
  });
  it("converts pure white to CMYK with all zeros", () => {
    const c = rgbToCmyk({ r: 255, g: 255, b: 255 });
    expect(c).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });
  it("converts pure cyan RGB to CMYK with c=1", () => {
    const c = rgbToCmyk({ r: 0, g: 255, b: 255 });
    expect(c.c).toBeCloseTo(1, 5);
    expect(c.m).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
    expect(c.k).toBeCloseTo(0, 5);
  });
  it("isGrayColor detects grayscale", () => {
    expect(isGrayColor({ r: 128, g: 128, b: 128 })).toBe(true);
    expect(isGrayColor({ r: 0, g: 0, b: 0 })).toBe(true);
    expect(isGrayColor({ r: 255, g: 0, b: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink coverage estimation", () => {
  it("estimates text area from chars and font size", () => {
    // 100 chars × 12pt × 0.5 × 12 = 7200 sq pt
    expect(estimateTextArea(100, 12)).toBe(7200);
  });
  it("returns 0 for zero chars or font size", () => {
    expect(estimateTextArea(0, 12)).toBe(0);
    expect(estimateTextArea(100, 0)).toBe(0);
  });
  it("caps graphics area to page area", () => {
    expect(estimateGraphicsArea(1000, 500)).toBe(500);
    expect(estimateGraphicsArea(100, 500)).toBe(100);
    expect(estimateGraphicsArea(0, 500)).toBe(0);
  });
  it("respects includeImages flag", () => {
    expect(estimateImageArea(500, 1000, true)).toBe(500);
    expect(estimateImageArea(500, 1000, false)).toBe(0);
  });
  it("caps image area to page area", () => {
    expect(estimateImageArea(2000, 1000, true)).toBe(1000);
  });
  it("coveragePct is 0-100 and rounded to 1 decimal", () => {
    expect(coveragePct(500, 1000)).toBe(50);
    expect(coveragePct(2000, 1000)).toBe(100);
    expect(coveragePct(0, 1000)).toBe(0);
    expect(coveragePct(333, 1000)).toBe(33.3);
  });
  it("coveragePct is 0 for zero page area", () => {
    expect(coveragePct(500, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink color coverage aggregation", () => {
  it("merges identical colors", () => {
    const entries = [
      color(255, 0, 0, 100),
      color(255, 0, 0, 50),
      color(0, 0, 255, 30),
    ];
    const agg = aggregateColorCoverages(entries);
    expect(agg).toHaveLength(2);
    expect(agg[0].hex).toBe("#ff0000");
    expect(agg[0].area).toBe(150);
    expect(agg[1].area).toBe(30);
  });
  it("returns sorted by area descending", () => {
    const entries = [
      color(0, 0, 255, 30),
      color(255, 0, 0, 200),
      color(0, 255, 0, 100),
    ];
    const agg = aggregateColorCoverages(entries);
    expect(agg[0].area).toBeGreaterThanOrEqual(agg[1].area);
    expect(agg[1].area).toBeGreaterThanOrEqual(agg[2].area);
  });
  it("topColorsByArea respects N cap", () => {
    const entries = [
      color(255, 0, 0, 100),
      color(0, 255, 0, 80),
      color(0, 0, 255, 60),
      color(255, 255, 0, 40),
    ];
    expect(topColorsByArea(entries, 2)).toHaveLength(2);
  });
  it("handles empty input", () => {
    expect(aggregateColorCoverages([])).toEqual([]);
    expect(topColorsByArea([], 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink CMYK channel separation", () => {
  it("weights each channel by color's CMYK components", () => {
    // Pure cyan: cmyk = {1, 0, 0, 0}, area 100 → c=100, m=0, y=0, k=0
    const c = cmykChannelAreas([color(0, 255, 255, 100)]);
    expect(c.c).toBeCloseTo(100, 5);
    expect(c.m).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
    expect(c.k).toBeCloseTo(0, 5);
  });
  it("sums across multiple colors", () => {
    // Cyan + Magenta: c = 100*1 + 100*0 = 100; m = 100*0 + 100*1 = 100
    const c = cmykChannelAreas([
      color(0, 255, 255, 100),
      color(255, 0, 255, 100),
    ]);
    expect(c.c).toBeCloseTo(100, 5);
    expect(c.m).toBeCloseTo(100, 5);
    expect(c.y).toBeCloseTo(0, 5);
    expect(c.k).toBeCloseTo(0, 5);
  });
  it("black contributes only to K", () => {
    const c = cmykChannelAreas([color(0, 0, 0, 200)]);
    expect(c.c).toBe(0);
    expect(c.m).toBe(0);
    expect(c.y).toBe(0);
    expect(c.k).toBe(200);
  });
  it("returns zeros for empty input", () => {
    const c = cmykChannelAreas([]);
    expect(c).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink volume & cost estimation", () => {
  it("estimates ink volume from area", () => {
    // 72000 sq pt = 72000 / (2.834^2) sq mm = ~8957 sq mm × 0.01 = 89.57 mm3 = 0.0896 ml
    const v = estimateInkVolume(72000);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
  it("returns 0 for zero area", () => {
    expect(estimateInkVolume(0)).toBe(0);
  });
  it("calculates cost from per-channel volume", () => {
    const v: CMYKColor = { c: 1, m: 1, y: 1, k: 1 };
    const cost: CMYKColor = { c: 0.05, m: 0.06, y: 0.07, k: 0.08 };
    // 1*0.05 + 1*0.06 + 1*0.07 + 1*0.08 = 0.26 cents
    expect(estimateCost(v, cost)).toBe(0.26);
  });
  it("handles zero volume", () => {
    expect(estimateCost({ c: 0, m: 0, y: 0, k: 0 }, { c: 0.05, m: 0.06, y: 0.07, k: 0.08 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink analyzePage", () => {
  it("produces a full PageInkAnalysis from raw stats", () => {
    const s = stats(1, 612, 792, 1000, 12, 5000, 10000, [
      color(0, 0, 0, 5000),
      color(255, 0, 0, 3000),
    ]);
    const cost = { c: 0.05, m: 0.06, y: 0.07, k: 0.08 };
    const a = analyzePage(s, cost);
    expect(a.pageNumber).toBe(1);
    expect(a.pageArea).toBe(612 * 792);
    expect(a.totalCoveragePct).toBeGreaterThan(0);
    expect(a.totalCoveragePct).toBeLessThanOrEqual(100);
    expect(a.k).toBeGreaterThan(0);
    expect(a.isColor).toBe(true);
    expect(a.isGrayscale).toBe(false);
    expect(a.distinctColorCount).toBe(2);
    expect(a.inkVolumeMl).toBeGreaterThan(0);
    expect(a.costCents).toBeGreaterThanOrEqual(0);
    expect(a.topColors.length).toBeGreaterThan(0);
  });
  it("marks pure grayscale page correctly", () => {
    const s = stats(1, 100, 100, 0, 0, 100, 0, [color(0, 0, 0, 100)]);
    const a = analyzePage(s, { c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
    expect(a.isColor).toBe(false);
    expect(a.isGrayscale).toBe(true);
  });
  it("caps total coverage to 100%", () => {
    const s = stats(1, 100, 100, 100000, 100, 100000, 100000, []);
    const a = analyzePage(s, { c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
    expect(a.totalCoveragePct).toBe(100);
  });
  it("handles empty page", () => {
    const s = stats(1, 612, 792, 0, 0, 0, 0, []);
    const a = analyzePage(s, { c: 0.05, m: 0.06, y: 0.07, k: 0.08 });
    expect(a.totalCoveragePct).toBe(0);
    expect(a.k).toBe(0);
    expect(a.inkVolumeMl).toBe(0);
    expect(a.costCents).toBe(0);
    expect(a.isColor).toBe(false);
    expect(a.isGrayscale).toBe(true);
    expect(a.distinctColorCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink heavy-usage detector & ranking", () => {
  const pages = [
    { pageNumber: 1, pageArea: 10000, textCoveragePct: 20, graphicsCoveragePct: 5, imageCoveragePct: 5, totalCoveragePct: 30, c: 10, m: 10, y: 10, k: 30, isColor: true, isGrayscale: false, inkVolumeMl: 0.01, costCents: 0.5, distinctColorCount: 3, topColors: [] },
    { pageNumber: 2, pageArea: 10000, textCoveragePct: 60, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 60, c: 5, m: 5, y: 5, k: 60, isColor: false, isGrayscale: true, inkVolumeMl: 0.02, costCents: 1.5, distinctColorCount: 1, topColors: [] },
    { pageNumber: 3, pageArea: 10000, textCoveragePct: 80, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 80, c: 0, m: 0, y: 0, k: 80, isColor: false, isGrayscale: true, inkVolumeMl: 0.03, costCents: 2.5, distinctColorCount: 1, topColors: [] },
  ] as PageInkAnalysis[];

  it("filters pages at or above threshold", () => {
    const heavy = detectHeavyUsage([...pages], 50);
    expect(heavy).toHaveLength(2);
    expect(heavy[0].pageNumber).toBe(2);
    expect(heavy[1].pageNumber).toBe(3);
  });
  it("returns empty for high threshold", () => {
    expect(detectHeavyUsage([...pages], 90)).toHaveLength(0);
  });
  it("ranks pages by cost descending", () => {
    const ranked = rankByCost([...pages]);
    expect(ranked[0].pageNumber).toBe(3);
    expect(ranked[1].pageNumber).toBe(2);
    expect(ranked[2].pageNumber).toBe(1);
  });
  it("does not mutate input", () => {
    const orig = [...pages];
    rankByCost([...pages]);
    expect(pages).toEqual(orig);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink summary stats", () => {
  it("computes aggregates across pages", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 20, graphicsCoveragePct: 5, imageCoveragePct: 5, totalCoveragePct: 30, c: 10, m: 10, y: 10, k: 30, isColor: true, isGrayscale: false, inkVolumeMl: 0.01, costCents: 0.5, distinctColorCount: 3, topColors: [] },
      { pageNumber: 2, pageArea: 10000, textCoveragePct: 60, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 60, c: 5, m: 5, y: 5, k: 60, isColor: false, isGrayscale: true, inkVolumeMl: 0.02, costCents: 1.5, distinctColorCount: 1, topColors: [] },
    ] as PageInkAnalysis[];
    const s = computeSummaryStats([...pages], 50);
    expect(s.totalPages).toBe(2);
    expect(s.pageAreaTotal).toBe(20000);
    expect(s.avgCoveragePct).toBe(45);
    expect(s.maxCoveragePct).toBe(60);
    expect(s.minCoveragePct).toBe(30);
    expect(s.avgC).toBe(7.5);
    expect(s.colorPages).toBe(1);
    expect(s.grayscalePages).toBe(1);
    expect(s.heavyPages).toBe(1);
    expect(s.totalInkVolumeMl).toBeCloseTo(0.03, 6);
    expect(s.totalCostCents).toBeCloseTo(2.0, 4);
  });
  it("handles empty input", () => {
    const s = computeSummaryStats([], 50);
    expect(s.totalPages).toBe(0);
    expect(s.avgCoveragePct).toBe(0);
    expect(s.totalCostCents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink histogram", () => {
  it("builds 10 buckets", () => {
    const h = buildHistogram([]);
    expect(h).toHaveLength(10);
    expect(h[0].lower).toBe(0);
    expect(h[9].upper).toBe(100);
  });
  it("distributes pages across buckets", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 5, c: 0, m: 0, y: 0, k: 0, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 0, topColors: [] },
      { pageNumber: 2, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 25, c: 0, m: 0, y: 0, k: 0, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 0, topColors: [] },
      { pageNumber: 3, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 95, c: 0, m: 0, y: 0, k: 0, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 0, topColors: [] },
    ] as PageInkAnalysis[];
    const h = buildHistogram([...pages]);
    expect(h[0].count).toBe(1); // 5% → bucket 0
    expect(h[0].pageNumbers).toContain(1);
    expect(h[2].count).toBe(1); // 25% → bucket 2
    expect(h[2].pageNumbers).toContain(2);
    expect(h[9].count).toBe(1); // 95% → bucket 9
    expect(h[9].pageNumbers).toContain(3);
  });
  it("clamps coverage to 0-100", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 200, c: 0, m: 0, y: 0, k: 0, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 0, topColors: [] },
    ] as PageInkAnalysis[];
    const h = buildHistogram([...pages]);
    expect(h[9].count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink recommendations", () => {
  it("flags heavy pages with channel recommendation", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 75, c: 5, m: 5, y: 5, k: 75, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 1, topColors: [] },
    ] as PageInkAnalysis[];
    const recs = generateRecommendations([...pages], 50);
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe("warn");
    expect(recs[0].message).toContain("Black");
  });
  it("flags critical pages at 80%+", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 90, c: 90, m: 0, y: 0, k: 0, isColor: true, isGrayscale: false, inkVolumeMl: 0, costCents: 0, distinctColorCount: 1, topColors: [] },
    ] as PageInkAnalysis[];
    const recs = generateRecommendations([...pages], 50);
    expect(recs[0].severity).toBe("critical");
    expect(recs[0].message).toContain("Cyan");
  });
  it("flags heavy-K pages below threshold", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 30, c: 0, m: 0, y: 0, k: 50, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 1, topColors: [] },
    ] as PageInkAnalysis[];
    const recs = generateRecommendations([...pages], 80);
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe("warn");
    expect(recs[0].message).toContain("Black");
  });
  it("flags image-dominant pages", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 0, graphicsCoveragePct: 0, imageCoveragePct: 75, totalCoveragePct: 35, c: 5, m: 5, y: 5, k: 5, isColor: true, isGrayscale: false, inkVolumeMl: 0, costCents: 0, distinctColorCount: 5, topColors: [] },
    ] as PageInkAnalysis[];
    const recs = generateRecommendations([...pages], 80);
    expect(recs).toHaveLength(1);
    expect(recs[0].message).toContain("image");
  });
  it("returns empty for clean pages", () => {
    const pages = [
      { pageNumber: 1, pageArea: 10000, textCoveragePct: 5, graphicsCoveragePct: 0, imageCoveragePct: 0, totalCoveragePct: 5, c: 1, m: 1, y: 1, k: 2, isColor: false, isGrayscale: true, inkVolumeMl: 0, costCents: 0, distinctColorCount: 1, topColors: [] },
    ] as PageInkAnalysis[];
    expect(generateRecommendations([...pages], 50)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink renderers", () => {
  const pages = [
    { pageNumber: 1, pageArea: 10000, textCoveragePct: 20, graphicsCoveragePct: 5, imageCoveragePct: 5, totalCoveragePct: 30, c: 10, m: 10, y: 10, k: 30, isColor: true, isGrayscale: false, inkVolumeMl: 0.001, costCents: 0.5, distinctColorCount: 3, topColors: [{ color: { r: 255, g: 0, b: 0 }, hex: "#ff0000", area: 1000, cmyk: { c: 0, m: 1, y: 1, k: 0 } }] },
  ];
  const summary = {
    totalPages: 1, pageAreaTotal: 10000, avgCoveragePct: 30, maxCoveragePct: 30, minCoveragePct: 30,
    avgC: 10, avgM: 10, avgY: 10, avgK: 30, totalInkVolumeMl: 0.001, totalCostCents: 0.5,
    colorPages: 1, grayscalePages: 0, heavyPages: 0,
  };

  it("renders text report with header and page block", () => {
    const txt = renderTextReport(pages, summary, "per-page");
    expect(txt).toContain("PDF Ink Coverage Report");
    expect(txt).toContain("Pages analyzed: 1");
    expect(txt).toContain("--- Page 1 ---");
    expect(txt).toContain("Total coverage:");
  });
  it("omits per-page block in total-document mode", () => {
    const txt = renderTextReport(pages, summary, "total-document");
    expect(txt).toContain("Total-document mode");
    expect(txt).not.toContain("--- Page 1 ---");
  });
  it("renders CSV with header row", () => {
    const csv = renderCsvReport(pages);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("page,total_pct,text_pct,graphics_pct,image_pct,c_pct,m_pct,y_pct,k_pct,volume_ml,cost_cents,color_page,distinct_colors");
    expect(lines[1].split(",")[0]).toBe("1");
  });
  it("renders HTML report with bars", () => {
    const html = renderHtmlReport(pages, summary, "per-page");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("PDF Ink Coverage Report");
    expect(html).toContain("bar-fill");
    expect(html).toContain("Page 1");
  });
  it("includes cost in cents and color/grayscale classification", () => {
    const html = renderHtmlReport(pages, summary, "per-page");
    expect(html).toContain("color");
    expect(html).toContain("0.50¢");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 5, analysisMode: "per-page", avgCoveragePct: 30, totalCostCents: 1.5 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.pdf");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, pageCount: 1, analysisMode: "per-page", avgCoveragePct: i, totalCostCents: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, analysisMode: "per-page", avgCoveragePct: 1, totalCostCents: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink shareable URL", () => {
  it("builds share URL with non-default options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      analysisMode: "per-channel-cmyk",
      pageRange: "1-3",
      inkCostPerMl: "0.10,0.20,0.30,0.40",
      coverageThreshold: 75,
      includeImages: false,
    });
    expect(url).toContain("mode=per-channel-cmyk");
    expect(url).toContain("range=1-3");
    expect(url).toContain("cost=0.10");
    expect(url).toContain("threshold=75");
    expect(url).toContain("images=0");
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
    const p = parseShareUrl("mode=per-color&range=1-3&threshold=80&images=0");
    expect(p.analysisMode).toBe("per-color");
    expect(p.pageRange).toBe("1-3");
    expect(p.coverageThreshold).toBe(80);
    expect(p.includeImages).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown mode", () => {
    const p = parseShareUrl("mode=invalid");
    expect(p.analysisMode).toBeUndefined();
  });
  it("clamps threshold to 0-100", () => {
    expect(parseShareUrl("threshold=150").coverageThreshold).toBe(100);
    expect(parseShareUrl("threshold=-5").coverageThreshold).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-ink validateOptions", () => {
  const valid: InkOptions = {
    analysisMode: "per-page",
    pageRange: "1-3",
    inkCostPerMl: "0.05,0.06,0.07,0.08",
    coverageThreshold: 50,
    includeImages: true,
  };
  it("accepts valid options", () => {
    const r = validateOptions(valid, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageRange).toBe("1-3");
  });
  it("accepts 'all'", () => {
    const r = validateOptions({ ...valid, pageRange: "all" }, 10);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown mode", () => {
    const r = validateOptions({ ...valid, analysisMode: "weird" as AnalysisMode }, 10);
    expect(r.ok).toBe(false);
  });
  it("rejects out-of-range threshold", () => {
    expect(validateOptions({ ...valid, coverageThreshold: -1 }, 10).ok).toBe(false);
    expect(validateOptions({ ...valid, coverageThreshold: 101 }, 10).ok).toBe(false);
  });
  it("rejects malformed range", () => {
    const r = validateOptions({ ...valid, pageRange: "abc" }, 10);
    expect(r.ok).toBe(false);
  });
});
