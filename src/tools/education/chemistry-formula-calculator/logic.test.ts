import { describe, it, expect, beforeEach } from "vitest";
import {
  PERIODIC_TABLE,
  ISOTOPE_MASSES,
  CALC_TYPES,
  COMPOUND_PRESETS,
  parseFormula,
  validateFormula,
  lookupElement,
  normalizeFormula,
  calculateMolarMass,
  molarMassOf,
  molarMassBreakdown,
  percentComposition,
  parseExperimentalData,
  empiricalFormula,
  molecularFormula,
  parseEquation,
  balanceEquation,
  computeSummary,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  sortByHillConvention,
  type CalculationType,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("chemistry constants", () => {
  it("has 118 periodic-table elements", () => {
    expect(PERIODIC_TABLE).toHaveLength(118);
  });
  it("first element is hydrogen", () => {
    expect(PERIODIC_TABLE[0].symbol).toBe("H");
    expect(PERIODIC_TABLE[0].number).toBe(1);
  });
  it("last element is oganesson (118)", () => {
    expect(PERIODIC_TABLE[117].symbol).toBe("Og");
    expect(PERIODIC_TABLE[117].number).toBe(118);
  });
  it("has 5 calculation types", () => {
    expect(CALC_TYPES).toHaveLength(5);
  });
  it("has at least 10 compound presets", () => {
    expect(COMPOUND_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("has isotope data for common elements", () => {
    expect(ISOTOPE_MASSES.H).toBeDefined();
    expect(ISOTOPE_MASSES.C).toBeDefined();
    expect(ISOTOPE_MASSES.C["12"]).toBe(12.0);
  });
  it("lookupElement returns undefined for unknown symbol", () => {
    expect(lookupElement("Xx")).toBeUndefined();
  });
});

describe("normalizeFormula", () => {
  it("trims whitespace", () => {
    expect(normalizeFormula("  H2O  ")).toBe("H2O");
  });
  it("replaces * with ·", () => {
    expect(normalizeFormula("CuSO4*5H2O")).toBe("CuSO4·5H2O");
  });
});

describe("parseFormula", () => {
  it("parses simple H2O", () => {
    const r = parseFormula("H2O");
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ H: 2, O: 1 });
  });
  it("parses NaCl", () => {
    const r = parseFormula("NaCl");
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ Na: 1, Cl: 1 });
  });
  it("parses glucose C6H12O6", () => {
    const r = parseFormula("C6H12O6");
    expect(r.counts).toEqual({ C: 6, H: 12, O: 6 });
  });
  it("handles parentheses in Ca(OH)2", () => {
    const r = parseFormula("Ca(OH)2");
    expect(r.counts).toEqual({ Ca: 1, O: 2, H: 2 });
  });
  it("handles nested parentheses in (NH4)2SO4", () => {
    const r = parseFormula("(NH4)2SO4");
    expect(r.counts).toEqual({ N: 2, H: 8, S: 1, O: 4 });
  });
  it("handles Fe2(SO4)3", () => {
    const r = parseFormula("Fe2(SO4)3");
    expect(r.counts).toEqual({ Fe: 2, S: 3, O: 12 });
  });
  it("handles hydrate CuSO4·5H2O", () => {
    const r = parseFormula("CuSO4·5H2O");
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
  });
  it("handles hydrate with * separator", () => {
    const r = parseFormula("CuSO4*5H2O");
    expect(r.counts).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
  });
  it("handles ethanol C2H5OH", () => {
    const r = parseFormula("C2H5OH");
    expect(r.counts).toEqual({ C: 2, H: 6, O: 1 });
  });
  it("rejects unknown element", () => {
    const r = parseFormula("Xx2O");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Unknown element");
  });
  it("rejects unbalanced parentheses", () => {
    const r = parseFormula("(H2O");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("parenthesis");
  });
  it("rejects empty formula", () => {
    const r = parseFormula("");
    expect(r.ok).toBe(false);
  });
  it("treats leading coefficient as hydrate-style multiplier (2O → O:2)", () => {
    const r = parseFormula("2O");
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ O: 2 });
  });
  it("rejects lone coefficient with no formula", () => {
    const r = parseFormula("2");
    expect(r.ok).toBe(false);
  });
});

describe("validateFormula", () => {
  it("validates a good formula", () => {
    const v = validateFormula("H2SO4");
    expect(v.ok).toBe(true);
  });
  it("rejects bad formula", () => {
    const v = validateFormula("(H2O");
    expect(v.ok).toBe(false);
  });
});

