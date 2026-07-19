import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  CONVERSION_METHODS,
  DITHERING_MODES,
  METHOD_LABELS,
  normalizeRgb,
  rgbToLuminance,
  rgbToAverage,
  rgbToLightness,
  rgbToDesaturate,
  rgbToCustomWeighted,
  parseCustomWeights,
  convertWithMethod,
  applyThreshold,
  preserveBlack,
  preserveWhite,
  colorDistance,
  estimateInkUsage,
  computeInkSavings,
  analyzePageColors,
  compareBeforeAfter,
  buildHistogram,
  buildBeforeAfterHistogram,
  generateFloydSteinberg,
  generateOrderedDither,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type ConversionMethod,
  type DitheringMode,
  type RGBColor,
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

describe("pdf-grayscale-converter constants", () => {
  it("exposes 5 conversion methods", () => {
    expect(CONVERSION_METHODS).toHaveLength(5);
    expect(CONVERSION_METHODS).toContain("luminance");
    expect(CONVERSION_METHODS).toContain("custom-weighted");
  });
  it("exposes 3 dithering modes", () => {
    expect(DITHERING_MODES).toHaveLength(3);
    expect(DITHERING_MODES).toContain("none");
    expect(DITHERING_MODES).toContain("floyd-steinberg");
    expect(DITHERING_MODES).toContain("ordered");
  });
  it("has labels for all methods", () => {
    expect(Object.keys(METHOD_LABELS)).toHaveLength(5);
    expect(METHOD_LABELS.luminance).toContain("NTSC");
  });
  it("default options are luminance / preserve on / threshold -1 / dithering none", () => {
    expect(DEFAULT_OPTIONS.method).toBe("luminance");
    expect(DEFAULT_OPTIONS.preserveBlack).toBe(true);
    expect(DEFAULT_OPTIONS.preserveWhite).toBe(true);
    expect(DEFAULT_OPTIONS.threshold).toBe(-1);
    expect(DEFAULT_OPTIONS.dithering).toBe("none");
  });
});

describe("pdf-grayscale-converter normalizeRgb", () => {
  it("clamps and rounds", () => {
    expect(normalizeRgb({ r: -10, g: 300, b: 12.7 })).toEqual({ r: 0, g: 255, b: 13 });
  });
});

