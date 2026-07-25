/**
 * Scale Calculator — pure logic. No DOM access.
 *
 * Computes scale factor = real / model and applies it to scale dimensions.
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

const isFin = (n: number) => Number.isFinite(n) && n > 0;

/** Validate scale input. */
export function validateScale(input: ScaleInput): ScaleInput | { error: string } {
  if (!isFin(input.real)) return { error: "Real length must be a positive finite number" };
  if (!isFin(input.model)) return { error: "Model length must be a positive finite number" };
  if (input.realDim !== undefined && (!Number.isFinite(input.realDim) || input.realDim < 0)) return { error: "Real dimension must be ≥ 0" };
  if (input.modelDim !== undefined && (!Number.isFinite(input.modelDim) || input.modelDim < 0)) return { error: "Model dimension must be ≥ 0" };
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

/** Pretty-print a number with up to 4 decimals, trimmed. */
export function fmtNum(n: number): string {
  return Number(n.toFixed(4)).toString();
}

/** Convert between units (meters, cm, mm, km, in, ft). */
export const UNIT_FACTORS_TO_M: Record<string, number> = {
  mm: 0.001, cm: 0.01, m: 1, km: 1000,
  in: 0.0254, ft: 0.3048,
};

export function convert(value: number, from: string, to: string): number | { error: string } {
  const f = UNIT_FACTORS_TO_M[from]; const t = UNIT_FACTORS_TO_M[to];
  if (!f || !t) return { error: "Unknown unit" };
  return (value * f) / t;
}
