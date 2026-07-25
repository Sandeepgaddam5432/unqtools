/**
 * Energy Converter — pure logic. No DOM/canvas access.
 *
 * Supports:
 *  - 10 energy units: J, kJ, cal, kcal, Wh, kWh, BTU, eV, ft·lb, therm
 *  - All-units conversion table (single input → all units)
 *  - Unit picker (from / to) with sanity validation
 *  - Batch conversion (multiple inputs from one source unit)
 *  - CSV export of batch / all-units table
 *  - Warnings (negative energy, overflow on eV)
 *  - Significant-digit rounding
 *  - Energy class hints (chemical / mechanical / electrical / thermal)
 *  - Common-presets table (1 cal, 1 BTU, 1 kWh, etc.)
 *  - Quick reference: human-scale equivalents (1 cal ≈ heat to warm 1g water 1°C)
 *  - Reverse conversion helper (swap from/to)
 */
export type EnergyUnit =
  | "J" | "kJ" | "cal" | "kcal" | "Wh" | "kWh" | "BTU" | "eV" | "ft_lb" | "therm";

/** Joules per unit (canonical). */
export const TO_J: Record<EnergyUnit, number> = {
  J: 1,
  kJ: 1e3,
  cal: 4.184,
  kcal: 4184,
  Wh: 3600,
  kWh: 3.6e6,
  BTU: 1055.05585262,
  eV: 1.602176634e-19,
  ft_lb: 1.3558179483314004,
  therm: 1.05505585262e8,
};

export const UNIT_LABELS: Record<EnergyUnit, string> = {
  J: "Joule (J)",
  kJ: "Kilojoule (kJ)",
  cal: "Calorie (cal)",
  kcal: "Kilocalorie (kcal)",
  Wh: "Watt-hour (Wh)",
  kWh: "Kilowatt-hour (kWh)",
  BTU: "British Thermal Unit (BTU)",
  eV: "Electronvolt (eV)",
  ft_lb: "Foot-pound (ft·lb)",
  therm: "Therm (therm)",
};

export type EnergyClass = "mechanical" | "thermal" | "electrical" | "atomic" | "chemical";

export const UNIT_CLASS: Record<EnergyUnit, EnergyClass> = {
  J: "mechanical", kJ: "mechanical",
  cal: "thermal", kcal: "thermal", BTU: "thermal", therm: "thermal",
  Wh: "electrical", kWh: "electrical",
  eV: "atomic",
  ft_lb: "mechanical",
};

export interface ConvertOptions { from: EnergyUnit; to: EnergyUnit; }
export interface ConvertResult { output: number; unit: EnergyUnit; warnings: string[]; }

/** Common reference conversions for the in-app table. */
export const PRESETS: { label: string; value: number; unit: EnergyUnit }[] = [
  { label: "1 cal (small calorie)", value: 1, unit: "cal" },
  { label: "1 kcal (food Calorie)", value: 1, unit: "kcal" },
  { label: "1 BTU", value: 1, unit: "BTU" },
  { label: "1 kWh", value: 1, unit: "kWh" },
  { label: "1 eV", value: 1, unit: "eV" },
  { label: "1 ft·lb", value: 1, unit: "ft_lb" },
  { label: "1 therm", value: 1, unit: "therm" },
];

/** Human-readable trivia per unit. */
export const UNIT_TRIVIA: Record<EnergyUnit, string> = {
  J: "SI unit of energy (N·m).",
  kJ: "1 kJ = 1000 J; used in chemistry.",
  cal: "Heat to warm 1 g of water by 1 °C.",
  kcal: "Food 'Calorie' = 1 kcal.",
  Wh: "Energy of 1 W for 1 hour.",
  kWh: "Standard electricity billing unit.",
  BTU: "Heat to warm 1 lb water by 1 °F.",
  eV: "Energy gained by an electron crossing 1 V.",
  ft_lb: "Work to lift 1 lb by 1 ft.",
  therm: "≈ 100 cubic feet of natural gas.",
};

