import { describe, it, expect } from "vitest";
import {
  parseHex,
  rgbToHex,
  computeOutputSize,
  mapToInput,
  isBorderPixel,
  padToSquare,
  padToAspect,
  borderPixelColor,
  shadowBounds,
  applyToRgba,
  buildBorderFilename,
  validateBorderOptions,
  defaultOptions,
  ASPECT_PRESETS,
  PRESET_THIN,
  PRESET_POLAROID,
  PRESET_FRAME,
  type BorderOptions,
  type RgbColor,
} from "./logic";

const solidOpts = (sides: BorderOptions["sides"], color: RgbColor = { r: 0, g: 0, b: 0 }): BorderOptions =>
  ({ ...defaultOptions(sides, color) });

describe("parseHex", () => {
  it("parses 6-digit hex", () => expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 }));
  it("parses 3-digit hex", () => expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 }));
  it("parses without leading #", () => expect(parseHex("ff8800")).toEqual({ r: 255, g: 136, b: 0 }));
  it("returns null on invalid", () => expect(parseHex("xyz")).toBeNull());
});

describe("rgbToHex", () => {
  it("formats 6-digit hex", () => expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe("#ff0080"));
  it("zero-pads", () => expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000"));
});

describe("computeOutputSize", () => {
  it("adds border to width and height", () => {
    expect(computeOutputSize(100, 50, solidOpts({ top: 10, right: 20, bottom: 30, left: 40 }))).toEqual({ width: 160, height: 90 });
  });
  it("handles zero border", () => {
    expect(computeOutputSize(100, 50, solidOpts({ top: 0, right: 0, bottom: 0, left: 0 }))).toEqual({ width: 100, height: 50 });
  });
});

describe("mapToInput", () => {
  const opts = solidOpts({ top: 10, right: 20, bottom: 30, left: 40 });
  it("maps interior pixels correctly", () => {
    expect(mapToInput(40, 10, opts)).toEqual({ x: 0, y: 0 });
    expect(mapToInput(50, 20, opts)).toEqual({ x: 10, y: 10 });
  });
  it("returns null for border pixels", () => {
    expect(mapToInput(0, 0, opts)).toBeNull();
    expect(mapToInput(39, 10, opts)).toBeNull();
  });
});

describe("isBorderPixel", () => {
  const opts = solidOpts({ top: 10, right: 20, bottom: 30, left: 40 });
  it("marks top-left border as border", () => expect(isBorderPixel(0, 0, 100, 50, opts)).toBe(true));
  it("marks interior as not border", () => expect(isBorderPixel(50, 20, 100, 50, opts)).toBe(false));
  it("marks right edge past input width", () => expect(isBorderPixel(140, 30, 100, 50, opts)).toBe(true));
});

describe("padToSquare", () => {
  it("pads landscape image to square", () => {
    const { sides, opts } = padToSquare(100, 50, { r: 0, g: 0, b: 0 });
    expect(sides.top + sides.bottom).toBe(50);
    expect(sides.left + sides.right).toBe(0);
    expect(opts.bgColor).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("pads portrait image to square", () => {
    const { sides } = padToSquare(50, 100, { r: 255, g: 255, b: 255 });
    expect(sides.left + sides.right).toBe(50);
    expect(sides.top + sides.bottom).toBe(0);
  });
});

describe("padToAspect", () => {
  it("pads 4:3 image to 16:9 (adds width)", () => {
    const { sides } = padToAspect(800, 600, "16:9", { r: 0, g: 0, b: 0 });
    expect(sides.left + sides.right).toBeGreaterThan(0);
    expect(sides.top + sides.bottom).toBe(0);
  });
  it("pads 1:1 image to 16:9 (adds width)", () => {
    const { sides } = padToAspect(1000, 1000, "16:9", { r: 0, g: 0, b: 0 });
    expect(sides.left + sides.right).toBeGreaterThan(0);
  });
  it("pads 16:9 image to 1:1 (adds height)", () => {
    const { sides } = padToAspect(1600, 900, "1:1", { r: 0, g: 0, b: 0 });
    expect(sides.top + sides.bottom).toBeGreaterThan(0);
    expect(sides.left + sides.right).toBe(0);
  });
});

describe("borderPixelColor", () => {
  it("returns solid color for solid style", () => {
    const opts = solidOpts({ top: 10, right: 10, bottom: 10, left: 10 }, { r: 100, g: 50, b: 25 });
    expect(borderPixelColor(0, 0, 100, 100, opts)).toEqual({ r: 100, g: 50, b: 25 });
  });
  it("interpolates gradient", () => {
    const opts: BorderOptions = {
      ...solidOpts({ top: 10, right: 10, bottom: 10, left: 10 }, { r: 0, g: 0, b: 0 }),
      style: "gradient",
      gradientTo: { r: 255, g: 255, b: 255 },
      gradientAngle: 0,
    };
    const top = borderPixelColor(60, 0, 100, 100, opts);
    const bottom = borderPixelColor(60, 119, 100, 100, opts);
    expect(bottom.r).toBeGreaterThanOrEqual(top.r);
  });
});

describe("shadowBounds", () => {
  it("extends beyond border when shadow enabled", () => {
    const opts: BorderOptions = {
      ...solidOpts({ top: 10, right: 10, bottom: 10, left: 10 }),
      shadow: { enabled: true, offsetX: 5, offsetY: 5, blur: 10, color: { r: 0, g: 0, b: 0 } },
    };
    const b = shadowBounds(100, 100, opts);
    expect(b.x0).toBeLessThan(0);
    expect(b.y1).toBeGreaterThan(120);
  });
});

describe("applyToRgba", () => {
  it("returns a larger buffer", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const out = applyToRgba(rgba, 4, 4, solidOpts({ top: 2, right: 2, bottom: 2, left: 2 }, { r: 0, g: 0, b: 0 }));
    expect(out.length).toBe(8 * 8 * 4);
  });
  it("fills border with color", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const out = applyToRgba(rgba, 4, 4, solidOpts({ top: 2, right: 2, bottom: 2, left: 2 }, { r: 0, g: 0, b: 0 }));
    // Top-left pixel should be black border
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });
  it("preserves interior pixels", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(200);
    const out = applyToRgba(rgba, 4, 4, solidOpts({ top: 2, right: 2, bottom: 2, left: 2 }, { r: 0, g: 0, b: 0 }));
    // Center pixel (3,3) in 8x8 output maps to input (1,1)
    const i = (3 * 8 + 3) * 4;
    expect(out[i]).toBe(200);
  });
  it("draws inner border when enabled", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const opts: BorderOptions = {
      ...solidOpts({ top: 2, right: 2, bottom: 2, left: 2 }, { r: 255, g: 255, b: 255 }),
      inner: { enabled: true, width: 1, color: { r: 255, g: 0, b: 0 } },
    };
    const out = applyToRgba(rgba, 4, 4, opts);
    // First interior pixel = inner border = red
    const i = (2 * 8 + 2) * 4;
    expect(out[i]).toBe(255);
    expect(out[i + 1]).toBe(0);
    expect(out[i + 2]).toBe(0);
  });
});

