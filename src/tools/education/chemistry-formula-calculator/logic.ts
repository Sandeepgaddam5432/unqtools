/**
 * Chemistry Formula Calculator — pure logic.
 *
 * Calculates molar mass, empirical/molecular formulas, balances chemical
 * equations, and computes percent composition. Pure functions only — no
 * DOM, no network. 118-element periodic table built-in.
 */

// ---- Periodic table data (118 elements) ----

export interface ElementInfo {
  number: number;
  symbol: string;
  name: string;
  mass: number; // standard atomic weight (g/mol)
}

// Compact tuple → expanded at runtime.
type ElementTuple = [number, string, string, number];

const ELEMENT_DATA: ElementTuple[] = [
  [1, "H", "Hydrogen", 1.008],
  [2, "He", "Helium", 4.0026],
  [3, "Li", "Lithium", 6.94],
  [4, "Be", "Beryllium", 9.0122],
  [5, "B", "Boron", 10.81],
  [6, "C", "Carbon", 12.011],
  [7, "N", "Nitrogen", 14.007],
  [8, "O", "Oxygen", 15.999],
  [9, "F", "Fluorine", 18.998],
  [10, "Ne", "Neon", 20.180],
  [11, "Na", "Sodium", 22.990],
  [12, "Mg", "Magnesium", 24.305],
  [13, "Al", "Aluminium", 26.982],
  [14, "Si", "Silicon", 28.085],
  [15, "P", "Phosphorus", 30.974],
  [16, "S", "Sulfur", 32.06],
  [17, "Cl", "Chlorine", 35.45],
  [18, "Ar", "Argon", 39.948],
  [19, "K", "Potassium", 39.098],
  [20, "Ca", "Calcium", 40.078],
  [21, "Sc", "Scandium", 44.956],
  [22, "Ti", "Titanium", 47.867],
  [23, "V", "Vanadium", 50.942],
  [24, "Cr", "Chromium", 51.996],
  [25, "Mn", "Manganese", 54.938],
  [26, "Fe", "Iron", 55.845],
  [27, "Co", "Cobalt", 58.933],
  [28, "Ni", "Nickel", 58.693],
  [29, "Cu", "Copper", 63.546],
  [30, "Zn", "Zinc", 65.38],
  [31, "Ga", "Gallium", 69.723],
  [32, "Ge", "Germanium", 72.630],
  [33, "As", "Arsenic", 74.922],
  [34, "Se", "Selenium", 78.971],
  [35, "Br", "Bromine", 79.904],
  [36, "Kr", "Krypton", 83.798],
  [37, "Rb", "Rubidium", 85.468],
  [38, "Sr", "Strontium", 87.62],
  [39, "Y", "Yttrium", 88.906],
  [40, "Zr", "Zirconium", 91.224],
  [41, "Nb", "Niobium", 92.906],
  [42, "Mo", "Molybdenum", 95.95],
  [43, "Tc", "Technetium", 98],
  [44, "Ru", "Ruthenium", 101.07],
  [45, "Rh", "Rhodium", 102.91],
  [46, "Pd", "Palladium", 106.42],
  [47, "Ag", "Silver", 107.87],
  [48, "Cd", "Cadmium", 112.41],
  [49, "In", "Indium", 114.82],
  [50, "Sn", "Tin", 118.71],
  [51, "Sb", "Antimony", 121.76],
  [52, "Te", "Tellurium", 127.60],
  [53, "I", "Iodine", 126.90],
  [54, "Xe", "Xenon", 131.29],
  [55, "Cs", "Caesium", 132.91],
  [56, "Ba", "Barium", 137.33],
  [57, "La", "Lanthanum", 138.91],
  [58, "Ce", "Cerium", 140.12],
  [59, "Pr", "Praseodymium", 140.91],
  [60, "Nd", "Neodymium", 144.24],
  [61, "Pm", "Promethium", 145],
  [62, "Sm", "Samarium", 150.36],
  [63, "Eu", "Europium", 151.96],
  [64, "Gd", "Gadolinium", 157.25],
  [65, "Tb", "Terbium", 158.93],
  [66, "Dy", "Dysprosium", 162.50],
  [67, "Ho", "Holmium", 164.93],
  [68, "Er", "Erbium", 167.26],
  [69, "Tm", "Thulium", 168.93],
  [70, "Yb", "Ytterbium", 173.05],
  [71, "Lu", "Lutetium", 174.97],
  [72, "Hf", "Hafnium", 178.49],
  [73, "Ta", "Tantalum", 180.95],
  [74, "W", "Tungsten", 183.84],
  [75, "Re", "Rhenium", 186.21],
  [76, "Os", "Osmium", 190.23],
  [77, "Ir", "Iridium", 192.22],
  [78, "Pt", "Platinum", 195.08],
  [79, "Au", "Gold", 196.97],
  [80, "Hg", "Mercury", 200.59],
  [81, "Tl", "Thallium", 204.38],
  [82, "Pb", "Lead", 207.2],
  [83, "Bi", "Bismuth", 208.98],
  [84, "Po", "Polonium", 209],
  [85, "At", "Astatine", 210],
  [86, "Rn", "Radon", 222],
  [87, "Fr", "Francium", 223],
  [88, "Ra", "Radium", 226],
  [89, "Ac", "Actinium", 227],
  [90, "Th", "Thorium", 232.04],
  [91, "Pa", "Protactinium", 231.04],
  [92, "U", "Uranium", 238.03],
  [93, "Np", "Neptunium", 237],
  [94, "Pu", "Plutonium", 244],
  [95, "Am", "Americium", 243],
  [96, "Cm", "Curium", 247],
  [97, "Bk", "Berkelium", 247],
  [98, "Cf", "Californium", 251],
  [99, "Es", "Einsteinium", 252],
  [100, "Fm", "Fermium", 257],
  [101, "Md", "Mendelevium", 258],
  [102, "No", "Nobelium", 259],
  [103, "Lr", "Lawrencium", 266],
  [104, "Rf", "Rutherfordium", 267],
  [105, "Db", "Dubnium", 268],
  [106, "Sg", "Seaborgium", 269],
  [107, "Bh", "Bohrium", 270],
  [108, "Hs", "Hassium", 269],
  [109, "Mt", "Meitnerium", 278],
  [110, "Ds", "Darmstadtium", 281],
  [111, "Rg", "Roentgenium", 282],
  [112, "Cn", "Copernicium", 285],
  [113, "Nh", "Nihonium", 286],
  [114, "Fl", "Flerovium", 289],
  [115, "Mc", "Moscovium", 290],
  [116, "Lv", "Livermorium", 293],
  [117, "Ts", "Tennessine", 294],
  [118, "Og", "Oganesson", 294],
];

