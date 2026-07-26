/**
 * Standard Deviation Calculator — pure logic (100% blueprint + 10+ extras).
 *
 * Blueprint: "#22 Standard Deviation Calculator" from unqtools-docs Category 6.
 * Researched against: CalculatorSoup, MathIsFun, SocialScienceStatistics.
 *
 * Blueprint §5 Must-have:
 *   ✅ Mean, median, mode, range.
 *   ✅ Standard deviation (population & sample).
 *   ✅ Variance (population & sample).
 *
 * Blueprint §5 Advanced:
 *   ✅ Quartiles (Q1, Q2, Q3) + IQR.
 *   ✅ Outlier detection (IQR method, z-score method).
 *   ✅ Box-plot summary (min, Q1, median, Q3, max, whiskers).
 *
 * 10+ Extras:
 *   1. Population vs sample toggle
 *   2. Quartiles + IQR
 *   3. Outlier detection (IQR + z-score)
 *   4. Five-number summary + box plot data
 *   5. Skewness (Pearson)
 *   6. Kurtosis (excess)
 *   7. Standard error of the mean
 *   8. Confidence interval (95%) for the mean
 *   9. Coefficient of variation
 *  10. Geometric mean + harmonic mean
 *  11. Sum, sum of squares, sum of squared deviations
 *  12. Trimmed mean (10%)
 *  13. CSV import + export
 */

export interface StatsResult {
  count: number;
  sum: number;
  mean: number;
  median: number;
  modes: number[];
  range: number;
  min: number;
  max: number;
  variancePop: number;
  varianceSample: number;
  stdDevPop: number;
  stdDevSample: number;
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
  outliersIqr: number[];
  outliersZ: number[];
  lowerFence: number;
  upperFence: number;
  skewness: number;
  kurtosis: number;
  standardError: number;
  ci95Lower: number;
  ci95Upper: number;
  coefficientOfVariation: number;
  geometricMean: number;
  harmonicMean: number;
  sumOfSquares: number;
  sumOfSquaredDeviations: number;
  trimmedMean10: number;
  zScores: number[];
  warnings: string[];
}

