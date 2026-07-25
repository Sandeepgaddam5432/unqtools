/**
 * Social Media A/B Tester — pure logic.
 * Two-proportion z-test for statistical significance.
 */

export interface ABInput {
  aVisitors: number;
  aConversions: number;
  bVisitors: number;
  bConversions: number;
  confidenceLevel: 0.9 | 0.95 | 0.99;
}

export interface ABResult {
  aRate: number;
  bRate: number;
  absoluteDifference: number;
  relativeLift: number;
  pooledP: number;
  standardError: number;
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  criticalZ: number;
  winner: "A" | "B" | "none";
  sampleSizeWarning: string | null;
}

const CRITICAL_Z: Record<ABInput["confidenceLevel"], number> = {
  0.9: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

/** Standard normal CDF using the error function approximation (Abramowitz & Stegun 7.1.26). */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Two-tailed p-value from a z-score. */
export function pValueFromZ(z: number): number {
  return Math.round((1 - normalCdf(Math.abs(z))) * 2 * 1_000_000) / 1_000_000;
}

export function computeAB(input: ABInput): ABResult {
  const { aVisitors, aConversions, bVisitors, bConversions, confidenceLevel } = input;
  const aRate = aVisitors > 0 ? aConversions / aVisitors : 0;
  const bRate = bVisitors > 0 ? bConversions / bVisitors : 0;
  const absoluteDifference = bRate - aRate;
  const relativeLift = aRate > 0 ? absoluteDifference / aRate : 0;

  const totalConv = aConversions + bConversions;
  const totalVis = aVisitors + bVisitors;
  const pooledP = totalVis > 0 ? totalConv / totalVis : 0;
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / Math.max(1, aVisitors) + 1 / Math.max(1, bVisitors)));
  const zScore = se > 0 ? absoluteDifference / se : 0;
  const pValue = pValueFromZ(zScore);
  const criticalZ = CRITICAL_Z[confidenceLevel];
  const isSignificant = Math.abs(zScore) >= criticalZ;
  const winner = !isSignificant ? "none" : (bRate > aRate ? "B" : "A");

  let sampleSizeWarning: string | null = null;
  const expectedConversionsPerCell = pooledP * Math.min(aVisitors, bVisitors);
  if (Math.min(aVisitors, bVisitors) < 30) {
    sampleSizeWarning = "Sample size too small (min 30 per variant recommended).";
  } else if (expectedConversionsPerCell < 5) {
    sampleSizeWarning = "Too few expected conversions per cell (<5) for a reliable z-test.";
  }

  return {
    aRate: round4(aRate),
    bRate: round4(bRate),
    absoluteDifference: round4(absoluteDifference),
    relativeLift: round4(relativeLift),
    pooledP: round4(pooledP),
    standardError: round4(se),
    zScore: round4(zScore),
    pValue,
    isSignificant,
    criticalZ,
    winner,
    sampleSizeWarning,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const CONFIDENCE_LABELS: Record<ABInput["confidenceLevel"], string> = {
  0.9: "90%",
  0.95: "95%",
  0.99: "99%",
};
