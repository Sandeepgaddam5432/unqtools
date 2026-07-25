import { describe, it, expect } from "vitest";
import { calculateConcentration, solveForMoles, validateInput } from "./logic";

describe("calculateConcentration — molarity", () => {
  it("computes mol/L", () => {
    const r = calculateConcentration({ mode: "molarity", moles: 2, volume: 1, mass: 0, equivalents: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(2);
    expect(r.unit).toBe("M (mol/L)");
  });
  it("rejects zero volume", () => {
    expect("error" in calculateConcentration({ mode: "molarity", moles: 2, volume: 0, mass: 0, equivalents: 1 })).toBe(true);
  });
  it("handles fractional values", () => {
    const r = calculateConcentration({ mode: "molarity", moles: 0.5, volume: 0.25, mass: 0, equivalents: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(2);
  });
});

describe("calculateConcentration — molality", () => {
  it("computes mol/kg", () => {
    const r = calculateConcentration({ mode: "molality", moles: 1, volume: 0, mass: 0.5, equivalents: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(2);
    expect(r.unit).toBe("m (mol/kg)");
  });
  it("rejects zero mass", () => {
    expect("error" in calculateConcentration({ mode: "molality", moles: 1, volume: 0, mass: 0, equivalents: 1 })).toBe(true);
  });
});

describe("calculateConcentration — normality", () => {
  it("multiplies moles by equivalents", () => {
    const r = calculateConcentration({ mode: "normality", moles: 1, volume: 1, mass: 0, equivalents: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(2);
    expect(r.unit).toBe("N (eq/L)");
  });
  it("rejects zero equivalents", () => {
    expect("error" in calculateConcentration({ mode: "normality", moles: 1, volume: 1, mass: 0, equivalents: 0 })).toBe(true);
  });
  it("rejects negative moles", () => {
    expect("error" in calculateConcentration({ mode: "normality", moles: -1, volume: 1, mass: 0, equivalents: 1 })).toBe(true);
  });
});

describe("solveForMoles", () => {
  it("inverts molarity correctly", () => {
    expect(solveForMoles(2, "molarity", 1)).toBe(2);
  });
  it("inverts molality correctly", () => {
    expect(solveForMoles(2, "molality", 0.5)).toBe(1);
  });
  it("inverts normality correctly", () => {
    expect(solveForMoles(2, "normality", 1, 2)).toBe(1);
  });
});

describe("validateInput", () => {
  it("accepts valid mode", () => {
    expect(validateInput({ mode: "molarity", moles: 1, volume: 1, mass: 0, equivalents: 1 })).toEqual({ ok: true });
  });
  it("rejects invalid mode", () => {
    expect(validateInput({ mode: "invalid" as never, moles: 1, volume: 1, mass: 0, equivalents: 1 })).toHaveProperty("error");
  });
});
