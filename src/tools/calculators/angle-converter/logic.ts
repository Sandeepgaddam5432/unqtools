/**
 * Angle Converter — pure logic. No DOM/canvas access.
 *
 * Supports:
 *  - 6 angle units: degree, radian, gradian, turn, arcminute, arcsecond
 *  - All-units conversion table (single input → all units)
 *  - Batch conversion (multiple inputs from one source unit)
 *  - CSV export of batch / all-units table
 *  - Normalization to [0, 360°)
 *  - Normalization to [0, 2π)
 *  - Trig helpers (sin/cos/tan) for the input angle
 *  - Cardinal direction (N/NE/E/...) for degrees
 *  - Complementary/supplementary angle helpers
 *  - DMS (degrees-minutes-seconds) formatter
 *  - Significant-digit rounding
 *  - Best-fit unit
 *  - Validate options
 */
export type AngleUnit = "deg" | "rad" | "grad" | "turn" | "arcmin" | "arcsec";

export const TO_DEG: Record<AngleUnit, number> = {
  deg: 1,
  rad: 180 / Math.PI,
  grad: 0.9,
  turn: 360,
  arcmin: 1 / 60,
  arcsec: 1 / 3600,
};

export const UNIT_LABELS: Record<AngleUnit, string> = {
  deg: "Degree (°)",
  rad: "Radian (rad)",
  grad: "Gradian (grad)",
  turn: "Turn (full circle)",
  arcmin: "Arcminute (′)",
  arcsec: "Arcsecond (″)",
};

export const ALL_UNITS = Object.keys(TO_DEG) as AngleUnit[];

export const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export const PRESETS: { label: string; value: number; unit: AngleUnit }[] = [
  { label: "30°", value: 30, unit: "deg" },
  { label: "45°", value: 45, unit: "deg" },
  { label: "60°", value: 60, unit: "deg" },
  { label: "90° (right)", value: 90, unit: "deg" },
  { label: "180° (straight)", value: 180, unit: "deg" },
  { label: "270°", value: 270, unit: "deg" },
  { label: "1 radian", value: 1, unit: "rad" },
  { label: "1 turn", value: 1, unit: "turn" },
  { label: "π rad", value: Math.PI, unit: "rad" },
];

export interface ConvertOptions { from: AngleUnit; to: AngleUnit; }
export interface ConvertResult { output: number; unit: AngleUnit; warnings: string[] }

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
  if (options.from === "deg" && Math.abs(input) > 360) warnings.push("Angle exceeds ±360° — consider normalizing.");
  const deg = input * TO_DEG[options.from];
  const output = deg / TO_DEG[options.to];
  return { output: roundTo(output), unit: options.to, warnings };
}

/** Convert one input to ALL units. */
export function convertAll(input: number, from: AngleUnit): { unit: AngleUnit; value: number }[] {
  const deg = input * TO_DEG[from];
  return ALL_UNITS.map((unit) => ({ unit, value: roundTo(deg / TO_DEG[unit]) }));
}

/** Batch conversion: many inputs from same source to one target. */
export function convertBatch(inputs: number[], from: AngleUnit, to: AngleUnit): (ConvertResult | { error: string })[] {
  return inputs.map((v) => process(v, { from, to }));
}

export function toCsv(rows: { unit: AngleUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

export function batchToCsv(inputs: number[], from: AngleUnit, to: AngleUnit, results: (ConvertResult | { error: string })[]): string {
  const lines = ["Input,From,Output,Unit,Warnings"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if ("error" in r) lines.push(`${inputs[i]},${from},ERROR,${to},"${r.error.replace(/"/g, '""')}"`);
    else lines.push(`${inputs[i]},${from},${r.output},${r.unit},${r.warnings.length}`);
  }
  return lines.join("\n");
}

export function swap(opts: ConvertOptions): ConvertOptions { return { from: opts.to, to: opts.from }; }

/** Normalize to [0, 360°). */
export function normalize(deg: number): number {
  let v = deg % 360;
  if (v < 0) v += 360;
  return v;
}

/** Normalize to [0, 2π). */
export function normalizeRad(rad: number): number {
  let v = rad % (2 * Math.PI);
  if (v < 0) v += 2 * Math.PI;
  return v;
}

/** Complementary angle (90° − x). */
export function complement(deg: number): number { return 90 - deg; }

/** Supplementary angle (180° − x). */
export function supplement(deg: number): number { return 180 - deg; }

/** sin(angle) where angle is in any unit. */
export function sinOf(angle: number, unit: AngleUnit): number {
  const rad = angle * TO_DEG[unit] * Math.PI / 180;
  return Math.sin(rad);
}

/** cos(angle) in any unit. */
export function cosOf(angle: number, unit: AngleUnit): number {
  const rad = angle * TO_DEG[unit] * Math.PI / 180;
  return Math.cos(rad);
}

/** tan(angle) in any unit. Returns {error} when cos is ~0 (angle ≈ 90° + n·180°). */
export function tanOf(angle: number, unit: AngleUnit): number | { error: string } {
  const rad = angle * TO_DEG[unit] * Math.PI / 180;
  const c = Math.cos(rad);
  if (Math.abs(c) < 1e-15) return { error: "tan undefined at this angle" };
  const t = Math.sin(rad) / c;
  if (!Number.isFinite(t)) return { error: "tan undefined at this angle" };
  return t;
}

/** Convert decimal degrees to degrees-minutes-seconds. */
export function toDMS(decimalDeg: number): { deg: number; min: number; sec: number; sign: string } {
  const sign = decimalDeg < 0 ? "-" : "";
  let v = Math.abs(decimalDeg);
  const deg = Math.floor(v);
  v = (v - deg) * 60;
  const min = Math.floor(v);
  const sec = Math.round((v - min) * 60 * 100) / 100;
  return { deg, min, sec, sign };
}

/** Format DMS as a string. */
export function formatDMS(decimalDeg: number): string {
  const d = toDMS(decimalDeg);
  return `${d.sign}${d.deg}°${d.min}′${d.sec}″`;
}

/** Cardinal direction (16-wind) for a degree value. */
export function cardinal(deg: number): string {
  const n = normalize(deg);
  const idx = Math.round(n / 22.5) % 16;
  return CARDINALS[idx]!;
}

/** Best-fit unit (prefers deg for moderate, rad for math, arcsec for tiny). */
export function bestFitUnit(deg: number): AngleUnit {
  const abs = Math.abs(deg);
  if (abs === 0) return "deg";
  if (abs < 1 / 3600) return "arcsec";
  if (abs < 1 / 60) return "arcmin";
  if (abs < 1) return "rad";
  return "deg";
}

export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  if (!TO_DEG[opts.from]) return { error: "Invalid source unit" };
  if (!TO_DEG[opts.to]) return { error: "Invalid target unit" };
  return { ok: true };
}

/** Format angle with unit. */
export function formatAngle(value: number, unit: AngleUnit): string {
  return `${roundTo(value, 6)} ${unit}`;
}

/** Sum angles across units. */
export function sumAngles(items: { value: number; unit: AngleUnit }[], outputUnit: AngleUnit): number {
  const deg = items.reduce((acc, it) => acc + it.value * TO_DEG[it.unit], 0);
  return roundTo(deg / TO_DEG[outputUnit]);
}
