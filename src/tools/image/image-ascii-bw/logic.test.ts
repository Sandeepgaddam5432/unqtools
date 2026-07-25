import { describe, it, expect } from "vitest";
import {
  validateAscii,
  luma,
  lumaToChar,
  lumaToColor,
  computeHeight,
  toAscii,
  toHtml,
  toSvg,
  adjustLuma,
  isIdentity,
  findRampPreset,
  RAMP_PRESETS,
  buildLumaGrid,
  samplePixel,
  asciiStats,
  batchValidate,
  formatForFilename,
  escapeHtml,
  DEFAULT_RAMP,
  DEFAULT_OPTIONS,
} from "./logic";

describe("validateAscii", () => {
  it("passes valid opts with defaults", () => {
    const r = validateAscii(DEFAULT_OPTIONS);
    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.width).toBe(80);
  });
  it("rounds width", () => {
    const r = validateAscii({ ...DEFAULT_OPTIONS, width: 80.6 });
    if (!("error" in r)) expect(r.width).toBe(81);
  });
  it("errors on bad width", () => {
    expect(validateAscii({ ...DEFAULT_OPTIONS, width: 0 })).toHaveProperty("error");
    expect(validateAscii({ ...DEFAULT_OPTIONS, width: 1000 })).toHaveProperty("error");
  });
  it("errors on too-short ramp", () => {
    expect(validateAscii({ ...DEFAULT_OPTIONS, ramp: "x" })).toHaveProperty("error");
  });
  it("errors on bad brightness", () => {
    expect(validateAscii({ ...DEFAULT_OPTIONS, brightness: 200 })).toHaveProperty("error");
  });
  it("errors on bad contrast", () => {
    expect(validateAscii({ ...DEFAULT_OPTIONS, contrast: -1 })).toHaveProperty("error");
  });
  it("errors on bad gamma", () => {
    expect(validateAscii({ ...DEFAULT_OPTIONS, gamma: 10 })).toHaveProperty("error");
  });
  it("errors on unknown dither", () => {
    expect(validateAscii({ ...DEFAULT_OPTIONS, dither: "xyz" as never })).toHaveProperty("error");
  });
});