export const PERIODIC_TABLE: ElementInfo[] = ELEMENT_DATA.map(
  ([number, symbol, name, mass]) => ({ number, symbol, name, mass }),
);

const ELEMENT_BY_SYMBOL: Record<string, ElementInfo> = (() => {
  const out: Record<string, ElementInfo> = {};
  for (const e of PERIODIC_TABLE) out[e.symbol] = e;
  return out;
})();

// Common isotope mass overrides (used when isotope selector is on).
export const ISOTOPE_MASSES: Record<string, Record<string, number>> = {
  H: { "1": 1.007825, "2": 2.014102, "3": 3.016049 }, // protium, deuterium, tritium
  C: { "12": 12.0, "13": 13.003355, "14": 14.003242 },
  N: { "14": 14.003074, "15": 15.000109 },
  O: { "16": 15.994915, "17": 16.999132, "18": 17.999161 },
  U: { "235": 235.04393, "238": 238.05079 },
};

export type CalculationType =
  | "molar-mass"
  | "empirical-formula"
  | "molecular-formula"
  | "balance-equation"
  | "percent-composition";

export const CALC_TYPES: { value: CalculationType; label: string }[] = [
  { value: "molar-mass", label: "Molar Mass" },
  { value: "empirical-formula", label: "Empirical Formula" },
  { value: "molecular-formula", label: "Molecular Formula" },
  { value: "balance-equation", label: "Balance Equation" },
  { value: "percent-composition", label: "Percent Composition" },
];

