/**
 * Concentration Calculator — pure logic for molarity/molality/normality.
 */
export type ConcentrationMode = "molarity" | "molality" | "normality";

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
  /** Decimal places. */
  precision?: number;
}

export interface ConcentrationResult {
  mode: ConcentrationMode;
  result: number;
  unit: string;
  explanation: string;
}

const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(6, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

export function calculateConcentration(input: ConcentrationInput): ConcentrationResult | { error: string } {
  const { mode, moles, volume, mass, equivalents, precision = 4 } = input;
  if (Number.isNaN(moles) || moles < 0) return { error: "Moles must be a non-negative number." };

  switch (mode) {
    case "molarity": {
      if (!Number.isFinite(volume) || volume <= 0) return { error: "Volume must be a positive number (L)." };
      const result = round(moles / volume, precision);
      return { mode, result, unit: "M (mol/L)", explanation: `${moles} mol ÷ ${volume} L = ${result} M` };
    }
    case "molality": {
      if (!Number.isFinite(mass) || mass <= 0) return { error: "Mass must be a positive number (kg)." };
      const result = round(moles / mass, precision);
      return { mode, result, unit: "m (mol/kg)", explanation: `${moles} mol ÷ ${mass} kg = ${result} m` };
    }
    case "normality": {
      if (!Number.isFinite(volume) || volume <= 0) return { error: "Volume must be a positive number (L)." };
      if (!Number.isFinite(equivalents) || equivalents <= 0) return { error: "Equivalents must be a positive number." };
      const result = round((moles * equivalents) / volume, precision);
      return { mode, result, unit: "N (eq/L)", explanation: `(${moles} mol × ${equivalents} eq/mol) ÷ ${volume} L = ${result} N` };
    }
    default:
      return { error: "Unknown concentration mode." };
  }
}

/** Solve for moles given a target concentration. */
export function solveForMoles(target: number, mode: ConcentrationMode, other: number, equivalents = 1): number | { error: string } {
  if (target < 0) return { error: "Target must be ≥ 0." };
  if (other <= 0) return { error: "Other value must be > 0." };
  if (mode === "molarity") return target * other;
  if (mode === "molality") return target * other;
  if (mode === "normality") return (target * other) / equivalents;
  return { error: "Unknown mode." };
}

export function validateInput(input: ConcentrationInput): { ok: true } | { error: string } {
  if (!["molarity", "molality", "normality"].includes(input.mode)) return { error: "Invalid mode." };
  return { ok: true };
}
