/**
 * Weight Unit Converter — pure logic. No DOM access.
 *
 * Features:
 *  - 15 units: microgram, milligram, gram, kilogram, metric ton, carat,
 *    grain, pennyweight, ounce, troy ounce, pound, stone, troy pound,
 *    US (short) ton, imperial (long) ton
 *  - All-units-at-once table
 *  - Batch mode (one value per line)
 *  - CSV export for batch and history
 *  - Number formatting helpers
 *  - Validation
 */

export type WeightUnit =
  | "ug"
  | "mg"
  | "g"
  | "kg"
  | "ton"
  | "carat"
  | "grain"
  | "pennyweight"
  | "oz"
  | "troy_oz"
  | "lb"
  | "stone"
  | "troy_lb"
  | "ton_us"
  | "ton_uk";

export interface ConvertOptions {
  from: WeightUnit;
  to: WeightUnit;
}

export interface ConvertResult {
  output: number;
  unit: WeightUnit;
  warnings: string[];
}

export interface WeightRow {
  unit: WeightUnit;
  value: number;
}

export interface HistoryEntry {
  ts: number;
  input: number;
  from: WeightUnit;
  to: WeightUnit;
  output: number;
}

/** Conversion factor: grams per 1 unit. */
export const TO_GRAMS: Record<WeightUnit, number> = {
  ug: 1e-6,
  mg: 0.001,
  g: 1,
  kg: 1000,
  ton: 1_000_000,
  carat: 0.2,
  grain: 0.06479891,
  pennyweight: 1.55517384,
  oz: 28.349523125,
  troy_oz: 31.1034768,
  lb: 453.59237,
  stone: 6350.29318,
  troy_lb: 373.2417216,
  ton_us: 907184.74,
  ton_uk: 1_016_046.9088,
};

export const UNIT_LABELS: Record<WeightUnit, string> = {
  ug: "Microgram (µg)",
  mg: "Milligram (mg)",
  g: "Gram (g)",
  kg: "Kilogram (kg)",
  ton: "Metric ton (t)",
  carat: "Carat (ct)",
  grain: "Grain (gr)",
  pennyweight: "Pennyweight (dwt)",
  oz: "Ounce (oz)",
  troy_oz: "Troy ounce (oz t)",
  lb: "Pound (lb)",
  stone: "Stone (st)",
  troy_lb: "Troy pound (lb t)",
  ton_us: "US (short) ton",
  ton_uk: "Imperial (long) ton",
};

export const UNIT_SYMBOLS: Record<WeightUnit, string> = {
  ug: "µg",
  mg: "mg",
  g: "g",
  kg: "kg",
  ton: "t",
  carat: "ct",
  grain: "gr",
  pennyweight: "dwt",
  oz: "oz",
  troy_oz: "oz t",
  lb: "lb",
  stone: "st",
  troy_lb: "lb t",
  ton_us: "ton (US)",
  ton_uk: "ton (UK)",
};

const round6 = (n: number): number => Math.round((n + Number.EPSILON) * 1e6) / 1e6;

/** Convert a value between two weight units. */
export function process(input: number, options: ConvertOptions): ConvertResult | { error: string } {
  const warnings: string[] = [];
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  if (!Number.isFinite(input)) return { error: "Input must be a finite number" };
  if (input < 0) warnings.push("Negative weight is unusual.");
  if (input > 1e15) warnings.push("Value is extraordinarily large — check the unit.");
  const fromG = input * TO_GRAMS[options.from];
  const out = fromG / TO_GRAMS[options.to];
  return { output: round6(out), unit: options.to, warnings };
}

/** Convert one input into every supported unit. */
export function convertAll(input: number, from: WeightUnit): WeightRow[] {
  const fromG = input * TO_GRAMS[from];
  return (Object.keys(TO_GRAMS) as WeightUnit[]).map((unit) => ({
    unit,
    value: round6(fromG / TO_GRAMS[unit]),
  }));
}

/** Batch-convert a list of values from one source unit to one target unit. */
export function batchConvert(inputs: number[], from: WeightUnit, to: WeightUnit): ConvertResult[] {
  const out: ConvertResult[] = [];
  for (const v of inputs) {
    const r = process(v, { from, to });
    if ("error" in r) continue;
    out.push(r);
  }
  return out;
}

/** Format a numeric weight for display. */
export function formatWeight(value: number, unit: WeightUnit, digits = 4): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const d = abs >= 1000 || abs < 0.001 ? 6 : digits;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: d })} ${UNIT_SYMBOLS[unit]}`;
}

/** Serialize an all-units table to CSV. */
export function toCsv(rows: WeightRow[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

/** Serialize batch results to CSV. */
export function batchToCsv(rows: { input: number; output: number; warnings: string }[], from: WeightUnit, to: WeightUnit): string {
  const lines = [`Input (${from}),Output (${to}),Warnings`];
  for (const r of rows) {
    const w = `"${r.warnings.join("; ").replace(/"/g, '""')}"`;
    lines.push(`${r.input},${r.output},${w}`);
  }
  return lines.join("\n");
}

/** Serialize history entries to CSV. */
export function historyToCsv(history: HistoryEntry[]): string {
  const lines = ["Timestamp,Input,From,Output,To"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.input},${h.from},${h.output},${h.to}`);
  }
  return lines.join("\n");
}

/** Parse a multi-line text input into a list of numbers (skipping bad lines). */
export function parseBatchInput(text: string): { values: number[]; skipped: number } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const values: number[] = [];
  let skipped = 0;
  for (const line of lines) {
    const n = Number(line);
    if (Number.isFinite(n)) values.push(n);
    else skipped += 1;
  }
  return { values, skipped };
}

/** Validate that a unit string is one of the supported units. */
export function isValidUnit(s: string): s is WeightUnit {
  return s in TO_GRAMS;
}

/** Group units by category for UI display. */
export function unitGroups(): { label: string; units: WeightUnit[] }[] {
  return [
    { label: "Metric", units: ["ug", "mg", "g", "kg", "ton"] },
    { label: "Imperial / US", units: ["oz", "lb", "stone", "ton_us", "ton_uk"] },
    { label: "Precious metals", units: ["carat", "grain", "pennyweight", "troy_oz", "troy_lb"] },
  ];
}
