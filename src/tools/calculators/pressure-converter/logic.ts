/** Pressure Converter — pure logic. */

export type PressureUnit = "Pa" | "hPa" | "kPa" | "bar" | "atm" | "psi" | "mmHg" | "torr";

// Pascals per unit
export const TO_PA: Record<PressureUnit, number> = {
  Pa: 1,
  hPa: 100,
  kPa: 1000,
  bar: 100000,
  atm: 101325,
  psi: 6894.757293168,
  mmHg: 133.3223684211,
  torr: 133.3223684211,
};

export const UNIT_LABELS: Record<PressureUnit, string> = {
  Pa: "Pascal (Pa)",
  hPa: "Hectopascal (hPa)",
  kPa: "Kilopascal (kPa)",
  bar: "Bar",
  atm: "Atmosphere (atm)",
  psi: "Pound per square inch (psi)",
  mmHg: "Millimeter of mercury (mmHg)",
  torr: "Torr",
};

export interface ConvertOptions {
  from: PressureUnit;
  to: PressureUnit;
}

export interface ConvertResult {
  output: number;
  unit: PressureUnit;
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
  if (input < 0) warnings.push("Negative pressure is unusual.");
  const pa = input * TO_PA[options.from];
  const output = pa / TO_PA[options.to];
  return { output, unit: options.to, warnings };
}

export function convertAll(
  input: number,
  from: PressureUnit,
): { unit: PressureUnit; value: number }[] {
  const pa = input * TO_PA[from];
  return (Object.keys(TO_PA) as PressureUnit[]).map((unit) => ({
    unit,
    value: pa / TO_PA[unit],
  }));
}

export function toCsv(rows: { unit: PressureUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
