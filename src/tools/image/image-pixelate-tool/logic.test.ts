import { describe, it, expect } from "vitest";
import {
  clampBlockSize,
  computeBlockCount,
  blockBounds,
  averageBlock,
  blurBlock,
  inRegion,
  featherAlpha,
  detectRegions,
  applyToRgba,
  buildConfirmPrompt,
  buildPixelateFilename,
  validatePixelateOptions,
  DEFAULT_OPTIONS,
  type PixelateOptions,
  type PixelateRegion,
} from "./logic";

const baseOpts = (over: Partial<PixelateOptions> = {}): PixelateOptions => ({ ...DEFAULT_OPTIONS, ...over });

describe("clampBlockSize", () => {
  it("returns the size when in range", () => expect(clampBlockSize(8, 100, 100)).toBe(8));
  it("clamps to 1 minimum", () => expect(clampBlockSize(0, 100, 100)).toBe(1));
  it("clamps to image max dimension", () => expect(clampBlockSize(500, 100, 100)).toBe(100));
  it("floors decimals", () => expect(clampBlockSize(8.7, 100, 100)).toBe(8));
});

describe("computeBlockCount", () => {
  it("returns ceil(w/bs) and ceil(h/bs)", () => expect(computeBlockCount(100, 100, 8)).toEqual({ cols: 13, rows: 13 }));
  it("handles exact division", () => expect(computeBlockCount(100, 50, 10)).toEqual({ cols: 10, rows: 5 }));
  it("handles block size 1", () => expect(computeBlockCount(10, 10, 1)).toEqual({ cols: 10, rows: 10 }));
});

describe("blockBounds", () => {
  it("returns full block for interior", () => expect(blockBounds(0, 0, 8, 100, 100)).toEqual({ x0: 0, y0: 0, x1: 8, y1: 8 }));
  it("clamps at image edge", () => expect(blockBounds(12, 12, 8, 100, 100)).toEqual({ x0: 96, y0: 96, x1: 100, y1: 100 }));
});

describe("averageBlock", () => {
  it("averages block pixels", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
    const avg = averageBlock(rgba, 2, { x0: 0, y0: 0, x1: 2, y1: 2 });
    expect(avg.r).toBe(Math.round((0 + 100 + 200 + 255) / 4));
    expect(avg.a).toBe(255);
  });
  it("returns zeros for empty block", () => {
    expect(averageBlock(new Uint8ClampedArray(0), 0, { x0: 0, y0: 0, x1: 0, y1: 0 })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});

describe("blurBlock", () => {
  it("returns 3x3-averaged values", () => {
    const rgba = new Uint8ClampedArray(10 * 10 * 4).fill(128);
    const r = blurBlock(rgba, 10, 10, { x0: 2, y0: 2, x1: 5, y1: 5 });
    expect(r.r).toBe(128);
    expect(r.a).toBe(128);
  });
});

describe("inRegion", () => {
  const rect: PixelateRegion = { shape: "rect", rect: { x0: 10, y0: 10, x1: 50, y1: 50 } };
  it("includes interior of rect", () => expect(inRegion(20, 20, rect)).toBe(true));
  it("excludes outside of rect", () => expect(inRegion(0, 0, rect)).toBe(false));
  const ell: PixelateRegion = { shape: "ellipse", rect: { x0: 0, y0: 0, x1: 100, y1: 100 } };
  it("includes ellipse center", () => expect(inRegion(50, 50, ell)).toBe(true));
  it("excludes ellipse corner", () => expect(inRegion(0, 0, ell)).toBe(false));
});

describe("featherAlpha", () => {
  const rect: PixelateRegion = { shape: "rect", rect: { x0: 10, y0: 10, x1: 50, y1: 50 } };
  it("returns 1 inside region when no feather", () => {
    expect(featherAlpha(25, 25, rect, 0)).toBe(1);
  });
  it("returns 0 outside region when no feather", () => {
    expect(featherAlpha(0, 0, rect, 0)).toBe(0);
  });
  it("smoothly fades with feather > 0", () => {
    const inside = featherAlpha(25, 25, rect, 50);
    const edge = featherAlpha(11, 25, rect, 50);
    const outside = featherAlpha(0, 0, rect, 50);
    expect(inside).toBeGreaterThanOrEqual(edge);
    expect(edge).toBeGreaterThanOrEqual(outside);
  });
});

describe("detectRegions", () => {
  it("returns empty when sensitivity is 0", () => {
    expect(detectRegions(100, 100, 0).length).toBe(0);
  });
  it("returns regions when sensitivity > 0", () => {
    expect(detectRegions(800, 600, 50).length).toBeGreaterThan(0);
  });
  it("more sensitivity yields more regions", () => {
    const low = detectRegions(800, 600, 10).length;
    const high = detectRegions(800, 600, 90).length;
    expect(high).toBeGreaterThanOrEqual(low);
  });
});

describe("applyToRgba", () => {
  it("returns same length buffer", () => {
    const rgba = new Uint8ClampedArray(16 * 16 * 4).fill(128);
    const out = applyToRgba(rgba, 16, 16, baseOpts({ blockSize: 4 }));
    expect(out.length).toBe(rgba.length);
  });
  it("mosaic averages within block", () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255, 100, 100, 100, 255,
      0, 0, 0, 255, 100, 100, 100, 255,
    ]);
    const out = applyToRgba(rgba, 2, 2, baseOpts({ blockSize: 2, mode: "mosaic" }));
    expect(out[0]).toBe(50);
    expect(out[4]).toBe(50);
  });
  it("solid fills with solid color", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]);
    const out = applyToRgba(rgba, 2, 2, baseOpts({ blockSize: 2, mode: "solid", solidColor: { r: 0, g: 0, b: 0 } }));
    expect(out[0]).toBe(0);
  });
  it("only modifies pixels inside region", () => {
    const rgba = new Uint8ClampedArray(16 * 16 * 4).fill(128);
    const out = applyToRgba(rgba, 16, 16, baseOpts({ blockSize: 4, mode: "solid", solidColor: { r: 0, g: 0, b: 0 } }), [
      { shape: "rect", rect: { x0: 0, y0: 0, x1: 4, y1: 4 } },
    ]);
    expect(out[0]).toBe(0); // inside region
    expect(out[(8 * 16) * 4]).toBe(128); // outside region unchanged
  });
});

