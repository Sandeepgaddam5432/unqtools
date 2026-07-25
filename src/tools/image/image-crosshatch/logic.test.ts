import { describe, it, expect } from "vitest";
import {
  gradientDirection, hatchDirection, hatchLayers, layerAngle, generateHatchLines, validateCrosshatchOptions,
} from "./logic";

const OPTS = { spacing: 4, threshold1: 200, threshold2: 128, threshold3: 64 };

describe("gradientDirection", () => {
  it("returns 0 for uniform field", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    expect(gradientDirection(data, 1, 1, 4, 4)).toBeCloseTo(0, 5);
  });
  it("detects horizontal gradient", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(0);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = x * 60;
      const i = (y * 4 + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    const g = gradientDirection(data, 2, 2, 4, 4);
    expect(Math.abs(g)).toBeGreaterThan(0);
  });
});

describe("hatchDirection", () => {
  it("is perpendicular to gradient", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(0);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = x * 60;
      const i = (y * 4 + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    const g = gradientDirection(data, 2, 2, 4, 4);
    const h = hatchDirection(data, 2, 2, 4, 4);
    const diff = Math.abs(h - g - Math.PI / 2) % Math.PI;
    expect(diff).toBeCloseTo(0, 1);
  });
});

describe("hatchLayers", () => {
  it("returns no layers for bright pixels", () => {
    expect(hatchLayers(255, OPTS)).toEqual([]);
  });
  it("returns one layer for moderately dark pixels", () => {
    expect(hatchLayers(150, OPTS)).toEqual([0]);
  });
  it("returns multiple layers for very dark pixels", () => {
    expect(hatchLayers(30, OPTS)).toEqual([0, 1, 2]);
  });
});

describe("layerAngle", () => {
  it("returns 0, π/4, π/2 for layers 0,1,2", () => {
    expect(layerAngle(0)).toBe(0);
    expect(layerAngle(1)).toBeCloseTo(Math.PI / 4);
    expect(layerAngle(2)).toBeCloseTo(Math.PI / 2);
  });
});

describe("generateHatchLines", () => {
  it("produces line segments", () => {
    const lines = generateHatchLines(50, 50, OPTS);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toHaveProperty("x1");
    expect(lines[0]).toHaveProperty("x2");
  });
});

describe("validateCrosshatchOptions", () => {
  it("accepts valid descending thresholds", () => {
    expect(validateCrosshatchOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects ascending thresholds", () => {
    expect(validateCrosshatchOptions({ spacing: 4, threshold1: 50, threshold2: 128, threshold3: 200 })).toHaveProperty("error");
  });
  it("rejects bad spacing", () => {
    expect(validateCrosshatchOptions({ ...OPTS, spacing: 0 })).toHaveProperty("error");
  });
});
