/**
 * Inventory Forecast — pure logic.
 * Linear projection from usage history.
 */

export interface UsagePoint {
  period: string; // label, e.g. "Week 1" or "2024-01"
  units: number;
}

export interface ForecastResult {
  slope: number;
  intercept: number;
  projected: number[];
  totalProjected: number;
  averageUsage: number;
  projectedStockoutPeriod: number | null; // index of period when stock hits 0
  r2: number; // coefficient of determination
  isValid: boolean;
  error?: string;
}

/** Simple linear regression of usage data. Returns slope and intercept. */
export function linearRegression(points: UsagePoint[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.units);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Compute R² for the regression. */
export function computeR2(points: UsagePoint[], slope: number, intercept: number): number {
  const ys = points.map((p) => p.units);
  const mean = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
  let ssTot = 0;
  let ssRes = 0;
  points.forEach((p, i) => {
    const predicted = slope * i + intercept;
    ssTot += Math.pow(p.units - mean, 2);
    ssRes += Math.pow(p.units - predicted, 2);
  });
  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}

/** Project future usage given historical data and current stock. */
export function forecast(
  history: UsagePoint[],
  currentStock: number,
  periods: number
): ForecastResult {
  if (!Array.isArray(history) || history.length < 2) {
    return { slope: 0, intercept: 0, projected: [], totalProjected: 0, averageUsage: 0, projectedStockoutPeriod: null, r2: 0, isValid: false, error: "Need at least 2 historical points." };
  }
  if (periods <= 0) {
    return { slope: 0, intercept: 0, projected: [], totalProjected: 0, averageUsage: 0, projectedStockoutPeriod: null, r2: 0, isValid: false, error: "Periods must be positive." };
  }
  const { slope, intercept } = linearRegression(history);
  const projected: number[] = [];
  let stockoutPeriod: number | null = null;
  let remaining = currentStock;
  for (let i = 0; i < periods; i++) {
    const futureIndex = history.length + i;
    const projectedUsage = Math.max(0, Math.round(slope * futureIndex + intercept));
    projected.push(projectedUsage);
    if (stockoutPeriod === null) {
      remaining -= projectedUsage;
      if (remaining <= 0) stockoutPeriod = i;
    }
  }
  const totalProjected = projected.reduce((a, b) => a + b, 0);
  const averageUsage = history.reduce((a, b) => a + b.units, 0) / history.length;
  const r2 = computeR2(history, slope, intercept);

  return {
    slope,
    intercept,
    projected,
    totalProjected,
    averageUsage,
    projectedStockoutPeriod: stockoutPeriod,
    r2,
    isValid: true,
  };
}

/** Suggest reorder point: average daily usage × lead time + safety stock. */
export function suggestReorderPoint(averageUsagePerPeriod: number, leadTimePeriods: number, safetyStock: number): number {
  if (averageUsagePerPeriod < 0 || leadTimePeriods < 0 || safetyStock < 0) return 0;
  return Math.ceil(averageUsagePerPeriod * leadTimePeriods + safetyStock);
}

/** Classify trend direction. */
export function classifyTrend(slope: number): "rising" | "falling" | "stable" {
  const threshold = 0.5;
  if (slope > threshold) return "rising";
  if (slope < -threshold) return "falling";
  return "stable";
}
