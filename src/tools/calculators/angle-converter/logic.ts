/** Angle Converter — pure logic. */

export type AngleUnit = "deg" | "rad" | "grad" | "turn" | "arcmin" | "arcsec";

// Degrees per unit
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
  turn: "Turn",
  arcmin: "Arcminute (′)",
  arcsec: "Arcsecond (″)",
};

export interface ConvertOptions {
  from: AngleUnit;
  to: AngleUnit;
}

export interface ConvertResult {
  output: number;
  unit: AngleUnit;
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
  const deg = input * TO_DEG[options.from];
  const output = deg / TO_DEG[options.to];
  return { output, unit: options.to, warnings };
}

export function convertAll(
  input: number,
  from: AngleUnit,
): { unit: AngleUnit; value: number }[] {
  const deg = input * TO_DEG[from];
  return (Object.keys(TO_DEG) as AngleUnit[]).map((unit) => ({
    unit,
    value: deg / TO_DEG[unit],
  }));
}

export function normalize(deg: number): number {
  let v = deg % 360;
  if (v < 0) v += 360;
  return v;
}

export function toCsv(rows: { unit: AngleUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
