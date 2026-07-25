import { describe, it, expect } from "vitest";
import {
  buildHistogram, clipHistogram, buildCdf, equalizeLuma, toLuma, applyLuma, validateClaheOptions,
} from "./logic";

describe("buildHistogram", () => {
  it("counts each value into the right bin", () => {
    const h = buildHistogram([0, 0, 255, 128]);
    expect(h[0]).toBe(2);
    expect(h[128]).toBe(1);
    expect(h[255]).toBe(1);
  });
  it("is 256 bins long", () => {
    expect(buildHistogram([]).length).toBe(256);
  });
  it("clamps out-of-range values", () => {
    const h = buildHistogram([-10, 300]);
    expect(h[0]).toBe(1);
    expect(h[255]).toBe(1);
  });
});

describe("clipHistogram", () => {
  it("does not change total pixel count", () => {
    const hist = new Array(256).fill(0);
    hist[100] = 1000;
    hist[200] = 500;
    const out = clipHistogram(hist, 5);
    const totalIn = hist.reduce((s, v) => s + v, 0);
    const totalOut = out.reduce((s, v) => s + v, 0);
    expect(totalOut).toBe(totalIn);
  });
  it("reduces peak bin magnitude", () => {
    const hist = new Array(256).fill(0);
    hist[100] = 1000;
    const out = clipHistogram(hist, 5);
    expect(out[100]!).toBeLessThan(1000);
  });
  it("distributes excess across bins", () => {
    const hist = new Array(256).fill(0);
    hist[100] = 1000;
    const out = clipHistogram(hist, 5);
    expect(out.filter((v) => v > 0).length).toBeGreaterThan(1);
  });
});

describe("buildCdf", () => {
  it("is monotonically non-decreasing", () => {
    const cdf = buildCdf(buildHistogram([10, 20, 30, 100, 200]));
    for (let i = 1; i < 256; i++) expect(cdf[i]!).toBeGreaterThanOrEqual(cdf[i - 1]!);
  });
  it("ends at total pixel count", () => {
    const cdf = buildCdf(buildHistogram([1, 2, 3]));
    expect(cdf[255]).toBe(3);
  });
});

describe("equalizeLuma", () => {
  it("returns 0 for empty histogram", () => {
    expect(equalizeLuma(100, new Array(256).fill(0), 0)).toBe(100);
  });
  it("maps to a valid byte range", () => {
    const cdf = buildCdf(buildHistogram([0, 50, 100, 150, 200, 250]));
    const out = equalizeLuma(100, cdf, 6);
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThanOrEqual(255);
  });
});

describe("toLuma / applyLuma", () => {
  it("computes luma per BT.601 weights", () => {
    expect(toLuma({ r: 100, g: 100, b: 100, a: 255 })).toBeCloseTo(100, 0);
  });
  it("preserves alpha", () => {
    const out = applyLuma({ r: 200, g: 100, b: 50, a: 128 }, 100);
    expect(out.a).toBe(128);
  });
  it("scales channels proportionally", () => {
    const out = applyLuma({ r: 100, g: 100, b: 100, a: 255 }, 200);
    expect(out.r).toBeGreaterThan(100);
  });
});

describe("validateClaheOptions", () => {
  it("accepts valid options", () => {
    expect(validateClaheOptions({ clipLimit: 30, tileSize: 32 })).toEqual({ ok: true });
  });
  it("rejects bad clip limit", () => {
    expect(validateClaheOptions({ clipLimit: 0, tileSize: 32 })).toHaveProperty("error");
  });
  it("rejects bad tile size", () => {
    expect(validateClaheOptions({ clipLimit: 30, tileSize: 4 })).toHaveProperty("error");
  });
});
