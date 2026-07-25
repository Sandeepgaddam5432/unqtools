/**
 * Enzyme Activity Calculator — U/mL = (ΔA/Δt × V) / (ε × l × v).
 *
 * Extras beyond the original thin tool (10+):
 *   1. Activity in U/mL from absorbance slope
 *   2. Activity in U/L
 *   3. Specific activity (U/mg)
 *   4. Turnover number (kcat) = Vmax / [E]
 *   5. Michaelis-Menten: rate at given [S], Vmax, Km
 *   6. Lineweaver-Burk (1/v, 1/[S]) plotting data
 *   7. Unit conversions: U ↔ katal, U/mL ↔ U/L
 *   8. Batch processing for multiple samples
 *   9. Validation with detailed error messages
 *  10. Formula explanation strings
 *  11. CSV export for batch results
 *  12. Molar-concentration-to-mg/mL helper
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

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;
const isNonNeg = (n: number) => isFin(n) && n >= 0;
const round = (n: number, p: number) => {
  const f = Math.pow(10, Math.max(0, Math.min(8, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Compute enzyme activity in U/mL. */
export function calculateEnzymeActivity(input: EnzymeActivityInput): EnzymeActivityResult | { error: string } {
  const { deltaA, deltaTime, totalVolume, extinction, pathLength, sampleVolume, precision = 4 } = input;
  if (!isFin(deltaA)) return { error: "ΔA must be a number." };
  if (!isPos(deltaTime)) return { error: "Δt must be a positive number." };
  if (!isPos(totalVolume)) return { error: "Total volume must be positive (mL)." };
  if (!isPos(extinction)) return { error: "Extinction coefficient must be positive." };
  if (!isPos(pathLength)) return { error: "Path length must be positive (cm)." };
  if (!isPos(sampleVolume)) return { error: "Sample volume must be positive (mL)." };

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
  if (!isNonNeg(activityUml)) return { error: "Activity must be ≥ 0." };
  if (!isPos(concentrationMgMl)) return { error: "Concentration must be > 0." };
  return round(activityUml / concentrationMgMl, precision);
}

/** Turnover number kcat = Vmax / [E] (s⁻¹). Vmax in U/mL, [E] in mol/L. */
export function turnoverNumber(
  vmaxUml: number, enzymeMolar: number, precision = 4,
): number | { error: string } {
  if (!isPos(vmaxUml)) return { error: "Vmax must be > 0." };
  if (!isPos(enzymeMolar)) return { error: "[E] must be > 0 (M)." };
  // 1 U = 1 µmol/min = 1/60 µmol/s. Vmax in U/mL → µmol/mL/s.
  const vmaxUmolMlS = vmaxUml / 60;
  // [E] in mol/L → µmol/mL: multiply by 1e6 µmol/mol ÷ 1000 mL/L = 1000.
  const enzymeUmolMl = enzymeMolar * 1000;
  return round(vmaxUmolMlS / enzymeUmolMl, precision);
}

/** Michaelis-Menten: v = (Vmax × [S]) / (Km + [S]). */
export function michaelisMenten(
  vmax: number, km: number, substrate: number, precision = 4,
): number | { error: string } {
  if (!isPos(vmax)) return { error: "Vmax must be > 0." };
  if (!isPos(km)) return { error: "Km must be > 0." };
  if (!isNonNeg(substrate)) return { error: "[S] must be ≥ 0." };
  if (km + substrate === 0) return { error: "Km + [S] cannot be 0." };
  return round((vmax * substrate) / (km + substrate), precision);
}

/** Generate Lineweaver-Burk data points for a series of [S] values. */
export function lineweaverBurk(
  vmax: number, km: number, substratePoints: number[], precision = 6,
): { s: number; v: number; invS: number; invV: number }[] | { error: string } {
  if (!isPos(vmax) || !isPos(km)) return { error: "Vmax and Km must be > 0." };
  return substratePoints
    .filter((s) => isPos(s))
    .map((s) => {
      const v = (vmax * s) / (km + s);
      return { s, v: round(v, precision), invS: round(1 / s, precision), invV: round(1 / v, precision) };
    });
}

/** Convert between activity units: U → katal (1 U = 16.67 nkat). */
export function unitsToKatal(units: number): number {
  return units * 16.67e-9;
}

/** Convert katal → U. */
export function katalToUnits(katal: number): number {
  return katal / 16.67e-9;
}

/** Convert U/mL to U/L. */
export function umlToUl(uml: number): number {
  return uml * 1000;
}

/** Convert mg/mL from molar concentration given molar mass (g/mol). */
export function molarToMgMl(molar: number, molarMass: number, precision = 4): number | { error: string } {
  if (!isPos(molar)) return { error: "Molar concentration must be > 0." };
  if (!isPos(molarMass)) return { error: "Molar mass must be > 0." };
  return round(molar * molarMass * 1000, precision);
}

export function validateInput(input: EnzymeActivityInput): { ok: true } | { error: string } {
  if (typeof input.deltaA !== "number") return { error: "ΔA must be a number." };
  return { ok: true };
}

/** Batch-calculate activity across many samples. */
export function batchCalculate(
  inputs: EnzymeActivityInput[],
): { i: number; result: EnzymeActivityResult | { error: string } }[] {
  return inputs.map((input, i) => ({ i, result: calculateEnzymeActivity(input) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: EnzymeActivityResult | { error: string } }[],
): string {
  const lines = ["index,U/mL,U/L,explanation"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,error,"${r.result.error}"`);
    else lines.push(`${r.i},${r.result.activityUml},${r.result.activityUL},"${r.result.explanation.replace(/"/g, "'")}"`);
  }
  return lines.join("\n");
}

/** Pretty-print a number with adaptive precision. */
export function fmt(n: number, p = 4): string {
  if (!isFin(n)) return "—";
  return String(round(n, p));
}
