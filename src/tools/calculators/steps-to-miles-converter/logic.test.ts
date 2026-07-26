/**
 * Steps to Miles Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { convertSteps, stepsTable, targetSteps } from "./logic";

describe("convertSteps — validation", () => {
  it("errors on zero steps", () => {
    expect("error" in convertSteps({ steps: 0 })).toBe(true);
  });
  it("errors on negative steps", () => {
    expect("error" in convertSteps({ steps: -100 })).toBe(true);
  });
  it("errors on unrealistic count", () => {
    expect("error" in convertSteps({ steps: 1e9 })).toBe(true);
  });
});

describe("convertSteps — distance", () => {
  it("computes distance using average stride when no height given", () => {
    const r = convertSteps({ steps: 10000 });
    if ("error" in r) throw new Error("should not error");
    // 10000 × 26.4 in / 63360 in/mi ≈ 4.17 mi
    expect(r.distanceMiles).toBeCloseTo(4.17, 1);
    expect(r.distanceKm).toBeCloseTo(6.7, 0);
  });
  it("uses height-based stride for imperial input", () => {
    const r = convertSteps({ steps: 10000, height: 70, sex: "male", unitSystem: "imperial" });
    if ("error" in r) throw new Error("should not error");
    // stride = 70 * 0.415 = 29.05 in; 10000 * 29.05 / 63360 = 4.585 mi
    expect(r.strideInches).toBeCloseTo(29.05, 1);
    expect(r.distanceMiles).toBeCloseTo(4.59, 1);
  });
  it("uses height-based stride for metric input", () => {
    const r = convertSteps({ steps: 10000, height: 178, sex: "male", unitSystem: "metric" });
    if ("error" in r) throw new Error("should not error");
    // 178 cm ≈ 70.08 in → same stride
    expect(r.strideCm).toBeCloseTo(178 * 0.415, 1);
  });
  it("female stride is shorter than male", () => {
    const male = convertSteps({ steps: 10000, height: 175, sex: "male", unitSystem: "metric" });
    const female = convertSteps({ steps: 10000, height: 175, sex: "female", unitSystem: "metric" });
    if ("error" in male || "error" in female) throw new Error("should not error");
    expect(female.distanceMiles).toBeLessThan(male.distanceMiles);
  });
});

describe("convertSteps — duration & calories", () => {
  it("computes duration based on pace", () => {
    const r = convertSteps({ steps: 10000, paceMph: 3.0 });
    if ("error" in r) throw new Error("should not error");
    // ~4.17 mi at 3 mph = ~1.39 h = ~83.4 min
    expect(r.durationMinutes).toBeGreaterThan(70);
    expect(r.durationMinutes).toBeLessThan(95);
  });
  it("computes calories when weight is given", () => {
    const r = convertSteps({ steps: 10000, weight: 70, unitSystem: "metric" });
    if ("error" in r) throw new Error("should not error");
    expect(r.caloriesBurned).toBeGreaterThan(200);
    expect(r.caloriesBurned).toBeLessThan(400);
  });
  it("returns 0 calories when no weight given", () => {
    const r = convertSteps({ steps: 10000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.caloriesBurned).toBe(0);
    expect(r.warnings.some((w) => w.includes("weight"))).toBe(true);
  });
  it("converts imperial weight to kg for calorie calc", () => {
    const metric = convertSteps({ steps: 10000, weight: 70, unitSystem: "metric" });
    const imperial = convertSteps({ steps: 10000, weight: 154.32, unitSystem: "imperial" });
    if ("error" in metric || "error" in imperial) throw new Error("should not error");
    expect(imperial.caloriesBurned).toBeCloseTo(metric.caloriesBurned, -1);
  });
});

describe("convertSteps — warnings", () => {
  it("warns when height missing", () => {
    const r = convertSteps({ steps: 5000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("height"))).toBe(true);
  });
});

describe("stepsTable", () => {
  it("produces a CSV table with multiple rows", () => {
    const csv = stepsTable({ unitSystem: "metric", weight: 70 });
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Steps");
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe("targetSteps", () => {
  it("returns step count for a given target distance", () => {
    const s = targetSteps(5, { height: 70, sex: "male", unitSystem: "imperial" });
    expect(typeof s).toBe("number");
    expect(s!).toBeGreaterThan(8000);
    expect(s!).toBeLessThan(12000);
  });
  it("errors on zero target", () => {
    expect("error" in targetSteps(0, {})).toBe(true);
  });
});
