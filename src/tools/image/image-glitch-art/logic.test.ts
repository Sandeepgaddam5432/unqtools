import { describe, it, expect } from "vitest";
import { makeRng, validateGlitchParams, luma, datamoshBlocks, channelShiftOffsets, sortByBrightness } from "./logic";

describe("makeRng", () => {
  it("is deterministic for same seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
  });
  it("produces values in [0,1)", () => {
    const r = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("validateGlitchParams", () => {
  it("accepts valid params", () => {
    expect(validateGlitchParams({ mode: "pixel-sort", intensity: 50, shift: 10, seed: 1 })).toEqual({ ok: true });
  });
  it("rejects unknown mode", () => {
    expect(validateGlitchParams({ mode: "x" as never, intensity: 50, shift: 10, seed: 1 })).toHaveProperty("error");
  });
  it("rejects out-of-range intensity", () => {
    expect(validateGlitchParams({ mode: "pixel-sort", intensity: 150, shift: 10, seed: 1 })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
});

describe("datamoshBlocks", () => {
  it("returns blocks within bounds", () => {
    const rng = makeRng(1);
    const blocks = datamoshBlocks(100, 50, rng);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b.y0).toBeGreaterThanOrEqual(0);
      expect(b.y1).toBeLessThanOrEqual(100);
      expect(b.y1).toBeGreaterThan(b.y0);
    }
  });
});

describe("channelShiftOffsets", () => {
  it("shifts bounded by shift amount", () => {
    const rng = makeRng(1);
    const o = channelShiftOffsets(20, rng);
    expect(Math.abs(o.r)).toBeLessThanOrEqual(20);
    expect(Math.abs(o.g)).toBeLessThanOrEqual(20);
    expect(Math.abs(o.b)).toBeLessThanOrEqual(20);
  });
});

describe("sortByBrightness", () => {
  it("orders darker first when reversed", () => {
    const dark: [number, number, number] = [10, 10, 10];
    const light: [number, number, number] = [240, 240, 240];
    expect(sortByBrightness(dark, light)).toBeGreaterThan(0);
  });
});
