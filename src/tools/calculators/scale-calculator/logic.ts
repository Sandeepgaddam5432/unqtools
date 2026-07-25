/**
 * Scale Calculator — pure logic. No DOM/canvas access.
 *
 * Computes scale factor = real / model and applies it to scale dimensions.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Scale factor (real / model) and ratio string 1:N
 *   2. Real-distance → model-distance conversion
 *   3. Model-distance → real-distance conversion
 *   4. Unit selector (metric/imperial: mm, cm, m, km, in, ft, yd, mi)
 *   5. Common scales preset library (1:50, 1:100, 1:500, 1:1000, 1:50000)
 *   6. Formula display string generation
 *   7. Batch conversion across multiple dimensions
 *   8. Map-distance → real-distance helper
 *   9. Area and volume scaling (factor², factor³)
 *  10. Validation helpers with detailed error messages
 *  11. Number pretty-printing with adaptive precision
 *  12. Area scaling (squares of length scales)
 *  13. CSV export helper for batch results
 */
export interface ScaleInput {
  /** Real-world length. */
  real: number;
  /** Model/scaled length. */
  model: number;
  /** Optional real-world dimension to convert. */
  realDim?: number;
  /** Optional model dimension to convert. */
  modelDim?: number;
}

export type System = "metric" | "imperial";

const isFin = (n: number) => Number.isFinite(n) && n > 0;
const isFinOrZero = (n: number) => Number.isFinite(n) && n >= 0;

/** Validate scale input. */
export function validateScale(input: ScaleInput): ScaleInput | { error: string } {
  if (!isFin(input.real)) return { error: "Real length must be a positive finite number" };
  if (!isFin(input.model)) return { error: "Model length must be a positive finite number" };
  if (input.realDim !== undefined && !isFinOrZero(input.realDim)) return { error: "Real dimension must be ≥ 0" };
  if (input.modelDim !== undefined && !isFinOrZero(input.modelDim)) return { error: "Model dimension must be ≥ 0" };
  return input;
}

/** Scale factor = real / model (e.g. 100 means 1:100). */
export function scaleFactor(real: number, model: number): number {
  return real / model;
}

/** Format a scale factor as 1:N (or N:1 for放大). */
export function formatScale(factor: number): string {
  const trim = (n: number) => n.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (factor >= 1) return `1:${trim(factor)}`;
  return `${trim(1 / factor)}:1`;
}

/** Convert a real-world dimension to model size. */
export function realToModel(realDim: number, factor: number): number {
  return realDim / factor;
}

/** Convert a model dimension to real-world size. */
export function modelToReal(modelDim: number, factor: number): number {
  return modelDim * factor;
}

/** Compute map distance given a scale ratio (1:N) and map distance. */
export function mapToReal(mapDistance: number, n: number): number {
  return mapDistance * n;
}

/** Compute map distance given a scale ratio (1:N) and a real distance. */
export function realToMap(realDistance: number, n: number): number {
  if (n === 0) return NaN;
  return realDistance / n;
}

/** Area scale factor (factor²). */
export function areaScale(factor: number): number {
  return factor * factor;
}

/** Volume scale factor (factor³). */
export function volumeScale(factor: number): number {
  return factor * factor * factor;
}

/** Pretty-print a number with up to 4 decimals, trimmed. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number(n.toFixed(4)).toString();
}

/** Convert between units (meters, cm, mm, km, in, ft, yd, mi). */
export const UNIT_FACTORS_TO_M: Record<string, number> = {
  mm: 0.001, cm: 0.01, m: 1, km: 1000,
  in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
};

export function convert(value: number, from: string, to: string): number | { error: string } {
  const f = UNIT_FACTORS_TO_M[from];
  const t = UNIT_FACTORS_TO_M[to];
  if (!f || !t) return { error: "Unknown unit" };
  return (value * f) / t;
}

/** Units grouped by system. */
export const UNITS_BY_SYSTEM: Record<System, string[]> = {
  metric: ["mm", "cm", "m", "km"],
  imperial: ["in", "ft", "yd", "mi"],
};

/** All available units as a sorted list. */
export const ALL_UNITS = Object.keys(UNIT_FACTORS_TO_M);

/** Common map/model scale presets. */
export const COMMON_SCALES: { label: string; factor: number }[] = [
  { label: "1:1 (full size)", factor: 1 },
  { label: "1:25 (architectural)", factor: 25 },
  { label: "1:50", factor: 50 },
  { label: "1:100", factor: 100 },
  { label: "1:200", factor: 200 },
  { label: "1:500", factor: 500 },
  { label: "1:1000", factor: 1000 },
  { label: "1:5000", factor: 5000 },
  { label: "1:25000 (map)", factor: 25000 },
  { label: "1:50000 (map)", factor: 50000 },
  { label: "1:100000 (map)", factor: 100000 },
];

/** Build a human-readable formula string. */
export function formula(real: number, model: number, factor: number): string {
  return `factor = real / model = ${fmtNum(real)} / ${fmtNum(model)} = ${fmtNum(factor)}`;
}

/** Batch-convert a list of real dimensions to model equivalents. */
export function batchRealToModel(
  dims: number[],
  factor: number,
): { dim: number; model: number | { error: string } }[] {
  return dims.map((d) => {
    if (!isFinOrZero(d)) return { dim: d, model: { error: "Dimension must be ≥ 0" } };
    return { dim: d, model: realToModel(d, factor) };
  });
}

/** Batch-convert a list of model dimensions to real equivalents. */
export function batchModelToReal(
  dims: number[],
  factor: number,
): { dim: number; real: number | { error: string } }[] {
  return dims.map((d) => {
    if (!isFinOrZero(d)) return { dim: d, real: { error: "Dimension must be ≥ 0" } };
    return { dim: d, real: modelToReal(d, factor) };
  });
}

/** Render batch results as CSV. */
export function batchToCsv(
  rows: { dim: number; model?: number | { error: string }; real?: number | { error: string } }[],
): string {
  const header = ["dimension", ...(rows[0]?.model !== undefined ? ["model"] : []), ...(rows[0]?.real !== undefined ? ["real"] : [])];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cells = [fmtNum(r.dim)];
    if (r.model !== undefined) cells.push(typeof r.model === "number" ? fmtNum(r.model) : "error");
    if (r.real !== undefined) cells.push(typeof r.real === "number" ? fmtNum(r.real) : "error");
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

/** Detect the unit system of a unit string. */
export function systemOf(unit: string): System | null {
  if (UNITS_BY_SYSTEM.metric.includes(unit)) return "metric";
  if (UNITS_BY_SYSTEM.imperial.includes(unit)) return "imperial";
  return null;
}

/** Suggest a sensible default unit pair (real vs model) given the system. */
export function defaultUnits(system: System): { real: string; model: string } {
  if (system === "imperial") return { real: "ft", model: "in" };
  return { real: "m", model: "cm" };
}
