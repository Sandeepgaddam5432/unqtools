/**
 * Unit Converter (Educational) — pure logic.
 *
 * Conversion factor table for 10 categories plus special handlers for
 * temperature. Pure functions only — no DOM, no network.
 */

export type Category =
  | "length"
  | "mass"
  | "temperature"
  | "time"
  | "area"
  | "volume"
  | "speed"
  | "digital-storage"
  | "energy"
  | "pressure";

export interface UnitDef {
  /** Stable identifier (e.g. "meter"). */
  id: string;
  /** Short symbol shown in UI (e.g. "m"). */
  symbol: string;
  /** Full display name (e.g. "meter"). */
  name: string;
  /** Conversion factor to the category base unit. For non-multiplicative
   * categories (temperature), this field is unused. */
  factor: number;
}

export interface CategoryDef {
  id: Category;
  label: string;
  baseUnitId: string;
  /** Whether this category uses a special handler instead of multiplication. */
  special?: "temperature";
  units: UnitDef[];
}

/** A single conversion step shown to the learner. */
export interface ConversionStep {
  /** Display label (e.g. "Formula"). */
  label: string;
  /** The math expression as a string. */
  expression: string;
}

export interface ConversionResult {
  category: Category;
  fromUnit: UnitDef;
  toUnit: UnitDef;
  value: number;
  result: number;
  steps: ConversionStep[];
  formulaReference: string;
  precision: number;
}

export interface ConverterInput {
  category: Category;
  fromUnitId: string;
  toUnitId: string;
  value: number;
  showSteps: boolean;
  precision: number;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  length: "Length",
  mass: "Mass",
  temperature: "Temperature",
  time: "Time",
  area: "Area",
  volume: "Volume",
  speed: "Speed",
  "digital-storage": "Digital Storage",
  energy: "Energy",
  pressure: "Pressure",
};