export interface CompoundPreset {
  label: string;
  formula: string;
}

export const COMPOUND_PRESETS: CompoundPreset[] = [
  { label: "Water", formula: "H2O" },
  { label: "Glucose", formula: "C6H12O6" },
  { label: "Sodium Chloride", formula: "NaCl" },
  { label: "Sulfuric Acid", formula: "H2SO4" },
  { label: "Methane", formula: "CH4" },
  { label: "Carbon Dioxide", formula: "CO2" },
  { label: "Ammonia", formula: "NH3" },
  { label: "Calcium Carbonate", formula: "CaCO3" },
  { label: "Ethanol", formula: "C2H5OH" },
  { label: "Copper Sulfate Hydrate", formula: "CuSO4·5H2O" },
];

export interface ParseResult {
  /** Element symbol → total atom count */
  counts: Record<string, number>;
  /** True if parsing succeeded */
  ok: boolean;
  /** Error message if ok is false */
  error?: string;
}

/** Look up an element by symbol. Returns undefined if not found. */
export function lookupElement(symbol: string): ElementInfo | undefined {
  return ELEMENT_BY_SYMBOL[symbol];
}

/** Normalize a formula string: trim, collapse spaces, swap '*' for '·'. */
export function normalizeFormula(s: string): string {
  if (!s) return "";
  return s.trim().replace(/\s+/g, "").replace(/\*/g, "·");
}

/** Tokenize a formula (single segment, no hydrate dots). */
type Token =
  | { kind: "element"; symbol: string }
  | { kind: "number"; value: number }
  | { kind: "open" }
  | { kind: "close" };

function tokenizeSegment(seg: string): Token[] | { error: string } {
  const tokens: Token[] = [];
  let i = 0;
  while (i < seg.length) {
    const ch = seg[i];
    if (ch === "(") {
      tokens.push({ kind: "open" });
      i++;
    } else if (ch === ")") {
      tokens.push({ kind: "close" });
      i++;
    } else if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      if (i < seg.length && /[a-z]/.test(seg[i])) {
        sym += seg[i];
        i++;
      }
      // Reject 3-letter pseudo-symbols or trailing lowercase junk.
      if (i < seg.length && /[a-z]/.test(seg[i])) {
        return { error: `Invalid element symbol near "${seg.slice(i - 2, i + 2)}"` };
      }
      if (!ELEMENT_BY_SYMBOL[sym]) {
        return { error: `Unknown element symbol: ${sym}` };
      }
      tokens.push({ kind: "element", symbol: sym });
    } else if (/[0-9]/.test(ch)) {
      let num = "";
      while (i < seg.length && /[0-9]/.test(seg[i])) {
        num += seg[i];
        i++;
      }
      tokens.push({ kind: "number", value: parseInt(num, 10) });
    } else {
      return { error: `Unexpected character: ${ch}` };
    }
  }
  return tokens;
}

