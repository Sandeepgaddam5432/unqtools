import { describe, it, expect } from "vitest";
import {
  luminance,
  applyGamma,
  applyLevels,
  sobelEdges,
  dilateEdges,
  quantizeColors,
  countUniqueColors,
  bilateralWeight,
  validateCartoonInput,
  cartoonCssFilter,
  cartoonize,
  statsToCsv,
  PRESETS,
  batchCartoonize,
  type CartoonInput,
} from "./logic";

function makePixels(width: number, height: number, color: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

const BASE: Omit<CartoonInput, "width" | "height" | "pixels"> = {
  edgeThreshold: 60,
  edgeThickness: 1,
  colorLevels: 6,
  smoothing: 0.3,
  intensity: 0.8,
  mode: "cartoon",
};

describe("luminance", () => {
  it("returns 0 for black", () => {
    expect(luminance(0, 0, 0)).toBe(0);
  });
  it("returns 1 for white", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 5);
  });
});

describe("applyGamma", () => {
  it("is identity for gamma 1", () => {
    expect(applyGamma(0.5, 1)).toBeCloseTo(0.5, 5);
  });
  it("brightens for gamma > 1", () => {
    expect(applyGamma(0.25, 2)).toBeCloseTo(0.5, 2);
  });
});

describe("applyLevels", () => {
  it("expands black/white points", () => {
    expect(applyLevels(128, 64, 192, 1)).toBeGreaterThan(128);
  });
  it("clamps to 0-255", () => {
    expect(applyLevels(0, 100, 200, 1)).toBe(0);
    expect(applyLevels(255, 0, 200, 1)).toBe(255);
  });
});

describe("sobelEdges", () => {
  it("returns zero edges for uniform image", () => {
    const px = makePixels(10, 10, [128, 128, 128]);
    const edges = sobelEdges(px, 10, 10);
    let max = 0;
    for (let i = 0; i < edges.length; i++) max = Math.max(max, edges[i]!);
    expect(max).toBe(0);
  });
  it("detects edges on a split image", () => {
    const px = makePixels(10, 10, [0, 0, 0]);
    // paint right half white
    for (let y = 0; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        const i = (y * 10 + x) * 4;
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
      }
    }
    const edges = sobelEdges(px, 10, 10);
    // The boundary at x=5 should have a high edge
    const boundaryEdge = edges[5 * 10 + 5]!;
    expect(boundaryEdge).toBeGreaterThan(50);
  });
});

describe("dilateEdges", () => {
  it("grows edges with each pass", () => {
    const edges = new Uint8ClampedArray(11 * 11);
    edges[5 * 11 + 5] = 255;
    const d1 = dilateEdges(edges, 11, 11, 1);
    const d2 = dilateEdges(edges, 11, 11, 2);
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < d1.length; i++) { sum1 += d1[i]!; sum2 += d2[i]!; }
    expect(sum2).toBeGreaterThan(sum1);
  });
});

describe("quantizeColors", () => {
  it("reduces to N levels per channel", () => {
    const px = makePixels(1, 1, [100, 150, 200]);
    const out = quantizeColors(px, 4);
    // step = 255 / 3 = 85, so 100→85, 150→170, 200→170
    expect(out[0]).toBe(85);
    expect(out[1]).toBe(170);
    expect(out[2]).toBe(170);
  });
});

describe("countUniqueColors", () => {
  it("counts distinct colors", () => {
    const px = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      255, 0, 0, 255,
    ]);
    expect(countUniqueColors(px)).toBe(2);
  });
  it("caps at maximum", () => {
    const px = new Uint8ClampedArray(200 * 4);
    for (let i = 0; i < 200; i++) {
      px[i * 4] = i; px[i * 4 + 1] = i; px[i * 4 + 2] = i; px[i * 4 + 3] = 255;
    }
    expect(countUniqueColors(px, 50)).toBe(50);
  });
});

describe("bilateralWeight", () => {
  it("returns 1 for zero diffs", () => {
    expect(bilateralWeight(0, 30, 0, 30)).toBeCloseTo(1, 5);
  });
  it("decreases with color diff", () => {
    const a = bilateralWeight(10, 30, 0, 30);
    const b = bilateralWeight(100, 30, 0, 30);
    expect(b).toBeLessThan(a);
  });
});

describe("validateCartoonInput", () => {
  it("accepts valid input", () => {
    expect(validateCartoonInput({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]) })).toEqual({ ok: true });
  });
  it("rejects bad dimensions", () => {
    expect(validateCartoonInput({ ...BASE, width: 0, height: 0, pixels: new Uint8ClampedArray(0) })).toHaveProperty("error");
  });
  it("rejects missing pixels", () => {
    expect(validateCartoonInput({ ...BASE, width: 10, height: 10, pixels: new Uint8ClampedArray(10) })).toHaveProperty("error");
  });
  it("rejects bad color levels", () => {
    expect(validateCartoonInput({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]), colorLevels: 1 })).toHaveProperty("error");
  });
  it("rejects bad intensity", () => {
    expect(validateCartoonInput({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]), intensity: 2 })).toHaveProperty("error");
  });
});

describe("cartoonCssFilter", () => {
  it("includes contrast and saturate", () => {
    const f = cartoonCssFilter({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]) });
    expect(f).toContain("contrast(");
    expect(f).toContain("saturate(");
    expect(f).toContain("posterize(");
  });
  it("uses brightness for sketch mode", () => {
    const f = cartoonCssFilter({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]), mode: "sketch" });
    expect(f).toContain("brightness(1.1)");
  });
});

describe("cartoonize", () => {
  it("returns result with stats for valid input", () => {
    const r = cartoonize({ ...BASE, width: 20, height: 20, pixels: makePixels(20, 20, [128, 128, 128]) });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.pixels.length).toBe(20 * 20 * 4);
    expect(r.stats.pixels).toBe(400);
    expect(r.stats.edgeRatio).toBeGreaterThanOrEqual(0);
  });
  it("returns error on bad input", () => {
    expect("error" in cartoonize({ ...BASE, width: 0, height: 0, pixels: new Uint8ClampedArray(0) })).toBe(true);
  });
  it("warns on very thick edges", () => {
    const r = cartoonize({ ...BASE, width: 20, height: 20, pixels: makePixels(20, 20, [128, 128, 128]), edgeThickness: 4 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("sketch mode produces grayscale output", () => {
    const r = cartoonize({ ...BASE, width: 20, height: 20, pixels: makePixels(20, 20, [200, 50, 100]), mode: "sketch" });
    if ("error" in r) throw new Error("unexpected");
    // For uniform area, sketch inverts luminance → grayscale
    expect(r.pixels[0]).toBe(r.pixels[1]);
    expect(r.pixels[1]).toBe(r.pixels[2]);
  });
});

describe("batchCartoonize", () => {
  it("runs over multiple inputs", () => {
    const inputs = [1, 2].map(() => ({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [100, 100, 100]) }));
    const results = batchCartoonize(inputs);
    expect(results.length).toBe(2);
    expect("error" in results[0]!).toBe(false);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = cartoonize({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]) });
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("Width");
    expect(csv).toContain("UniqueColors");
  });
});

describe("PRESETS", () => {
  it("has 4 presets", () => {
    expect(PRESETS.length).toBe(4);
  });
  it("includes Comic and Sketch", () => {
    expect(PRESETS.some((p) => p.name === "Comic")).toBe(true);
    expect(PRESETS.some((p) => p.name === "Sketch")).toBe(true);
  });
});
