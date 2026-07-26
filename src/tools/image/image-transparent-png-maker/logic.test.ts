import { describe, it, expect } from "vitest";
import {
  colorDistance,
  maxChannelDistance,
  matchesAnyTarget,
  alphaBlend,
  floodFill,
  validateInput,
  removeBackground,
  batchRemoveBackground,
  statsToCsv,
  hexToRgb,
  type TransparentPngInput,
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

const BASE: Omit<TransparentPngInput, "width" | "height" | "pixels"> = {
  targetColors: [[255, 255, 255]],
  tolerance: 30,
  mode: "global",
  feather: 0,
};

describe("colorDistance", () => {
  it("returns 0 for identical colors", () => {
    expect(colorDistance([10, 20, 30], [10, 20, 30])).toBe(0);
  });
  it("computes Euclidean distance", () => {
    expect(colorDistance([0, 0, 0], [3, 4, 0])).toBeCloseTo(5, 5);
  });
  it("max distance for black vs white", () => {
    expect(colorDistance([0, 0, 0], [255, 255, 255])).toBeCloseTo(255 * Math.sqrt(3), 1);
  });
});

describe("maxChannelDistance", () => {
  it("returns largest channel diff", () => {
    expect(maxChannelDistance([0, 0, 0], [10, 50, 30])).toBe(50);
  });
});

describe("matchesAnyTarget", () => {
  it("matches within tolerance", () => {
    expect(matchesAnyTarget([250, 250, 250], [[255, 255, 255]], 30)).toBe(true);
  });
  it("rejects outside tolerance", () => {
    expect(matchesAnyTarget([0, 0, 0], [[255, 255, 255]], 30)).toBe(false);
  });
  it("matches any of multiple targets", () => {
    expect(matchesAnyTarget([255, 0, 0], [[255, 255, 255], [255, 0, 0]], 30)).toBe(true);
  });
});

describe("alphaBlend", () => {
  it("returns dst when src alpha is 0", () => {
    const out = alphaBlend([0, 0, 0], 0, [100, 100, 100]);
    expect(out).toEqual([100, 100, 100]);
  });
  it("returns src when src alpha is 255", () => {
    const out = alphaBlend([50, 100, 150], 255, [200, 200, 200]);
    expect(out).toEqual([50, 100, 150]);
  });
  it("blends in between", () => {
    const out = alphaBlend([0, 0, 0], 128, [255, 255, 255]);
    expect(out[0]).toBeGreaterThan(0);
    expect(out[0]).toBeLessThan(255);
  });
});

describe("floodFill", () => {
  it("fills a uniform image completely", () => {
    const px = makePixels(10, 10, [255, 255, 255]);
    const visited = floodFill(px, 10, 10, { x: 0, y: 0 }, (i) => px[i] === 255);
    expect(visited.size).toBe(100);
  });
  it("stops at boundaries", () => {
    const px = makePixels(10, 10, [0, 0, 0]);
    // paint a 5x5 white square at top-left
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const i = (y * 10 + x) * 4;
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
      }
    }
    const visited = floodFill(px, 10, 10, { x: 0, y: 0 }, (i) => px[i] === 255);
    expect(visited.size).toBe(25);
  });
  it("handles out-of-bounds seed", () => {
    const px = makePixels(5, 5, [255, 255, 255]);
    const visited = floodFill(px, 5, 5, { x: 99, y: 99 }, (i) => px[i] === 255);
    expect(visited.size).toBe(0);
  });
});

describe("validateInput", () => {
  it("accepts valid global input", () => {
    expect(validateInput({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [255, 255, 255]) })).toEqual({ ok: true });
  });
  it("rejects empty targets", () => {
    expect(validateInput({ ...BASE, targetColors: [], width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]) })).toHaveProperty("error");
  });
  it("rejects bad tolerance", () => {
    expect(validateInput({ ...BASE, tolerance: -1, width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]) })).toHaveProperty("error");
  });
  it("rejects contiguous without seed", () => {
    expect(validateInput({ ...BASE, mode: "contiguous", width: 10, height: 10, pixels: makePixels(10, 10, [0, 0, 0]) })).toHaveProperty("error");
  });
  it("accepts contiguous with seed", () => {
    expect(validateInput({ ...BASE, mode: "contiguous", seed: { x: 0, y: 0 }, width: 10, height: 10, pixels: makePixels(10, 10, [255, 255, 255]) })).toEqual({ ok: true });
  });
});

