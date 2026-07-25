import { describe, it, expect } from "vitest";
import { calculateEnzymeActivity, specificActivity, unitsToKatal, validateInput } from "./logic";

describe("calculateEnzymeActivity", () => {
  it("computes U/mL from formula", () => {
    const r = calculateEnzymeActivity({
      deltaA: 0.1, deltaTime: 1, totalVolume: 1, extinction: 1, pathLength: 1, sampleVolume: 1,
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.activityUml).toBe(0.1);
  });
  it("computes U/L from U/mL", () => {
    const r = calculateEnzymeActivity({
      deltaA: 0.5, deltaTime: 1, totalVolume: 2, extinction: 1, pathLength: 1, sampleVolume: 0.5,
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.activityUml).toBe(2);
    expect(r.activityUL).toBe(2000);
  });
  it("rejects zero delta time", () => {
    expect("error" in calculateEnzymeActivity({ deltaA: 0.1, deltaTime: 0, totalVolume: 1, extinction: 1, pathLength: 1, sampleVolume: 1 })).toBe(true);
  });
  it("rejects zero sample volume", () => {
    expect("error" in calculateEnzymeActivity({ deltaA: 0.1, deltaTime: 1, totalVolume: 1, extinction: 1, pathLength: 1, sampleVolume: 0 })).toBe(true);
  });
  it("rejects zero extinction", () => {
    expect("error" in calculateEnzymeActivity({ deltaA: 0.1, deltaTime: 1, totalVolume: 1, extinction: 0, pathLength: 1, sampleVolume: 1 })).toBe(true);
  });
});

describe("specificActivity", () => {
  it("computes U/mg", () => {
    expect(specificActivity(100, 5)).toBe(20);
  });
  it("rejects zero concentration", () => {
    expect("error" in specificActivity(100, 0)).toBe(true);
  });
});

describe("unitsToKatal", () => {
  it("converts U to katal", () => {
    expect(unitsToKatal(1)).toBeCloseTo(16.67e-9, 15);
  });
  it("scales linearly", () => {
    expect(unitsToKatal(2)).toBeCloseTo(2 * 16.67e-9, 15);
  });
});

describe("validateInput", () => {
  it("accepts numeric ΔA", () => {
    expect(validateInput({ deltaA: 0.1, deltaTime: 1, totalVolume: 1, extinction: 1, pathLength: 1, sampleVolume: 1 })).toEqual({ ok: true });
  });
  it("rejects non-numeric ΔA", () => {
    expect(validateInput({ deltaA: "x" as unknown as number, deltaTime: 1, totalVolume: 1, extinction: 1, pathLength: 1, sampleVolume: 1 })).toHaveProperty("error");
  });
});
