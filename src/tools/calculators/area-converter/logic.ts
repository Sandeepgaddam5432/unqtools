/**
 * Area Converter — pure logic.
 *
 * Converts an area value across common units:
 *   • m²  (square metres)
 *   • km² (square kilometres)
 *   • ft² (square feet)
 *   • acre
 *   • hectare
 *   • mi² (square miles)
 *
 * Internally everything is converted to m² as the canonical unit.
 */

export type AreaUnit = "m2" | "km2" | "ft2" | "acre" | "hectare" | "mi2";

export interface AreaTableEntry {
  unit: AreaUnit;
  label: string;
  value: number;
}

export interface AreaResult {
  input: { value: number; unit: AreaUnit };
  m2: number;
  table: AreaTableEntry[];
  warnings: string[];
}

/** Conversion factors: 1 unit = N m². */
export const AREA_FACTORS_TO_M2: Record<AreaUnit, number> = {
  m2: 1,
  km2: 1_000_000,
  ft2: 0.09290304,
  acre: 4046.8564224,
  hectare: 10_000,
  mi2: 2_589_988.110336,
};

export const AREA_LABELS: Record<AreaUnit, string> = {
  m2: "Square metres (m²)",
  km2: "Square kilometres (km²)",
  ft2: "Square feet (ft²)",
  acre: "Acres",
  hectare: "Hectares",
  mi2: "Square miles (mi²)",
};

export const AREA_ABBREVIATIONS: Record<AreaUnit, string> = {
  m2: "m²",
  km2: "km²",
  ft2: "ft²",
  acre: "acre",
  hectare: "ha",
  mi2: "mi²",
};

const round = (n: number, digits = 6) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

/** Convert a single value from one unit to another. */
export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  if (!Number.isFinite(value)) return NaN;
  const m2 = value * AREA_FACTORS_TO_M2[from];
  return m2 / AREA_FACTORS_TO_M2[to];
}

/** Build the all-units table. */
export function buildAreaTable(value: number, from: AreaUnit): AreaResult | { error: string } {
  if (!Number.isFinite(value)) return { error: "Value must be a finite number." };
  if (value < 0) return { error: "Area cannot be negative." };
  if (value > 1e20) return { error: "Area value is unrealistically large." };

  const m2 = value * AREA_FACTORS_TO_M2[from];
  const table: AreaTableEntry[] = (Object.keys(AREA_FACTORS_TO_M2) as AreaUnit[]).map((unit) => ({
    unit,
    label: AREA_LABELS[unit],
    value: round(m2 / AREA_FACTORS_TO_M2[unit]),
  }));

  const warnings: string[] = [];
  if (value === 0) warnings.push("Zero area — nothing to convert.");
  if (m2 > 1e9) warnings.push("Very large area — verify the source unit.");

  return { input: { value, unit: from }, m2: round(m2), table, warnings };
}

/** Reference table of common area sizes. */
export function areaReferenceCsv(): string {
  const refs: { label: string; value: number; unit: AreaUnit }[] = [
    { label: "Tennis court", value: 260, unit: "m2" },
    { label: "Basketball court (FIBA)", value: 420, unit: "m2" },
    { label: "Football pitch (FIFA)", value: 7140, unit: "m2" },
    { label: "Acre", value: 1, unit: "acre" },
    { label: "Hectare", value: 1, unit: "hectare" },
    { label: "City block (typical)", value: 2.5, unit: "acre" },
    { label: "Central Park (NYC)", value: 3.41, unit: "km2" },
    { label: "London (UK)", value: 1572, unit: "km2" },
    { label: "Rhode Island (US)", value: 4001, unit: "km2" },
    { label: "Monaco", value: 2.02, unit: "km2" },
  ];
  const lines = ["Reference,m²,km²,ft²,acre,hectare,mi²"];
  for (const r of refs) {
    const m2 = convertArea(r.value, r.unit, "m2");
    const km2 = convertArea(r.value, r.unit, "km2");
    const ft2 = convertArea(r.value, r.unit, "ft2");
    const acre = convertArea(r.value, r.unit, "acre");
    const ha = convertArea(r.value, r.unit, "hectare");
    const mi2 = convertArea(r.value, r.unit, "mi2");
    lines.push(`${r.label},${round(m2, 2)},${round(km2, 4)},${round(ft2, 2)},${round(acre, 4)},${round(ha, 4)},${round(mi2, 6)}`);
  }
  return lines.join("\n");
}

/** Format table as plain text. */
export function tableToText(result: AreaResult): string {
  const lines = [`Input: ${result.input.value} ${AREA_ABBREVIATIONS[result.input.unit]}`];
  for (const e of result.table) {
    lines.push(`${e.label}: ${e.value} ${AREA_ABBREVIATIONS[e.unit]}`);
  }
  return lines.join("\n");
}
