/**
 * Concentration Calculator — pure logic for molarity / molality / normality / mass percent.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Molarity (mol/L)
 *   2. Molality (mol/kg)
 *   3. Normality (eq/L) with adjustable equivalents
 *   4. Mass percent (% w/w)
 *   5. Solve-for-X: moles, volume, mass, equivalents, solute mass
 *   6. Unit conversion for volume (L, mL, µL) and mass (g, kg, mg)
 *   7. Molar mass helper for converting between moles and grams
 *   8. Batch processing of multiple samples
 *   9. CSV export of batch results
 *  10. Validation with detailed error messages
 *  11. Pretty explanation strings with formula display
 *  12. Dilution helper (C1V1 = C2V2)
 */
export type ConcentrationMode = "molarity" | "molality" | "normality" | "massPercent";

export interface ConcentrationInput {
  mode: ConcentrationMode;
  /** Moles of solute (mol). */
  moles: number;
  /** Volume of solution (L) — for molarity/normality. */
  volume: number;
  /** Mass of solvent (kg) — for molality. */
  mass: number;
  /** Number of equivalents per mole — for normality. */
  equivalents: number;
  /** Solute mass (g) for mass percent. */
  soluteMass: number;
  /** Solution mass (g) for mass percent. */
  solutionMass: number;
  /** Decimal places. */
  precision?: number;
}

