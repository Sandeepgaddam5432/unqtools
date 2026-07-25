import { describe, it, expect } from "vitest";
import { calculateMolarity, solveForMoles, solveForVolume, massToMoles, validateInput } from "./logic";

describe("calculateMolarity", () => {
  it("computes moles ÷ volume", () => {
    const r = calculateMolarity({ moles: 2, volume: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.molarity).toBe(2);
  });
  it("handles fractional values", () => {
    const r = calculateMolarity({ moles: 0.5, volume: 0.25 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.molarity).toBe(2);
  });
  it("rejects zero volume", () => {
    expect("error" in calculateMolarity({ moles: 1, volume: 0 })).toBe(true);
  });
  it("rejects negative moles", () => {
    expect("error" in calculateMolarity({ moles: -1, volume: 1 })).toBe(true);
  });
});

describe("solveForMoles", () => {
  it("multiplies molarity by volume", () => {
    expect(solveForMoles(2, 1)).toBe(2);
  });
  it("rejects zero volume", () => {
    expect("error" in solveForMoles(2, 0)).toBe(true);
  });
});

describe("solveForVolume", () => {
  it("divides moles by molarity", () => {
    expect(solveForVolume(2, 1)).toBe(0.5);
  });
  it("rejects zero molarity", () => {
    expect("error" in solveForVolume(0, 1)).toBe(true);
  });
});

describe("massToMoles", () => {
  it("divides mass by molar mass", () => {
    expect(massToMoles(36, 18)).toBe(2);
  });
  it("rejects zero molar mass", () => {
    expect("error" in massToMoles(36, 0)).toBe(true);
  });
  it("rejects negative mass", () => {
    expect("error" in massToMoles(-1, 18)).toBe(true);
  });
});

describe("validateInput", () => {
  it("accepts numeric inputs", () => {
    expect(validateInput({ moles: 1, volume: 1 })).toEqual({ ok: true });
  });
  it("rejects non-numeric inputs", () => {
    expect(validateInput({ moles: "x" as unknown as number, volume: 1 })).toHaveProperty("error");
  });
});