describe("buildBorderFilename", () => {
  it("builds PNG filename", () => expect(buildBorderFilename("photo.png", "image/png")).toBe("photo-bordered.png"));
  it("builds JPEG filename", () => expect(buildBorderFilename("logo.png", "image/jpeg")).toBe("logo-bordered.jpg"));
  it("builds WebP filename", () => expect(buildBorderFilename("img", "image/webp")).toBe("img-bordered.webp"));
});

describe("validateBorderOptions", () => {
  it("accepts valid options", () => {
    expect(validateBorderOptions(solidOpts({ top: 10, right: 10, bottom: 10, left: 10 }))).toEqual({ ok: true });
  });
  it("rejects negative border", () => {
    expect(validateBorderOptions(solidOpts({ top: -1, right: 0, bottom: 0, left: 0 }))).toHaveProperty("error");
  });
  it("rejects overly large border", () => {
    expect(validateBorderOptions(solidOpts({ top: 0, right: 0, bottom: 0, left: 50000 }))).toHaveProperty("error");
  });
  it("rejects bad style", () => {
    const opts = solidOpts({ top: 1, right: 1, bottom: 1, left: 1 });
    (opts as { style: string }).style = "bogus";
    expect(validateBorderOptions(opts)).toHaveProperty("error");
  });
});

describe("presets & constants", () => {
  it("exposes aspect presets", () => expect(ASPECT_PRESETS.length).toBeGreaterThanOrEqual(4));
  it("PRESET_THIN is thin uniform", () => {
    expect(PRESET_THIN.sides.top).toBe(2);
    expect(PRESET_THIN.sides.bottom).toBe(2);
  });
  it("PRESET_POLAROID has thick bottom", () => {
    expect(PRESET_POLAROID.sides.bottom).toBeGreaterThan(PRESET_POLAROID.sides.top);
  });
  it("PRESET_FRAME has thick uniform", () => {
    expect(PRESET_FRAME.sides.top).toBe(40);
  });
});
