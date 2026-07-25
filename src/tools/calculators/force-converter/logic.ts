/** Force Converter — pure logic. */

export type ForceUnit = "N" | "kgf" | "lbf" | "dyn" | "poundal" | "kip";

// Newtons per unit
export const TO_N: Record<ForceUnit, number> = {
  N: 1,
  kgf: 9.80665,
  lbf: 4.4482216152605,
  dyn: 0.00001,
  poundal: 0.138254954376,
  kip: 4448.2216152605,
};

/** Round to 9 significant figures to wash out floating-point noise. */
function round9(x: number): number {
  if (x === 0) return 0;
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const scale = 10 ** (9 - mag);
  return Math.round(x * scale) / scale;
}

export const UNIT_LABELS: Record<ForceUnit, string> = {
  N: "Newton (N)",
  kgf: "Kilogram-force (kgf)",
  lbf: "Pound-force (lbf)",
  dyn: "Dyne (dyn)",
  poundal: "Poundal (pdl)",
  kip: "Kip (1000 lbf)",
};

export interface ConvertOptions {
  from: ForceUnit;
  to: ForceUnit;
}

export interface ConvertResult {
  output: number;
  unit: ForceUnit;
  warnings: string[];
}

export function process(
  input: number,
  options: ConvertOptions,
): ConvertResult | { error: string } {
  if (typeof input !== "number" || Number.isNaN(input)) {
    return { error: "Input must be a number" };
  }
  const warnings: string[] = [];
  if (input < 0) warnings.push("Negative force is unusual.");
  const n = input * TO_N[options.from];
  const output = round9(n / TO_N[options.to]);
  return { output, unit: options.to, warnings };
}

export function convertAll(
  input: number,
  from: ForceUnit,
): { unit: ForceUnit; value: number }[] {
  const n = input * TO_N[from];
  return (Object.keys(TO_N) as ForceUnit[]).map((unit) => ({
    unit,
    value: round9(n / TO_N[unit]),
  }));
}

export function toCsv(rows: { unit: ForceUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
