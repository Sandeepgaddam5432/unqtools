import { describe, it, expect } from "vitest";
import { validateFlare, falloff, blendFlare, ghostPositions } from "./logic";

describe("validateFlare", () => {
  it("passes through valid options", () => {
    const r = validateFlare({ fx: 0.5, fy: 0.5, intensity: 0.8, color: [255, 200, 100] });
    expect(r).toEqual({ fx: 0.5, fy: 0.5, intensity: 0.8, color: [255, 200, 100] });
  });
  it("clamps position to [0,1]", () => {
    const r = validateFlare({ fx: -1, fy: 2, intensity: 0.5, color: [0, 0, 0] });
    if ("error" in r) throw new Error("should not error");
    expect(r.fx).toBe(0);
    expect(r.fy).toBe(1);
  });
  it("errors on bad intensity", () => {
    expect(validateFlare({ fx: 0.5, fy: 0.5, intensity: 2, color: [0, 0, 0] })).toHaveProperty("error");
  });
  it("errors on bad color", () => {
    expect(validateFlare({ fx: 0.5, fy: 0.5, intensity: 0.5, color: [300, 0, 0] })).toHaveProperty("error");
  });
  it("errors on NaN position", () => {
    expect(validateFlare({ fx: NaN, fy: 0.5, intensity: 0.5, color: [0, 0, 0] })).toHaveProperty("error");
  });
});

describe("falloff", () => {
  it("is 1 at distance 0", () => {
    expect(falloff(0, 100)).toBeCloseTo(1);
  });
  it("decreases with distance", () => {
    expect(falloff(50, 100)).toBeGreaterThan(falloff(100, 100));
  });
  it("is 0 outside radius when radius is 0", () => {
    expect(falloff(5, 0)).toBe(0);
  });
  it("is 1 at distance 0 when radius is 0", () => {
    expect(falloff(0, 0)).toBe(1);
  });
});

describe("blendFlare", () => {
  it("blends toward flare color", () => {
    const r = blendFlare([0, 0, 0, 255], [255, 255, 255], 0.5);
    expect(r[0]).toBe(128);
    expect(r[3]).toBe(255);
  });
  it("keeps original at amount 0", () => {
    expect(blendFlare([10, 20, 30, 255], [200, 200, 200], 0)).toEqual([10, 20, 30, 255]);
  });
  it("reaches flare color at amount 1", () => {
    expect(blendFlare([10, 20, 30, 255], [200, 200, 200], 1)).toEqual([200, 200, 200, 255]);
  });
  it("clamps amount > 1", () => {
    expect(blendFlare([0, 0, 0, 255], [255, 255, 255], 5)).toEqual([255, 255, 255, 255]);
  });
});

describe("ghostPositions", () => {
  it("returns count entries", () => {
    expect(ghostPositions(0.5, 0.5, 4).length).toBe(4);
  });
  it("each entry has scale in [0,1.5]", () => {
    for (const g of ghostPositions(0.2, 0.3, 5)) {
      expect(g.scale).toBeGreaterThanOrEqual(0);
      expect(g.scale).toBeLessThanOrEqual(1.5);
      expect(g.x).toBeGreaterThanOrEqual(-1);
      expect(g.y).toBeGreaterThanOrEqual(-1);
    }
  });
  it("returns empty for count 0", () => {
    expect(ghostPositions(0.5, 0.5, 0)).toEqual([]);
  });
});
