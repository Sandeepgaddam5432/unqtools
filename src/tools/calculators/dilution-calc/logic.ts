/**
 * Dilution Calculator — C1V1 = C2V2.
 * Pure logic. No DOM access.
 */
export type DilutionSolveFor = "C1" | "V1" | "C2" | "V2";

export interface DilutionInput {
  solveFor: DilutionSolveFor;
  C1: number;
  V1: number;
  C2: number;
  V2: number;
  /** Decimal places. */
  precision?: number;
}

export interface DilutionResult {
  variable: DilutionSolveFor;
  value: number;
  explanation: string;
}

const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(6, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Solve C1V1 = C2V2 for any one variable. */
export function calculateDilution(input: DilutionInput): DilutionResult | { error: string } {
  const { solveFor, C1, V1, C2, V2, precision = 4 } = input;
  const provided = { C1, V1, C2, V2 };
  if (provided[solveFor] !== 0 && !Number.isFinite(provided[solveFor])) {
    return { error: `Variable ${solveFor} must be set to 0 (or any value) to indicate it's the unknown.` };
  }
  // Validate the known values.
  for (const key of ["C1", "V1", "C2", "V2"] as const) {
    if (key === solveFor) continue;
    if (!Number.isFinite(provided[key]) || provided[key]! < 0) return { error: `${key} must be a non-negative number.` };
    if (provided[key] === 0) return { error: `${key} cannot be 0 when solving for ${solveFor}.` };
  }

  switch (solveFor) {
    case "C1":
      return { variable: "C1", value: round((C2 * V2) / V1, precision), explanation: `C1 = (C2 × V2) / V1 = (${C2} × ${V2}) / ${V1}` };
    case "V1":
      return { variable: "V1", value: round((C2 * V2) / C1, precision), explanation: `V1 = (C2 × V2) / C1 = (${C2} × ${V2}) / ${C1}` };
    case "C2":
      return { variable: "C2", value: round((C1 * V1) / V2, precision), explanation: `C2 = (C1 × V1) / V2 = (${C1} × ${V1}) / ${V2}` };
    case "V2":
      return { variable: "V2", value: round((C1 * V1) / C2, precision), explanation: `V2 = (C1 × V1) / C2 = (${C1} × ${V1}) / ${C2}` };
    default:
      return { error: "Unknown solve target." };
  }
}

/** Compute dilution factor V2 / V1 (or 1 + solvent/solute). */
export function dilutionFactor(V1: number, V2: number): number | { error: string } {
  if (V1 <= 0) return { error: "V1 must be > 0." };
  if (V2 < V1) return { error: "V2 must be ≥ V1." };
  return V2 / V1;
}

/** Serial dilution helper: returns concentration after N steps of factor f. */
export function serialDilution(initialConc: number, factor: number, steps: number, precision = 4): number[] | { error: string } {
  if (initialConc < 0) return { error: "Initial concentration must be ≥ 0." };
  if (factor <= 1) return { error: "Factor must be > 1." };
  if (steps < 0 || !Number.isInteger(steps)) return { error: "Steps must be a non-negative integer." };
  const out: number[] = [];
  let c = initialConc;
  for (let i = 0; i <= steps; i++) {
    out.push(round(c, precision));
    c /= factor;
  }
  return out;
}

export function validateInput(input: DilutionInput): { ok: true } | { error: string } {
  if (!["C1", "V1", "C2", "V2"].includes(input.solveFor)) return { error: "Invalid solveFor." };
  return { ok: true };
}
