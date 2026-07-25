/** Force Converter — pure logic. No DOM access. */

export type ForceUnit = "N" | "kN" | "kgf" | "lbf" | "dyn" | "poundal" | "kip" | "tf";

/** Newtons per unit. */
export const TO_N: Record<ForceUnit, number> = {
  N: 1,
  kN: 1000,
  kgf: 9.80665,
  lbf: 4.4482216152605,
  dyn: 0.00001,
  poundal: 0.138254954376,
  kip: 4448.2216152605,
  tf: 9806.65,
};

export const UNIT_LABELS: Record<ForceUnit, string> = {
  N: "Newton (N)",
  kN: "Kilonewton (kN)",
  kgf: "Kilogram-force (kgf)",
  lbf: "Pound-force (lbf)",
  dyn: "Dyne (dyn)",
  poundal: "Poundal (pdl)",
  kip: "Kip (1000 lbf)",
  tf: "Tonne-force (tf)",
};

/** All available units in display order. */
export const ALL_UNITS = Object.keys(TO_N) as ForceUnit[];

/** Round to 9 significant figures to wash out floating-point noise. */
function round9(x: number): number {
  if (x === 0) return 0;
  if (!Number.isFinite(x)) return x;
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const scale = 10 ** (9 - mag);
  return Math.round(x * scale) / scale;
}

export interface ConvertOptions {
  from: ForceUnit;
  to: ForceUnit;
}

export interface ConvertResult {
  output: number;
  unit: ForceUnit;
  warnings: string[];
}

/** Convert a single value between two force units. */
export function process(
  input: number,
  options: ConvertOptions,
): ConvertResult | { error: string } {
  if (typeof input !== "number" || Number.isNaN(input)) {
    return { error: "Input must be a number" };
  }
  if (!Number.isFinite(input)) return { error: "Input must be finite" };
  if (!TO_N[options.from] || !TO_N[options.to]) return { error: "Unknown unit" };
  const warnings: string[] = [];
  if (input < 0) warnings.push("Negative force is unusual.");
  if (input !== 0 && Math.abs(Math.log10(Math.abs(input))) > 12) warnings.push("Magnitude is extreme; precision may suffer.");
  const n = input * TO_N[options.from];
  const output = round9(n / TO_N[options.to]);
  return { output, unit: options.to, warnings };
}

/** Convert one input value into every available unit. */
export function convertAll(
  input: number,
  from: ForceUnit,
): { unit: ForceUnit; value: number }[] {
  const n = input * TO_N[from];
  return ALL_UNITS.map((unit) => ({ unit, value: round9(n / TO_N[unit]) }));
}

/** Pretty-print a force value with its unit label. */
export function formatForce(value: number, unit: ForceUnit, precision = 6): string {
  if (!Number.isFinite(value)) return "—";
  return `${Number(value.toFixed(precision))} ${unit}`;
}

/** Render an all-units table as CSV. */
export function toCsv(rows: { unit: ForceUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

/** Render an all-units table as Markdown. */
export function toMarkdown(rows: { unit: ForceUnit; value: number }[]): string {
  const lines = ["| Unit | Value |", "| --- | --- |"];
  for (const r of rows) lines.push(`| ${r.unit} | ${r.value} |`);
  return lines.join("\n");
}

/** Validate that a string parses to a finite number. */
export function parseInput(raw: string): number | { error: string } {
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: "Input must be a finite number" };
  return n;
}

/** Batch-convert multiple values from one unit to another. */
export function batchConvert(
  values: number[],
  from: ForceUnit,
  to: ForceUnit,
): { input: number; result: ConvertResult | { error: string } }[] {
  return values.map((v) => ({ input: v, result: process(v, { from, to }) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  rows: { input: number; result: ConvertResult | { error: string } }[],
): string {
  const lines = ["input,output,unit,warnings"];
  for (const r of rows) {
    if ("error" in r.result) lines.push(`${r.input},,error,"${r.result.error}"`);
    else lines.push(`${r.input},${r.result.output},${r.result.unit},"${r.result.warnings.join("; ")}"`);
  }
  return lines.join("\n");
}

/** Common reference forces in Newtons (for quick comparison). */
export const REFERENCE_FORCES: { label: string; n: number }[] = [
  { label: "Apple (0.1 kg)", n: 0.98 },
  { label: "Adult human weight (70 kg)", n: 686 },
  { label: "Car weight (1500 kg)", n: 14710 },
  { label: "Space Shuttle thrust (1 SSME)", n: 1.87e6 },
];

/** Find the unit with the largest/smallest value (extreme conversions). */
export function findExtremes(
  rows: { unit: ForceUnit; value: number }[],
): { max: ForceUnit; min: ForceUnit } | { error: string } {
  if (!rows.length) return { error: "Empty rows" };
  let max = rows[0]!;
  let min = rows[0]!;
  for (const r of rows) {
    if (r.value > max.value) max = r;
    if (r.value < min.value) min = r;
  }
  return { max: max.unit, min: min.unit };
}

/** Convert input to Newtons (canonical form). */
export function toNewtons(value: number, from: ForceUnit): number {
  return value * TO_N[from];
}

/** Convert Newtons to a target unit. */
export function fromNewtons(newtons: number, to: ForceUnit): number {
  return round9(newtons / TO_N[to]);
}

/** Pretty-print helper for any value. */
export function fmt(n: number, p = 6): string {
  if (!Number.isFinite(n)) return "—";
  return String(Number(n.toFixed(p)));
}
