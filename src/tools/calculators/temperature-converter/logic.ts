/** Temperature Converter — pure logic. */

export type TempUnit = "celsius" | "fahrenheit" | "kelvin" | "rankine";

export interface TempConvertOptions {
  from: TempUnit;
  to: TempUnit;
}

export interface TempResult {
  output: number;
  unit: TempUnit;
  warnings: string[];
}

// Convert each unit to Kelvin first
function toKelvin(value: number, from: TempUnit): number {
  switch (from) {
    case "celsius": return value + 273.15;
    case "fahrenheit": return (value - 32) * 5 / 9 + 273.15;
    case "kelvin": return value;
    case "rankine": return value * 5 / 9;
  }
}

function fromKelvin(k: number, to: TempUnit): number {
  switch (to) {
    case "celsius": return k - 273.15;
    case "fahrenheit": return (k - 273.15) * 9 / 5 + 32;
    case "kelvin": return k;
    case "rankine": return k * 9 / 5;
  }
}

export function process(input: number, options: TempConvertOptions): TempResult | { error: string } {
  const warnings: string[] = [];
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  const k = toKelvin(input, options.from);
  if (k < 0) warnings.push("Temperature is below absolute zero — physically impossible.");
  const out = fromKelvin(k, options.to);
  return { output: out, unit: options.to, warnings };
}

export const UNIT_LABELS: Record<TempUnit, string> = {
  celsius: "Celsius (°C)",
  fahrenheit: "Fahrenheit (°F)",
  kelvin: "Kelvin (K)",
  rankine: "Rankine (°R)",
};

export function convertAll(input: number, from: TempUnit): { unit: TempUnit; value: number }[] {
  const k = toKelvin(input, from);
  return (Object.keys(UNIT_LABELS) as TempUnit[]).map((unit) => ({ unit, value: fromKelvin(k, unit) }));
}

export function toCsv(rows: { unit: TempUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
