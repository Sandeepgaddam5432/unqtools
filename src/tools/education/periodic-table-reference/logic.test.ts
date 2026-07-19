import { describe, it, expect, beforeEach } from "vitest";
import {
  ELEMENTS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  normalizeQuery,
  searchElements,
  filterByCategory,
  searchAndFilter,
  formatElement,
  sortElements,
  getCategoryColor,
  listCategoriesWithCounts,
  computePosition,
  findNeighbors,
  getIsotopes,
  getMostAbundantIsotope,
  validateCompoundFormula,
  renderElementLine,
  renderTextTable,
  renderAsciiTable,
  renderCsv,
  renderJson,
  renderElementJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  computeSummaryStats,
  getByAtomicNumber,
  getBySymbol,
  type ElementCategory,
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

describe("periodic-table-reference constants", () => {
  it("has 118 elements", () => {
    expect(ELEMENTS).toHaveLength(118);
  });
  it("has unique atomic numbers 1..118", () => {
    const zs = ELEMENTS.map((e) => e.z);
    expect(new Set(zs).size).toBe(118);
    expect(Math.min(...zs)).toBe(1);
    expect(Math.max(...zs)).toBe(118);
  });
  it("has unique symbols", () => {
    const syms = ELEMENTS.map((e) => e.symbol);
    expect(new Set(syms).size).toBe(118);
  });
  it("has 11 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(11);
  });
  it("has 11 category colors", () => {
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(11);
  });
  it("Hydrogen is first", () => {
    expect(ELEMENTS[0].symbol).toBe("H");
    expect(ELEMENTS[0].name).toBe("Hydrogen");
    expect(ELEMENTS[0].z).toBe(1);
  });
  it("Oganesson is last", () => {
    expect(ELEMENTS[117].symbol).toBe("Og");
    expect(ELEMENTS[117].z).toBe(118);
  });
});

describe("periodic-table-reference normalizeQuery", () => {
  it("lowercases and trims", () => {
    expect(normalizeQuery("  Hydrogen  ")).toBe("hydrogen");
  });
  it("handles empty", () => {
    expect(normalizeQuery("")).toBe("");
  });
});

describe("periodic-table-reference searchElements", () => {
  it("returns all elements for empty query", () => {
    expect(searchElements("")).toHaveLength(118);
  });
  it("finds by exact symbol (case-insensitive)", () => {
    const r = searchElements("O");
    expect(r.some((e) => e.symbol === "O")).toBe(true);
  });
  it("finds by name substring", () => {
    const r = searchElements("hydr");
    expect(r.some((e) => e.name === "Hydrogen")).toBe(true);
  });
  it("finds by atomic number (exact)", () => {
    const r = searchElements("8");
    expect(r).toHaveLength(1);
    expect(r[0].symbol).toBe("O");
  });
  it("finds by atomic number (substring)", () => {
    // "0" has no exact atomic-number match, so falls through to substring
    const r = searchElements("0");
    expect(r.some((e) => e.z === 10)).toBe(true);
    expect(r.some((e) => e.z === 20)).toBe(true);
    expect(r.some((e) => e.z === 100)).toBe(true);
  });
  it("finds by category substring", () => {
    const r = searchElements("noble");
    expect(r.every((e) => e.category === "noble-gas")).toBe(true);
    expect(r.length).toBeGreaterThanOrEqual(6);
  });
});

describe("periodic-table-reference filterByCategory", () => {
  it("returns all for empty category", () => {
    expect(filterByCategory("")).toHaveLength(118);
  });
  it("filters alkali metals", () => {
    const r = filterByCategory("alkali-metal");
    expect(r.length).toBeGreaterThanOrEqual(6);
    expect(r.every((e) => e.category === "alkali-metal")).toBe(true);
  });
  it("filters noble gases (at least 6)", () => {
    const r = filterByCategory("noble-gas");
    expect(r.length).toBeGreaterThanOrEqual(6);
    expect(r.every((e) => e.category === "noble-gas")).toBe(true);
  });
});

describe("periodic-table-reference searchAndFilter", () => {
  it("combines search + filter", () => {
    const r = searchAndFilter("n", "halogen");
    expect(r.every((e) => e.category === "halogen")).toBe(true);
  });
});

describe("periodic-table-reference formatElement", () => {
  it("formats hydrogen header", () => {
    const f = formatElement(ELEMENTS[0]);
    expect(f.header).toBe("1. H — Hydrogen");
  });
  it("formats details with atomic mass", () => {
    const f = formatElement(ELEMENTS[0]);
    expect(f.details.some((d) => d.includes("Atomic Mass"))).toBe(true);
    expect(f.details.some((d) => d.includes("Electronegativity"))).toBe(true);
  });
  it("formats details with isotopes", () => {
    const f = formatElement(ELEMENTS[0]);
    expect(f.details.some((d) => d.startsWith("Isotopes:"))).toBe(true);
  });
});

