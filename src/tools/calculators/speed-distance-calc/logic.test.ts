import { describe, it, expect } from "vitest";
import { solveSdt, validateSdtInput, msToKmh, kmhToMs, kmhToMph } from "./logic";

describe("solveSdt — speed", () => {
  it("solves for speed = d/t", () => {
    const r = solveSdt({ solveFor: "speed", distance: 100, time: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.speed).toBe(50);
  });
  it("errors on time=0", () => {
    expect(solveSdt({ solveFor: "speed", distance: 100, time: 0 })).toHaveProperty("error");
  });
  it("errors when missing values", () => {
    expect(solveSdt({ solveFor: "speed", distance: 100 })).toHaveProperty("error");
  });
});

describe("solveSdt — distance", () => {
  it("solves distance = speed × time", () => {
    const r = solveSdt({ solveFor: "distance", speed: 60, time: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.distance).toBe(120);
  });
});

describe("solveSdt — time", () => {
  it("solves time = d/s", () => {
    const r = solveSdt({ solveFor: "time", speed: 50, distance: 100 });
    if ("error" in r) throw new Error("should not error");
    expect(r.time).toBe(2);
  });
  it("errors on speed=0", () => {
    expect(solveSdt({ solveFor: "time", speed: 0, distance: 100 })).toHaveProperty("error");
  });
});

describe("validateSdtInput", () => {
  it("accepts non-negative values", () => {
    expect(validateSdtInput({ solveFor: "speed", distance: 10, time: 2 })).toEqual({ ok: true });
  });
  it("rejects negative values", () => {
    expect(validateSdtInput({ solveFor: "speed", distance: -1, time: 2 })).toHaveProperty("error");
  });
});

describe("unit conversions", () => {
  it("m/s to km/h", () => {
    expect(msToKmh(10)).toBeCloseTo(36, 5);
  });
  it("km/h to m/s", () => {
    expect(kmhToMs(36)).toBeCloseTo(10, 5);
  });
  it("km/h to mph", () => {
    expect(kmhToMph(100)).toBeCloseTo(62.1371, 2);
  });
});
