/**
 * Molarity Calculator — M = n / V.
 * Pure logic. No DOM access.
 */
export interface MolarityInput {
  /** Moles of solute (mol). */
  moles: number;
  /** Volume of solution (L). */
  volume: number;
  /** Decimal places. */
  precision?: number;
}

export interface MolarityResult {
  molarity: number;
  unit: string;
  explanation: string;
}

const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(6, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Compute molarity from moles and volume. */
export function calculateMolarity(input: MolarityInput): MolarityResult | { error: string } {
  const { moles, volume, precision = 4 } = input;
  if (Number.isNaN(moles) || moles < 0) return { error: "Moles must be a non-negative number." };
  if (!Number.isFinite(volume) || volume <= 0) return { error: "Volume must be a positive number (L)." };
  const molarity = round(moles / volume, precision);
  return { molarity, unit: "M (mol/L)", explanation: `M = n/V = ${moles} mol / ${volume} L = ${molarity} M` };
}

/** Solve for moles given molarity and volume. */
export function solveForMoles(molarity: number, volume: number, precision = 4): number | { error: string } {
  if (molarity < 0) return { error: "Molarity must be ≥ 0." };
  if (volume <= 0) return { error: "Volume must be > 0." };
  return round(molarity * volume, precision);
}

/** Solve for volume given molarity and moles. */
export function solveForVolume(molarity: number, moles: number, precision = 4): number | { error: string } {
  if (molarity <= 0) return { error: "Molarity must be > 0." };
  if (moles < 0) return { error: "Moles must be ≥ 0." };
  return round(moles / molarity, precision);
}

/** Convert mass (g) → moles via molar mass (g/mol). */
export function massToMoles(mass: number, molarMass: number, precision = 4): number | { error: string } {
  if (mass < 0) return { error: "Mass must be ≥ 0." };
  if (molarMass <= 0) return { error: "Molar mass must be > 0." };
  return round(mass / molarMass, precision);
}

export function validateInput(input: MolarityInput): { ok: true } | { error: string } {
  if (typeof input.moles !== "number" || typeof input.volume !== "number") return { error: "Moles and volume must be numbers." };
  return { ok: true };
}
