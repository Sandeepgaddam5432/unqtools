/**
 * Speed Converter — pure logic.
 *
 * Converts a speed value across the five common units:
 *   • mph — miles per hour
 *   • kmh — kilometres per hour
 *   • ms  — metres per second
 *   • fps — feet per second
 *   • knot — nautical miles per hour
 *
 * Internally everything is converted to m/s as the canonical unit, then
 * emitted to all targets. A small "all-units table" generator is provided
 * for UI rendering.
 */

export type SpeedUnit = "mph" | "kmh" | "ms" | "fps" | "knot";

export interface SpeedConversion {
  value: number;
  from: SpeedUnit;
  to: SpeedUnit;
  result: number;
}

export interface SpeedTableEntry {
  unit: SpeedUnit;
  label: string;
  value: number;
}

export interface SpeedResult {
  input: { value: number; unit: SpeedUnit };
  ms: number;
  table: SpeedTableEntry[];
  warnings: string[];
}

export const SPEED_FACTORS_TO_MS: Record<SpeedUnit, number> = {
  mph: 0.44704, // 1 mph = 0.44704 m/s
  kmh: 0.2777777778, // 1 km/h = 1000/3600 m/s
  ms: 1,
  fps: 0.3048, // 1 ft/s = 0.3048 m/s
  knot: 0.5144444444, // 1 knot = 1852/3600 m/s
};

export const SPEED_LABELS: Record<SpeedUnit, string> = {
  mph: "Miles per hour (mph)",
  kmh: "Kilometres per hour (km/h)",
  ms: "Metres per second (m/s)",
  fps: "Feet per second (ft/s)",
  knot: "Knots (kn)",
};

export const SPEED_ABBREVIATIONS: Record<SpeedUnit, string> = {
  mph: "mph",
  kmh: "km/h",
  ms: "m/s",
  fps: "ft/s",
  knot: "kn",
};

const round = (n: number, digits = 4) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

/** Convert a single value from one unit to another. */
export function convertSpeed(value: number, from: SpeedUnit, to: SpeedUnit): number {
  if (!Number.isFinite(value)) return NaN;
  const ms = value * SPEED_FACTORS_TO_MS[from];
  return ms / SPEED_FACTORS_TO_MS[to];
}

/** Build the all-units table for a given input. */
export function buildSpeedTable(value: number, from: SpeedUnit): SpeedResult | { error: string } {
  if (!Number.isFinite(value)) return { error: "Value must be a finite number." };
  if (value < 0) return { error: "Speed cannot be negative." };
  if (value > 1e9) return { error: "Speed value is unrealistically large." };

  const ms = value * SPEED_FACTORS_TO_MS[from];
  const table: SpeedTableEntry[] = (Object.keys(SPEED_FACTORS_TO_MS) as SpeedUnit[]).map((unit) => ({
    unit,
    label: SPEED_LABELS[unit],
    value: round(ms / SPEED_FACTORS_TO_MS[unit]),
  }));

  const warnings: string[] = [];
  if (value === 0) warnings.push("Zero speed — object is stationary.");
  if (ms > 343) warnings.push("Above the speed of sound in air (~343 m/s) — supersonic regime.");
  if (ms > 299792458) warnings.push("Above the speed of light — physically impossible.");

  return {
    input: { value, unit: from },
    ms: round(ms),
    table,
    warnings,
  };
}

/** Generate a CSV of common speed reference points. */
export function speedReferenceCsv(): string {
  const refs: { label: string; value: number; unit: SpeedUnit }[] = [
    { label: "Walking pace", value: 3, unit: "mph" },
    { label: "Jogging", value: 6, unit: "mph" },
    { label: "Marathon runner (elite)", value: 13, unit: "kmh" },
    { label: "City speed limit (US)", value: 25, unit: "mph" },
    { label: "Highway speed limit (US)", value: 65, unit: "mph" },
    { label: "Highway speed limit (EU)", value: 120, unit: "kmh" },
    { label: "Cyclist (pro sprint)", value: 45, unit: "mph" },
    { label: "Train (TGV)", value: 320, unit: "kmh" },
    { label: "Commercial jet (cruise)", value: 900, unit: "kmh" },
    { label: "Speed of sound (air, sea level)", value: 767, unit: "mph" },
  ];
  const lines = ["Reference,mph,km/h,m/s,ft/s,knot"];
  for (const r of refs) {
    const mph = convertSpeed(r.value, r.unit, "mph");
    const kmh = convertSpeed(r.value, r.unit, "kmh");
    const ms = convertSpeed(r.value, r.unit, "ms");
    const fps = convertSpeed(r.value, r.unit, "fps");
    const knot = convertSpeed(r.value, r.unit, "knot");
    lines.push(`${r.label},${round(mph, 2)},${round(kmh, 2)},${round(ms, 2)},${round(fps, 2)},${round(knot, 2)}`);
  }
  return lines.join("\n");
}

/** Format the all-units table as plain text. */
export function tableToText(result: SpeedResult): string {
  const lines = [`Input: ${result.input.value} ${SPEED_ABBREVIATIONS[result.input.unit]}`];
  for (const e of result.table) {
    lines.push(`${e.label}: ${e.value} ${SPEED_ABBREVIATIONS[e.unit]}`);
  }
  return lines.join("\n");
}