describe("calculateMolarMass", () => {
  it("computes H2O molar mass ~18.015", () => {
    const r = parseFormula("H2O");
    const m = calculateMolarMass(r.counts);
    expect(m).toBeCloseTo(18.015, 1);
  });
  it("computes NaCl molar mass ~58.44", () => {
    const r = parseFormula("NaCl");
    const m = calculateMolarMass(r.counts);
    expect(m).toBeCloseTo(58.44, 1);
  });
  it("computes glucose molar mass ~180.156", () => {
    const r = parseFormula("C6H12O6");
    const m = calculateMolarMass(r.counts);
    expect(m).toBeCloseTo(180.156, 1);
  });
  it("molarMassOf returns 0 on invalid", () => {
    expect(molarMassOf("(H2O")).toBe(0);
  });
});

describe("molarMassBreakdown", () => {
  it("returns rows for H2O", () => {
    const b = molarMassBreakdown("H2O");
    expect("rows" in b).toBe(true);
    if ("rows" in b) {
      expect(b.rows.length).toBe(2);
      expect(b.totalAtoms).toBe(3);
      expect(b.distinctElements).toBe(2);
      expect(b.total).toBeCloseTo(18.015, 1);
    }
  });
  it("returns error for invalid formula", () => {
    const b = molarMassBreakdown("(H2O");
    expect("error" in b).toBe(true);
  });
});

describe("percentComposition", () => {
  it("computes % for H2O", () => {
    const rows = percentComposition("H2O");
    expect(Array.isArray(rows)).toBe(true);
    if (Array.isArray(rows)) {
      const total = rows.reduce((s, r) => s + r.percent, 0);
      expect(total).toBeCloseTo(100, 1);
      // Oxygen should be ~88.81%
      const o = rows.find((r) => r.symbol === "O");
      expect(o?.percent).toBeCloseTo(88.81, 1);
    }
  });
  it("returns error for invalid", () => {
    const rows = percentComposition("(H2O");
    expect("error" in rows).toBe(true);
  });
});

describe("parseExperimentalData", () => {
  it("parses element,percentage lines", () => {
    const d = parseExperimentalData("C,40\nH,6.7\nO,53.3");
    expect(Array.isArray(d)).toBe(true);
    if (Array.isArray(d)) {
      expect(d).toHaveLength(3);
      expect(d[0]).toEqual({ symbol: "C", percent: 40 });
    }
  });
  it("rejects unknown element", () => {
    const d = parseExperimentalData("Xx,40");
    expect("error" in d).toBe(true);
  });
  it("rejects bad percentage", () => {
    const d = parseExperimentalData("C,abc");
    expect("error" in d).toBe(true);
  });
});

describe("empiricalFormula", () => {
  it("computes empirical formula for glucose composition", () => {
    // C=40%, H=6.7%, O=53.3% → CH2O
    const data = [
      { symbol: "C", percent: 40 },
      { symbol: "H", percent: 6.7 },
      { symbol: "O", percent: 53.3 },
    ];
    const r = empiricalFormula(data);
    expect(r.ok).toBe(true);
    expect(r.formula).toBe("CH2O");
  });
  it("returns error for empty data", () => {
    const r = empiricalFormula([]);
    expect(r.ok).toBe(false);
  });
});

describe("molecularFormula", () => {
  it("computes molecular formula for glucose (CH2O, 180)", () => {
    const r = molecularFormula("CH2O", 180.156);
    expect(r.ok).toBe(true);
    expect(r.multiplier).toBe(6);
    expect(r.formula).toBe("C6H12O6");
  });
  it("rejects non-integer multiple", () => {
    const r = molecularFormula("CH2O", 50);
    expect(r.ok).toBe(false);
  });
  it("rejects empty empirical", () => {
    const r = molecularFormula("", 180);
    expect(r.ok).toBe(false);
  });
});

describe("parseEquation", () => {
  it("parses H2 + O2 = H2O", () => {
    const p = parseEquation("H2 + O2 = H2O");
    expect(p.ok).toBe(true);
    expect(p.reactants).toHaveLength(2);
    expect(p.products).toHaveLength(1);
    expect(p.elements).toEqual(expect.arrayContaining(["H", "O"]));
  });
  it("handles -> arrow", () => {
    const p = parseEquation("H2 + O2 -> H2O");
    expect(p.ok).toBe(true);
  });
  it("rejects equation without arrow", () => {
    const p = parseEquation("H2 + O2 H2O");
    expect(p.ok).toBe(false);
  });
});

