/**
 * Image Placeholder Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  ASPECT_PRESETS, clampDimension, parseHex, toHex, luminance, autoTextColor,
  makeRng, randomColor, patternPixel, autoFontSize, validateOptions,
  applyAspect, dimensionLabel, buildFilename,
} from "./logic";
import type { PlaceholderOptions } from "./logic";

const validOpts = (over: Partial<PlaceholderOptions> = {}): PlaceholderOptions => ({
  width: 600, height: 400, bgHex: "#3366cc", pattern: "solid",
  secondaryHex: "#ffffff", text: "Hello", textHex: "#ffffff",
  fontSize: 24, format: "image/png", seed: 42, ...over,
});

describe("clampDimension", () => {
  it("clamps to 1 minimum", () => {
    expect(clampDimension(0)).toBe(1);
    expect(clampDimension(-5)).toBe(1);
  });
  it("clamps to 4000 maximum", () => {
    expect(clampDimension(5000)).toBe(4000);
  });
  it("rounds floats", () => {
    expect(clampDimension(100.7)).toBe(101);
  });
  it("handles NaN", () => {
    expect(clampDimension(NaN)).toBe(1);
  });
});

describe("parseHex", () => {
  it("parses #rrggbb", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses #rgb shorthand", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses without # prefix", () => {
    expect(parseHex("ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("returns null for invalid", () => {
    expect(parseHex("#xyz")).toBeNull();
    expect(parseHex("nope")).toBeNull();
  });
});

describe("toHex", () => {
  it("formats 6-digit hex", () => {
    expect(toHex(255, 136, 0)).toBe("#ff8800");
  });
  it("clamps values", () => {
    expect(toHex(300, -10, 0)).toBe("#ff0000");
  });
});

describe("luminance", () => {
  it("is near 1 for white", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 2);
  });
  it("is near 0 for black", () => {
    expect(luminance(0, 0, 0)).toBeCloseTo(0, 2);
  });
});

describe("autoTextColor", () => {
  it("returns black for bright bg", () => {
    expect(autoTextColor(255, 255, 255)).toBe("#000000");
  });
  it("returns white for dark bg", () => {
    expect(autoTextColor(0, 0, 0)).toBe("#FFFFFF");
  });
});

describe("makeRng / randomColor", () => {
  it("is deterministic for same seed", () => {
    const r1 = makeRng(42);
    const r2 = makeRng(42);
    expect(r1()).toBe(r2());
  });
  it("generates hex color string", () => {
    expect(randomColor(7)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("patternPixel", () => {
  const bg = { r: 0, g: 0, b: 0 };
  const sec = { r: 255, g: 255, b: 255 };
  it("solid returns bg", () => {
    expect(patternPixel(10, 10, 100, 100, "solid", bg, sec, makeRng(1))).toEqual(bg);
  });
  it("gradient interpolates horizontally", () => {
    const p0 = patternPixel(0, 0, 100, 100, "gradient", bg, sec, makeRng(1));
    const p99 = patternPixel(99, 0, 100, 100, "gradient", bg, sec, makeRng(1));
    expect(p0.r).toBeLessThan(p99.r);
  });
  it("checkerboard alternates", () => {
    const a = patternPixel(0, 0, 100, 100, "checkerboard", bg, sec, makeRng(1));
    const b = patternPixel(50, 0, 100, 100, "checkerboard", bg, sec, makeRng(1));
    expect(a).not.toEqual(b);
  });
  it("noise varies per call", () => {
    const r = makeRng(1);
    const a = patternPixel(0, 0, 100, 100, "noise", bg, sec, r);
    const b = patternPixel(1, 0, 100, 100, "noise", bg, sec, r);
    expect(a).not.toEqual(b);
  });
});

describe("autoFontSize", () => {
  it("scales with dimension", () => {
    expect(autoFontSize(1000, 1000, "Hi")).toBeGreaterThan(autoFontSize(100, 100, "Hi"));
  });
  it("shrinks for long text", () => {
    expect(autoFontSize(400, 400, "Hello World Long Text")).toBeLessThan(autoFontSize(400, 400, "Hi"));
  });
  it("minimum of 8", () => {
    expect(autoFontSize(20, 20, "Hi")).toBeGreaterThanOrEqual(8);
  });
});

describe("validateOptions", () => {
  it("accepts valid opts", () => {
    expect("ok" in validateOptions(validOpts())).toBe(true);
  });
  it("errors on negative width", () => {
    expect("error" in validateOptions(validOpts({ width: -1 }))).toBe(true);
  });
  it("errors on too-large dimension", () => {
    expect("error" in validateOptions(validOpts({ width: 5000 }))).toBe(true);
  });
  it("errors on invalid bg hex", () => {
    expect("error" in validateOptions(validOpts({ bgHex: "nope" }))).toBe(true);
  });
});

describe("applyAspect", () => {
  it("16:9 produces landscape dimensions", () => {
    const d = applyAspect("16:9", 1080);
    expect(d.width).toBeGreaterThanOrEqual(d.height);
  });
  it("9:16 produces portrait dimensions", () => {
    const d = applyAspect("9:16", 1080);
    expect(d.height).toBeGreaterThan(d.width);
  });
  it("1:1 produces square", () => {
    const d = applyAspect("1:1", 600);
    expect(d.width).toBe(d.height);
  });
});

describe("ASPECT_PRESETS", () => {
  it("includes 4 presets", () => {
    expect(ASPECT_PRESETS.length).toBe(4);
  });
});

describe("dimensionLabel & buildFilename", () => {
  it("formats label", () => {
    expect(dimensionLabel(1920, 1080)).toBe("1920×1080");
  });
  it("builds PNG filename", () => {
    expect(buildFilename(600, 400, "image/png")).toBe("placeholder-600x400.png");
  });
  it("builds JPEG filename", () => {
    expect(buildFilename(600, 400, "image/jpeg")).toBe("placeholder-600x400.jpeg");
  });
});