describe("periodic-table-reference sortElements", () => {
  it("sorts by atomic number ascending", () => {
    const sorted = sortElements(ELEMENTS, "z", true);
    expect(sorted[0].z).toBe(1);
    expect(sorted[117].z).toBe(118);
  });
  it("sorts by name", () => {
    const sorted = sortElements(ELEMENTS, "name");
    expect(sorted[0].name).toBe("Actinium");
  });
  it("sorts by mass descending", () => {
    const sorted = sortElements(ELEMENTS, "mass", false);
    expect(sorted[0].mass).toBeGreaterThanOrEqual(sorted[1].mass);
  });
  it("sorts by electronegativity descending", () => {
    const sorted = sortElements(ELEMENTS, "electronegativity", false);
    expect(sorted[0].electronegativity).toBe(3.98);
  });
});

describe("periodic-table-reference category color", () => {
  it("gets color for alkali metal", () => {
    expect(getCategoryColor("alkali-metal")).toBe("#ff6b6b");
  });
  it("lists categories with counts", () => {
    const list = listCategoriesWithCounts();
    expect(list.length).toBeGreaterThanOrEqual(10);
    const total = list.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(118);
  });
});

describe("periodic-table-reference computePosition", () => {
  it("computes position for H", () => {
    const pos = computePosition(ELEMENTS[0]);
    expect(pos.period).toBe(1);
    expect(pos.group).toBe(1);
    expect(pos.isFBlock).toBe(false);
  });
  it("flags f-block for lanthanides", () => {
    const cerium = getByAtomicNumber(58)!;
    const pos = computePosition(cerium);
    expect(pos.isFBlock).toBe(true);
  });
});

describe("periodic-table-reference findNeighbors", () => {
  it("finds neighbors of carbon (group 14, period 2)", () => {
    const c = getByAtomicNumber(6)!;
    const n = findNeighbors(c);
    expect(n.left?.symbol).toBe("B");
    expect(n.right?.symbol).toBe("N");
    expect(n.up).toBeNull();
    expect(n.down?.symbol).toBe("Si");
  });
  it("returns null neighbors for f-block elements", () => {
    const cerium = getByAtomicNumber(58)!;
    const n = findNeighbors(cerium);
    expect(n.left).toBeNull();
    expect(n.right).toBeNull();
  });
  it("hydrogen has Li as down neighbor (period 1, group 1)", () => {
    const h = getByAtomicNumber(1)!;
    const n = findNeighbors(h);
    expect(n.left).toBeNull();
    expect(n.right).toBeNull(); // group 2 doesn't exist in period 1
    expect(n.up).toBeNull();
    expect(n.down?.symbol).toBe("Li");
  });
});

describe("periodic-table-reference isotopes", () => {
  it("returns isotopes for hydrogen", () => {
    const iso = getIsotopes(ELEMENTS[0]);
    expect(iso).toHaveLength(2);
    expect(iso[0].mass).toBe(1);
  });
  it("finds most abundant isotope", () => {
    const abund = getMostAbundantIsotope(ELEMENTS[0]);
    expect(abund?.mass).toBe(1);
    expect(abund?.abundance).toBe(99.985);
  });
  it("returns null when no isotopes", () => {
    const el = { ...ELEMENTS[0], isotopes: [] };
    expect(getMostAbundantIsotope(el)).toBeNull();
  });
});

describe("periodic-table-reference validateCompoundFormula", () => {
  it("validates H2O", () => {
    const r = validateCompoundFormula("H2O");
    expect(r.valid).toBe(true);
    expect(r.tokens).toContainEqual({ symbol: "H", count: 2 });
    expect(r.tokens).toContainEqual({ symbol: "O", count: 1 });
  });
  it("validates NaCl", () => {
    const r = validateCompoundFormula("NaCl");
    expect(r.valid).toBe(true);
    expect(r.tokens).toContainEqual({ symbol: "Na", count: 1 });
  });
  it("validates Ca(OH)2", () => {
    const r = validateCompoundFormula("Ca(OH)2");
    expect(r.valid).toBe(true);
    expect(r.tokens).toContainEqual({ symbol: "Ca", count: 1 });
    expect(r.tokens).toContainEqual({ symbol: "O", count: 2 });
    expect(r.tokens).toContainEqual({ symbol: "H", count: 2 });
  });
  it("validates H2SO4", () => {
    const r = validateCompoundFormula("H2SO4");
    expect(r.valid).toBe(true);
    expect(r.tokens).toContainEqual({ symbol: "H", count: 2 });
    expect(r.tokens).toContainEqual({ symbol: "S", count: 1 });
    expect(r.tokens).toContainEqual({ symbol: "O", count: 4 });
  });
  it("rejects empty formula", () => {
    expect(validateCompoundFormula("").valid).toBe(false);
  });
  it("rejects unknown element", () => {
    const r = validateCompoundFormula("Xx2O");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Unknown element");
  });
  it("rejects unmatched paren", () => {
    const r = validateCompoundFormula("(H2O");
    expect(r.valid).toBe(false);
  });
  it("rejects invalid characters", () => {
    const r = validateCompoundFormula("H2O!");
    expect(r.valid).toBe(false);
  });
  it("validates nested parens", () => {
    const r = validateCompoundFormula("Mg(OH(CO3)2)2");
    expect(r.valid).toBe(true);
  });
});

