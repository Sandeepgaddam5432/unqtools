/**
 * Pressure Converter — pure logic. No DOM/canvas access.
 *
 * Supports:
 *  - 10 pressure units: Pa, kPa, MPa, bar, psi, atm, mmHg, torr, hPa, mbar
 *  - All-units conversion table (single input → all units)
 *  - Batch conversion (multiple inputs from one source unit)
 *  - CSV export of batch / all-units table
 *  - Warnings (negative pressure, vacuum warning when < 1 atm)
 *  - Significant-digit rounding
 *  - Common-presets table (1 atm, 1 bar, 1 psi, etc.)
 *  - Best-fit unit finder
 *  - Pressure-class hints (atmospheric / hydraulic / vacuum)
 *  - Altitude-from-pressure estimator (barometric formula)
 *  - Validate options
 */
export type PressureUnit =
  | "Pa" | "hPa" | "kPa" | "MPa" | "bar" | "mbar" | "atm" | "psi" | "mmHg" | "torr";

export type PressureClass = "atmospheric" | "hydraulic" | "vacuum" | "metric";

/** Pascals per unit (canonical). */
export const TO_PA: Record<PressureUnit, number> = {
  Pa: 1,
  hPa: 100,
  kPa: 1000,
  MPa: 1e6,
  bar: 1e5,
  mbar: 100,
  atm: 101325,
  psi: 6894.757293168,
  mmHg: 133.3223684211,
  torr: 133.3223684211,
};

export const UNIT_LABELS: Record<PressureUnit, string> = {
  Pa: "Pascal (Pa)",
  hPa: "Hectopascal (hPa)",
  kPa: "Kilopascal (kPa)",
  MPa: "Megapascal (MPa)",
  bar: "Bar",
  mbar: "Millibar (mbar)",
  atm: "Atmosphere (atm)",
  psi: "Pound per square inch (psi)",
  mmHg: "Millimeter of mercury (mmHg)",
  torr: "Torr",
};

export const UNIT_CLASS: Record<PressureUnit, PressureClass> = {
  Pa: "metric", hPa: "atmospheric", kPa: "metric", MPa: "hydraulic",
  bar: "metric", mbar: "atmospheric", atm: "atmospheric",
  psi: "hydraulic", mmHg: "atmospheric", torr: "vacuum",
};

export const ALL_UNITS = Object.keys(TO_PA) as PressureUnit[];
export const ALL_CLASSES: PressureClass[] = ["atmospheric", "hydraulic", "vacuum", "metric"];

export const PRESETS: { label: string; value: number; unit: PressureUnit }[] = [
  { label: "1 atm (sea level)", value: 1, unit: "atm" },
  { label: "1 bar", value: 1, unit: "bar" },
  { label: "1 psi", value: 1, unit: "psi" },
  { label: "1 mmHg (1 torr)", value: 1, unit: "mmHg" },
  { label: "1 kPa", value: 1, unit: "kPa" },
  { label: "1 MPa", value: 1, unit: "MPa" },
  { label: "1013 hPa (1 atm)", value: 1013, unit: "hPa" },
];

export interface ConvertOptions { from: PressureUnit; to: PressureUnit; }
export interface ConvertResult { output: number; unit: PressureUnit; class: PressureClass; warnings: string[] }

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
  if (input < 0) warnings.push("Negative pressure is unusual.");
  const pa = input * TO_PA[options.from];
  if (pa < 1000 && pa > 0) warnings.push("Below atmospheric — vacuum range.");
  if (pa > 1e7) warnings.push("Very high pressure — hydraulic range.");
  const output = pa / TO_PA[options.to];
  return { output: roundTo(output), unit: options.to, class: UNIT_CLASS[options.to], warnings };
}

/** Convert one input to ALL units. */
export function convertAll(input: number, from: PressureUnit): { unit: PressureUnit; value: number }[] {
  const pa = input * TO_PA[from];
  return ALL_UNITS.map((unit) => ({ unit, value: roundTo(pa / TO_PA[unit]) }));
}

/** Batch conversion: many inputs from same source to one target. */
export function convertBatch(inputs: number[], from: PressureUnit, to: PressureUnit): (ConvertResult | { error: string })[] {
  return inputs.map((v) => process(v, { from, to }));
}

export function toCsv(rows: { unit: PressureUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

export function batchToCsv(inputs: number[], from: PressureUnit, to: PressureUnit, results: (ConvertResult | { error: string })[]): string {
  const lines = ["Input,From,Output,Unit,Class,Warnings"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if ("error" in r) lines.push(`${inputs[i]},${from},ERROR,${to},,"${r.error.replace(/"/g, '""')}"`);
    else lines.push(`${inputs[i]},${from},${r.output},${r.unit},${r.class},${r.warnings.length}`);
  }
  return lines.join("\n");
}

export function swap(opts: ConvertOptions): ConvertOptions { return { from: opts.to, to: opts.from }; }

/** Best-fit unit for a pascal value. */
export function bestFitUnit(pa: number): PressureUnit {
  const abs = Math.abs(pa);
  if (abs === 0) return "Pa";
  if (abs < 100) return "Pa";
  if (abs < 1000) return "hPa";
  if (abs < 1e5) return "kPa";
  if (abs < 1e6) return "bar";
  return "MPa";
}

/** Estimate altitude (meters) from pressure (Pa) using the barometric formula. */
export function altitudeFromPressure(pa: number): number {
  if (pa <= 0) return NaN;
  // h = 44330 * (1 - (P/P0)^(1/5.255))
  return 44330 * (1 - Math.pow(pa / 101325, 1 / 5.255));
}

/** Format a pressure value with unit and 6 sig digits. */
export function formatPressure(value: number, unit: PressureUnit): string {
  return `${roundTo(value, 6)} ${unit}`;
}

/** Validate options. */
export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  if (!TO_PA[opts.from]) return { error: "Invalid source unit" };
  if (!TO_PA[opts.to]) return { error: "Invalid target unit" };
  return { ok: true };
}

/** Filter units by class. */
export function unitsByClass(cls: PressureClass): PressureUnit[] {
  return ALL_UNITS.filter((u) => UNIT_CLASS[u] === cls);
}

/** Sum pressures (rare but useful for partial-pressure calculations). */
export function sumPressure(items: { value: number; unit: PressureUnit }[], outputUnit: PressureUnit): number {
  const pa = items.reduce((acc, it) => acc + it.value * TO_PA[it.unit], 0);
  return roundTo(pa / TO_PA[outputUnit]);
}

/** Convert mmHg to inHg (extra convenience). */
export function mmHgToInHg(mmHg: number): number {
  return mmHg * 0.03937;
}