/** Parse a single segment (no dots). Returns counts or error. */
function parseSegment(seg: string): ParseResult {
  if (!seg) return { counts: {}, ok: true };
  const toks = tokenizeSegment(seg);
  if (!Array.isArray(toks)) return { counts: {}, ok: false, error: toks.error };

  const counts: Record<string, number> = {};
  // Stack of maps for parenthesized groups.
  const stack: Record<string, number>[] = [counts];
  let depth = 0;
  let prevElement: string | null = null;

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === "element") {
      const top = stack[stack.length - 1];
      top[t.symbol] = (top[t.symbol] ?? 0) + 1;
      prevElement = t.symbol;
    } else if (t.kind === "number") {
      if (prevElement === null) {
        return { counts: {}, ok: false, error: "Number with no preceding element" };
      }
      // The number applies to the previous element (count - 1, since we already added 1).
      const top = stack[stack.length - 1];
      top[prevElement] = (top[prevElement] ?? 0) + (t.value - 1);
      prevElement = null;
    } else if (t.kind === "open") {
      stack.push({});
      depth++;
      prevElement = null;
    } else if (t.kind === "close") {
      if (depth === 0) {
        return { counts: {}, ok: false, error: "Unbalanced closing parenthesis" };
      }
      // Check for following number (multiplier).
      let mult = 1;
      const nextTok = toks[i + 1];
      if (nextTok && nextTok.kind === "number") {
        mult = nextTok.value;
        i++;
      }
      const popped = stack.pop()!;
      depth--;
      const top = stack[stack.length - 1];
      for (const [sym, n] of Object.entries(popped)) {
        top[sym] = (top[sym] ?? 0) + n * mult;
      }
      prevElement = null;
    }
  }
  if (depth !== 0) {
    return { counts: {}, ok: false, error: "Unbalanced opening parenthesis" };
  }
  return { counts, ok: true };
}

/**
 * Parse a chemical formula. Handles parentheses and hydrate dot notation
 * (· or *). A leading coefficient on a hydrate segment multiplies that
 * segment (e.g. "CuSO4·5H2O" → 5 × H2O).
 */
export function parseFormula(input: string): ParseResult {
  const s = normalizeFormula(input);
  if (!s) return { counts: {}, ok: false, error: "Empty formula" };

  // Split on the hydrate dot (·). Plain formulas have no dots.
  const segments = s.split("·");
  const total: Record<string, number> = {};

  for (const seg of segments) {
    if (!seg) {
      return { counts: {}, ok: false, error: "Empty hydrate segment" };
    }
    // Check for leading coefficient (e.g. "5H2O").
    let multiplier = 1;
    let body = seg;
    const m = seg.match(/^(\d+)(.*)$/);
    if (m) {
      multiplier = parseInt(m[1], 10);
      body = m[2];
      if (!body) {
        return { counts: {}, ok: false, error: "Hydrate coefficient with no formula" };
      }
    }
    const r = parseSegment(body);
    if (!r.ok) return r;
    for (const [sym, n] of Object.entries(r.counts)) {
      total[sym] = (total[sym] ?? 0) + n * multiplier;
    }
  }
  return { counts: total, ok: true };
}

/** Validate a formula: returns { ok, error }. */
export function validateFormula(input: string): { ok: boolean; error?: string } {
  const r = parseFormula(input);
  if (!r.ok) return { ok: false, error: r.error };
  if (Object.keys(r.counts).length === 0) {
    return { ok: false, error: "Formula produced no elements" };
  }
  return { ok: true };
}

/** Calculate molar mass from a counts map. */
export function calculateMolarMass(counts: Record<string, number>): number {
  let sum = 0;
  for (const [sym, n] of Object.entries(counts)) {
    const el = ELEMENT_BY_SYMBOL[sym];
    if (!el) continue;
    sum += el.mass * n;
  }
  return sum;
}

/** Calculate molar mass from a formula string. Returns 0 on parse error. */
export function molarMassOf(input: string): number {
  const r = parseFormula(input);
  if (!r.ok) return 0;
  return calculateMolarMass(r.counts);
}

/** Per-element contribution rows for molar mass breakdown. */
export interface MolarMassRow {
  symbol: string;
  name: string;
  count: number;
  atomicMass: number;
  contribution: number;
  percent: number;
}

export interface MolarMassBreakdown {
  rows: MolarMassRow[];
  total: number;
  totalAtoms: number;
  distinctElements: number;
}