describe("periodic-table-reference renderers", () => {
  it("renderElementLine formats fields", () => {
    const line = renderElementLine(ELEMENTS[0]);
    expect(line).toContain("1");
    expect(line).toContain("H");
    expect(line).toContain("Hydrogen");
  });
  it("renderTextTable has header", () => {
    const t = renderTextTable();
    expect(t.split("\n")[0]).toContain("Sym");
    expect(t.split("\n").length).toBe(119);
  });
  it("renderAsciiTable has 7+ lines", () => {
    const t = renderAsciiTable();
    expect(t.split("\n").length).toBeGreaterThanOrEqual(7);
    expect(t).toContain("H");
    expect(t).toContain("He");
  });
  it("renderCsv has header and 118 rows", () => {
    const csv = renderCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("atomic_number");
    expect(lines).toHaveLength(119);
  });
  it("renderJson is valid JSON", () => {
    const json = renderJson();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(118);
  });
  it("renderElementJson is valid for one element", () => {
    const json = renderElementJson(ELEMENTS[0]);
    const parsed = JSON.parse(json);
    expect(parsed.symbol).toBe("H");
  });
  it("renderCsv with subset", () => {
    const csv = renderCsv([ELEMENTS[0], ELEMENTS[1]]);
    expect(csv.split("\n")).toHaveLength(3);
  });
});

describe("periodic-table-reference history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, z: 1, symbol: "H", name: "Hydrogen" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("dedupes same element", () => {
    saveHistory({ ts: 1, z: 1, symbol: "H", name: "Hydrogen" });
    saveHistory({ ts: 2, z: 1, symbol: "H", name: "Hydrogen" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 1; i <= 25; i++) {
      saveHistory({ ts: i, z: i, symbol: `S${i}`, name: `El${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, z: 1, symbol: "H", name: "Hydrogen" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("periodic-table-reference shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(8);
    expect(url).toContain("z=8");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    expect(parseShareUrl("z=8").z).toBe(8);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("").z).toBe(0);
  });
  it("rejects out-of-range z", () => {
    expect(parseShareUrl("z=200").z).toBe(0);
  });
  it("rejects non-numeric z", () => {
    expect(parseShareUrl("z=abc").z).toBe(0);
  });
});

describe("periodic-table-reference summary stats", () => {
  it("computes totals", () => {
    const s = computeSummaryStats();
    expect(s.totalElements).toBe(118);
  });
  it("computes by-category counts summing to 118", () => {
    const s = computeSummaryStats();
    const total = s.byCategory.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(118);
  });
  it("computes by-period counts", () => {
    const s = computeSummaryStats();
    expect(s.byPeriod[1]).toBe(2);
    expect(s.byPeriod[2]).toBe(8);
  });
  it("finds heaviest and lightest", () => {
    const s = computeSummaryStats();
    expect(s.lightest?.symbol).toBe("H");
    expect(s.heaviest?.z).toBe(118);
  });
  it("finds most electronegative", () => {
    const s = computeSummaryStats();
    expect(s.mostElectronegative?.symbol).toBe("F");
  });
  it("computes avg electronegativity", () => {
    const s = computeSummaryStats();
    expect(s.avgElectronegativity).not.toBeNull();
    expect(s.avgElectronegativity).toBeGreaterThan(0);
  });
});

describe("periodic-table-reference getByAtomicNumber / getBySymbol", () => {
  it("gets element by atomic number", () => {
    expect(getByAtomicNumber(6)?.symbol).toBe("C");
  });
  it("returns null for unknown atomic number", () => {
    expect(getByAtomicNumber(999)).toBeNull();
  });
  it("gets element by symbol (case-insensitive)", () => {
    expect(getBySymbol("na")?.name).toBe("Sodium");
  });
  it("returns null for unknown symbol", () => {
    expect(getBySymbol("Xx")).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = ElementCategory;
