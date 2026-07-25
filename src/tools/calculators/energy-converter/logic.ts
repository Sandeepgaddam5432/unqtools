/** Energy Converter — pure logic. */

export type EnergyUnit = "J" | "cal" | "kWh" | "BTU" | "eV" | "ft_lb" | "Wh";

// Joules per unit
export const TO_J: Record<EnergyUnit, number> = {
  J: 1,
  cal: 4.184,
  kWh: 3.6e6,
  BTU: 1055.05585262,
  eV: 1.602176634e-19,
  ft_lb: 1.3558179483314004,
  Wh: 3600,
};

export const UNIT_LABELS: Record<EnergyUnit, string> = {
  J: "Joule (J)",
  cal: "Calorie (cal)",
  kWh: "Kilowatt-hour (kWh)",
  BTU: "British Thermal Unit (BTU)",
  eV: "Electronvolt (eV)",
  ft_lb: "Foot-pound (ft·lb)",
  Wh: "Watt-hour (Wh)",
};

export interface ConvertOptions {
  from: EnergyUnit;
  to: EnergyUnit;
}

export interface ConvertResult {
  output: number;
  unit: EnergyUnit;
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
  if (input < 0) warnings.push("Negative energy is unusual.");
  const j = input * TO_J[options.from];
  const output = j / TO_J[options.to];
  return { output, unit: options.to, warnings };
}

export function convertAll(
  input: number,
  from: EnergyUnit,
): { unit: EnergyUnit; value: number }[] {
  const j = input * TO_J[from];
  return (Object.keys(TO_J) as EnergyUnit[]).map((unit) => ({
    unit,
    value: j / TO_J[unit],
  }));
}

export function toCsv(rows: { unit: EnergyUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
