import { describe, it, expect } from "vitest";
import {
  calculateConcentration, solveForMoles, solveForOther,
  gramsToMoles, molesToGrams, convertVolume, convertMass,
  dilutionV1, dilutionC2, validateInput, batchCalculate, batchToCsv, fmt,
  VOLUME_TO_L, MASS_TO_KG,
} from "./logic";
import type { ConcentrationInput } from "./logic";

const base: ConcentrationInput = {
  mode: "molarity", moles: 2, volume: 1, mass: 1,
  equivalents: 1, soluteMass: 10, solutionMass: 100, precision: 4,
};

describe("calculateConcentration — molarity", () => {
  it("computes mol/L", () => {
    const r = calculateConcentration({ ...base, mode: "molarity", moles: 2, volume: 1 });
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.result).toBe(2);
      expect(r.unit).toContain("mol/L");
    }
  });
  it("errors on zero volume", () => {
    expect(calculateConcentration({ ...base, mode: "molarity", volume: 0 })).toHaveProperty("error");
  });
  it("errors on negative moles", () => {
    expect(calculateConcentration({ ...base, mode: "molarity", moles: -1 })).toHaveProperty("error");
  });
});

describe("calculateConcentration — molality", () => {
  it("computes mol/kg", () => {
    const r = calculateConcentration({ ...base, mode: "molality", moles: 1, mass: 2 });
    if (!("error" in r)) expect(r.result).toBe(0.5);
  });
  it("errors on zero mass", () => {
    expect(calculateConcentration({ ...base, mode: "molality", mass: 0 })).toHaveProperty("error");
  });
});

describe("calculateConcentration — normality", () => {
  it("multiplies moles × equivalents", () => {
    const r = calculateConcentration({ ...base, mode: "normality", moles: 1, volume: 1, equivalents: 2 });
    if (!("error" in r)) expect(r.result).toBe(2);
  });
  it("errors on zero equivalents", () => {
    expect(calculateConcentration({ ...base, mode: "normality", equivalents: 0 })).toHaveProperty("error");
  });
});

describe("calculateConcentration — massPercent", () => {
  it("computes % w/w", () => {
    const r = calculateConcentration({ ...base, mode: "massPercent", soluteMass: 25, solutionMass: 100 });
    if (!("error" in r)) expect(r.result).toBe(25);
  });
  it("errors when solute > solution", () => {
    expect(calculateConcentration({ ...base, mode: "massPercent", soluteMass: 150, solutionMass: 100 })).toHaveProperty("error");
  });
});

describe("solveForMoles", () => {
  it("molarity", () => {
    expect(solveForMoles(2, "molarity", 1)).toBe(2);
  });
  it("normality divides by equivalents", () => {
    expect(solveForMoles(2, "normality", 1, 2)).toBe(1);
  });
  it("rejects massPercent mode", () => {
    expect(solveForMoles(2, "massPercent", 1)).toHaveProperty("error");
  });
});

describe("solveForOther", () => {
  it("molarity: moles/target", () => {
    expect(solveForOther(2, 1, "molarity")).toBe(2);
  });
  it("normality: moles × eq / target", () => {
    expect(solveForOther(2, 1, "normality", 2)).toBe(4);
  });
  it("rejects massPercent mode", () => {
    expect(solveForOther(2, 1, "massPercent")).toHaveProperty("error");
  });
});

describe("gramsToMoles / molesToGrams", () => {
  it("converts grams → moles", () => {
    expect(gramsToMoles(58.44, 58.44)).toBeCloseTo(1, 5);
  });
  it("errors on zero molar mass", () => {
    expect(gramsToMoles(10, 0)).toHaveProperty("error");
  });
  it("converts moles → grams", () => {
    expect(molesToGrams(1, 58.44)).toBeCloseTo(58.44, 5);
  });
});

describe("convertVolume / convertMass", () => {
  it("L → mL", () => {
    expect(convertVolume(1, "L", "mL")).toBe(1000);
  });
  it("mL → µL", () => {
    expect(convertVolume(1, "mL", "µL")).toBeCloseTo(1000, 5);
  });
  it("errors on unknown volume unit", () => {
    expect(convertVolume(1, "gallon", "L")).toHaveProperty("error");
  });
  it("kg → g", () => {
    expect(convertMass(1, "kg", "g")).toBe(1000);
  });
  it("g → mg", () => {
    expect(convertMass(1, "g", "mg")).toBeCloseTo(1000, 5);
  });
  it("errors on unknown mass unit", () => {
    expect(convertMass(1, "pound", "g")).toHaveProperty("error");
  });
});

describe("dilutionV1 / dilutionC2", () => {
  it("computes V1 from C1, C2, V2", () => {
    expect(dilutionV1(10, 1, 100)).toBe(10);
  });
  it("errors when C2 > C1", () => {
    expect(dilutionV1(1, 10, 100)).toHaveProperty("error");
  });
  it("computes C2 from C1, V1, V2", () => {
    expect(dilutionC2(10, 10, 100)).toBe(1);
  });
});

describe("validateInput", () => {
  it("accepts valid mode", () => {
    expect(validateInput(base)).toEqual({ ok: true });
  });
  it("rejects invalid mode", () => {
    expect(validateInput({ ...base, mode: "bogus" as never })).toHaveProperty("error");
  });
});

describe("batchCalculate / batchToCsv", () => {
  it("returns results for each input", () => {
    const r = batchCalculate([
      { ...base, moles: 2, volume: 1 },
      { ...base, moles: -1, volume: 1 },
    ]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
  it("renders CSV with header and rows", () => {
    const r = batchCalculate([{ ...base, moles: 2, volume: 1 }]);
    const csv = batchToCsv(r);
    expect(csv.split("\n")[0]).toBe("index,mode,result,unit,explanation");
    expect(csv).toContain("molarity");
  });
});

describe("fmt", () => {
  it("trims to precision", () => {
    expect(fmt(1.234567, 2)).toBe("1.23");
  });
  it("em-dash for non-finite", () => {
    expect(fmt(NaN)).toBe("—");
  });
});

describe("unit tables", () => {
  it("VOLUME_TO_L has 4 units", () => {
    expect(Object.keys(VOLUME_TO_L)).toHaveLength(4);
  });
  it("MASS_TO_KG has 4 units", () => {
    expect(Object.keys(MASS_TO_KG)).toHaveLength(4);
  });
});