describe("removeBackground", () => {
  it("removes matching pixels in global mode", () => {
    const r = removeBackground({ ...BASE, width: 10, height: 10, pixels: makePixels(10, 10, [255, 255, 255]) });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.stats.removedPixels).toBe(100);
    expect(r.stats.removedRatio).toBeCloseTo(1, 5);
    // All pixels should be transparent
    expect(r.pixels[3]).toBe(0);
  });
  it("keeps non-matching pixels", () => {
    const r = removeBackground({ ...BASE, targetColors: [[0, 0, 0]], width: 10, height: 10, pixels: makePixels(10, 10, [255, 255, 255]) });
    if ("error" in r) throw new Error("unexpected");
    expect(r.stats.removedPixels).toBe(0);
    expect(r.pixels[3]).toBe(255);
  });
  it("errors on bad input", () => {
    expect("error" in removeBackground({ ...BASE, width: 0, height: 0, pixels: new Uint8ClampedArray(0) })).toBe(true);
  });
  it("uses replacement color when set", () => {
    const r = removeBackground({ ...BASE, replacementColor: [255, 0, 0], width: 5, height: 5, pixels: makePixels(5, 5, [255, 255, 255]) });
    if ("error" in r) throw new Error("unexpected");
    expect(r.pixels[0]).toBe(255);
    expect(r.pixels[1]).toBe(0);
    expect(r.pixels[2]).toBe(0);
    expect(r.pixels[3]).toBe(255);
  });
  it("invert keeps matched pixels", () => {
    const r = removeBackground({ ...BASE, targetColors: [[255, 255, 255]], invert: true, width: 5, height: 5, pixels: makePixels(5, 5, [255, 255, 255]) });
    if ("error" in r) throw new Error("unexpected");
    expect(r.stats.removedPixels).toBe(0);
  });
  it("contiguous mode only removes connected region", () => {
    const px = makePixels(10, 10, [0, 0, 0]);
    // paint a 3x3 white block at top-left
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const i = (y * 10 + x) * 4;
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
      }
    }
    // paint a separate 2x2 white block at bottom-right
    for (let y = 8; y < 10; y++) {
      for (let x = 8; x < 10; x++) {
        const i = (y * 10 + x) * 4;
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
      }
    }
    const r = removeBackground({ ...BASE, mode: "contiguous", seed: { x: 0, y: 0 }, width: 10, height: 10, pixels: px });
    if ("error" in r) throw new Error("unexpected");
    // Should only remove the top-left 3x3 block (9 pixels), boundary may add a few
    expect(r.stats.removedPixels).toBeGreaterThanOrEqual(9);
    expect(r.stats.removedPixels).toBeLessThanOrEqual(9);
  });
  it("feathers edges", () => {
    const px = makePixels(10, 10, [0, 0, 0]);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const i = (y * 10 + x) * 4;
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
      }
    }
    const r = removeBackground({ ...BASE, feather: 2, width: 10, height: 10, pixels: px });
    if ("error" in r) throw new Error("unexpected");
    expect(r.stats.featheredPixels).toBeGreaterThan(0);
  });
});

describe("batchRemoveBackground", () => {
  it("runs over multiple inputs", () => {
    const inputs = [1, 2].map(() => ({ ...BASE, width: 5, height: 5, pixels: makePixels(5, 5, [255, 255, 255]) }));
    const results = batchRemoveBackground(inputs);
    expect(results.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = removeBackground({ ...BASE, width: 5, height: 5, pixels: makePixels(5, 5, [255, 255, 255]) });
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("RemovedPixels");
  });
});

describe("hexToRgb", () => {
  it("parses #RRGGBB", () => {
    expect(hexToRgb("#FF8800")).toEqual([255, 136, 0]);
  });
  it("errors on invalid", () => {
    expect(hexToRgb("xyz")).toHaveProperty("error");
  });
});
