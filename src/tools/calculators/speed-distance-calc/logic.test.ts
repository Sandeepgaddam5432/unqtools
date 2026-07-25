import { describe, it, expect } from "vitest";
import {
  solveSdt,
  validateSdtInput,
  msToKmh,
  kmhToMs,
  kmhToMph,
  mphToKmh,
  msToMph,
  knotToKmh,
  computeAcceleration,
  formatValue,
  historyToCsv,
  computeStats,
  solveSdtBatch,
  SPEED_TO_MS,
  DISTANCE_TO_M,
  TIME_TO_S,
} from "./logic";

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
  it("errors on negative distance", () => {
    expect(solveSdt({ solveFor: "speed", distance: -1, time: 2 })).toHaveProperty("error");
  });
  it("includes formula and explanation", () => {
    const r = solveSdt({ solveFor: "speed", distance: 100, time: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.formula).toContain("speed");
    expect(r.explanation).toContain("100");
  });
});

describe("solveSdt — distance", () => {
  it("solves distance = speed × time", () => {
    const r = solveSdt({ solveFor: "distance", speed: 60, time: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.distance).toBe(120);
  });
  it("errors on negative speed", () => {
    expect(solveSdt({ solveFor: "distance", speed: -1, time: 2 })).toHaveProperty("error");
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

describe("solveSdt — units", () => {
  it("converts kmh + hours to kmh", () => {
    const r = solveSdt({ solveFor: "speed", distance: 100, distanceUnit: "km", time: 2, timeUnit: "h", speedUnit: "kmh" });
    if ("error" in r) throw new Error("should not error");
    expect(r.speed).toBeCloseTo(50, 5);
  });
  it("converts miles + hours to mph", () => {
    const r = solveSdt({ solveFor: "speed", distance: 100, distanceUnit: "mi", time: 2, timeUnit: "h", speedUnit: "mph" });
    if ("error" in r) throw new Error("should not error");
    expect(r.speed).toBeCloseTo(50, 5);
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
  it("mph to km/h", () => {
    expect(mphToKmh(62.1371)).toBeCloseTo(100, 2);
  });
  it("m/s to mph", () => {
    expect(msToMph(1)).toBeCloseTo(2.236936, 4);
  });
  it("knots to km/h", () => {
    expect(knotToKmh(1)).toBeCloseTo(1.852, 3);
  });
});

describe("computeAcceleration", () => {
  it("computes acceleration", () => {
    const r = computeAcceleration({ initialSpeed: 0, finalSpeed: 30, time: 6, speedUnit: "ms", timeUnit: "s" });
    if ("error" in r) throw new Error("should not error");
    expect(r.acceleration).toBeCloseTo(5, 5);
  });
  it("errors on time=0", () => {
    expect(computeAcceleration({ initialSpeed: 0, finalSpeed: 10, time: 0 })).toHaveProperty("error");
  });
  it("computes km/h/s equivalent", () => {
    const r = computeAcceleration({ initialSpeed: 0, finalSpeed: 10, time: 2, speedUnit: "ms", timeUnit: "s" });
    if ("error" in r) throw new Error("should not error");
    expect(r.accelerationKmhPerS).toBeCloseTo(18, 0);
  });
});

describe("formatValue", () => {
  it("formats value with unit", () => {
    expect(formatValue(50, "km/h")).toBe("50 km/h");
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([{ ts: 1700000000000, solveFor: "speed", speed: 50, distance: 100, time: 2, formula: "speed = d/t" }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,SolveFor,Speed,Distance,Time,Formula");
    expect(csv).toContain("50");
  });
});

describe("computeStats", () => {
  it("returns solveFor and duration", () => {
    const s = computeStats({ solveFor: "speed", distance: 100, time: 2 });
    expect(s.solveFor).toBe("speed");
    expect(s.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("solveSdtBatch", () => {
  it("processes multiple inputs", () => {
    const results = solveSdtBatch([
      { solveFor: "speed", distance: 100, time: 2 },
      { solveFor: "distance", speed: 60, time: 2 },
    ]);
    expect(results.length).toBe(2);
    expect("error" in results[0]!).toBe(false);
  });
});

describe("conversion tables", () => {
  it("SPEED_TO_MS has 5 entries", () => {
    expect(Object.keys(SPEED_TO_MS).length).toBe(5);
  });
  it("DISTANCE_TO_M has 6 entries", () => {
    expect(Object.keys(DISTANCE_TO_M).length).toBe(6);
  });
  it("TIME_TO_S has 4 entries", () => {
    expect(Object.keys(TIME_TO_S).length).toBe(4);
  });
});