describe("luma + adjustLuma", () => {
  it("is 0 for black, ~255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
  it("adjustLuma is identity at defaults", () => {
    expect(adjustLuma(128, { brightness: 0, contrast: 1, gamma: 1, invert: false })).toBeCloseTo(128, 0);
  });
  it("adjustLuma inverts", () => {
    expect(adjustLuma(0, { brightness: 0, contrast: 1, gamma: 1, invert: true })).toBe(255);
  });
  it("adjustLuma applies brightness", () => {
    expect(adjustLuma(100, { brightness: 50, contrast: 1, gamma: 1, invert: false })).toBeGreaterThan(100);
  });
});

describe("lumaToChar + lumaToColor", () => {
  it("returns first char for black", () => {
    expect(lumaToChar(0, DEFAULT_RAMP)).toBe(" ");
  });
  it("returns last char for white", () => {
    expect(lumaToChar(255, DEFAULT_RAMP)).toBe("@");
  });
  it("clamps out-of-range luminance", () => {
    expect(lumaToChar(-50, DEFAULT_RAMP)).toBe(" ");
    expect(lumaToChar(500, DEFAULT_RAMP)).toBe("@");
  });
  it("lumaToColor returns hex grayscale", () => {
    expect(lumaToColor(0)).toBe("#000000");
    expect(lumaToColor(255)).toBe("#ffffff");
  });
});

describe("computeHeight", () => {
  it("halves aspect ratio (chars taller than wide)", () => {
    expect(computeHeight(80, 100, 100)).toBe(40);
  });
  it("handles 0 dimension", () => {
    expect(computeHeight(80, 0, 100)).toBe(0);
  });
  it("minimum 1", () => {
    expect(computeHeight(80, 100, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe("toAscii", () => {
  it("produces width × height grid of @ for white", () => {
    const px = new Uint8ClampedArray(2 * 2 * 4);
    for (let i = 0; i < px.length; i += 4) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255; }
    const out = toAscii(px, 2, 2, { ...DEFAULT_OPTIONS, width: 2 });
    expect(out).toBe("@@");
  });
  it("black pixels map to first ramp char", () => {
    const px = new Uint8ClampedArray(4);
    const out = toAscii(px, 1, 1, { ...DEFAULT_OPTIONS, width: 1 });
    expect(out).toBe(" ");
  });
  it("throws on invalid width", () => {
    expect(() => toAscii(new Uint8ClampedArray(4), 1, 1, { ...DEFAULT_OPTIONS, width: 0 })).toThrow();
  });
  it("invert swaps dark/light", () => {
    const px = new Uint8ClampedArray(4);
    px[2] = 0;
    const outBlack = toAscii(px, 1, 1, { ...DEFAULT_OPTIONS, width: 1, invert: false });
    const outInv = toAscii(px, 1, 1, { ...DEFAULT_OPTIONS, width: 1, invert: true });
    expect(outBlack).toBe(" ");
    expect(outInv).toBe("@");
  });
});

describe("toHtml + toSvg", () => {
  it("toHtml produces pre with span", () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 255; px[1] = 255; px[2] = 255; px[3] = 255;
    const html = toHtml(px, 1, 1, { ...DEFAULT_OPTIONS, width: 1 });
    expect(html).toContain("<pre");
    expect(html).toContain("<span");
  });
  it("toSvg produces svg root element", () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 255; px[1] = 255; px[2] = 255; px[3] = 255;
    const svg = toSvg(px, 1, 1, { ...DEFAULT_OPTIONS, width: 1 });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
  it("toSvg escapes special chars in ramp", () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 255; px[1] = 255; px[2] = 255; px[3] = 255;
    const svg = toSvg(px, 1, 1, { ...DEFAULT_OPTIONS, width: 1, ramp: " <" });
    expect(svg).toContain("&lt;");
  });
});

describe("dither", () => {
  it("floyd-steinberg produces binary output", () => {
    const px = new Uint8ClampedArray(2 * 4);
    px[0] = 128; px[1] = 128; px[2] = 128; px[3] = 255;
    px[4] = 128; px[5] = 128; px[6] = 128; px[7] = 255;
    const grid = buildLumaGrid(px, 2, 1, 2, 1, { ...DEFAULT_OPTIONS, dither: "floyd-steinberg" });
    expect(grid.length).toBe(1);
    expect(grid[0]!.length).toBe(2);
    grid[0]!.forEach((v) => expect([0, 255]).toContain(v));
  });
  it("atkinson produces binary output", () => {
    const px = new Uint8ClampedArray(2 * 4);
    px[0] = 100; px[1] = 100; px[2] = 100; px[3] = 255;
    px[4] = 100; px[5] = 100; px[6] = 100; px[7] = 255;
    const grid = buildLumaGrid(px, 2, 1, 2, 1, { ...DEFAULT_OPTIONS, dither: "atkinson" });
    grid[0]!.forEach((v) => expect([0, 255]).toContain(v));
  });
});

describe("helpers + presets", () => {
  it("isIdentity true at defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(true);
  });
  it("isIdentity false when invert set", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, invert: true })).toBe(false);
  });
  it("findRampPreset returns matching", () => {
    expect(findRampPreset("binary")?.ramp).toBe(" 1");
  });
  it("has at least 6 ramp presets", () => {
    expect(RAMP_PRESETS.length).toBeGreaterThanOrEqual(6);
  });
  it("samplePixel returns correct triplet", () => {
    const px = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(samplePixel(px, 2, 1, 2, 1, 0, 0)).toEqual([10, 20, 30]);
    expect(samplePixel(px, 2, 1, 2, 1, 1, 0)).toEqual([40, 50, 60]);
  });
  it("asciiStats counts lines and chars", () => {
    const stats = asciiStats("ab\ncd");
    expect(stats.lines).toBe(2);
    expect(stats.chars).toBe(5);
    expect(stats.width).toBe(2);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("formatForFilename detects txt/html/svg", () => {
    expect(formatForFilename("a.txt")).toBe("txt");
    expect(formatForFilename("a.html")).toBe("html");
    expect(formatForFilename("a.svg")).toBe("svg");
  });
  it("escapeHtml escapes special chars", () => {
    expect(escapeHtml("<a>&\"'")).toBe("&lt;a&gt;&amp;&quot;&#39;");
  });
});