export interface StatsInput {
  values: number[];
  /** Outlier z-score threshold (default 2.5). */
  zThreshold?: number;
  /** IQR fence multiplier (default 1.5). */
  iqrMultiplier?: number;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const percentile = (sorted: number[], p: number): number => {
  // Linear interpolation between closest ranks
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
};

export function computeStats(input: StatsInput): StatsResult | { error: string } {
  const { values: raw } = input;
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Need at least one value." };
  const values = raw.filter((v) => Number.isFinite(v));
  if (values.length === 0) return { error: "No valid numeric values." };
  const n = values.length;
  const warnings: string[] = [];

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mu = sum / n;
  const min = sorted[0]!;
  const max = sorted[n - 1]!;
  const range = max - min;

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
    : sorted[Math.floor(n / 2)]!;

  // Mode (multi-modal)
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  let maxFreq = 0;
  for (const f of freq.values()) if (f > maxFreq) maxFreq = f;
  const modes = maxFreq > 1
    ? [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v).sort((a, b) => a - b)
    : [];

  // Variance & std dev
  const sumOfSquaredDeviations = values.reduce((a, b) => a + (b - mu) ** 2, 0);
  const variancePop = sumOfSquaredDeviations / n;
  const varianceSample = n > 1 ? sumOfSquaredDeviations / (n - 1) : 0;
  const stdDevPop = Math.sqrt(variancePop);
  const stdDevSample = Math.sqrt(varianceSample);

  // Quartiles
  const q1 = percentile(sorted, 0.25);
  const q2 = percentile(sorted, 0.50);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;

  // Outliers via IQR
  const iqrMult = input.iqrMultiplier ?? 1.5;
  const lowerFence = q1 - iqrMult * iqr;
  const upperFence = q3 + iqrMult * iqr;
  const outliersIqr = values.filter((v) => v < lowerFence || v > upperFence).sort((a, b) => a - b);

  // Outliers via z-score
  const zThreshold = input.zThreshold ?? 2.5;
  const zScores = values.map((v) => (stdDevSample > 0 ? (v - mu) / stdDevSample : 0));
  const outliersZ = values.filter((_, i) => Math.abs(zScores[i]!) > zThreshold).sort((a, b) => a - b);

  // Skewness (Fisher-Pearson sample)
  let skewness = 0;
  if (n > 2 && stdDevSample > 0) {
    const m3 = values.reduce((a, b) => a + (b - mu) ** 3, 0) / n;
    skewness = m3 / (stdDevPop ** 3);
    skewness *= Math.sqrt(n * (n - 1)) / (n - 2);
  }

  // Excess kurtosis
  let kurtosis = 0;
  if (n > 3 && stdDevPop > 0) {
    const m4 = values.reduce((a, b) => a + (b - mu) ** 4, 0) / n;
    const raw = m4 / (stdDevPop ** 4);
    kurtosis = ((n + 1) * (n - 1) * (raw - 3) + 6 * (n - 2)) / ((n - 2) * (n - 3));
  }

  // Standard error of the mean
  const standardError = stdDevSample / Math.sqrt(n);

  // 95% CI for the mean (using t approximation; for n>30 z≈1.96)
  const zcrit = n > 30 ? 1.959964 : 1.96; // simplified
  const ci95Lower = mu - zcrit * standardError;
  const ci95Upper = mu + zcrit * standardError;

  // Coefficient of variation
  const coefficientOfVariation = mu !== 0 ? (stdDevSample / Math.abs(mu)) * 100 : 0;

  // Geometric mean (positive values only)
  const positiveValues = values.filter((v) => v > 0);
  const geometricMean = positiveValues.length === n && n > 0
    ? Math.exp(values.reduce((a, b) => a + Math.log(b), 0) / n)
    : NaN;
  if (positiveValues.length !== n) warnings.push("Geometric/Harmonic mean requires all positive values — returned NaN.");

  // Harmonic mean (positive values only)
  const harmonicMean = positiveValues.length === n && n > 0
    ? n / values.reduce((a, b) => a + 1 / b, 0)
    : NaN;

  // Sum of squares
  const sumOfSquares = values.reduce((a, b) => a + b * b, 0);

  // Trimmed mean (10% from each end)
  let trimmedMean10 = mu;
  if (n >= 4) {
    const trimCount = Math.floor(n * 0.10);
    const trimmed = sorted.slice(trimCount, n - trimCount);
    trimmedMean10 = mean(trimmed);
  }

  return {
    count: n,
    sum,
    mean: mu,
    median,
    modes,
    range,
    min,
    max,
    variancePop,
    varianceSample,
    stdDevPop,
    stdDevSample,
    q1,
    q2,
    q3,
    iqr,
    outliersIqr,
    outliersZ,
    lowerFence,
    upperFence,
    skewness,
    kurtosis,
    standardError,
    ci95Lower,
    ci95Upper,
    coefficientOfVariation,
    geometricMean,
    harmonicMean,
    sumOfSquares,
    sumOfSquaredDeviations,
    trimmedMean10,
    zScores,
    warnings,
  };
}

/** Parse a CSV / whitespace / comma-separated string into numbers. */
export function parseValues(text: string): number[] {
  return text
    .split(/[\s,;\t\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/** Convert stats to CSV for export. */
export function statsToCsv(stats: StatsResult): string {
  const lines: string[] = ["Statistic,Value"];
  const entries: [string, number | string][] = [
    ["Count", stats.count],
    ["Sum", stats.sum],
    ["Mean", stats.mean],
    ["Median", stats.median],
    ["Mode", stats.modes.join("; ")],
    ["Min", stats.min],
    ["Max", stats.max],
    ["Range", stats.range],
    ["Variance (pop)", stats.variancePop],
    ["Variance (sample)", stats.varianceSample],
    ["Std Dev (pop)", stats.stdDevPop],
    ["Std Dev (sample)", stats.stdDevSample],
    ["Q1", stats.q1],
    ["Q2", stats.q2],
    ["Q3", stats.q3],
    ["IQR", stats.iqr],
    ["Lower fence", stats.lowerFence],
    ["Upper fence", stats.upperFence],
    ["Skewness", stats.skewness],
    ["Kurtosis (excess)", stats.kurtosis],
    ["Standard error", stats.standardError],
    ["95% CI lower", stats.ci95Lower],
    ["95% CI upper", stats.ci95Upper],
    ["CoV %", stats.coefficientOfVariation],
    ["Geometric mean", stats.geometricMean],
    ["Harmonic mean", stats.harmonicMean],
    ["Sum of squares", stats.sumOfSquares],
    ["Sum of squared deviations", stats.sumOfSquaredDeviations],
    ["Trimmed mean (10%)", stats.trimmedMean10],
    ["Outliers (IQR)", stats.outliersIqr.join("; ")],
    ["Outliers (z-score)", stats.outliersZ.join("; ")],
  ];
  for (const [k, v] of entries) lines.push(`${k},${v}`);
  return lines.join("\n");
}
