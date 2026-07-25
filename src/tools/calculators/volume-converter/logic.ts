/** Volume Converter — pure logic. */

export type VolumeUnit =
  | "ml"
  | "tsp"
  | "tbsp"
  | "fl_oz"
  | "cup"
  | "pint"
  | "quart"
  | "L"
  | "gal";

// Milliliters per unit (US customary)
export const TO_ML: Record<VolumeUnit, number> = {
  ml: 1,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  fl_oz: 29.5735295625,
  cup: 236.5882365,
  pint: 473.176473,
  quart: 946.352946,
  L: 1000,
  gal: 3785.411784,
};

export const UNIT_LABELS: Record<VolumeUnit, string> = {
  ml: "Milliliter (ml)",
  tsp: "Teaspoon (tsp)",
  tbsp: "Tablespoon (tbsp)",
  fl_oz: "Fluid ounce (fl oz)",
  cup: "Cup",
  pint: "Pint",
  quart: "Quart",
  L: "Liter (L)",
  gal: "Gallon (gal)",
};

export interface ConvertOptions {
  from: VolumeUnit;
  to: VolumeUnit;
}

export interface ConvertResult {
  output: number;
  unit: VolumeUnit;
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
  if (input < 0) warnings.push("Negative volume is unusual.");
  const ml = input * TO_ML[options.from];
  const output = ml / TO_ML[options.to];
  return { output, unit: options.to, warnings };
}

export function convertAll(
  input: number,
  from: VolumeUnit,
): { unit: VolumeUnit; value: number }[] {
  const ml = input * TO_ML[from];
  return (Object.keys(TO_ML) as VolumeUnit[]).map((unit) => ({
    unit,
    value: ml / TO_ML[unit],
  }));
}

export function toCsv(rows: { unit: VolumeUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
