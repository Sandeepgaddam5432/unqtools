import { describe, it, expect } from "vitest";
import {
  computePlacement,
  computeTilePlacements,
  blendPixel,
  degToRad,
  textBbox,
  validateOptions,
  buildFontString,
  serializePreset,
  parsePreset,
  buildWatermarkFilename,
  DEFAULT_WATERMARK_OPTIONS,
  POSITIONS,
  BLEND_MODES,
  FONT_OPTIONS,
  type WatermarkOptions,
} from "./logic";

const baseOpts = (over: Partial<WatermarkOptions> = {}): WatermarkOptions => ({ ...DEFAULT_WATERMARK_OPTIONS, ...over });

describe("computePlacement", () => {
  it("places top-left at padding", () => {
    const p = computePlacement(1000, 1000, "top-left", 20);
    expect(p).toMatchObject({ x: 20, y: 20, align: "left" });
  });
  it("places bottom-right at canvas - padding", () => {
    const p = computePlacement(1000, 1000, "bottom-right", 20);
    expect(p.x).toBe(980);
    expect(p.y).toBe(980);
    expect(p.align).toBe("right");
  });
  it("places middle-center at canvas center", () => {
    const p = computePlacement(800, 600, "middle-center", 0);
    expect(p.x).toBe(400);
    expect(p.y).toBe(300);
    expect(p.align).toBe("center");
  });
});

describe("computeTilePlacements", () => {
  it("returns empty when spacing is 0", () => {
    expect(computeTilePlacements(100, 100, 0).length).toBe(0);
  });
  it("generates a regular grid", () => {
    const ps = computeTilePlacements(500, 500, 100);
    expect(ps.length).toBeGreaterThan(0);
    expect(ps.every((p) => p.rotationRad === 0)).toBe(true);
  });
  it("applies diagonal rotation when requested", () => {
    const ps = computeTilePlacements(500, 500, 100, true);
    expect(ps.every((p) => Math.abs(p.rotationRad + Math.PI / 4) < 1e-9)).toBe(true);
  });
});

describe("blendPixel", () => {
  it("normal mode alpha-composites", () => {
    const out = blendPixel({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, "normal", 0.5);
    expect(out.r).toBe(128);
    expect(out.g).toBe(128);
    expect(out.b).toBe(128);
  });
  it("multiply mode darkens", () => {
    const out = blendPixel({ r: 200, g: 200, b: 200, a: 255 }, { r: 100, g: 100, b: 100, a: 255 }, "multiply", 1);
    expect(out.r).toBeLessThan(200);
  });
  it("screen mode lightens", () => {
    const out = blendPixel({ r: 50, g: 50, b: 50, a: 255 }, { r: 100, g: 100, b: 100, a: 255 }, "screen", 1);
    expect(out.r).toBeGreaterThan(50);
  });
  it("zero opacity leaves base untouched", () => {
    const base = { r: 100, g: 100, b: 100, a: 255 };
    const out = blendPixel(base, { r: 0, g: 0, b: 0, a: 255 }, "normal", 0);
    expect(out).toEqual(base);
  });
});

describe("degToRad", () => {
  it("converts 180 to π", () => expect(degToRad(180)).toBeCloseTo(Math.PI, 5));
  it("converts 0 to 0", () => expect(degToRad(0)).toBe(0));
  it("converts -90 to -π/2", () => expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2, 5));
});

describe("textBbox", () => {
  it("returns same dims at 0 rotation", () => {
    const b = textBbox(200, 40, 0);
    expect(b.width).toBeCloseTo(200, 0);
    expect(b.height).toBeCloseTo(40, 0);
  });
  it("swaps width/height at 90°", () => {
    const b = textBbox(200, 40, 90);
    expect(b.width).toBeCloseTo(40, 0);
    expect(b.height).toBeCloseTo(200, 0);
  });
});

describe("validateOptions", () => {
  it("accepts default options", () => {
    expect(validateOptions(baseOpts())).toEqual({ ok: true });
  });
  it("rejects empty text", () => {
    expect(validateOptions(baseOpts({ text: "   " }))).toHaveProperty("error");
  });
  it("rejects opacity out of range", () => {
    expect(validateOptions(baseOpts({ opacity: 2 }))).toHaveProperty("error");
  });
  it("rejects negative font size", () => {
    expect(validateOptions(baseOpts({ fontSize: -5 }))).toHaveProperty("error");
  });
  it("rejects bad blend mode", () => {
    expect(validateOptions(baseOpts({ blendMode: "bogus" as WatermarkOptions["blendMode"] }))).toHaveProperty("error");
  });
  it("rejects bad shadow blur", () => {
    expect(validateOptions(baseOpts({ shadow: { enabled: true, offsetX: 0, offsetY: 0, blur: 200, color: "#000" } }))).toHaveProperty("error");
  });
});

describe("buildFontString", () => {
  it("builds non-bold font", () => {
    expect(buildFontString("Arial", 32)).toBe("32px Arial");
  });
  it("builds bold font", () => {
    expect(buildFontString("Georgia", 24, true)).toBe("bold 24px Georgia");
  });
});

describe("preset serialization", () => {
  it("round-trips a preset", () => {
    const opts = baseOpts({ text: "TEST" });
    const json = serializePreset("My Preset", opts);
    const back = parsePreset(json);
    expect(back).not.toBeNull();
    expect(back!.name).toBe("My Preset");
    expect(back!.options.text).toBe("TEST");
  });
  it("returns null for invalid JSON", () => {
    expect(parsePreset("not json")).toBeNull();
  });
  it("returns null for malformed object", () => {
    expect(parsePreset('{"foo":"bar"}')).toBeNull();
  });
});

describe("buildWatermarkFilename", () => {
  it("builds PNG filename", () => {
    expect(buildWatermarkFilename("photo.png", "image/png")).toBe("photo-watermarked.png");
  });
  it("builds JPG filename", () => {
    expect(buildWatermarkFilename("logo.png", "image/jpeg")).toBe("logo-watermarked.jpg");
  });
  it("builds WebP filename", () => {
    expect(buildWatermarkFilename("img", "image/webp")).toBe("img-watermarked.webp");
  });
});

describe("constants", () => {
  it("exposes 9 positions", () => expect(POSITIONS.length).toBe(9));
  it("exposes 6 blend modes", () => expect(BLEND_MODES.length).toBe(6));
  it("exposes at least 5 fonts", () => expect(FONT_OPTIONS.length).toBeGreaterThanOrEqual(5));
});
