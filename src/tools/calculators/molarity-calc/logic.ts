/**
 * Molarity Calculator — M = n / V.
 *
 * Solves for molarity, moles, or volume. Supports mass↔moles conversion
 * via molar mass, dilution helper (C1V1 = C2V2), and unit conversion
 * for volume (L, mL, μL) and amount (mol, mmol, μmol).
 *
 * Pure logic. No DOM access.
 */

export type SolveMode = "molarity" | "moles" | "volume";

export type VolumeUnit = "L" | "mL" | "uL";
export type AmountUnit = "mol" | "mmol" | "umol";

export interface MolarityInput {
  moles: number;
  volume: number;
  volumeUnit?: VolumeUnit;
  amountUnit?: AmountUnit;
  precision?: number;
}

export interface MolarityResult {
  molarity: number;
  unit: string;
  explanation: string;
  formula: string;
  moles: number;
  volume: number;
  volumeUnit: VolumeUnit;
  amountUnit: AmountUnit;
}

export interface DilutionInput {
  c1: number; // initial concentration (M)
  v1: number; // initial volume (any unit)
  c2: number; // final concentration (M)
  v2?: number; // final volume (any unit, same as v1)
}

export interface DilutionResult {
  c1: number;
  v1: number;
  c2: number;
  v2: number;
  formula: string;
  explanation: string;
}

export interface HistoryEntry {
  ts: number;
  mode: SolveMode;
  result: string;
}

const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(8, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Volume conversion factor → liters. */
export const VOLUME_TO_L: Record<VolumeUnit, number> = {
  L: 1,
  mL: 1e-3,
  uL: 1e-6,
};

/** Amount conversion factor → moles. */
export const AMOUNT_TO_MOL: Record<AmountUnit, number> = {
  mol: 1,
  mmol: 1e-3,
  umol: 1e-6,
};

/** Compute molarity from moles and volume. */
export function calculateMolarity(input: MolarityInput): MolarityResult | { error: string } {
  const { moles, volume, precision = 4 } = input;
  const volumeUnit = input.volumeUnit ?? "L";
  const amountUnit = input.amountUnit ?? "mol";
  if (Number.isNaN(moles) || moles < 0) return { error: "Moles must be a non-negative number." };
  if (!Number.isFinite(volume) || volume <= 0) return { error: "Volume must be a positive number." };
  const molesMol = moles * AMOUNT_TO_MOL[amountUnit];
  const volumeL = volume * VOLUME_TO_L[volumeUnit];
  const molarity = round(molesMol / volumeL, precision);
  return {
    molarity,
    unit: "M (mol/L)",
    moles: round(moles, precision),
    volume: round(volume, precision),
    volumeUnit,
    amountUnit,
    formula: "M = n / V",
    explanation: `M = n/V = ${moles} ${amountUnit} / ${volume} ${volumeUnit} = ${molarity} M`,
  };
}

/** Solve for moles given molarity and volume. */
export function solveForMoles(molarity: number, volume: number, volumeUnit: VolumeUnit = "L", amountUnit: AmountUnit = "mol", precision = 4): number | { error: string } {
  if (molarity < 0) return { error: "Molarity must be ≥ 0." };
  if (volume <= 0) return { error: "Volume must be > 0." };
  const volumeL = volume * VOLUME_TO_L[volumeUnit];
  const molesMol = molarity * volumeL;
  return round(molesMol / AMOUNT_TO_MOL[amountUnit], precision);
}

/** Solve for volume given molarity and moles. */
export function solveForVolume(molarity: number, moles: number, amountUnit: AmountUnit = "mol", volumeUnit: VolumeUnit = "L", precision = 4): number | { error: string } {
  if (molarity <= 0) return { error: "Molarity must be > 0." };
  if (moles < 0) return { error: "Moles must be ≥ 0." };
  const molesMol = moles * AMOUNT_TO_MOL[amountUnit];
  const volumeL = molesMol / molarity;
  return round(volumeL / VOLUME_TO_L[volumeUnit], precision);
}

/** Convert mass (g) → moles via molar mass (g/mol). */
export function massToMoles(mass: number, molarMass: number, precision = 4): number | { error: string } {
  if (mass < 0) return { error: "Mass must be ≥ 0." };
  if (molarMass <= 0) return { error: "Molar mass must be > 0." };
  return round(mass / molarMass, precision);
}

/** Convert moles → mass (g) via molar mass (g/mol). */
export function molesToMass(moles: number, molarMass: number, precision = 4): number | { error: string } {
  if (moles < 0) return { error: "Moles must be ≥ 0." };
  if (molarMass <= 0) return { error: "Molar mass must be > 0." };
  return round(moles * molarMass, precision);
}

/** Dilution: solve for the missing variable using C1V1 = C2V2. */
export function calculateDilution(input: DilutionInput): DilutionResult | { error: string } {
  const { c1, v1, c2, v2 } = input;
  if (c1 < 0 || v1 < 0 || c2 < 0) return { error: "Concentrations and volumes must be ≥ 0." };
  if (c2 === 0) return { error: "Final concentration must be > 0." };
  if (v2 != null) {
    // verify C1V1 = C2V2
    return {
      c1, v1, c2, v2,
      formula: "C1V1 = C2V2",
      explanation: `${c1} × ${v1} = ${c2} × ${v2}`,
    };
  }
  const computedV2 = (c1 * v1) / c2;
  return {
    c1, v1, c2, v2: round(computedV2, 6),
    formula: "V2 = (C1 × V1) / C2",
    explanation: `V2 = (${c1} × ${v1}) / ${c2} = ${round(computedV2, 6)}`,
  };
}

export function validateInput(input: MolarityInput): { ok: true } | { error: string } {
  if (typeof input.moles !== "number" || typeof input.volume !== "number") return { error: "Moles and volume must be numbers." };
  return { ok: true };
}

/** Format a number with appropriate precision. */
export function formatValue(value: number, unit: string, precision = 4): string {
  return `${round(value, precision)} ${unit}`;
}

/** Serialize history to CSV. */
export function historyToCsv(history: HistoryEntry[]): string {
  const lines = ["Timestamp,Mode,Result"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.mode},"${h.result.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Batch: compute molarity for multiple inputs. */
export function calculateMolarityBatch(inputs: MolarityInput[]): (MolarityResult | { error: string })[] {
  return inputs.map((i) => calculateMolarity(i));
}

/** Common compounds and their molar masses (g/mol). */
export const COMMON_MOLAR_MASSES: Record<string, number> = {
  "H₂O (Water)": 18.015,
  "NaCl (Sodium chloride)": 58.44,
  "HCl (Hydrochloric acid)": 36.461,
  "NaOH (Sodium hydroxide)": 39.997,
  "KCl (Potassium chloride)": 74.555,
  "C₆H₁₂O₆ (Glucose)": 180.156,
  "H₂SO₄ (Sulfuric acid)": 98.079,
  "CaCl₂ (Calcium chloride)": 110.98,
};

export const VOLUME_UNITS: { value: VolumeUnit; label: string }[] = [
  { value: "L", label: "liters (L)" },
  { value: "mL", label: "milliliters (mL)" },
  { value: "uL", label: "microliters (μL)" },
];

export const AMOUNT_UNITS: { value: AmountUnit; label: string }[] = [
  { value: "mol", label: "moles (mol)" },
  { value: "mmol", label: "millimoles (mmol)" },
  { value: "umol", label: "micromoles (μmol)" },
];
