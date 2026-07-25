/**
 * Temperature Converter — pure logic. No DOM access.
 *
 * Features:
 *  - Celsius / Fahrenheit / Kelvin / Rankine conversions
 *  - All-units-at-once table
 *  - Formula strings for each pair
 *  - Absolute zero warnings
 *  - Common temperature reference table
 *  - Batch mode (one value per line)
 *  - CSV export
 *  - History export
 *  - Number formatting helpers
 */

export type TempUnit = "celsius" | "fahrenheit" | "kelvin" | "rankine";

export interface TempConvertOptions {
  from: TempUnit;
  to: TempUnit;
}

export interface TempResult {
  output: number;
  unit: TempUnit;
  warnings: string[];
  formula: string;
}

export interface TempRow {
  unit: TempUnit;
  value: number;
}

export interface HistoryEntry {
  ts: number;
  input: number;
  from: TempUnit;
  to: TempUnit;
  output: number;
}

export const UNIT_LABELS: Record<TempUnit, string> = {
  celsius: "Celsius (°C)",
  fahrenheit: "Fahrenheit (°F)",
  kelvin: "Kelvin (K)",
  rankine: "Rankine (°R)",
};

export const UNIT_SYMBOLS: Record<TempUnit, string> = {
  celsius: "°C",
  fahrenheit: "°F",
  kelvin: "K",
  rankine: "°R",
};

/** Absolute zero in each unit. */
export const ABSOLUTE_ZERO: Record<TempUnit, number> = {
  celsius: -273.15,
  fahrenheit: -459.67,
  kelvin: 0,
  rankine: 0,
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Convert each unit to Kelvin. */
function toKelvin(value: number, from: TempUnit): number {
  switch (from) {
    case "celsius": return value + 273.15;
    case "fahrenheit": return (value - 32) * 5 / 9 + 273.15;
    case "kelvin": return value;
    case "rankine": return value * 5 / 9;
  }
}

/** Convert Kelvin to a target unit. */
function fromKelvin(k: number, to: TempUnit): number {
  switch (to) {
    case "celsius": return k - 273.15;
    case "fahrenheit": return (k - 273.15) * 9 / 5 + 32;
    case "kelvin": return k;
    case "rankine": return k * 9 / 5;
  }
}

/** Build a human-readable formula string for a conversion. */
export function formulaFor(from: TempUnit, to: TempUnit): string {
  if (from === to) return "x → x (identity)";
  const k: Record<TempUnit, string> = {
    celsius: "x + 273.15",
    fahrenheit: "(x − 32) × 5/9 + 273.15",
    kelvin: "x",
    rankine: "x × 5/9",
  };
  const fromK: Record<TempUnit, string> = {
    celsius: "K − 273.15",
    fahrenheit: "(K − 273.15) × 9/5 + 32",
    kelvin: "K",
    rankine: "K × 9/5",
  };
  return `${UNIT_SYMBOLS[from]} → ${UNIT_SYMBOLS[to]}: ${fromK[to]} where K = ${k[from]}`;
}

/** Single-value conversion with validation and warning. */
export function process(input: number, options: TempConvertOptions): TempResult | { error: string } {
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  if (!Number.isFinite(input)) return { error: "Input must be a finite number" };
  const warnings: string[] = [];
  const k = toKelvin(input, options.from);
  if (k < 0) warnings.push("Temperature is below absolute zero — physically impossible.");
  if (Math.abs(k) < 1e-9) warnings.push("Temperature is exactly absolute zero.");
  const out = fromKelvin(k, options.to);
  return {
    output: round2(out),
    unit: options.to,
    warnings,
    formula: formulaFor(options.from, options.to),
  };
}

/** Convert one input into every supported unit. */
export function convertAll(input: number, from: TempUnit): TempRow[] {
  const k = toKelvin(input, from);
  return (Object.keys(UNIT_LABELS) as TempUnit[]).map((unit) => ({ unit, value: round2(fromKelvin(k, unit)) }));
}

/** Convert a list of values, all from the same source unit, into the target unit. */
export function batchConvert(inputs: number[], from: TempUnit, to: TempUnit): TempResult[] {
  const out: TempResult[] = [];
  for (const v of inputs) {
    const r = process(v, { from, to });
    if ("error" in r) continue;
    out.push(r);
  }
  return out;
}

/** Format a numeric temperature for display. */
export function formatTemp(value: number, unit: TempUnit, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)} ${UNIT_SYMBOLS[unit]}`;
}

/** Reference table of common temperatures across all 4 scales. */
export function commonReferenceTable(): { label: string; celsius: number; fahrenheit: number; kelvin: number; rankine: number }[] {
  return [
    { label: "Absolute zero", celsius: -273.15, fahrenheit: -459.67, kelvin: 0, rankine: 0 },
    { label: "Water freezing", celsius: 0, fahrenheit: 32, kelvin: 273.15, rankine: 491.67 },
    { label: "Room temperature", celsius: 21, fahrenheit: 69.8, kelvin: 294.15, rankine: 529.47 },
    { label: "Body temperature", celsius: 37, fahrenheit: 98.6, kelvin: 310.15, rankine: 558.27 },
    { label: "Water boiling", celsius: 100, fahrenheit: 212, kelvin: 373.15, rankine: 671.67 },
    { label: "Gold melting", celsius: 1064, fahrenheit: 1947.2, kelvin: 1337.15, rankine: 2406.87 },
  ];
}

/** Serialize all-units result to CSV. */
export function toCsv(rows: TempRow[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

/** Serialize batch result rows to CSV. */
export function batchToCsv(rows: { input: number; output: number; warnings: string }[], from: TempUnit, to: TempUnit): string {
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
