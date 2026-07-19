import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  CHANNEL_LABELS,
  CHANNEL_TINTS,
  SEPARATION_MODES,
  OUTPUT_FORMATS,
  clampRgb,
  rgbToCmyk,
  cmykToRgb,
  cmykChannelIntensity,
  rgbChannelIntensity,
  grayscaleIntensity,
  channelIntensityFor,
  channelsForMode,
  computeChannelIntensities,
  topColors,
  rgbToHex,
  hexToRgb,
  countUniqueColors,
  analyzePageColors,
  computeInkCoverage,
  coveragePercentage,
  generateChannelLabel,
  generateRegistrationMarks,
  splitPageIntoChannels,
  generateChannelPreview,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  crc32,
  utf8Encode,
  buildZip,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type SeparationMode,
  type OutputFormat,
  type ChannelId,
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

describe("pdf-color-separation constants", () => {
  it("exposes 4 separation modes", () => {
    expect(SEPARATION_MODES).toHaveLength(4);
    expect(SEPARATION_MODES).toContain("cmyk-4-channels");
    expect(SEPARATION_MODES).toContain("custom");
  });
  it("exposes 3 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(3);
    expect(OUTPUT_FORMATS).toContain("separate-pdfs");
    expect(OUTPUT_FORMATS).toContain("combined-pdf");
    expect(OUTPUT_FORMATS).toContain("side-by-side");
  });
  it("has labels for 8 channels", () => {
    expect(Object.keys(CHANNEL_LABELS)).toHaveLength(8);
    expect(CHANNEL_LABELS.cyan).toBe("Cyan");
    expect(CHANNEL_LABELS.black).toBe("Black");
  });
  it("has RGB tints for every channel", () => {
    for (const ch of Object.keys(CHANNEL_LABELS) as ChannelId[]) {
      const t = CHANNEL_TINTS[ch];
      expect(t).toBeDefined();
      expect(t.r).toBeGreaterThanOrEqual(0);
      expect(t.b).toBeGreaterThanOrEqual(0);
    }
  });
  it("default options are CMYK / separate / labels + marks on", () => {
    expect(DEFAULT_OPTIONS.mode).toBe("cmyk-4-channels");
    expect(DEFAULT_OPTIONS.outputFormat).toBe("separate-pdfs");
    expect(DEFAULT_OPTIONS.channelLabel).toBe(true);
    expect(DEFAULT_OPTIONS.includeRegistrationMarks).toBe(true);
  });
});

describe("pdf-color-separation clampRgb", () => {
  it("clamps out-of-range values", () => {
    expect(clampRgb({ r: -10, g: 300, b: 128 })).toEqual({ r: 0, g: 255, b: 128 });
  });
  it("rounds floats", () => {
    expect(clampRgb({ r: 12.7, g: 99.4, b: 0 })).toEqual({ r: 13, g: 99, b: 0 });
  });
});

describe("pdf-color-separation rgbToCmyk / cmykToRgb", () => {
  it("converts pure white to all-zero CMYK (k=0)", () => {
    const c = rgbToCmyk({ r: 255, g: 255, b: 255 });
    expect(c.c).toBeCloseTo(0);
    expect(c.m).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.k).toBeCloseTo(0);
  });
  it("converts pure black to c=m=y=0, k=1", () => {
    const c = rgbToCmyk({ r: 0, g: 0, b: 0 });
    expect(c.c).toBe(0);
    expect(c.m).toBe(0);
    expect(c.y).toBe(0);
    expect(c.k).toBe(1);
  });
  it("converts pure cyan (0,255,255) to c=1, m=0, y=0, k=0", () => {
    const c = rgbToCmyk({ r: 0, g: 255, b: 255 });
    expect(c.c).toBeCloseTo(1);
    expect(c.m).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.k).toBeCloseTo(0);
  });
  it("round-trips an arbitrary color", () => {
    const orig: RGBColor = { r: 100, g: 175, b: 50 };
    const back = cmykToRgb(rgbToCmyk(orig));
    expect(back.r).toBeGreaterThan(80);
    expect(back.r).toBeLessThan(120);
    expect(back.g).toBeGreaterThan(160);
    expect(back.g).toBeLessThan(190);
  });
});

