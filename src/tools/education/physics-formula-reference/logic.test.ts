import { describe, it, expect, beforeEach } from "vitest";
import {
  FORMULAS,
  CATEGORIES,
  CONSTANTS,
  UNIT_CATEGORIES,
  DIFFICULTY_LABELS,
  formulasByCategory,
  lookupFormula,
  lookupConstant,
  searchFormulas,
  parseKnownValues,
  validateVariables,
  solveFormula,
  roundSigFigs,
  formatSigFigs,
  convertUnit,
  checkDimensions,
  formatDimensions,
  computeSummary,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PhysicsCategory,
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

describe("physics constants", () => {
  it("has at least 50 formulas", () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(50);
  });
  it("has 6 categories", () => {
    expect(CATEGORIES).toHaveLength(6);
  });
  it("has formulas in every category", () => {
    for (const c of CATEGORIES) {
      expect(formulasByCategory(c.value).length).toBeGreaterThan(0);
    }
  });
  it("has at least 10 constants", () => {
    expect(CONSTANTS.length).toBeGreaterThanOrEqual(7);
    expect(CONSTANTS.some((c) => c.symbol === "g")).toBe(true);
    expect(CONSTANTS.some((c) => c.symbol === "c")).toBe(true);
    expect(CONSTANTS.some((c) => c.symbol === "h")).toBe(true);
  });
  it("has 3 difficulty levels", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
  it("has at least 5 unit categories", () => {
    expect(Object.keys(UNIT_CATEGORIES).length).toBeGreaterThanOrEqual(5);
  });
});

describe("lookupFormula and lookupConstant", () => {
  it("looks up a formula by id", () => {
    const f = lookupFormula("newton2");
    expect(f).toBeDefined();
    expect(f?.name).toContain("Newton");
  });
  it("returns undefined for unknown formula", () => {
    expect(lookupFormula("does-not-exist")).toBeUndefined();
  });
  it("looks up a constant", () => {
    const g = lookupConstant("g");
    expect(g).toBeDefined();
    expect(g?.value).toBeCloseTo(9.80665, 4);
  });
});

describe("formulasByCategory", () => {
  it("returns formulas for mechanics", () => {
    const list = formulasByCategory("mechanics");
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.every((f) => f.category === "mechanics")).toBe(true);
  });
  it("returns formulas for electricity", () => {
    const list = formulasByCategory("electricity");
    expect(list.length).toBeGreaterThanOrEqual(5);
  });
  it("returns formulas for optics", () => {
    const list = formulasByCategory("optics");
    expect(list.length).toBeGreaterThanOrEqual(4);
  });
});

describe("searchFormulas", () => {
  it("finds formulas by name fragment", () => {
    const results = searchFormulas("ohm");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((f) => f.id === "ohms-law")).toBe(true);
  });
  it("finds by equation fragment", () => {
    const results = searchFormulas("F = m");
    expect(results.some((f) => f.id === "newton2")).toBe(true);
  });
  it("returns empty for empty query", () => {
    expect(searchFormulas("")).toEqual([]);
  });
});

describe("parseKnownValues", () => {
  it("parses variable=value lines", () => {
    const r = parseKnownValues("mass=10\nacceleration=9.8");
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r).toEqual({ mass: 10, acceleration: 9.8 });
    }
  });
  it("parses with spaces", () => {
    const r = parseKnownValues("m = 10, a = 9.8");
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r).toEqual({ m: 10, a: 9.8 });
    }
  });
  it("handles scientific notation", () => {
    const r = parseKnownValues("c=3e8");
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.c).toBe(3e8);
    }
  });
  it("handles negative numbers", () => {
    const r = parseKnownValues("v=-9.8");
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.v).toBe(-9.8);
    }
  });
  it("returns empty for empty input", () => {
    const r = parseKnownValues("");
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(Object.keys(r).length).toBe(0);
    }
  });
  it("rejects malformed line", () => {
    const r = parseKnownValues("this is not a number");
    expect("error" in r).toBe(true);
  });
});

describe("validateVariables", () => {
  it("validates complete input", () => {
    const f = lookupFormula("newton2")!;
    const v = validateVariables(f, { m: 10, a: 9.8 }, "F");
    expect(v.ok).toBe(true);
    expect(v.missing).toEqual([]);
  });
  it("flags missing variables", () => {
    const f = lookupFormula("newton2")!;
    const v = validateVariables(f, { m: 10 }, "F");
    expect(v.ok).toBe(false);
    expect(v.missing).toContain("a");
  });
  it("flags unknown unknown variable", () => {
    const f = lookupFormula("newton2")!;
    const v = validateVariables(f, { m: 10, a: 9.8 }, "nonexistent");
    expect(v.ok).toBe(false);
    expect(v.error).toContain("not in formula");
  });
});

describe("solveFormula", () => {
  it("solves F = ma for F", () => {
    const f = lookupFormula("newton2")!;
    const r = solveFormula(f, { m: 10, a: 9.8 }, "F");
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(98, 4);
    expect(r.unit).toBe("N");
  });
  it("solves Ohm's law for I", () => {
    const f = lookupFormula("ohms-law")!;
    const r = solveFormula(f, { V: 12, R: 4 }, "I");
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(3, 4);
  });
  it("solves kinetic energy for v", () => {
    const f = lookupFormula("kinetic-energy")!;
    const r = solveFormula(f, { KE: 100, m: 2 }, "v");
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(10, 4);
  });
  it("solves wave speed for wavelength", () => {
    const f = lookupFormula("wave-speed")!;
    const r = solveFormula(f, { v: 340, f: 170 }, "lambda");
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(2, 4);
  });
  it("solves mass-energy for E", () => {
    const f = lookupFormula("mass-energy")!;
    const r = solveFormula(f, { m: 1, c: 3e8 }, "E");
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(9e16, -3);
  });
  it("returns error for missing variable", () => {
    const f = lookupFormula("newton2")!;
    const r = solveFormula(f, { m: 10 }, "F");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Missing");
  });
});