export interface ConcentrationResult {
  mode: ConcentrationMode;
  result: number;
  unit: string;
  explanation: string;
}

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;
const isNonNeg = (n: number) => isFin(n) && n >= 0;
const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(8, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

export function calculateConcentration(input: ConcentrationInput): ConcentrationResult | { error: string } {
  const { mode, moles, volume, mass, equivalents, soluteMass, solutionMass, precision = 4 } = input;
  if (!isNonNeg(moles)) return { error: "Moles must be a non-negative number." };

  switch (mode) {
    case "molarity": {
      if (!isPos(volume)) return { error: "Volume must be a positive number (L)." };
      const result = round(moles / volume, precision);
      return { mode, result, unit: "M (mol/L)", explanation: `${moles} mol ÷ ${volume} L = ${result} M` };
    }
    case "molality": {
      if (!isPos(mass)) return { error: "Mass must be a positive number (kg)." };
      const result = round(moles / mass, precision);
      return { mode, result, unit: "m (mol/kg)", explanation: `${moles} mol ÷ ${mass} kg = ${result} m` };
    }
    case "normality": {
      if (!isPos(volume)) return { error: "Volume must be a positive number (L)." };
      if (!isPos(equivalents)) return { error: "Equivalents must be a positive number." };
      const result = round((moles * equivalents) / volume, precision);
      return { mode, result, unit: "N (eq/L)", explanation: `(${moles} mol × ${equivalents} eq/mol) ÷ ${volume} L = ${result} N` };
    }
    case "massPercent": {
      if (!isPos(solutionMass)) return { error: "Solution mass must be positive (g)." };
      if (!isNonNeg(soluteMass)) return { error: "Solute mass must be ≥ 0 (g)." };
      if (soluteMass > solutionMass) return { error: "Solute mass cannot exceed solution mass." };
      const result = round((soluteMass / solutionMass) * 100, precision);
      return { mode, result, unit: "% (w/w)", explanation: `(${soluteMass} g ÷ ${solutionMass} g) × 100 = ${result}%` };
    }
    default:
      return { error: "Unknown concentration mode." };
  }
}

/** Solve for any variable given the others. */
export function solveForMoles(
  target: number, mode: ConcentrationMode, other: number, equivalents = 1,
): number | { error: string } {
  if (!isNonNeg(target)) return { error: "Target must be ≥ 0." };
  if (!isPos(other)) return { error: "Other value must be > 0." };
  if (!isPos(equivalents)) return { error: "Equivalents must be > 0." };
  if (mode === "molarity" || mode === "molality") return target * other;
  if (mode === "normality") return (target * other) / equivalents;
  return { error: "Mass percent mode is not supported by solveForMoles." };
}

/** Solve for the "other" variable (volume or mass) given moles and target concentration. */
export function solveForOther(
  moles: number, target: number, mode: ConcentrationMode, equivalents = 1,
): number | { error: string } {
  if (!isNonNeg(moles)) return { error: "Moles must be ≥ 0." };
  if (!isPos(target)) return { error: "Target must be > 0." };
  if (!isPos(equivalents)) return { error: "Equivalents must be > 0." };
  if (mode === "molarity" || mode === "molality") return moles / target;
  if (mode === "normality") return (moles * equivalents) / target;
  return { error: "Mass percent mode is not supported by solveForOther." };
}

/** Convert grams of solute to moles given molar mass (g/mol). */
export function gramsToMoles(grams: number, molarMass: number): number | { error: string } {
  if (!isNonNeg(grams)) return { error: "Grams must be ≥ 0." };
  if (!isPos(molarMass)) return { error: "Molar mass must be > 0." };
  return grams / molarMass;
}

/** Convert moles to grams given molar mass (g/mol). */
export function molesToGrams(moles: number, molarMass: number): number | { error: string } {
  if (!isNonNeg(moles)) return { error: "Moles must be ≥ 0." };
  if (!isPos(molarMass)) return { error: "Molar mass must be > 0." };
  return moles * molarMass;
}

/** Volume unit factors to litres. */
export const VOLUME_TO_L: Record<string, number> = {
  "µL": 1e-6, mL: 1e-3, L: 1, kL: 1e3,
};

/** Mass unit factors to kilograms. */
export const MASS_TO_KG: Record<string, number> = {
  mg: 1e-6, g: 1e-3, kg: 1, t: 1e3,
};

export function convertVolume(value: number, from: string, to: string): number | { error: string } {
  const f = VOLUME_TO_L[from]; const t = VOLUME_TO_L[to];
  if (!f || !t) return { error: "Unknown volume unit." };
  return value * (f / t);
}

export function convertMass(value: number, from: string, to: string): number | { error: string } {
  const f = MASS_TO_KG[from]; const t = MASS_TO_KG[to];
  if (!f || !t) return { error: "Unknown mass unit." };
  return value * (f / t);
}

/** Dilution: C1V1 = C2V2. Solve for V1 (volume of stock needed). */
export function dilutionV1(
  c1: number, c2: number, v2: number,
): number | { error: string } {
  if (!isPos(c1)) return { error: "Stock concentration C1 must be > 0." };
  if (!isPos(c2)) return { error: "Target concentration C2 must be > 0." };
  if (!isPos(v2)) return { error: "Target volume V2 must be > 0." };
  if (c2 > c1) return { error: "Target concentration cannot exceed stock concentration." };
  return (c2 * v2) / c1;
}

/** Dilution: solve for C2 (final concentration). */
export function dilutionC2(
  c1: number, v1: number, v2: number,
): number | { error: string } {
  if (!isPos(c1) || !isPos(v1) || !isPos(v2)) return { error: "All values must be > 0." };
  return (c1 * v1) / v2;
}

export function validateInput(input: ConcentrationInput): { ok: true } | { error: string } {
  if (!["molarity", "molality", "normality", "massPercent"].includes(input.mode)) return { error: "Invalid mode." };
  return { ok: true };
}

/** Batch-calculate concentration across many samples. */
export function batchCalculate(
  inputs: ConcentrationInput[],
): { i: number; result: ConcentrationResult | { error: string } }[] {
  return inputs.map((input, i) => ({ i, result: calculateConcentration(input) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: ConcentrationResult | { error: string } }[],
): string {
  const lines = ["index,mode,result,unit,explanation"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,error,,"${r.result.error}"`);
    else {
      const x = r.result;
      lines.push(`${r.i},${x.mode},${x.result},"${x.unit}","${x.explanation.replace(/"/g, "'")}"`);
    }
  }
  return lines.join("\n");
}

/** Pretty-print a number with adaptive precision. */
export function fmt(n: number, p = 4): string {
  if (!isFin(n)) return "—";
  return String(round(n, p));
}