/** Round to N significant digits. */
export function roundTo(value: number, sig = 10): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = sig - d;
  const f = Math.pow(10, power);
  return Math.round(value * f) / f;
}

/** Convert a single value. */
export function process(input: number, options: ConvertOptions): ConvertResult | { error: string } {
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  if (!Number.isFinite(input)) return { error: "Input must be finite" };
  const warnings: string[] = [];
  if (input < 0) warnings.push("Negative energy is unusual.");
  const j = input * TO_J[options.from];
  if (options.to === "eV" && Math.abs(j) >= 1e30) warnings.push("Value exceeds typical atomic-scale magnitudes.");
  const output = j / TO_J[options.to];
  return { output: roundTo(output), unit: options.to, warnings };
}

/** Convert one input to ALL units. */
export function convertAll(input: number, from: EnergyUnit): { unit: EnergyUnit; value: number }[] {
  const j = input * TO_J[from];
  return (Object.keys(TO_J) as EnergyUnit[]).map((unit) => ({ unit, value: roundTo(j / TO_J[unit]) }));
}

/** Batch conversion: many inputs from the same source unit to a single target unit. */
export function convertBatch(inputs: number[], from: EnergyUnit, to: EnergyUnit): (ConvertResult | { error: string })[] {
  return inputs.map((v) => process(v, { from, to }));
}

/** Convert a list of {unit, value} rows to CSV. */
export function toCsv(rows: { unit: EnergyUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

/** Convert a batch outcome list to CSV. */
export function batchToCsv(inputs: number[], from: EnergyUnit, to: EnergyUnit, results: (ConvertResult | { error: string })[]): string {
  const lines = ["Input,From,Output,Unit,Warnings"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if ("error" in r) lines.push(`${inputs[i]},${from},ERROR,${to},"${r.error.replace(/"/g, '""')}"`);
    else lines.push(`${inputs[i]},${from},${r.output},${r.unit},${r.warnings.length}`);
  }
  return lines.join("\n");
}

/** Swap from/to. */
export function swap(opts: ConvertOptions): ConvertOptions {
  return { from: opts.to, to: opts.from };
}

/** Find the largest human-friendly unit for a joule value. */
export function bestFitUnit(joules: number): EnergyUnit {
  const abs = Math.abs(joules);
  if (abs === 0) return "J";
  if (abs < 1e-15) return "eV";
  if (abs < 1) return "J";
  if (abs < 1e3) return "J";
  if (abs < 4.2e3) return "cal";
  if (abs < 4.2e6) return "kcal";
  if (abs < 1.06e8) return "kWh";
  return "therm";
}

/** Format an energy value with unit and 6 sig digits. */
export function formatEnergy(value: number, unit: EnergyUnit): string {
  return `${roundTo(value, 6)} ${unit}`;
}

/** Total energy of a list of values (each in its own unit). */
export function sumEnergy(items: { value: number; unit: EnergyUnit }[], outputUnit: EnergyUnit): number {
  const j = items.reduce((acc, it) => acc + it.value * TO_J[it.unit], 0);
  return roundTo(j / TO_J[outputUnit]);
}

/** Average energy of a list. */
export function avgEnergy(items: { value: number; unit: EnergyUnit }[], outputUnit: EnergyUnit): number {
  if (items.length === 0) return 0;
  return roundTo(sumEnergy(items, outputUnit) / items.length);
}

/** Validate conversion options. */
export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  if (!TO_J[opts.from]) return { error: "Invalid source unit" };
  if (!TO_J[opts.to]) return { error: "Invalid target unit" };
  return { ok: true };
}

/** List of all units. */
export const ALL_UNITS = Object.keys(TO_J) as EnergyUnit[];

/** List of all energy classes. */
export const ALL_CLASSES: EnergyClass[] = ["mechanical", "thermal", "electrical", "atomic", "chemical"];

/** Filter units by class. */
export function unitsByClass(cls: EnergyClass): EnergyUnit[] {
  return ALL_UNITS.filter((u) => UNIT_CLASS[u] === cls);
}
