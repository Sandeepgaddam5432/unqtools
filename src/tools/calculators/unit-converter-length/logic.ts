/**
 * Unit Converter (Length) — pure logic.
 * Base unit: meters (SI).
 */

export interface LengthUnit {
  id: string;
  name: string;
  /** Conversion factor: 1 unit = this many meters. */
  factor: number;
  system: "metric" | "imperial" | "astronomical" | "typographic" | "nautical";
  symbol: string;
  /** For very large/small numbers, prefer scientific notation. */
  commonUse?: string;
}

export const LENGTH_UNITS: LengthUnit[] = [
  // Metric
  { id: "nm", name: "Nanometer", factor: 1e-9, system: "metric", symbol: "nm", commonUse: "Wavelengths of light, chip fabrication" },
  { id: "um", name: "Micrometer", factor: 1e-6, system: "metric", symbol: "µm", commonUse: "Cell biology, precision machining" },
  { id: "mm", name: "Millimeter", factor: 0.001, system: "metric", symbol: "mm", commonUse: "Engineering drawings, rainfall" },
  { id: "cm", name: "Centimeter", factor: 0.01, system: "metric", symbol: "cm", commonUse: "Everyday measurements, rulers" },
  { id: "dm", name: "Decimeter", factor: 0.1, system: "metric", symbol: "dm", commonUse: "Rarely used in practice" },
  { id: "m", name: "Meter", factor: 1, system: "metric", symbol: "m", commonUse: "SI base unit of length" },
  { id: "dam", name: "Dekameter", factor: 10, system: "metric", symbol: "dam", commonUse: "Surveying" },
  { id: "hm", name: "Hectometer", factor: 100, system: "metric", symbol: "hm", commonUse: "Agriculture" },
  { id: "km", name: "Kilometer", factor: 1000, system: "metric", symbol: "km", commonUse: "Road distances, running" },
  // Imperial
  { id: "mil", name: "Mil (thousandth of inch)", factor: 0.0000254, system: "imperial", symbol: "mil", commonUse: "Manufacturing tolerances" },
  { id: "in", name: "Inch", factor: 0.0254, system: "imperial", symbol: "in", commonUse: "Screen sizes, tire sizes" },
  { id: "ft", name: "Foot", factor: 0.3048, system: "imperial", symbol: "ft", commonUse: "Height (US), room dimensions" },
  { id: "yd", name: "Yard", factor: 0.9144, system: "imperial", symbol: "yd", commonUse: "Fabric, American football" },
  { id: "mi", name: "Mile", factor: 1609.344, system: "imperial", symbol: "mi", commonUse: "US/UK road distances" },
  // Nautical
  { id: "ftm", name: "Fathom", factor: 1.8288, system: "nautical", symbol: "ftm", commonUse: "Water depth" },
  { id: "cable", name: "Cable length", factor: 185.2, system: "nautical", symbol: "cable", commonUse: "Maritime navigation" },
  { id: "nmi", name: "Nautical mile", factor: 1852, system: "nautical", symbol: "nmi", commonUse: "Aviation, maritime" },
  // Astronomical
  { id: "au", name: "Astronomical unit", factor: 1.495978707e11, system: "astronomical", symbol: "AU", commonUse: "Earth-Sun distance" },
  { id: "ly", name: "Light year", factor: 9.4607304725808e15, system: "astronomical", symbol: "ly", commonUse: "Stellar distances" },
  { id: "pc", name: "Parsec", factor: 3.0856775814913673e16, system: "astronomical", symbol: "pc", commonUse: "Professional astronomy" },
  // Typographic
  { id: "pt", name: "Point (PostScript)", factor: 0.0003527778, system: "typographic", symbol: "pt", commonUse: "Font sizes, design" },
  { id: "px", name: "Pixel (96 DPI)", factor: 0.0002645833, system: "typographic", symbol: "px", commonUse: "Web/screen design" },
];

export interface ConvertInput {
  value: number;
  fromUnit: string;
  toUnit: string;
  precision?: number;
  scientificNotation?: boolean;
}

