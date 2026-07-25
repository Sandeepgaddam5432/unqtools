import { describe, it, expect } from "vitest";
import {
  calculateMolarity,
  solveForMoles,
  solveForVolume,
  massToMoles,
  molesToMass,
  calculateDilution,
  validateInput,
  formatValue,
  historyToCsv,
  calculateMolarityBatch,
  COMMON_MOLAR_MASSES,
  VOLUME_TO_L,
  AMOUNT_TO_MOL,
} from "./logic";

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
  it("converts mL volume", () => {
    const r = calculateMolarity({ moles: 1, volume: 500, volumeUnit: "mL" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.molarity).toBe(2);
  });
  it("converts mmol amount", () => {
    const r = calculateMolarity({ moles: 1000, volume: 1, amountUnit: "mmol" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.molarity).toBe(1);
  });
  it("includes formula and explanation", () => {
    const r = calculateMolarity({ moles: 2, volume: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.formula).toBe("M = n / V");
    expect(r.explanation).toContain("2");
  });
});

describe("solveForMoles", () => {
  it("multiplies molarity by volume", () => {
    expect(solveForMoles(2, 1)).toBe(2);
  });
  it("rejects zero volume", () => {
    expect("error" in solveForMoles(2, 0)).toBe(true);
  });
  it("converts units", () => {
    expect(solveForMoles(2, 500, "mL")).toBe(1);
    expect(solveForMoles(2, 1, "L", "mmol")).toBe(2000);
  });
});

describe("solveForVolume", () => {
  it("divides moles by molarity", () => {
    expect(solveForVolume(2, 1)).toBe(0.5);
  });
  it("rejects zero molarity", () => {
    expect("error" in solveForVolume(0, 1)).toBe(true);
  });
  it("converts units", () => {
    expect(solveForVolume(1, 1, "mol", "mL")).toBe(1000);
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

describe("molesToMass", () => {
  it("multiplies moles by molar mass", () => {
    expect(molesToMass(2, 18)).toBe(36);
  });
  it("rejects zero molar mass", () => {
    expect("error" in molesToMass(2, 0)).toBe(true);
  });
});

describe("calculateDilution", () => {
  it("solves V2 = C1V1/C2", () => {
    const r = calculateDilution({ c1: 10, v1: 5, c2: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.v2).toBe(25);
  });
  it("errors on c2=0", () => {
    expect("error" in calculateDilution({ c1: 10, v1: 5, c2: 0 })).toBe(true);
  });
  it("returns provided v2 as-is", () => {
    const r = calculateDilution({ c1: 10, v1: 5, c2: 2, v2: 25 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.v2).toBe(25);
    expect(r.explanation).toContain("25");
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

describe("formatValue", () => {
  it("formats with unit", () => {
    expect(formatValue(2.5, "M")).toBe("2.5 M");
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([{ ts: 1700000000000, mode: "molarity", result: "2 M" }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Mode,Result");
    expect(csv).toContain("2 M");
  });
});

describe("calculateMolarityBatch", () => {
  it("processes multiple inputs", () => {
    const results = calculateMolarityBatch([
      { moles: 2, volume: 1 },
      { moles: 1, volume: 1 },
    ]);
    expect(results.length).toBe(2);
  });
});

describe("common molar masses", () => {
  it("includes water and NaCl", () => {
    expect(COMMON_MOLAR_MASSES["H₂O (Water)"]).toBe(18.015);
    expect(COMMON_MOLAR_MASSES["NaCl (Sodium chloride)"]).toBe(58.44);
  });
});

describe("conversion tables", () => {
  it("VOLUME_TO_L has 3 entries", () => {
    expect(Object.keys(VOLUME_TO_L).length).toBe(3);
  });
  it("AMOUNT_TO_MOL has 3 entries", () => {
    expect(Object.keys(AMOUNT_TO_MOL).length).toBe(3);
  });
});