export function molarMassBreakdown(input: string): MolarMassBreakdown | { error: string } {
  const r = parseFormula(input);
  if (!r.ok) return { error: r.error ?? "Invalid formula" };
  const total = calculateMolarMass(r.counts);
  if (total <= 0) return { error: "Cannot compute molar mass" };

  const rows: MolarMassRow[] = Object.entries(r.counts)
    .map(([symbol, count]) => {
      const el = ELEMENT_BY_SYMBOL[symbol];
      const atomicMass = el?.mass ?? 0;
      const contribution = atomicMass * count;
      return {
        symbol,
        name: el?.name ?? symbol,
        count,
        atomicMass,
        contribution,
        percent: total > 0 ? (contribution / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.contribution - a.contribution);

  let totalAtoms = 0;
  for (const n of Object.values(r.counts)) totalAtoms += n;

  return {
    rows,
    total,
    totalAtoms,
    distinctElements: Object.keys(r.counts).length,
  };
}

// ---- Percent composition ----

export interface PercentRow {
  symbol: string;
  name: string;
  count: number;
  atomicMass: number;
  contribution: number;
  percent: number;
}

export function percentComposition(input: string): PercentRow[] | { error: string } {
  const r = parseFormula(input);
  if (!r.ok) return { error: r.error ?? "Invalid formula" };
  const total = calculateMolarMass(r.counts);
  if (total <= 0) return { error: "Cannot compute percent composition" };
  const rows: PercentRow[] = Object.entries(r.counts)
    .map(([symbol, count]) => {
      const el = ELEMENT_BY_SYMBOL[symbol];
      const atomicMass = el?.mass ?? 0;
      const contribution = atomicMass * count;
      return {
        symbol,
        name: el?.name ?? symbol,
        count,
        atomicMass,
        contribution,
        percent: (contribution / total) * 100,
      };
    })
    .sort((a, b) => b.percent - a.percent);
  return rows;
}

// ---- Empirical formula from % composition ----

export interface EmpiricalInput {
  symbol: string;
  percent: number;
}

export interface EmpiricalResult {
  formula: string;
  counts: Record<string, number>;
  moles: { symbol: string; moles: number }[];
  ratios: { symbol: string; ratio: number }[];
  ok: boolean;
  error?: string;
}

/** Parse experimental data: "element,percentage" per line. */
export function parseExperimentalData(input: string): EmpiricalInput[] | { error: string } {
  if (!input) return { error: "No experimental data provided" };
  const lines = input
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: "No data lines found" };
  const out: EmpiricalInput[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    if (parts.length < 2) {
      return { error: `Line "${line}" is not element,percentage` };
    }
    const symbol = parts[0];
    if (!ELEMENT_BY_SYMBOL[symbol]) {
      return { error: `Unknown element symbol: ${symbol}` };
    }
    const percent = parseFloat(parts[1]);
    if (isNaN(percent)) {
      return { error: `Invalid percentage: ${parts[1]}` };
    }
    out.push({ symbol, percent });
  }
  // Validate sum is roughly 100 (warn but don't fail).
  return out;
}

/** Compute the empirical formula from percent composition data. */
export function empiricalFormula(data: EmpiricalInput[]): EmpiricalResult {
  if (!data || data.length === 0) {
    return { formula: "", counts: {}, moles: [], ratios: [], ok: false, error: "No data" };
  }
  // Assume 100g sample: grams = percent value.
  // Moles = grams / atomic_mass.
  const moles = data.map((d) => ({
    symbol: d.symbol,
    moles: d.percent / (ELEMENT_BY_SYMBOL[d.symbol]?.mass ?? 1),
  }));
  const minMoles = Math.min(...moles.map((m) => m.moles));
  if (minMoles <= 0) {
    return {
      formula: "",
      counts: {},
      moles,
      ratios: [],
      ok: false,
      error: "Invalid composition data (zero or negative moles)",
    };
  }
  const rawRatios = moles.map((m) => ({ symbol: m.symbol, ratio: m.moles / minMoles }));

  // Convert ratios to whole numbers. Try multipliers 1..20.
  const counts = wholeNumberRatios(rawRatios);
  if (!counts) {
    return {
      formula: "",
      counts: {},
      moles,
      ratios: rawRatios,
      ok: false,
      error: "Could not find integer ratios within range",
    };
  }
  // Sort elements by Hill convention: C, H, then alphabetical.
  const sortedSymbols = sortByHillConvention(Object.keys(counts));
  const formula = sortedSymbols
    .map((s) => (counts[s] === 1 ? s : `${s}${counts[s]}`))
    .join("");
  return { formula, counts, moles, ratios: rawRatios, ok: true };
}

/** Try to convert a list of float ratios to whole numbers (multiplier 1..20). */
function wholeNumberRatios(
  ratios: { symbol: string; ratio: number }[],
): Record<string, number> | null {
  const EPS = 0.02;
  for (let mult = 1; mult <= 20; mult++) {
    const rounded = ratios.map((r) => Math.round(r.ratio * mult));
    let ok = true;
    for (let i = 0; i < ratios.length; i++) {
      const diff = Math.abs(ratios[i].ratio * mult - rounded[i]);
      if (diff > EPS) {
        ok = false;
        break;
      }
    }
    if (ok && rounded.every((n) => n > 0)) {
      const out: Record<string, number> = {};
      ratios.forEach((r, i) => { out[r.symbol] = rounded[i]; });
      return out;
    }
  }
  return null;
}

/** Sort element symbols by Hill convention: C first, H second, then alphabetical. */
export function sortByHillConvention(symbols: string[]): string[] {
  const copy = [...symbols];
  copy.sort((a, b) => {
    if (a === "C" && b !== "C") return -1;
    if (b === "C" && a !== "C") return 1;
    if (a === "H" && b !== "H" && b !== "C") return -1;
    if (b === "H" && a !== "H" && a !== "C") return 1;
    return a.localeCompare(b);
  });
  return copy;
}

// ---- Molecular formula from empirical + molar mass ----

export interface MolecularResult {
  formula: string;
  counts: Record<string, number>;
  multiplier: number;
  empiricalMass: number;
  molarMass: number;
  ok: boolean;
  error?: string;
}

/** Compute the molecular formula given the empirical formula and molar mass. */
export function molecularFormula(empirical: string, molarMass: number): MolecularResult {
  if (!empirical) {
    return { formula: "", counts: {}, multiplier: 0, empiricalMass: 0, molarMass, ok: false, error: "Empty empirical formula" };
  }
  const r = parseFormula(empirical);
  if (!r.ok) {
    return { formula: "", counts: {}, multiplier: 0, empiricalMass: 0, molarMass, ok: false, error: r.error };
  }
  const empMass = calculateMolarMass(r.counts);
  if (empMass <= 0) {
    return { formula: "", counts: {}, multiplier: 0, empiricalMass: 0, molarMass, ok: false, error: "Invalid empirical mass" };
  }
  const ratio = molarMass / empMass;
  const mult = Math.round(ratio);
  if (Math.abs(ratio - mult) > 0.05 || mult < 1) {
    return {
      formula: "",
      counts: {},
      multiplier: mult,
      empiricalMass: empMass,
      molarMass,
      ok: false,
      error: `Molar mass ${molarMass} is not a whole-number multiple of empirical mass ${empMass.toFixed(3)} (ratio ${ratio.toFixed(3)})`,
    };
  }
  const counts: Record<string, number> = {};
  for (const [s, n] of Object.entries(r.counts)) counts[s] = n * mult;
  const sorted = sortByHillConvention(Object.keys(counts));
  const formula = sorted.map((s) => (counts[s] === 1 ? s : `${s}${counts[s]}`)).join("");
  return { formula, counts, multiplier: mult, empiricalMass: empMass, molarMass, ok: true };
}

// ---- Equation balancer ----

export interface ParsedEquation {
  reactants: { formula: string; counts: Record<string, number> }[];
  products: { formula: string; counts: Record<string, number> }[];
  elements: string[];
  ok: boolean;
  error?: string;
}

/** Parse an equation like "H2 + O2 = H2O" into reactants and products. */
export function parseEquation(eq: string): ParsedEquation {
  if (!eq) return { reactants: [], products: [], elements: [], ok: false, error: "Empty equation" };
  const parts = eq.split(/->|=>|=|→/).map((p) => p.trim());
  if (parts.length !== 2) {
    return { reactants: [], products: [], elements: [], ok: false, error: "Equation must contain exactly one = or ->" };
  }
  const reactantStrs = parts[0].split(/\+|\+/).map((s) => s.trim()).filter(Boolean);
  const productStrs = parts[1].split(/\+|\+/).map((s) => s.trim()).filter(Boolean);
  if (reactantStrs.length === 0 || productStrs.length === 0) {
    return { reactants: [], products: [], elements: [], ok: false, error: "Missing reactants or products" };
  }
  const parseSide = (strs: string[]) => {
    const out: { formula: string; counts: Record<string, number> }[] = [];
    for (const s of strs) {
      // Strip any leading coefficient (e.g. "2H2O" → "H2O").
      const stripped = s.replace(/^\d+/, "");
      const r = parseFormula(stripped);
      if (!r.ok) {
        return { error: r.error ?? `Invalid formula: ${s}`, side: null as null };
      }
      out.push({ formula: stripped, counts: r.counts });
    }
    return { error: null as string | null, side: out };
  };
  const rR = parseSide(reactantStrs);
  if (rR.error) return { reactants: [], products: [], elements: [], ok: false, error: rR.error };
  const rP = parseSide(productStrs);
  if (rP.error) return { reactants: [], products: [], elements: [], ok: false, error: rP.error };

  const elementSet = new Set<string>();
  for (const c of [...rR.side!, ...rP.side!]) {
    for (const sym of Object.keys(c.counts)) elementSet.add(sym);
  }
  return {
    reactants: rR.side!,
    products: rP.side!,
    elements: [...elementSet].sort(),
    ok: true,
  };
}

export interface BalanceResult {
  coefficients: number[];
  balancedEquation: string;
  ok: boolean;
  error?: string;
}

/**
 * Balance a chemical equation by searching for the smallest integer
 * coefficients (1..20) that satisfy the law of conservation of mass.
 * Suitable for equations with up to 6 species.
 */
export function balanceEquation(eq: string): BalanceResult {
  const p = parseEquation(eq);
  if (!p.ok) return { coefficients: [], balancedEquation: "", ok: false, error: p.error };

  const nReact = p.reactants.length;
  const nProd = p.products.length;
  const total = nReact + nProd;
  if (total > 6) {
    return {
      coefficients: [],
      balancedEquation: "",
      ok: false,
      error: "Equation has too many species (max 6) for the integer-search balancer",
    };
  }

  // species[i] = counts for species i (reactants first, then products).
  const species: Record<string, number>[] = [
    ...p.reactants.map((r) => r.counts),
    ...p.products.map((r) => r.counts),
  ];

  // Try coefficients recursively. First solution found = smallest (because we
  // iterate in ascending order from coefficient 1).
  const coeffs = new Array(total).fill(1);
  let found: number[] | null = null;

  const isBalanced = () => {
    for (const el of p.elements) {
      let reactSum = 0;
      let prodSum = 0;
      for (let i = 0; i < nReact; i++) reactSum += (species[i][el] ?? 0) * coeffs[i];
      for (let i = nReact; i < total; i++) prodSum += (species[i][el] ?? 0) * coeffs[i];
      if (reactSum !== prodSum) return false;
    }
    return true;
  };

  const recurse = (idx: number): boolean => {
    if (idx === total) {
      // Reject all-zero (would falsely balance trivially).
      if (coeffs.every((c) => c === 0)) return false;
      if (isBalanced()) {
        found = [...coeffs];
        return true;
      }
      return false;
    }
    for (let v = 1; v <= 20; v++) {
      coeffs[idx] = v;
      if (recurse(idx + 1)) return true;
    }
    return false;
  };

  if (!recurse(0)) {
    return {
      coefficients: [],
      balancedEquation: "",
      ok: false,
      error: "Could not balance within coefficient range 1..20",
    };
  }

  // Build the balanced equation string.
  const fmt = (i: number) => (found![i] === 1 ? "" : `${found![i]}`);
  const reactStr = p.reactants.map((r, i) => `${fmt(i)}${r.formula}`).join(" + ");
  const prodStr = p.products.map((r, i) => `${fmt(nReact + i)}${r.formula}`).join(" + ");
  return {
    coefficients: found!,
    balancedEquation: `${reactStr} = ${prodStr}`,
    ok: true,
  };
}

// ---- Render ----

export interface SummaryStats {
  totalElements: number;
  totalAtoms: number;
  molarMass: number;
  formula: string;
}

export function computeSummary(formula: string): SummaryStats | { error: string } {
  const r = parseFormula(formula);
  if (!r.ok) return { error: r.error ?? "Invalid formula" };
  let totalAtoms = 0;
  for (const n of Object.values(r.counts)) totalAtoms += n;
  return {
    totalElements: Object.keys(r.counts).length,
    totalAtoms,
    molarMass: calculateMolarMass(r.counts),
    formula,
  };
}

/** Render the molar mass breakdown as a text report. */
export function renderText(formula: string, breakdown: MolarMassBreakdown): string {
  const lines: string[] = [];
  lines.push("Chemistry Formula Report");
  lines.push("========================");
  lines.push(`Formula: ${formula}`);
  lines.push(`Molar mass: ${breakdown.total.toFixed(4)} g/mol`);
  lines.push(`Total atoms: ${breakdown.totalAtoms}`);
  lines.push(`Distinct elements: ${breakdown.distinctElements}`);
  lines.push("");
  lines.push("Breakdown:");
  lines.push("  Symbol  Count  AtomicMass  Contribution  Percent");
  for (const r of breakdown.rows) {
    lines.push(
      `  ${r.symbol.padEnd(6)} ${String(r.count).padStart(5)}  ${r.atomicMass.toFixed(3).padStart(10)}  ${r.contribution.toFixed(4).padStart(12)}  ${r.percent.toFixed(2).padStart(7)}%`,
    );
  }
  return lines.join("\n");
}

/** Render the molar mass breakdown as CSV. */
export function renderCsv(breakdown: MolarMassBreakdown): string {
  const lines = ["symbol,name,count,atomic_mass,contribution,percent"];
  for (const r of breakdown.rows) {
    lines.push(
      [
        r.symbol,
        escapeCsv(r.name),
        r.count,
        r.atomicMass.toFixed(6),
        r.contribution.toFixed(6),
        r.percent.toFixed(4),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:chemistry-formula-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  calculationType: CalculationType;
  formula: string;
  result: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(
  calcType: CalculationType,
  formula: string,
  experimentalData: string,
  molarMass: number,
  equation: string,
): string {
  const params = new URLSearchParams();
  if (calcType) params.set("t", calcType);
  if (formula) params.set("f", formula);
  if (experimentalData) params.set("d", experimentalData);
  if (molarMass && molarMass > 0) params.set("m", String(molarMass));
  if (equation) params.set("e", equation);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  calcType: CalculationType;
  formula: string;
  experimentalData: string;
  molarMass: number;
  equation: string;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { calcType: "molar-mass", formula: "", experimentalData: "", molarMass: 0, equation: "" };
  }
  const params = new URLSearchParams(clean);
  const t = params.get("t") ?? "molar-mass";
  const validTypes = CALC_TYPES.map((c) => c.value);
  const calcType = validTypes.includes(t as CalculationType) ? (t as CalculationType) : "molar-mass";
  const formula = params.get("f") ?? "";
  const experimentalData = params.get("d") ?? "";
  const molarMassNum = parseFloat(params.get("m") ?? "");
  const molarMass = isNaN(molarMassNum) ? 0 : molarMassNum;
  const equation = params.get("e") ?? "";
  return { calcType, formula, experimentalData, molarMass, equation };
}
