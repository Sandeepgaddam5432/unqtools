import { describe, it, expect } from "vitest";
import {
  validateFlare,
  distance,
  falloff,
  blendFlare,
  ghostPositions,
  starRayIntensity,
  haloIntensity,
  flareContribution,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("distance", () => {
  it("is 0 for same point", () => expect(distance(1, 1, 1, 1)).toBe(0));
  it("computes 3-4-5 triangle", () => expect(distance(0, 0, 3, 4)).toBe(5));
  it("is symmetric", () => expect(distance(0, 0, 1, 1)).toBe(distance(1, 1, 0, 0)));
});

describe("falloff", () => {
  it("is 1 at distance 0", () => expect(falloff(0, 1)).toBe(1));
  it("is 0 for radius 0 and non-zero distance", () => expect(falloff(1, 0)).toBe(0));
  it("is 1 for radius 0 and distance 0", () => expect(falloff(0, 0)).toBe(1));
  it("decreases with distance", () => {
    expect(falloff(1, 1)).toBeGreaterThan(falloff(2, 1));
  });
});

describe("validateFlare", () => {
  it("returns sanitized options for valid input", () => {
    const r = validateFlare(DEFAULT_OPTIONS);
    expect("error" in r).toBe(false);
  });
  it("rejects non-finite position", () => {
    expect("error" in validateFlare({ ...DEFAULT_OPTIONS, fx: Number.NaN })).toBe(true);
  });
  it("rejects out-of-range intensity", () => {
    expect("error" in validateFlare({ ...DEFAULT_OPTIONS, intensity: 2 })).toBe(true);
  });
  it("rejects bad color", () => {
    expect("error" in validateFlare({ ...DEFAULT_OPTIONS, color: [300, 0, 0] })).toBe(true);
  });
  it("rejects bad rays", () => {
    expect("error" in validateFlare({ ...DEFAULT_OPTIONS, rays: 100 })).toBe(true);
  });
  it("rejects bad ray length", () => {
    expect("error" in validateFlare({ ...DEFAULT_OPTIONS, rayLength: 2 })).toBe(true);
  });
  it("rejects bad ghosts", () => {
    expect("error" in validateFlare({ ...DEFAULT_OPTIONS, ghosts: 20 })).toBe(true);
  });
  it("clamps position to 0..1", () => {
    const r = validateFlare({ ...DEFAULT_OPTIONS, fx: -1, fy: 2 });
    if (!("error" in r)) {
      expect(r.fx).toBe(0);
      expect(r.fy).toBe(1);
    }
  });
});

describe("blendFlare", () => {
  it("blends by amount", () => {
    const out = blendFlare([100, 100, 100, 255], [200, 200, 200], 0.5);
    expect(out[0]).toBe(150);
  });
  it("preserves alpha", () => {
    const out = blendFlare([100, 100, 100, 128], [200, 200, 200], 1);
    expect(out[3]).toBe(128);
  });
  it("amount 0 is identity", () => {
    const out = blendFlare([100, 100, 100, 255], [200, 200, 200], 0);
    expect(out[0]).toBe(100);
  });
});

describe("ghostPositions", () => {
  it("returns requested count", () => {
    expect(ghostPositions(0.3, 0.3, 4).length).toBe(4);
  });
  it("returns empty for count 0", () => {
    expect(ghostPositions(0.3, 0.3, 0)).toEqual([]);
  });
  it("scales ghosts", () => {
    const ghosts = ghostPositions(0.3, 0.3, 3);
    for (const g of ghosts) {
      expect(g.scale).toBeGreaterThan(0);
      expect(g.scale).toBeLessThanOrEqual(1);
    }
  });
});

describe("starRayIntensity + haloIntensity", () => {
  it("star ray is 0 at center", () => {
    expect(starRayIntensity(0, 0, 6, 0.5)).toBe(0);
  });
  it("star ray is 0 when rayCount 0", () => {
    expect(starRayIntensity(0.1, 0, 0, 0.5)).toBe(0);
  });
  it("star ray is positive along ray direction", () => {
    expect(starRayIntensity(0.05, 0, 4, 0.5)).toBeGreaterThan(0);
  });
  it("halo is 0 at center", () => {
    expect(haloIntensity(0, 0.15)).toBe(0);
  });
  it("halo is positive at ring radius", () => {
    expect(haloIntensity(0.15, 0.15)).toBeGreaterThan(0);
  });
  it("halo is 0 when radius 0", () => {
    expect(haloIntensity(0.1, 0)).toBe(0);
  });
});

describe("flareContribution", () => {
  it("is 0 when intensity 0", () => {
    expect(flareContribution(0.5, 0.5, { ...DEFAULT_OPTIONS, intensity: 0 })).toBe(0);
  });
  it("is positive at flare center", () => {
    const c = flareContribution(DEFAULT_OPTIONS.fx, DEFAULT_OPTIONS.fy, DEFAULT_OPTIONS);
    expect(c).toBeGreaterThan(0);
  });
  it("is 0..1 range", () => {
    const c = flareContribution(0.4, 0.4, DEFAULT_OPTIONS);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when intensity 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, intensity: 0 })).toBe(true);
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments by 0.01", () => {
    expect(nudgeValue(0.5, "arrowup", false)).toBeCloseTo(0.51);
  });
  it("nudgeValue increments by 0.1 with shift", () => {
    expect(nudgeValue(0.5, "arrowup", true)).toBeCloseTo(0.6);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("anamorphic")?.options.color[0]).toBe(120);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
