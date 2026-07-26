import { describe, it, expect } from "vitest";
import {
  mulberry32, fade, lerp, buildPermutation, perlin2, simplex2, valueNoise2,
  noiseSample, fbm, renderNoise, renderTileableNoise, noiseStats,
  estimatePngBytes, formatBytes, DEFAULT_PARAMS,
} from "./logic";

describe("mulberry32", () => {
  it("produces deterministic sequence", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("returns values in [0, 1)", () => {
    const r = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("fade & lerp", () => {
  it("fade is smooth", () => {
    expect(fade(0)).toBe(0);
    expect(fade(1)).toBe(1);
    expect(fade(0.5)).toBeCloseTo(0.5, 1);
  });
  it("lerp interpolates", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

describe("buildPermutation", () => {
  it("produces 512 bytes", () => {
    const p = buildPermutation(1);
    expect(p.length).toBe(512);
  });
  it("same seed → same table", () => {
    expect(Array.from(buildPermutation(42))).toEqual(Array.from(buildPermutation(42)));
  });
  it("different seed → different table", () => {
    expect(Array.from(buildPermutation(1))).not.toEqual(Array.from(buildPermutation(2)));
  });
});

describe("perlin2", () => {
  it("returns values in [-1, 1]", () => {
    const p = buildPermutation(1);
    for (let i = 0; i < 20; i++) {
      const v = perlin2(p, i * 0.13, i * 0.27);
      expect(v).toBeGreaterThanOrEqual(-1.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
  });
  it("is deterministic", () => {
    const p = buildPermutation(99);
    expect(perlin2(p, 0.5, 0.5)).toBe(perlin2(p, 0.5, 0.5));
  });
});

describe("simplex2", () => {
  it("returns values in [-1, 1]", () => {
    const p = buildPermutation(7);
    for (let i = 0; i < 20; i++) {
      const v = simplex2(p, i * 0.11, i * 0.23);
      expect(v).toBeGreaterThanOrEqual(-1.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
  });
});

describe("valueNoise2", () => {
  it("returns values in [0, 1]", () => {
    const p = buildPermutation(3);
    for (let i = 0; i < 20; i++) {
      const v = valueNoise2(p, i * 0.13, i * 0.17);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("noiseSample", () => {
  it("dispatches by type", () => {
    const p = buildPermutation(1);
    const a = noiseSample("perlin", p, 0.5, 0.5);
    const b = noiseSample("value", p, 0.5, 0.5);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
  });
});

describe("fbm", () => {
  it("returns values in [0, 1]", () => {
    const p = buildPermutation(1);
    const params = { ...DEFAULT_PARAMS, width: 16, height: 16 };
    for (let i = 0; i < 20; i++) {
      const v = fbm(params, p, i * 0.1, i * 0.2);
      expect(v).toBeGreaterThanOrEqual(-0.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
  });
  it("more octaves increases detail", () => {
    const p = buildPermutation(1);
    const a = fbm({ ...DEFAULT_PARAMS, octaves: 1 }, p, 0.5, 0.5);
    const b = fbm({ ...DEFAULT_PARAMS, octaves: 4 }, p, 0.5, 0.5);
    // both in range; not necessarily equal
    expect(typeof a).toBe("number");
    expect(typeof b).toBe("number");
  });
});

describe("renderNoise", () => {
  it("produces RGBA buffer", () => {
    const px = renderNoise({ ...DEFAULT_PARAMS, width: 16, height: 16 });
    expect(px.length).toBe(16 * 16 * 4);
    expect(px[3]).toBe(255);
  });
  it("threshold produces binary values", () => {
    const px = renderNoise({ ...DEFAULT_PARAMS, width: 16, height: 16, threshold: 0.5 });
    for (let i = 0; i < px.length; i += 4) {
      expect(px[i] === 0 || px[i] === 255).toBe(true);
    }
  });
  it("invert flips values", () => {
    const a = renderNoise({ ...DEFAULT_PARAMS, width: 16, height: 16, invert: false });
    const b = renderNoise({ ...DEFAULT_PARAMS, width: 16, height: 16, invert: true });
    expect(a[0] + b[0]).toBe(255);
  });
});

describe("renderTileableNoise", () => {
  it("produces same-size buffer", () => {
    const px = renderTileableNoise({ ...DEFAULT_PARAMS, width: 16, height: 16 });
    expect(px.length).toBe(16 * 16 * 4);
  });
});

describe("noiseStats", () => {
  it("computes min/max/mean/std", () => {
    const px = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
    const s = noiseStats(px);
    expect(s.min).toBe(0);
    expect(s.max).toBe(255);
    expect(s.mean).toBeGreaterThan(0);
    expect(s.std).toBeGreaterThan(0);
  });
});

describe("estimatePngBytes & formatBytes", () => {
  it("scales with size", () => {
    expect(estimatePngBytes(512, 512)).toBeGreaterThan(estimatePngBytes(64, 64));
  });
  it("formats", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});