describe("buildConfirmPrompt", () => {
  it("mentions whole image when no regions", () => {
    expect(buildConfirmPrompt([], "mosaic")).toContain("whole image");
  });
  it("mentions count when regions provided", () => {
    const r: PixelateRegion[] = [{ shape: "rect", rect: { x0: 0, y0: 0, x1: 10, y1: 10 } }];
    const p = buildConfirmPrompt(r, "blur");
    expect(p).toContain("1 region");
    expect(p).toContain("blur");
  });
  it("pluralizes for multiple regions", () => {
    const r: PixelateRegion[] = [
      { shape: "rect", rect: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      { shape: "rect", rect: { x0: 20, y0: 20, x1: 30, y1: 30 } },
    ];
    expect(buildConfirmPrompt(r, "mosaic")).toContain("2 regions");
  });
});

describe("buildPixelateFilename", () => {
  it("builds filename with mode suffix", () => {
    expect(buildPixelateFilename("photo.png", "mosaic")).toBe("photo-pixelated-mosaic.png");
    expect(buildPixelateFilename("logo", "blur")).toBe("logo-pixelated-blur.png");
  });
});

describe("validatePixelateOptions", () => {
  it("accepts valid options", () => {
    expect(validatePixelateOptions(baseOpts(), 100, 100)).toEqual({ ok: true });
  });
  it("rejects block size < 1", () => {
    expect(validatePixelateOptions(baseOpts({ blockSize: 0 }), 100, 100)).toHaveProperty("error");
  });
  it("rejects block size larger than image", () => {
    expect(validatePixelateOptions(baseOpts({ blockSize: 200 }), 100, 100)).toHaveProperty("error");
  });
  it("rejects bad feather", () => {
    expect(validatePixelateOptions(baseOpts({ feather: 200 }), 100, 100)).toHaveProperty("error");
  });
  it("rejects bad sensitivity", () => {
    expect(validatePixelateOptions(baseOpts({ autoSensitivity: 200 }), 100, 100)).toHaveProperty("error");
  });
  it("rejects unknown mode", () => {
    expect(validatePixelateOptions(baseOpts({ mode: "bogus" as PixelateOptions["mode"] }), 100, 100)).toHaveProperty("error");
  });
});