describe("pdf-color-separation channel intensities", () => {
  it("cmykChannelIntensity returns C for cyan", () => {
    expect(cmykChannelIntensity({ r: 0, g: 255, b: 255 }, "cyan")).toBeCloseTo(1);
  });
  it("cmykChannelIntensity returns 0 for non-CMYK channel", () => {
    expect(cmykChannelIntensity({ r: 255, g: 0, b: 0 }, "red")).toBe(0);
  });
  it("rgbChannelIntensity returns R/255 for red", () => {
    expect(rgbChannelIntensity({ r: 255, g: 0, b: 0 }, "red")).toBeCloseTo(1);
    expect(rgbChannelIntensity({ r: 0, g: 128, b: 0 }, "green")).toBeCloseTo(128 / 255);
  });
  it("grayscaleIntensity uses NTSC weights", () => {
    expect(grayscaleIntensity({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
    expect(grayscaleIntensity({ r: 0, g: 0, b: 0 })).toBeCloseTo(0);
    expect(grayscaleIntensity({ r: 100, g: 100, b: 100 })).toBeCloseTo(100 / 255, 1);
  });
  it("channelIntensityFor dispatches to the right space", () => {
    expect(channelIntensityFor({ r: 0, g: 255, b: 255 }, "cyan")).toBeCloseTo(1);
    expect(channelIntensityFor({ r: 255, g: 0, b: 0 }, "red")).toBeCloseTo(1);
    expect(channelIntensityFor({ r: 128, g: 128, b: 128 }, "gray")).toBeCloseTo(128 / 255, 1);
  });
});

describe("pdf-color-separation channelsForMode", () => {
  it("returns 4 CMYK channels", () => {
    expect(channelsForMode("cmyk-4-channels")).toEqual(["cyan", "magenta", "yellow", "black"]);
  });
  it("returns 3 RGB channels", () => {
    expect(channelsForMode("rgb-3-channels")).toEqual(["red", "green", "blue"]);
  });
  it("returns 1 grayscale channel", () => {
    expect(channelsForMode("grayscale-1-channel")).toEqual(["gray"]);
  });
  it("returns custom channels when provided", () => {
    expect(channelsForMode("custom", ["cyan", "red"])).toEqual(["cyan", "red"]);
  });
  it("returns all 8 when custom has no picks", () => {
    expect(channelsForMode("custom", [])).toHaveLength(8);
  });
  it("dedupes custom channels", () => {
    expect(channelsForMode("custom", ["cyan", "cyan", "magenta"])).toEqual(["cyan", "magenta"]);
  });
});

describe("pdf-color-separation computeChannelIntensities", () => {
  it("returns zeros for empty color list", () => {
    const r = computeChannelIntensities([], ["cyan", "magenta"]);
    expect(r.cyan).toBe(0);
    expect(r.magenta).toBe(0);
  });
  it("averages intensities across colors", () => {
    const r = computeChannelIntensities(
      [{ r: 0, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }],
      ["cyan", "black"],
    );
    // cyan=1 for first, 0 for second → avg 0.5; black=0 for first, 1 for second → avg 0.5
    expect(r.cyan).toBeCloseTo(0.5);
    expect(r.black).toBeCloseTo(0.5);
  });
});

describe("pdf-color-separation color analysis", () => {
  it("topColors counts and sorts", () => {
    const colors = [
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
    ];
    const top = topColors(colors, 10);
    expect(top).toHaveLength(2);
    expect(top[0].count).toBe(2);
    expect(top[0].hex).toBe("#ff0000");
  });
  it("topColors respects n limit", () => {
    const colors = [
      { r: 1, g: 0, b: 0 }, { r: 2, g: 0, b: 0 }, { r: 3, g: 0, b: 0 },
    ];
    expect(topColors(colors, 2)).toHaveLength(2);
  });
  it("rgbToHex formats as #rrggbb", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
    expect(rgbToHex({ r: 18, g: 52, b: 86 })).toBe("#123456");
  });
  it("hexToRgb parses #rrggbb", () => {
    expect(hexToRgb("#123456")).toEqual({ r: 18, g: 52, b: 86 });
    expect(hexToRgb("123456")).toEqual({ r: 18, g: 52, b: 86 });
    expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("countUniqueColors counts distinct", () => {
    expect(countUniqueColors([{ r: 1, g: 1, b: 1 }, { r: 1, g: 1, b: 1 }, { r: 2, g: 2, b: 2 }])).toBe(2);
  });
  it("analyzePageColors produces full analysis", () => {
    const a = analyzePageColors(
      1,
      [{ r: 0, g: 255, b: 255 }, { r: 255, g: 0, b: 0 }],
      ["cyan", "magenta"],
    );
    expect(a.pageNumber).toBe(1);
    expect(a.uniqueColorCount).toBe(2);
    expect(a.channelIntensities.cyan).toBeGreaterThan(0);
    expect(a.topColors).toHaveLength(2);
  });
});

describe("pdf-color-separation ink coverage & labels", () => {
  it("computeInkCoverage multiplies intensity by area", () => {
    expect(computeInkCoverage(0.5, 1)).toBeCloseTo(50, 1);
    expect(computeInkCoverage(0.5, 0.5)).toBeCloseTo(25, 1);
  });
  it("clamps intensity above 1", () => {
    expect(computeInkCoverage(2, 1)).toBe(100);
  });
  it("coveragePercentage assumes full page", () => {
    expect(coveragePercentage(0)).toBe(0);
    expect(coveragePercentage(1)).toBe(100);
  });
  it("generateChannelLabel includes mode tag", () => {
    expect(generateChannelLabel("cyan", "cmyk-4-channels")).toBe("CMYK · Cyan");
    expect(generateChannelLabel("red", "rgb-3-channels")).toBe("RGB · Red");
    expect(generateChannelLabel("gray", "grayscale-1-channel")).toBe("GRAY · Gray");
    expect(generateChannelLabel("cyan", "custom")).toBe("CUSTOM · Cyan");
  });
});

describe("pdf-color-separation registration marks", () => {
  it("generates 5 marks (4 corners + center)", () => {
    const marks = generateRegistrationMarks(612, 792);
    expect(marks).toHaveLength(5);
    expect(marks.filter((m) => m.type === "cross")).toHaveLength(4);
    expect(marks.filter((m) => m.type === "circle")).toHaveLength(1);
  });
  it("center mark is at (w/2, h/2)", () => {
    const marks = generateRegistrationMarks(612, 792);
    const center = marks.find((m) => m.type === "circle");
    expect(center).toBeDefined();
    expect(center!.x).toBe(306);
    expect(center!.y).toBe(396);
  });
});

describe("pdf-color-separation splitPageIntoChannels & preview", () => {
  it("splits one page into N descriptors", () => {
    const a = analyzePageColors(1, [{ r: 0, g: 255, b: 255 }], ["cyan", "magenta", "yellow", "black"]);
    const splits = splitPageIntoChannels(a, ["cyan", "magenta", "yellow", "black"], "cmyk-4-channels");
    expect(splits).toHaveLength(4);
    expect(splits[0].channel).toBe("cyan");
    expect(splits[0].label).toContain("CMYK");
    expect(splits[0].inkCoverage).toBeGreaterThanOrEqual(0);
  });
  it("generateChannelPreview flattens pages × channels", () => {
    const a1 = analyzePageColors(1, [{ r: 0, g: 255, b: 255 }], ["cyan", "magenta"]);
    const a2 = analyzePageColors(2, [{ r: 255, g: 0, b: 0 }], ["cyan", "magenta"]);
    const preview = generateChannelPreview([a1, a2], ["cyan", "magenta"], "cmyk-4-channels");
    expect(preview).toHaveLength(4);
    expect(preview[0].pageNumber).toBe(1);
    expect(preview[2].pageNumber).toBe(2);
  });
});

describe("pdf-color-separation summary stats", () => {
  it("computes summary across pages", () => {
    const a1 = analyzePageColors(1, [{ r: 0, g: 255, b: 255 }], ["cyan", "magenta"]);
    const a2 = analyzePageColors(2, [{ r: 255, g: 0, b: 255 }], ["cyan", "magenta"]);
    const stats = computeSummaryStats([a1, a2], ["cyan", "magenta"]);
    expect(stats.totalPages).toBe(2);
    expect(stats.totalChannels).toBe(2);
    expect(stats.pagesPerChannel).toBe(2);
    expect(stats.avgIntensityByChannel.cyan).toBeGreaterThan(0);
    expect(stats.totalUniqueColors).toBe(2);
  });
});

describe("pdf-color-separation renderers", () => {
  it("renderTextReport includes headers and page info", () => {
    const a = analyzePageColors(1, [{ r: 0, g: 255, b: 255 }], ["cyan", "magenta"]);
    const txt = renderTextReport([a], ["cyan", "magenta"], "cmyk-4-channels");
    expect(txt).toContain("PDF Color Separation Report");
    expect(txt).toContain("Mode: cmyk-4-channels");
    expect(txt).toContain("--- Page 1 ---");
    expect(txt).toContain("Cyan");
  });
  it("renderCsv has header and one row per page × channel", () => {
    const a = analyzePageColors(1, [{ r: 0, g: 255, b: 255 }], ["cyan", "magenta"]);
    const csv = renderCsv([a], ["cyan", "magenta"]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("channel,page,intensity,color_count,ink_coverage_percent");
    expect(lines.length).toBe(3); // header + 2 rows
    expect(lines[1]).toContain("cyan,1,");
  });
});

describe("pdf-color-separation ZIP builder", () => {
  it("crc32 matches known value for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("crc32 is stable for the same input", () => {
    const a = utf8Encode("hello");
    expect(crc32(a)).toBe(crc32(a));
  });
  it("crc32 matches the standard value for 'hello'", () => {
    // Standard CRC-32 of "hello" = 0x3610a686 = 907060870
    expect(crc32(utf8Encode("hello"))).toBe(907060870);
  });
  it("buildZip produces a non-empty archive with correct signature", () => {
    const zip = buildZip([{ name: "a.txt", bytes: utf8Encode("hello") }]);
    expect(zip.length).toBeGreaterThan(0);
    // PK\x03\x04 signature
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });
  it("buildZip with multiple files has correct entry count in EOCD", () => {
    const zip = buildZip([
      { name: "a.txt", bytes: utf8Encode("aaa") },
      { name: "b.txt", bytes: utf8Encode("bbb") },
    ]);
    // EOCD record is the last 22 bytes (no comment). Entry count is at offset 10 from EOCD start.
    const eocdStart = zip.length - 22;
    const count = zip[eocdStart + 10] | (zip[eocdStart + 11] << 8);
    expect(count).toBe(2);
  });
});

describe("pdf-color-separation history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "x.pdf", pageCount: 3,
      mode: "cmyk-4-channels", outputFormat: "separate-pdfs", channelCount: 4,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: "x.pdf", pageCount: 1,
        mode: "rgb-3-channels", outputFormat: "combined-pdf", channelCount: 3,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "x.pdf", pageCount: 1,
      mode: "grayscale-1-channel", outputFormat: "side-by-side", channelCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-color-separation shareable URL", () => {
  it("builds share URL with default options (no params)", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).toBe("?"); // empty params
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with non-default options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "rgb-3-channels",
      outputFormat: "combined-pdf",
      channelLabel: false,
      includeRegistrationMarks: false,
    });
    expect(url).toContain("mode=rgb-3-channels");
    expect(url).toContain("fmt=combined-pdf");
    expect(url).toContain("label=0");
    expect(url).toContain("marks=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with custom channels", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "custom",
      outputFormat: "separate-pdfs",
      channelLabel: true,
      includeRegistrationMarks: true,
      customChannels: ["cyan", "red"],
    });
    expect(url).toContain("mode=custom");
    expect(url).toContain("ch=cyan%2Cred");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=rgb-3-channels&fmt=combined-pdf&label=0&marks=0");
    expect(p.mode).toBe("rgb-3-channels");
    expect(p.outputFormat).toBe("combined-pdf");
    expect(p.channelLabel).toBe(false);
    expect(p.includeRegistrationMarks).toBe(false);
  });
  it("parses custom channels", () => {
    const p = parseShareUrl("mode=custom&ch=cyan,magenta");
    expect(p.mode).toBe("custom");
    expect(p.customChannels).toEqual(["cyan", "magenta"]);
  });
  it("ignores invalid values", () => {
    const p = parseShareUrl("mode=invalid&fmt=invalid&ch=unknown,red");
    expect(p.mode).toBeUndefined();
    expect(p.outputFormat).toBeUndefined();
    expect(p.customChannels).toEqual(["red"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("pdf-color-separation validateOptions", () => {
  it("accepts valid default options", () => {
    const r = validateOptions(DEFAULT_OPTIONS);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown mode", () => {
    const r = validateOptions({
      mode: "unknown" as SeparationMode,
      outputFormat: "separate-pdfs",
      channelLabel: true,
      includeRegistrationMarks: true,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown output format", () => {
    const r = validateOptions({
      mode: "cmyk-4-channels",
      outputFormat: "weird" as OutputFormat,
      channelLabel: true,
      includeRegistrationMarks: true,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects custom mode with no channels", () => {
    const r = validateOptions({
      mode: "custom",
      outputFormat: "separate-pdfs",
      channelLabel: true,
      includeRegistrationMarks: true,
      customChannels: [],
    });
    expect(r.ok).toBe(false);
  });
  it("accepts custom mode with valid channels", () => {
    const r = validateOptions({
      mode: "custom",
      outputFormat: "separate-pdfs",
      channelLabel: true,
      includeRegistrationMarks: true,
      customChannels: ["cyan", "red"],
    });
    expect(r.ok).toBe(true);
  });
});