describe("balanceEquation", () => {
  it("balances H2 + O2 = H2O", () => {
    const r = balanceEquation("H2 + O2 = H2O");
    expect(r.ok).toBe(true);
    expect(r.balancedEquation).toBe("2H2 + O2 = 2H2O");
  });
  it("balances Fe + O2 = Fe2O3", () => {
    const r = balanceEquation("Fe + O2 = Fe2O3");
    expect(r.ok).toBe(true);
    expect(r.balancedEquation).toBe("4Fe + 3O2 = 2Fe2O3");
  });
  it("balances CH4 + O2 = CO2 + H2O", () => {
    const r = balanceEquation("CH4 + O2 = CO2 + H2O");
    expect(r.ok).toBe(true);
    expect(r.balancedEquation).toBe("CH4 + 2O2 = CO2 + 2H2O");
  });
  it("balances C2H6 + O2 = CO2 + H2O", () => {
    const r = balanceEquation("C2H6 + O2 = CO2 + H2O");
    expect(r.ok).toBe(true);
    expect(r.balancedEquation).toBe("2C2H6 + 7O2 = 4CO2 + 6H2O");
  });
  it("returns error for invalid equation", () => {
    const r = balanceEquation("H2 + O2 H2O");
    expect(r.ok).toBe(false);
  });
});

describe("sortByHillConvention", () => {
  it("puts C first, H second, then alphabetical", () => {
    const out = sortByHillConvention(["O", "H", "C", "N"]);
    expect(out).toEqual(["C", "H", "N", "O"]);
  });
  it("works without carbon", () => {
    const out = sortByHillConvention(["O", "H", "N"]);
    expect(out).toEqual(["H", "N", "O"]);
  });
});

describe("computeSummary", () => {
  it("returns summary for H2O", () => {
    const s = computeSummary("H2O");
    expect("error" in s).toBe(false);
    if (!("error" in s)) {
      expect(s.totalAtoms).toBe(3);
      expect(s.totalElements).toBe(2);
      expect(s.molarMass).toBeCloseTo(18.015, 1);
    }
  });
  it("returns error for invalid formula", () => {
    const s = computeSummary("(H2O");
    expect("error" in s).toBe(true);
  });
});

describe("renderText", () => {
  it("includes formula and molar mass", () => {
    const b = molarMassBreakdown("H2O");
    if ("rows" in b) {
      const text = renderText("H2O", b);
      expect(text).toContain("Formula: H2O");
      expect(text).toContain("Molar mass:");
      expect(text).toContain("Breakdown:");
    }
  });
});

describe("renderCsv", () => {
  it("has header", () => {
    const b = molarMassBreakdown("H2O");
    if ("rows" in b) {
      const csv = renderCsv(b);
      expect(csv).toContain("symbol,name,count,atomic_mass,contribution,percent");
      expect(csv).toContain("H,");
    }
  });
});

describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      calculationType: "molar-mass",
      formula: "H2O",
      result: "18.015",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, calculationType: "molar-mass", formula: "H2O", result: String(i) });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, calculationType: "molar-mass", formula: "H2O", result: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("shareable URL", () => {
  it("builds share URL without window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("molar-mass", "H2O", "", 0, "");
    expect(url).toContain("t=molar-mass");
    expect(url).toContain("f=H2O");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("t=molar-mass&f=H2O");
    expect(p.calcType).toBe("molar-mass");
    expect(p.formula).toBe("H2O");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.calcType).toBe("molar-mass");
    expect(p.formula).toBe("");
  });
  it("filters unknown calc type", () => {
    const p = parseShareUrl("t=unknown-type&f=H2O");
    expect(p.calcType).toBe("molar-mass");
  });
  it("round-trips all params", () => {
    const url = buildShareUrl("balance-equation", "", "C,40", 180.16, "H2 + O2 = H2O");
    const params = url.split("#")[1] ?? url;
    const p = parseShareUrl(params);
    expect(p.calcType).toBe("balance-equation");
    expect(p.equation).toBe("H2 + O2 = H2O");
    expect(p.molarMass).toBeCloseTo(180.16, 2);
  });
});

// Suppress unused-import lint
export type _Unused = CalculationType;