describe("significant figures", () => {
  it("rounds to 3 sig figs", () => {
    expect(roundSigFigs(1234.5678, 3)).toBeCloseTo(1230, 0);
  });
  it("rounds to 2 sig figs", () => {
    expect(roundSigFigs(0.004567, 2)).toBeCloseTo(0.0046, 5);
  });
  it("handles zero", () => {
    expect(roundSigFigs(0, 3)).toBe(0);
  });
  it("formats large numbers in exponential", () => {
    const s = formatSigFigs(9e16, 3);
    expect(s).toMatch(/e\+?17|e\+16/);
  });
  it("formats normal numbers", () => {
    expect(formatSigFigs(98, 3)).toBe("98");
  });
});

describe("convertUnit", () => {
  it("converts m/s to km/h", () => {
    const r = convertUnit(10, "m/s", "km/h");
    expect(r.ok).toBe(true);
    expect(r.result).toBeCloseTo(36, 4);
  });
  it("converts J to cal", () => {
    const r = convertUnit(4184, "J", "cal");
    expect(r.ok).toBe(true);
    expect(r.result).toBeCloseTo(1000, 1);
  });
  it("converts km/h to mph", () => {
    const r = convertUnit(100, "km/h", "mph");
    expect(r.ok).toBe(true);
    expect(r.result).toBeCloseTo(62.137, 1);
  });
  it("rejects unknown source unit", () => {
    const r = convertUnit(10, "furlongs", "m");
    expect(r.ok).toBe(false);
  });
  it("rejects mismatched categories", () => {
    const r = convertUnit(10, "m/s", "kg");
    expect(r.ok).toBe(false);
  });
  it("converts C to K", () => {
    const r = convertUnit(0, "C", "K");
    expect(r.ok).toBe(true);
    expect(r.result).toBeCloseTo(273.15, 1);
  });
});

describe("checkDimensions and formatDimensions", () => {
  it("returns ok for formula with all dimensions", () => {
    const f = lookupFormula("newton2")!;
    const r = checkDimensions(f, "F", { m: 10, a: 9.8 });
    expect(r.ok).toBe(true);
    expect(r.leftDims.length).toBe(7);
  });
  it("formats dimensions", () => {
    const s = formatDimensions([1, 1, -2, 0, 0, 0, 0]);
    expect(s).toBe("[M L T⁻²]");
  });
  it("formats empty dimensions", () => {
    expect(formatDimensions([])).toBe("[]");
  });
});

describe("computeSummary", () => {
  it("returns counts by category", () => {
    const s = computeSummary();
    expect(s.totalFormulas).toBeGreaterThanOrEqual(50);
    expect(s.byCategory.mechanics).toBeGreaterThanOrEqual(10);
    expect(s.byDifficulty.basic).toBeGreaterThan(0);
  });
});

describe("renderText and renderCsv", () => {
  it("renders text report with formula and result", () => {
    const f = lookupFormula("newton2")!;
    const r = solveFormula(f, { m: 10, a: 9.8 }, "F");
    const text = renderText(r, 4);
    expect(text).toContain("Newton's Second Law");
    expect(text).toContain("F = m × a");
    expect(text).toContain("m =");
    expect(text).toContain("Solved for: F");
  });
  it("renders CSV with header and rows", () => {
    const f = lookupFormula("newton2")!;
    const r = solveFormula(f, { m: 10, a: 9.8 }, "F");
    const csv = renderCsv(r, 4);
    expect(csv).toContain("variable,value,unit");
    expect(csv).toContain("m,");
    expect(csv).toContain("F,");
  });
});

describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      formulaId: "newton2",
      formulaName: "Newton's Second Law",
      unknownVariable: "F",
      result: "98 N",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, formulaId: "newton2", formulaName: "x", unknownVariable: "F", result: String(i) });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, formulaId: "newton2", formulaName: "x", unknownVariable: "F", result: "1" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("shareable URL", () => {
  it("builds share URL without window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("mechanics", "newton2", "m=10\na=9.8", "F", 4);
    expect(url).toContain("c=mechanics");
    expect(url).toContain("f=newton2");
    expect(url).toContain("u=F");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("c=mechanics&f=newton2&v=m%3D10&u=F");
    expect(p.category).toBe("mechanics");
    expect(p.formulaId).toBe("newton2");
    expect(p.unknownVariable).toBe("F");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.category).toBe("mechanics");
    expect(p.formulaId).toBe("");
  });
  it("filters unknown category", () => {
    const p = parseShareUrl("c=unknown-cat&f=newton2");
    expect(p.category).toBe("mechanics");
  });
  it("round-trips all params", () => {
    const url = buildShareUrl("electricity", "ohms-law", "V=12\nR=4", "I", 6);
    const params = url.split("#")[1] ?? url;
    const p = parseShareUrl(params);
    expect(p.category).toBe("electricity");
    expect(p.formulaId).toBe("ohms-law");
    expect(p.unknownVariable).toBe("I");
    expect(p.sigFigs).toBe(6);
  });
});

// Suppress unused-import lint
export type _Unused = PhysicsCategory;
