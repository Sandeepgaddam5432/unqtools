/**
 * Enzyme Activity Calculator — U/mL = (ΔA/Δt × V) / (ε × l × v).
 * Pure logic. No DOM access.
 */
export interface EnzymeActivityInput {
  /** Change in absorbance per unit time (ΔA/min). */
  deltaA: number;
  /** Time interval (min). */
  deltaTime: number;
  /** Total assay volume (mL). */
  totalVolume: number;
  /** Molar extinction coefficient (L/(mol·cm) or M⁻¹·cm⁻¹). */
  extinction: number;
  /** Path length (cm). */
  pathLength: number;
  /** Sample (enzyme) volume added (mL). */
  sampleVolume: number;
  /** Decimal places. */
  precision?: number;
}

export interface EnzymeActivityResult {
  /** Activity in U/mL. */
  activityUml: number;
  /** Activity in U/L. */
  activityUL: number;
  /** Specific activity if mass given (U/mg). */
  specificActivity?: number;
  explanation: string;
}

const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(6, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Compute enzyme activity in U/mL. */
export function calculateEnzymeActivity(input: EnzymeActivityInput): EnzymeActivityResult | { error: string } {
  const { deltaA, deltaTime, totalVolume, extinction, pathLength, sampleVolume, precision = 4 } = input;
  if (Number.isNaN(deltaA)) return { error: "ΔA must be a number." };
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return { error: "Δt must be a positive number." };
  if (!Number.isFinite(totalVolume) || totalVolume <= 0) return { error: "Total volume must be positive (mL)." };
  if (!Number.isFinite(extinction) || extinction <= 0) return { error: "Extinction coefficient must be positive." };
  if (!Number.isFinite(pathLength) || pathLength <= 0) return { error: "Path length must be positive (cm)." };
  if (!Number.isFinite(sampleVolume) || sampleVolume <= 0) return { error: "Sample volume must be positive (mL)." };

  const slope = deltaA / deltaTime; // ΔA/Δt
  const activityUml = round((slope * totalVolume) / (extinction * pathLength * sampleVolume), precision);
  const activityUL = round(activityUml * 1000, precision);
  return {
    activityUml,
    activityUL,
    explanation: `Activity = (ΔA/Δt × V) / (ε × l × v) = (${slope.toFixed(4)} × ${totalVolume}) / (${extinction} × ${pathLength} × ${sampleVolume}) = ${activityUml} U/mL`,
  };
}

/** Compute specific activity given activity (U/mL) and concentration (mg/mL). */
export function specificActivity(activityUml: number, concentrationMgMl: number, precision = 4): number | { error: string } {
  if (activityUml < 0) return { error: "Activity must be ≥ 0." };
  if (concentrationMgMl <= 0) return { error: "Concentration must be > 0." };
  return round(activityUml / concentrationMgMl, precision);
}

/** Convert between activity units: U → katal (1 U = 16.67 nkat). */
export function unitsToKatal(units: number): number {
  return units * 16.67e-9;
}

export function validateInput(input: EnzymeActivityInput): { ok: true } | { error: string } {
  if (typeof input.deltaA !== "number") return { error: "ΔA must be a number." };
  return { ok: true };
}