describe("pdf-grayscale-converter conversions", () => {
  it("rgbToLuminance uses NTSC weights", () => {
    expect(rgbToLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(rgbToLuminance({ r: 255, g: 255, b: 255 })).toBe(255);
    expect(rgbToLuminance({ r: 255, g: 0, b: 0 })).toBe(76); // 0.299 * 255 ≈ 76
  });
  it("rgbToAverage is simple mean", () => {
    expect(rgbToAverage({ r: 30, g: 60, b: 90 })).toBe(60);
    expect(rgbToAverage({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it("rgbToLightness is (max+min)/2", () => {
    expect(rgbToLightness({ r: 0, g: 100, b: 200 })).toBe(100);
    expect(rgbToLightness({ r: 255, g: 255, b: 255 })).toBe(255);
  });
  it("rgbToDesaturate equals rgbToLightness", () => {
    const c = { r: 50, g: 100, b: 200 };
    expect(rgbToDesaturate(c)).toBe(rgbToLightness(c));
  });
  it("rgbToCustomWeighted applies weights", () => {
    expect(rgbToCustomWeighted({ r: 100, g: 200, b: 50 }, { r: 0.5, g: 0.25, b: 0.25 }))
      .toBe(113); // 50 + 50 + 12.5 = 112.5 → 113
  });
  it("parseCustomWeights parses valid input", () => {
    expect(parseCustomWeights("0.4, 0.4, 0.2")).toEqual({ r: 0.4, g: 0.4, b: 0.2 });
    expect(parseCustomWeights("0.299 0.587 0.114")).toEqual({ r: 0.299, g: 0.587, b: 0.114 });
  });
  it("parseCustomWeights rejects invalid input", () => {
    expect(parseCustomWeights("")).toBeNull();
    expect(parseCustomWeights("1,2")).toBeNull();
    expect(parseCustomWeights("a,b,c")).toBeNull();
    expect(parseCustomWeights("-1,0.5,0.5")).toBeNull();
  });
  it("convertWithMethod dispatches correctly", () => {
    const c = { r: 100, g: 100, b: 100 };
    expect(convertWithMethod(c, "average")).toBe(100);
    expect(convertWithMethod(c, "lightness")).toBe(100);
    expect(convertWithMethod(c, "luminance")).toBe(100);
    expect(convertWithMethod(c, "custom-weighted", { r: 0.5, g: 0.3, b: 0.2 })).toBe(100);
  });
  it("convertWithMethod custom without weights falls back to luminance", () => {
    const c = { r: 255, g: 0, b: 0 };
    expect(convertWithMethod(c, "custom-weighted")).toBe(rgbToLuminance(c));
  });
});

describe("pdf-grayscale-converter threshold & preserve", () => {
  it("applyThreshold returns 255 above threshold", () => {
    expect(applyThreshold(200, 128)).toBe(255);
    expect(applyThreshold(50, 128)).toBe(0);
    expect(applyThreshold(128, 128)).toBe(255);
  });
  it("applyThreshold defaults to 128 when out of range", () => {
    expect(applyThreshold(200, -1)).toBe(255);
    expect(applyThreshold(50, -1)).toBe(0);
    expect(applyThreshold(50, 999)).toBe(0);
  });
  it("preserveBlack keeps pure black as 0", () => {
    expect(preserveBlack({ r: 0, g: 0, b: 0 }, 128, true)).toBe(0);
    expect(preserveBlack({ r: 0, g: 0, b: 0 }, 128, false)).toBe(128);
    expect(preserveBlack({ r: 1, g: 1, b: 1 }, 128, true)).toBe(128);
  });
  it("preserveWhite keeps pure white as 255", () => {
    expect(preserveWhite({ r: 255, g: 255, b: 255 }, 128, true)).toBe(255);
    expect(preserveWhite({ r: 255, g: 255, b: 255 }, 128, false)).toBe(128);
    expect(preserveWhite({ r: 254, g: 254, b: 254 }, 128, true)).toBe(128);
  });
});

describe("pdf-grayscale-converter distance & ink", () => {
  it("colorDistance is Euclidean", () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 0, b: 0 })).toBeCloseTo(255);
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBeCloseTo(5);
  });
  it("estimateInkUsage averages ink coverage", () => {
    expect(estimateInkUsage([0, 0, 0])).toBe(100);
    expect(estimateInkUsage([255, 255, 255])).toBe(0);
    expect(estimateInkUsage([0, 255])).toBe(50);
    expect(estimateInkUsage([])).toBe(0);
  });
  it("computeInkSavings returns percentage saved", () => {
    expect(computeInkSavings(100, 50)).toBe(50);
    expect(computeInkSavings(50, 50)).toBe(0);
    expect(computeInkSavings(50, 100)).toBe(-100);
    expect(computeInkSavings(0, 0)).toBe(0);
  });
});

describe("pdf-grayscale-converter analyzePageColors", () => {
  it("counts unique colors", () => {
    const a = analyzePageColors([
      { r: 1, g: 1, b: 1 }, { r: 1, g: 1, b: 1 }, { r: 2, g: 2, b: 2 },
    ]);
    expect(a.uniqueColorCount).toBe(2);
  });
  it("returns top colors sorted by count", () => {
    const a = analyzePageColors([
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
    ]);
    expect(a.topColors).toHaveLength(2);
    expect(a.topColors[0].count).toBe(2);
    expect(a.topColors[0].hex).toBe("#ff0000");
  });
  it("respects topN", () => {
    const a = analyzePageColors(
      [{ r: 1, g: 0, b: 0 }, { r: 2, g: 0, b: 0 }, { r: 3, g: 0, b: 0 }],
      2,
    );
    expect(a.topColors).toHaveLength(2);
  });
});

describe("pdf-grayscale-converter compareBeforeAfter", () => {
  it("computes distance stats", () => {
    const before: RGBColor[] = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
    ];
    const after: RGBColor[] = [
      { r: 76, g: 76, b: 76 },
      { r: 150, g: 150, b: 150 },
    ];
    const c = compareBeforeAfter(before, after);
    expect(c.totalColors).toBe(2);
    expect(c.changedColors).toBe(2);
    expect(c.avgColorDistance).toBeGreaterThan(0);
    expect(c.maxColorDistance).toBeGreaterThan(0);
  });
  it("returns zeros for empty input", () => {
    const c = compareBeforeAfter([], []);
    expect(c.totalColors).toBe(0);
    expect(c.changedColors).toBe(0);
  });
});

describe("pdf-grayscale-converter histogram", () => {
  it("buildHistogram bins values", () => {
    const h = buildHistogram([0, 0, 100, 200, 255], 4);
    expect(h).toHaveLength(4);
    expect(h[0].count).toBe(2); // 0,0 in [0,64)
    expect(h[1].count).toBe(1); // 100 in [64,128)
    expect(h[3].count).toBe(2); // 200, 255 in [192,256)
  });
  it("buildBeforeAfterHistogram returns both", () => {
    const hist = buildBeforeAfterHistogram([0, 100, 200], [50, 150, 250], 4);
    expect(hist.before).toHaveLength(4);
    expect(hist.after).toHaveLength(4);
    expect(hist.before[0].count).toBe(1);
    expect(hist.after[3].count).toBe(1);
  });
});

describe("pdf-grayscale-converter dithering", () => {
  it("generateFloydSteinberg returns 0/255 values", () => {
    const out = generateFloydSteinberg([0, 50, 200, 255], 128);
    expect(out).toHaveLength(4);
    for (const v of out) expect(v === 0 || v === 255).toBe(true);
  });
  it("generateFloydSteinberg preserves extreme values", () => {
    const out = generateFloydSteinberg([0, 255], 128);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(255);
  });
  it("generateFloydSteinberg returns empty for empty input", () => {
    expect(generateFloydSteinberg([], 128)).toEqual([]);
  });
  it("generateOrderedDither returns 0/255 values", () => {
    const out = generateOrderedDither([0, 50, 200, 255, 100, 100, 100, 100], 128);
    expect(out).toHaveLength(8);
    for (const v of out) expect(v === 0 || v === 255).toBe(true);
  });
  it("generateOrderedDither preserves extreme values", () => {
    const out = generateOrderedDither([0, 255], 128);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(255);
  });
});

describe("pdf-grayscale-converter summary stats", () => {
  it("aggregates page stats", () => {
    const page1: PageConversionStatsLike = {
      pageNumber: 1,
      originalColorCount: 10,
      uniqueOriginalColors: 5,
      grayscaleColorCount: 3,
      inkBefore: 60,
      inkAfter: 30,
      inkSavedPercent: 50,
      topColorsBefore: [],
      topColorsAfter: [],
    };
    const page2: PageConversionStatsLike = {
      pageNumber: 2,
      originalColorCount: 20,
      uniqueOriginalColors: 8,
      grayscaleColorCount: 4,
      inkBefore: 70,
      inkAfter: 35,
      inkSavedPercent: 50,
      topColorsBefore: [],
      topColorsAfter: [],
    };
    const stats = computeSummaryStats([page1, page2] as never, DEFAULT_OPTIONS);
    expect(stats.totalPages).toBe(2);
    expect(stats.totalColorsConverted).toBe(30);
    expect(stats.uniqueColorsBefore).toBe(13);
    expect(stats.uniqueColorsAfter).toBe(7);
    expect(stats.totalInkSavedPercent).toBe(50);
  });
});

describe("pdf-grayscale-converter renderers", () => {
  it("renderTextReport includes method and page info", () => {
    const stats = computeSummaryStats([], DEFAULT_OPTIONS);
    const txt = renderTextReport([], stats);
    expect(txt).toContain("PDF Grayscale Conversion Report");
    expect(txt).toContain("Method: luminance");
    expect(txt).toContain("Threshold: off (grayscale only)");
  });
  it("renderCsv has header and rows", () => {
    const csv = renderCsv([
      {
        pageNumber: 1, originalColorCount: 5, uniqueOriginalColors: 3,
        grayscaleColorCount: 2, inkBefore: 60, inkAfter: 30, inkSavedPercent: 50,
        topColorsBefore: [], topColorsAfter: [],
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("page,original_colors,grayscale_colors,ink_before,ink_after,ink_saved_percent");
    expect(lines[1]).toBe("1,5,2,60,30,50");
  });
});

describe("pdf-grayscale-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "x.pdf", pageCount: 3,
      method: "luminance", threshold: -1, inkSavedPercent: 25.5,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: "x.pdf", pageCount: 1,
        method: "average", threshold: 128, inkSavedPercent: 50,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "x.pdf", pageCount: 1,
      method: "desaturate", threshold: -1, inkSavedPercent: 10,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-grayscale-converter shareable URL", () => {
  it("builds share URL with default options (no params)", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).toBe("?");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with non-default options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      method: "average",
      preserveBlack: false,
      preserveWhite: false,
      threshold: 128,
      dithering: "floyd-steinberg",
    });
    expect(url).toContain("m=average");
    expect(url).toContain("pb=0");
    expect(url).toContain("pw=0");
    expect(url).toContain("t=128");
    expect(url).toContain("d=floyd-steinberg");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with custom weights", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      method: "custom-weighted",
      preserveBlack: true,
      preserveWhite: true,
      threshold: -1,
      dithering: "none",
      customWeights: { r: 0.4, g: 0.4, b: 0.2 },
    });
    expect(url).toContain("m=custom-weighted");
    expect(url).toContain("w=0.4%2C0.4%2C0.2");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("m=average&pb=0&pw=0&t=128&d=floyd-steinberg");
    expect(p.method).toBe("average");
    expect(p.preserveBlack).toBe(false);
    expect(p.preserveWhite).toBe(false);
    expect(p.threshold).toBe(128);
    expect(p.dithering).toBe("floyd-steinberg");
  });
  it("parses custom weights", () => {
    const p = parseShareUrl("m=custom-weighted&w=0.4,0.4,0.2");
    expect(p.method).toBe("custom-weighted");
    expect(p.customWeights).toEqual({ r: 0.4, g: 0.4, b: 0.2 });
  });
  it("ignores invalid values", () => {
    const p = parseShareUrl("m=invalid&d=invalid&t=abc&w=bad");
    expect(p.method).toBeUndefined();
    expect(p.dithering).toBeUndefined();
    expect(p.threshold).toBeUndefined();
    expect(p.customWeights).toBeUndefined();
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("pdf-grayscale-converter validateOptions", () => {
  it("accepts default options", () => {
    expect(validateOptions(DEFAULT_OPTIONS).ok).toBe(true);
  });
  it("rejects unknown method", () => {
    const r = validateOptions({
      method: "weird" as ConversionMethod,
      preserveBlack: true, preserveWhite: true,
      threshold: -1, dithering: "none",
    });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown dithering", () => {
    const r = validateOptions({
      method: "luminance",
      preserveBlack: true, preserveWhite: true,
      threshold: -1, dithering: "weird" as DitheringMode,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects custom-weighted without weights", () => {
    const r = validateOptions({
      method: "custom-weighted",
      preserveBlack: true, preserveWhite: true,
      threshold: -1, dithering: "none",
    });
    expect(r.ok).toBe(false);
  });
  it("rejects custom-weighted with negative weights", () => {
    const r = validateOptions({
      method: "custom-weighted",
      preserveBlack: true, preserveWhite: true,
      threshold: -1, dithering: "none",
      customWeights: { r: -1, g: 0.5, b: 0.5 },
    });
    expect(r.ok).toBe(false);
  });
  it("rejects out-of-range threshold", () => {
    const r = validateOptions({
      method: "luminance",
      preserveBlack: true, preserveWhite: true,
      threshold: 999, dithering: "none",
    });
    expect(r.ok).toBe(false);
  });
  it("accepts valid custom weights", () => {
    const r = validateOptions({
      method: "custom-weighted",
      preserveBlack: true, preserveWhite: true,
      threshold: -1, dithering: "none",
      customWeights: { r: 0.4, g: 0.4, b: 0.2 },
    });
    expect(r.ok).toBe(true);
  });
});

// Helper type used only in tests to avoid repetition.
interface PageConversionStatsLike {
  pageNumber: number;
  originalColorCount: number;
  uniqueOriginalColors: number;
  grayscaleColorCount: number;
  inkBefore: number;
  inkAfter: number;
  inkSavedPercent: number;
  topColorsBefore: { color: RGBColor; count: number; hex: string }[];
  topColorsAfter: { value: number; count: number }[];
}