/** All categories with their unit tables. Factors are relative to base unit. */
export const CATEGORIES: CategoryDef[] = [
  {
    id: "length",
    label: "Length",
    baseUnitId: "meter",
    units: [
      { id: "meter", symbol: "m", name: "Meter", factor: 1 },
      { id: "kilometer", symbol: "km", name: "Kilometer", factor: 1000 },
      { id: "centimeter", symbol: "cm", name: "Centimeter", factor: 0.01 },
      { id: "millimeter", symbol: "mm", name: "Millimeter", factor: 0.001 },
      { id: "mile", symbol: "mi", name: "Mile", factor: 1609.344 },
      { id: "yard", symbol: "yd", name: "Yard", factor: 0.9144 },
      { id: "foot", symbol: "ft", name: "Foot", factor: 0.3048 },
      { id: "inch", symbol: "in", name: "Inch", factor: 0.0254 },
      { id: "nautical-mile", symbol: "nmi", name: "Nautical Mile", factor: 1852 },
    ],
  },
  {
    id: "mass",
    label: "Mass",
    baseUnitId: "kilogram",
    units: [
      { id: "kilogram", symbol: "kg", name: "Kilogram", factor: 1 },
      { id: "gram", symbol: "g", name: "Gram", factor: 0.001 },
      { id: "milligram", symbol: "mg", name: "Milligram", factor: 0.000001 },
      { id: "ton", symbol: "t", name: "Metric Ton", factor: 1000 },
      { id: "pound", symbol: "lb", name: "Pound", factor: 0.45359237 },
      { id: "ounce", symbol: "oz", name: "Ounce", factor: 0.028349523125 },
      { id: "stone", symbol: "st", name: "Stone", factor: 6.35029318 },
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    baseUnitId: "celsius",
    special: "temperature",
    units: [
      { id: "celsius", symbol: "°C", name: "Celsius", factor: 1 },
      { id: "fahrenheit", symbol: "°F", name: "Fahrenheit", factor: 1 },
      { id: "kelvin", symbol: "K", name: "Kelvin", factor: 1 },
    ],
  },
  {
    id: "time",
    label: "Time",
    baseUnitId: "second",
    units: [
      { id: "second", symbol: "s", name: "Second", factor: 1 },
      { id: "minute", symbol: "min", name: "Minute", factor: 60 },
      { id: "hour", symbol: "h", name: "Hour", factor: 3600 },
      { id: "day", symbol: "d", name: "Day", factor: 86400 },
      { id: "week", symbol: "wk", name: "Week", factor: 604800 },
      { id: "month", symbol: "mo", name: "Month (30d)", factor: 2592000 },
      { id: "year", symbol: "yr", name: "Year (365d)", factor: 31536000 },
    ],
  },
  {
    id: "area",
    label: "Area",
    baseUnitId: "square-meter",
    units: [
      { id: "square-meter", symbol: "m²", name: "Square Meter", factor: 1 },
      { id: "square-kilometer", symbol: "km²", name: "Square Kilometer", factor: 1000000 },
      { id: "square-foot", symbol: "ft²", name: "Square Foot", factor: 0.09290304 },
      { id: "square-yard", symbol: "yd²", name: "Square Yard", factor: 0.83612736 },
      { id: "acre", symbol: "ac", name: "Acre", factor: 4046.8564224 },
      { id: "hectare", symbol: "ha", name: "Hectare", factor: 10000 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    baseUnitId: "liter",
    units: [
      { id: "liter", symbol: "L", name: "Liter", factor: 1 },
      { id: "milliliter", symbol: "mL", name: "Milliliter", factor: 0.001 },
      { id: "gallon", symbol: "gal", name: "US Gallon", factor: 3.785411784 },
      { id: "quart", symbol: "qt", name: "US Quart", factor: 0.946352946 },
      { id: "pint", symbol: "pt", name: "US Pint", factor: 0.473176473 },
      { id: "cup", symbol: "cup", name: "US Cup", factor: 0.2365882365 },
      { id: "fluid-ounce", symbol: "fl oz", name: "US Fluid Ounce", factor: 0.0295735295625 },
    ],
  },
  {
    id: "speed",
    label: "Speed",
    baseUnitId: "meter-per-second",
    units: [
      { id: "meter-per-second", symbol: "m/s", name: "Meter per Second", factor: 1 },
      { id: "kilometer-per-hour", symbol: "km/h", name: "Kilometer per Hour", factor: 0.277777777778 },
      { id: "mile-per-hour", symbol: "mph", name: "Mile per Hour", factor: 0.44704 },
      { id: "knot", symbol: "kn", name: "Knot", factor: 0.514444444444 },
    ],
  },
  {
    id: "digital-storage",
    label: "Digital Storage",
    baseUnitId: "bit",
    units: [
      { id: "bit", symbol: "b", name: "Bit", factor: 1 },
      { id: "byte", symbol: "B", name: "Byte", factor: 8 },
      { id: "kilobyte", symbol: "KB", name: "Kilobyte (10³)", factor: 8000 },
      { id: "megabyte", symbol: "MB", name: "Megabyte (10⁶)", factor: 8000000 },
      { id: "gigabyte", symbol: "GB", name: "Gigabyte (10⁹)", factor: 8000000000 },
      { id: "terabyte", symbol: "TB", name: "Terabyte (10¹²)", factor: 8000000000000 },
      { id: "petabyte", symbol: "PB", name: "Petabyte (10¹⁵)", factor: 8000000000000000 },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    baseUnitId: "joule",
    units: [
      { id: "joule", symbol: "J", name: "Joule", factor: 1 },
      { id: "calorie", symbol: "cal", name: "Calorie (thermochemical)", factor: 4.184 },
      { id: "kilowatt-hour", symbol: "kWh", name: "Kilowatt-Hour", factor: 3600000 },
      { id: "btu", symbol: "BTU", name: "British Thermal Unit", factor: 1055.05585262 },
    ],
  },
  {
    id: "pressure",
    label: "Pressure",
    baseUnitId: "pascal",
    units: [
      { id: "pascal", symbol: "Pa", name: "Pascal", factor: 1 },
      { id: "kilopascal", symbol: "kPa", name: "Kilopascal", factor: 1000 },
      { id: "bar", symbol: "bar", name: "Bar", factor: 100000 },
      { id: "psi", symbol: "psi", name: "Pound per Square Inch", factor: 6894.757293168 },
      { id: "atm", symbol: "atm", name: "Standard Atmosphere", factor: 101325 },
    ],
  },
];

/** Common conversion presets. */
export interface Preset {
  label: string;
  category: Category;
  fromUnitId: string;
  toUnitId: string;
  value: number;
}

export const PRESETS: Preset[] = [
  { label: "1 mile → km", category: "length", fromUnitId: "mile", toUnitId: "kilometer", value: 1 },
  { label: "1 kg → lb", category: "mass", fromUnitId: "kilogram", toUnitId: "pound", value: 1 },
  { label: "100 °C → °F", category: "temperature", fromUnitId: "celsius", toUnitId: "fahrenheit", value: 100 },
  { label: "1 hour → s", category: "time", fromUnitId: "hour", toUnitId: "second", value: 1 },
  { label: "1 L → gal (US)", category: "volume", fromUnitId: "liter", toUnitId: "gallon", value: 1 },
  { label: "1 MB → KB", category: "digital-storage", fromUnitId: "megabyte", toUnitId: "kilobyte", value: 1 },
];

export const DEFAULT_INPUT: ConverterInput = {
  category: "length",
  fromUnitId: "mile",
  toUnitId: "kilometer",
  value: 1,
  showSteps: true,
  precision: 4,
};

/** Find a category by id. */
export function getCategory(id: Category): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Find a unit within a category by id. */
export function getUnit(category: Category, unitId: string): UnitDef | undefined {
  const cat = getCategory(category);
  if (!cat) return undefined;
  return cat.units.find((u) => u.id === unitId);
}

/** Get all unit ids for a category. */
export function listUnitIds(category: Category): string[] {
  return getCategory(category)?.units.map((u) => u.id) ?? [];
}

/** Get the first unit id of a category (used as default). */
export function defaultUnitId(category: Category, fallback?: string): string {
  const cat = getCategory(category);
  if (!cat || cat.units.length === 0) return "";
  // Prefer the fallback if it exists in the new category.
  if (fallback) {
    const exists = cat.units.find((u) => u.id === fallback);
    if (exists) return exists.id;
  }
  return cat.units[0].id;
}

/** Round a number to `precision` decimals. */
export function roundTo(value: number, precision: number): number {
  if (!Number.isFinite(value)) return NaN;
  const p = Math.max(0, Math.min(10, Math.floor(precision)));
  const mult = Math.pow(10, p);
  return Math.round(value * mult) / mult;
}

/** Format a number to a fixed precision string. */
export function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return String(value);
  const p = Math.max(0, Math.min(10, Math.floor(precision)));
  return value.toFixed(p);
}

/** Convert temperature using standard formulas. */
export function convertTemperature(
  value: number,
  fromId: string,
  toId: string,
): { result: number; formula: string } {
  // Reduce to Celsius first.
  let celsius: number;
  let step1: string;
  if (fromId === "celsius") {
    celsius = value;
    step1 = `${formatNumber(value, 4)} °C`;
  } else if (fromId === "fahrenheit") {
    celsius = (value - 32) * (5 / 9);
    step1 = `(${formatNumber(value, 4)} − 32) × 5/9 = ${formatNumber(celsius, 6)} °C`;
  } else if (fromId === "kelvin") {
    celsius = value - 273.15;
    step1 = `${formatNumber(value, 4)} K − 273.15 = ${formatNumber(celsius, 6)} °C`;
  } else {
    return { result: NaN, formula: "Unknown source unit" };
  }
  // Convert Celsius to target.
  let result: number;
  let step2: string;
  if (toId === "celsius") {
    result = celsius;
    step2 = `${formatNumber(celsius, 6)} °C`;
  } else if (toId === "fahrenheit") {
    result = celsius * (9 / 5) + 32;
    step2 = `${formatNumber(celsius, 6)} × 9/5 + 32 = ${formatNumber(result, 6)} °F`;
  } else if (toId === "kelvin") {
    result = celsius + 273.15;
    step2 = `${formatNumber(celsius, 6)} + 273.15 = ${formatNumber(result, 6)} K`;
  } else {
    return { result: NaN, formula: "Unknown target unit" };
  }
  const formula = `${step1} → ${step2}`;
  return { result, formula };
}

/** Build a formula reference string for a category. */
export function formulaReference(category: Category): string {
  if (category === "temperature") {
    return "°F = °C × 9/5 + 32 · K = °C + 273.15 · °C = (°F − 32) × 5/9 · K = °F − 32) × 5/9 + 273.15";
  }
  const cat = getCategory(category);
  if (!cat) return "";
  const base = cat.units.find((u) => u.id === cat.baseUnitId);
  const baseSymbol = base?.symbol ?? cat.baseUnitId;
  return `result = value × (factor_from / factor_to) — factors relative to ${baseSymbol}`;
}

/** Run a conversion and return the full result with steps. */
export function convert(input: ConverterInput): ConversionResult {
  const from = getUnit(input.category, input.fromUnitId);
  const to = getUnit(input.category, input.toUnitId);
  if (!from || !to) {
    const fallbackUnit = getUnit(input.category, listUnitIds(input.category)[0]);
    const safeUnit = fallbackUnit ?? (CATEGORIES[0].units[0] as UnitDef);
    return {
      category: input.category,
      fromUnit: from ?? safeUnit,
      toUnit: to ?? safeUnit,
      value: input.value,
      result: NaN,
      steps: [{ label: "Error", expression: "Unknown unit" }],
      formulaReference: formulaReference(input.category),
      precision: input.precision,
    };
  }
  const value = Number.isFinite(input.value) ? input.value : NaN;
  const precision = Math.max(0, Math.min(10, Math.floor(input.precision ?? 0)));

  if (input.category === "temperature") {
    const { result, formula } = convertTemperature(value, from.id, to.id);
    const steps: ConversionStep[] = [
      { label: "Formula", expression: formulaReference("temperature") },
      { label: "Step 1 (to °C)", expression: formula.split(" → ")[0] },
      { label: "Step 2 (to target)", expression: formula.split(" → ")[1] ?? "" },
      { label: "Result", expression: `${formatNumber(value, precision)} ${from.symbol} = ${formatNumber(result, precision)} ${to.symbol}` },
    ];
    return {
      category: input.category,
      fromUnit: from,
      toUnit: to,
      value,
      result,
      steps: input.showSteps ? steps : [steps[steps.length - 1]],
      formulaReference: formulaReference("temperature"),
      precision,
    };
  }

  // Multiplicative conversion.
  const baseValue = value * from.factor;
  const result = baseValue / to.factor;
  const steps: ConversionStep[] = [
    {
      label: "Formula",
      expression: `${formatNumber(value, precision)} ${from.symbol} × (${from.factor} / ${to.factor}) → ${to.symbol}`,
    },
    {
      label: "Substitute",
      expression: `${formatNumber(value, precision)} × ${from.factor} = ${formatNumber(baseValue, 6)} (base)`,
    },
    {
      label: "Convert",
      expression: `${formatNumber(baseValue, 6)} / ${to.factor} = ${formatNumber(result, precision)}`,
    },
    {
      label: "Result",
      expression: `${formatNumber(value, precision)} ${from.symbol} = ${formatNumber(result, precision)} ${to.symbol}`,
    },
  ];
  return {
    category: input.category,
    fromUnit: from,
    toUnit: to,
    value,
    result,
    steps: input.showSteps ? steps : [steps[steps.length - 1]],
    formulaReference: formulaReference(input.category),
    precision,
  };
}

/** Swap from/to in an input. */
export function swapUnits(input: ConverterInput): ConverterInput {
  return { ...input, fromUnitId: input.toUnitId, toUnitId: input.fromUnitId };
}

/** Filter units by a search query (matches symbol or name, case-insensitive). */
export function filterUnits(category: Category, query: string): UnitDef[] {
  const cat = getCategory(category);
  if (!cat) return [];
  const q = (query || "").trim().toLowerCase();
  if (!q) return cat.units;
  return cat.units.filter(
    (u) => u.symbol.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
  );
}

/** Render a conversion result as a text report. */
export function renderText(result: ConversionResult): string {
  const lines: string[] = [];
  lines.push("Unit Conversion Report");
  lines.push("======================");
  lines.push(`Category: ${CATEGORY_LABELS[result.category]}`);
  lines.push(`From: ${formatNumber(result.value, result.precision)} ${result.fromUnit.symbol} (${result.fromUnit.name})`);
  lines.push(`To:   ${result.toUnit.name} (${result.toUnit.symbol})`);
  lines.push("");
  lines.push("Steps:");
  for (const s of result.steps) {
    lines.push(`  ${s.label}: ${s.expression}`);
  }
  lines.push("");
  lines.push(`Result: ${formatNumber(result.value, result.precision)} ${result.fromUnit.symbol} = ${formatNumber(result.result, result.precision)} ${result.toUnit.symbol}`);
  lines.push("");
  lines.push(`Formula reference: ${result.formulaReference}`);
  return lines.join("\n");
}

/** Render a conversion result as CSV. */
export function renderCsv(result: ConversionResult): string {
  const header = "from_unit,from_symbol,to_unit,to_symbol,value,result,formula";
  const row = [
    result.fromUnit.name,
    result.fromUnit.symbol,
    result.toUnit.name,
    result.toUnit.symbol,
    formatNumber(result.value, result.precision),
    formatNumber(result.result, result.precision),
    `"${result.formulaReference.replace(/"/g, '""')}"`,
  ].join(",");
  return [header, row].join("\n");
}

/** Compute summary stats from history. */
export interface SummaryStats {
  total: number;
  byCategory: Record<Category, number>;
}

export function computeSummary(entries: HistoryEntry[]): SummaryStats {
  const byCategory = {
    length: 0,
    mass: 0,
    temperature: 0,
    time: 0,
    area: 0,
    volume: 0,
    speed: 0,
    "digital-storage": 0,
    energy: 0,
    pressure: 0,
  } as Record<Category, number>;
  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return { total: entries.length, byCategory };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:unit-converter-educational:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  category: Category;
  fromUnitId: string;
  toUnitId: string;
  value: number;
  result: number;
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

export function buildShareUrl(input: ConverterInput): string {
  const params = new URLSearchParams();
  params.set("cat", input.category);
  params.set("from", input.fromUnitId);
  params.set("to", input.toUnitId);
  params.set("v", String(input.value));
  params.set("p", String(input.precision));
  params.set("steps", input.showSteps ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ConverterInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_INPUT };
  const params = new URLSearchParams(clean);
  const validCats = CATEGORIES.map((c) => c.id);
  const cat = (params.get("cat") as Category) || DEFAULT_INPUT.category;
  const finalCat = validCats.includes(cat) ? cat : DEFAULT_INPUT.category;
  const fromId = params.get("from") ?? DEFAULT_INPUT.fromUnitId;
  const toId = params.get("to") ?? DEFAULT_INPUT.toUnitId;
  // Validate unit ids against the category.
  const catUnits = listUnitIds(finalCat);
  const from = catUnits.includes(fromId) ? fromId : defaultUnitId(finalCat);
  const to = catUnits.includes(toId) ? toId : defaultUnitId(finalCat, catUnits.find((u) => u !== from));
  return {
    category: finalCat,
    fromUnitId: from,
    toUnitId: to,
    value: Number(params.get("v") ?? DEFAULT_INPUT.value),
    showSteps: params.get("steps") !== "0",
    precision: Number(params.get("p") ?? DEFAULT_INPUT.precision),
  };
}
