/** Weight Unit Converter — pure logic. */

export type WeightUnit = "mg" | "g" | "kg" | "ton" | "carat" | "oz" | "lb" | "stone" | "ton_us" | "ton_uk";

export interface ConvertOptions {
  from: WeightUnit;
  to: WeightUnit;
}

export interface ConvertResult {
  output: number;
  unit: WeightUnit;
  warnings: string[];
}

// Grams per unit
const TO_GRAMS: Record<WeightUnit, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  ton: 1000000, // metric ton
  carat: 0.2,
  oz: 28.349523125,
  lb: 453.59237,
  stone: 6350.29318,
  ton_us: 907184.74,
  ton_uk: 1016046.9088,
};

export const UNIT_LABELS: Record<WeightUnit, string> = {
  mg: "Milligram (mg)",
  g: "Gram (g)",
  kg: "Kilogram (kg)",
  ton: "Metric ton (t)",
  carat: "Carat (ct)",
  oz: "Ounce (oz)",
  lb: "Pound (lb)",
  stone: "Stone (st)",
  ton_us: "US ton",
  ton_uk: "Imperial ton",
};

export function process(input: number, options: ConvertOptions): ConvertResult | { error: string } {
  const warnings: string[] = [];
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  if (input < 0) warnings.push("Negative weight is unusual.");
  const fromG = input * TO_GRAMS[options.from];
  const out = fromG / TO_GRAMS[options.to];
  return { output: out, unit: options.to, warnings };
}

export function convertAll(input: number, from: WeightUnit): { unit: WeightUnit; value: number }[] {
  const fromG = input * TO_GRAMS[from];
  return (Object.keys(TO_GRAMS) as WeightUnit[]).map((unit) => ({
    unit,
    value: fromG / TO_GRAMS[unit],
  }));
}

export function toCsv(rows: { unit: WeightUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
