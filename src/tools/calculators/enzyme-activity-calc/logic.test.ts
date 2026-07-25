import { describe, it, expect } from "vitest";
import {
  calculateEnzymeActivity, specificActivity, turnoverNumber,
  michaelisMenten, lineweaverBurk,
  unitsToKatal, katalToUnits, umlToUl, molarToMgMl,
  validateInput, batchCalculate, batchToCsv, fmt,
} from "./logic";

const base = {
  deltaA: 0.5, deltaTime: 1, totalVolume: 1, extinction: 1,
  pathLength: 1, sampleVolume: 1, precision: 4,
};

describe("calculateEnzymeActivity", () => {
  it("computes U/mL = (ΔA/Δt × V) / (ε × l × v)", () => {
    const r = calculateEnzymeActivity(base);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.activityUml).toBeCloseTo(0.5, 4);
      expect(r.activityUL).toBeCloseTo(500, 1);
    }
  });
  it("errors on non-positive deltaTime", () => {
    expect(calculateEnzymeActivity({ ...base, deltaTime: 0 })).toHaveProperty("error");
  });
  it("errors on zero total volume", () => {
    expect(calculateEnzymeActivity({ ...base, totalVolume: 0 })).toHaveProperty("error");
  });
  it("errors on zero extinction", () => {
    expect(calculateEnzymeActivity({ ...base, extinction: 0 })).toHaveProperty("error");
  });
  it("errors on zero sample volume", () => {
    expect(calculateEnzymeActivity({ ...base, sampleVolume: 0 })).toHaveProperty("error");
  });
  it("returns explanation string", () => {
    const r = calculateEnzymeActivity(base);
    if (!("error" in r)) expect(r.explanation).toContain("U/mL");
  });
});

describe("specificActivity", () => {
  it("divides activity by concentration", () => {
    expect(specificActivity(100, 2)).toBeCloseTo(50, 4);
  });
  it("errors on negative activity", () => {
    expect(specificActivity(-1, 2)).toHaveProperty("error");
  });
  it("errors on zero concentration", () => {
    expect(specificActivity(100, 0)).toHaveProperty("error");
  });
});

describe("turnoverNumber", () => {
  it("computes kcat = Vmax / [E] / 60", () => {
    // Vmax = 60 U/mL = 60 µmol/mL/min = 1 µmol/mL/s. [E] = 1 µM = 1e-6 mol/L = 1e-9 mol/mL
    // kcat = 1e-6 / 1e-9 = 1000 s⁻¹
    const k = turnoverNumber(60, 1e-6, 2);
    expect(k).toBeCloseTo(1000, 0);
  });
  it("errors on zero Vmax", () => {
    expect(turnoverNumber(0, 1e-6)).toHaveProperty("error");
  });
  it("errors on zero [E]", () => {
    expect(turnoverNumber(60, 0)).toHaveProperty("error");
  });
});

describe("michaelisMenten", () => {
  it("returns Vmax/2 when [S] = Km", () => {
    expect(michaelisMenten(100, 10, 10)).toBeCloseTo(50, 4);
  });
  it("approaches Vmax at saturating [S]", () => {
    expect(michaelisMenten(100, 1, 1e6)).toBeCloseTo(100, 1);
  });
  it("returns 0 at [S] = 0", () => {
    expect(michaelisMenten(100, 1, 0)).toBe(0);
  });
  it("errors on zero Vmax", () => {
    expect(michaelisMenten(0, 1, 1)).toHaveProperty("error");
  });
});

describe("lineweaverBurk", () => {
  it("returns inverse points", () => {
    const pts = lineweaverBurk(100, 10, [5, 10, 20]);
    expect(Array.isArray(pts)).toBe(true);
    if (Array.isArray(pts)) {
      expect(pts).toHaveLength(3);
      expect(pts[0]!.invS).toBeCloseTo(0.2, 4);
    }
  });
  it("filters out non-positive substrate", () => {
    const pts = lineweaverBurk(100, 10, [0, -1, 5]);
    if (Array.isArray(pts)) expect(pts).toHaveLength(1);
  });
  it("errors on invalid Vmax", () => {
    expect(lineweaverBurk(0, 10, [1])).toHaveProperty("error");
  });
});

describe("unit conversions", () => {
  it("1 U = 16.67 nkat", () => {
    expect(unitsToKatal(1)).toBeCloseTo(16.67e-9, 12);
  });
  it("katalToUnits inverts unitsToKatal", () => {
    expect(katalToUnits(unitsToKatal(5))).toBeCloseTo(5, 2);
  });
  it("U/mL → U/L multiplies by 1000", () => {
    expect(umlToUl(1.5)).toBe(1500);
  });
});

describe("molarToMgMl", () => {
  it("converts M to mg/mL via molar mass", () => {
    // 1 M NaCl (58.44 g/mol) = 58440 mg/L = 58.44 mg/mL
    expect(molarToMgMl(1, 58.44)).toBeCloseTo(58440, 0);
  });
  it("errors on zero molar mass", () => {
    expect(molarToMgMl(1, 0)).toHaveProperty("error");
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(base)).toEqual({ ok: true });
  });
  it("rejects non-number deltaA", () => {
    expect(validateInput({ ...base, deltaA: "x" as unknown as number })).toHaveProperty("error");
  });
});

describe("batchCalculate / batchToCsv", () => {
  it("returns results for each input", () => {
    const r = batchCalculate([base, { ...base, deltaTime: 0 }]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchCalculate([base]));
    expect(csv.split("\n")[0]).toBe("index,U/mL,U/L,explanation");
    expect(csv).toContain("0.5");
  });
});

describe("fmt", () => {
  it("trims to precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for non-finite", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