export interface ConvertResult {
  fromValue: number;
  fromUnit: LengthUnit;
  toValue: number;
  toUnit: LengthUnit;
  formatted: string;
}

const r = (n: number, precision: number): number => {
  const p = Math.max(0, Math.min(10, precision));
  const factor = Math.pow(10, p);
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

export function convertLength(input: ConvertInput): ConvertResult | { error: string } {
  const { value, fromUnit, toUnit, precision = 6, scientificNotation = false } = input;
  if (Number.isNaN(value)) return { error: "Value must be a valid number." };
  const from = LENGTH_UNITS.find((u) => u.id === fromUnit);
  const to = LENGTH_UNITS.find((u) => u.id === toUnit);
  if (!from) return { error: `Unknown source unit: ${fromUnit}.` };
  if (!to) return { error: `Unknown target unit: ${toUnit}.` };

  // Convert via meters
  const inMeters = value * from.factor;
  const rawTo = inMeters / to.factor;
  const rounded = r(rawTo, precision);

  let formatted: string;
  if (scientificNotation || Math.abs(rawTo) >= 1e7 || (Math.abs(rawTo) < 1e-4 && rawTo !== 0)) {
    formatted = rawTo.toExponential(precision);
  } else {
    formatted = String(rounded);
  }

  return { fromValue: value, fromUnit: from, toValue: rounded, toUnit: to, formatted };
}

export interface AllUnitsResult {
  fromUnit: LengthUnit;
  fromValue: number;
  rows: { unit: LengthUnit; value: number; formatted: string }[];
}

export function convertToAll(value: number, fromUnit: string, precision = 6): AllUnitsResult | { error: string } {
  if (Number.isNaN(value)) return { error: "Value must be a valid number." };
  const from = LENGTH_UNITS.find((u) => u.id === fromUnit);
  if (!from) return { error: `Unknown source unit: ${fromUnit}.` };
  const inMeters = value * from.factor;
  const rows = LENGTH_UNITS.map((u) => {
    const v = inMeters / u.factor;
    let formatted: string;
    if (Math.abs(v) >= 1e7 || (Math.abs(v) < 1e-4 && v !== 0)) {
      formatted = v.toExponential(precision);
    } else {
      formatted = String(r(v, precision));
    }
    return { unit: u, value: r(v, precision), formatted };
  });
  return { fromUnit: from, fromValue: value, rows };
}

/** Parse chained units like "5 km 300 m 50 cm" → total in meters. */
export function parseChainedLength(input: string): { totalMeters: number; breakdown: { value: number; unit: LengthUnit }[] } | { error: string } {
  const tokens = input.trim().split(/\s+/);
  if (tokens.length % 2 !== 0) return { error: "Expected alternating value-unit pairs (e.g. '5 km 300 m')." };
  const breakdown: { value: number; unit: LengthUnit }[] = [];
  let total = 0;
  for (let i = 0; i < tokens.length; i += 2) {
    const value = Number(tokens[i]);
    const unitId = tokens[i + 1];
    if (Number.isNaN(value)) return { error: `Invalid value: '${tokens[i]}'` };
    const unit = LENGTH_UNITS.find((u) => u.id === unitId || u.symbol === unitId);
    if (!unit) return { error: `Unknown unit: '${unitId}'` };
    breakdown.push({ value, unit });
    total += value * unit.factor;
  }
  return { totalMeters: total, breakdown };
}

/** Convert meters to feet+inches fractional display. */
export function metersToFeetInches(meters: number): { feet: number; inches: number; display: string } {
  const totalInches = meters / 0.0254;
  const feet = Math.floor(totalInches / 12);
  const inches = r(totalInches - feet * 12, 2);
  return { feet, inches, display: `${feet} ft ${inches} in` };
}

export function historyToCsv(history: { ts: number; value: number; from: string; to: string; result: number }[]): string {
  const lines = ["Timestamp,Value,From,To,Result"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.value},${h.from},${h.to},${h.result}`);
  }
  return lines.join("\n");
}
