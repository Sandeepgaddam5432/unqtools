/**
 * Depreciation Calculator — pure logic.
 * Straight-line, declining balance, sum-of-years, MACRS, salvage value.
 */

export type DepreciationMethod = "straight-line" | "declining-balance" | "sum-of-years" | "macrs";

export interface AssetInputs {
  cost: number;
  salvage: number;
  usefulLifeYears: number;
  method: DepreciationMethod;
  decliningRate?: number; // multiplier (e.g. 2 for double-declining)
  macrsClass?: number; // MACRS class life (3, 5, 7, 10, 15, 20)
  macrsConvention?: "half-year" | "mid-quarter";
  placedInServiceMonth?: number; // 1..12, used for mid-quarter / proration
}

export interface YearSchedule {
  year: number;
  beginningBookValue: number;
  depreciation: number;
  endingBookValue: number;
  cumulativeDepreciation: number;
}

export interface DepreciationResult {
  method: DepreciationMethod;
  schedule: YearSchedule[];
  totalDepreciation: number;
  finalBookValue: number;
  annualAverage: number;
}

/** Straight-line: (cost - salvage) / life. */
export function straightLine(inputs: AssetInputs): DepreciationResult {
  const { cost, salvage, usefulLifeYears } = inputs;
  const annual = (cost - salvage) / usefulLifeYears;
  const schedule: YearSchedule[] = [];
  let bv = cost;
  let cum = 0;
  for (let y = 1; y <= usefulLifeYears; y++) {
    const dep = Math.min(annual, bv - salvage);
    bv -= dep;
    cum += dep;
    schedule.push({ year: y, beginningBookValue: bv + dep, depreciation: dep, endingBookValue: bv, cumulativeDepreciation: cum });
  }
  return {
    method: "straight-line",
    schedule,
    totalDepreciation: cum,
    finalBookValue: bv,
    annualAverage: annual,
  };
}

/** Declining balance: rate × current book value, switching to SL when optimal. */
export function decliningBalance(inputs: AssetInputs): DepreciationResult {
  const { cost, salvage, usefulLifeYears } = inputs;
  const rate = (inputs.decliningRate ?? 2) / usefulLifeYears;
  const schedule: YearSchedule[] = [];
  let bv = cost;
  let cum = 0;
  for (let y = 1; y <= usefulLifeYears; y++) {
    let dep = bv * rate;
    if (bv - dep < salvage) dep = bv - salvage;
    // Switch to straight-line if beneficial
    const remainingYears = usefulLifeYears - y + 1;
    const slDep = (bv - salvage) / remainingYears;
    if (slDep > dep) dep = slDep;
    bv -= dep;
    cum += dep;
    schedule.push({ year: y, beginningBookValue: bv + dep, depreciation: dep, endingBookValue: bv, cumulativeDepreciation: cum });
  }
  return {
    method: "declining-balance",
    schedule,
    totalDepreciation: cum,
    finalBookValue: bv,
    annualAverage: cum / usefulLifeYears,
  };
}

/** Sum-of-years digits. */
export function sumOfYears(inputs: AssetInputs): DepreciationResult {
  const { cost, salvage, usefulLifeYears } = inputs;
  const base = cost - salvage;
  const sum = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
  const schedule: YearSchedule[] = [];
  let bv = cost;
  let cum = 0;
  for (let y = 1; y <= usefulLifeYears; y++) {
    const factor = (usefulLifeYears - y + 1) / sum;
    const dep = base * factor;
    bv -= dep;
    cum += dep;
    schedule.push({ year: y, beginningBookValue: bv + dep, depreciation: dep, endingBookValue: bv, cumulativeDepreciation: cum });
  }
  return {
    method: "sum-of-years",
    schedule,
    totalDepreciation: cum,
    finalBookValue: bv,
    annualAverage: cum / usefulLifeYears,
  };
}

/** MACRS — uses pre-published IRS depreciation rates for half-year convention. */
export const MACRS_RATES: Record<number, number[]> = {
  3: [0.3333, 0.4445, 0.1481, 0.0741],
  5: [0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
  7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
  10: [0.1, 0.18, 0.144, 0.1152, 0.0922, 0.0737, 0.0655, 0.0655, 0.0655, 0.0655, 0.0328],
  15: [0.05, 0.095, 0.0855, 0.077, 0.0693, 0.0623, 0.059, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591, 0.0295],
  20: [0.0375, 0.0722, 0.0668, 0.0618, 0.0571, 0.0528, 0.0489, 0.0452, 0.0447, 0.0447, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0223],
};

export function macrs(inputs: AssetInputs): DepreciationResult {
  const cls = inputs.macrsClass ?? 5;
  const rates = MACRS_RATES[cls] ?? MACRS_RATES[5];
  const { cost } = inputs;
  const schedule: YearSchedule[] = [];
  let bv = cost;
  let cum = 0;
  for (let y = 1; y <= rates.length; y++) {
    const dep = cost * rates[y - 1];
    bv -= dep;
    cum += dep;
    schedule.push({ year: y, beginningBookValue: bv + dep, depreciation: dep, endingBookValue: Math.max(0, bv), cumulativeDepreciation: cum });
  }
  return {
    method: "macrs",
    schedule,
    totalDepreciation: cum,
    finalBookValue: Math.max(0, bv),
    annualAverage: cum / rates.length,
  };
}

/** Dispatch to the right method. */
export function computeDepreciation(inputs: AssetInputs): DepreciationResult {
  switch (inputs.method) {
    case "straight-line": return straightLine(inputs);
    case "declining-balance": return decliningBalance(inputs);
    case "sum-of-years": return sumOfYears(inputs);
    case "macrs": return macrs(inputs);
  }
}

/** Validate inputs. */
export function validateInputs(inputs: AssetInputs): string[] {
  const w: string[] = [];
  if (inputs.cost <= 0) w.push("Cost must be positive.");
  if (inputs.salvage < 0) w.push("Salvage value cannot be negative.");
  if (inputs.salvage >= inputs.cost) w.push("Salvage value should be less than cost.");
  if (inputs.usefulLifeYears <= 0) w.push("Useful life must be positive.");
  if (inputs.method === "declining-balance" && (inputs.decliningRate ?? 2) <= 0) w.push("Declining rate must be positive.");
  if (inputs.method === "macrs" && inputs.macrsClass && !MACRS_RATES[inputs.macrsClass]) w.push(`Unsupported MACRS class: ${inputs.macrsClass}`);
  return w;
}

/** Format schedule as CSV. */
export function exportScheduleCSV(result: DepreciationResult): string {
  const header = ["year", "beginning_book_value", "depreciation", "ending_book_value", "cumulative_depreciation"];
  const rows = result.schedule.map((r) =>
    [r.year, r.beginningBookValue.toFixed(2), r.depreciation.toFixed(2), r.endingBookValue.toFixed(2), r.cumulativeDepreciation.toFixed(2)].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Format as text. */
export function exportScheduleText(result: DepreciationResult): string {
  const lines = [
    `DEPRECIATION SCHEDULE — ${result.method}`,
    `Total depreciation:   ${result.totalDepreciation.toFixed(2)}`,
    `Final book value:     ${result.finalBookValue.toFixed(2)}`,
    `Annual average:       ${result.annualAverage.toFixed(2)}`,
    ``,
    `Year | Begin BV | Depreciation | End BV | Cumulative`,
  ];
  for (const r of result.schedule) {
    lines.push(`${r.year} | ${r.beginningBookValue.toFixed(2)} | ${r.depreciation.toFixed(2)} | ${r.endingBookValue.toFixed(2)} | ${r.cumulativeDepreciation.toFixed(2)}`);
  }
  return lines.join("\n");
}

/** Compare methods for the same asset. */
export function compareMethods(inputs: AssetInputs): Array<{ method: DepreciationMethod; year1Dep: number; totalDep: number; finalBV: number }> {
  const methods: DepreciationMethod[] = ["straight-line", "declining-balance", "sum-of-years", "macrs"];
  return methods.map((m) => {
    const r = computeDepreciation({ ...inputs, method: m });
    return {
      method: m,
      year1Dep: r.schedule[0]?.depreciation ?? 0,
      totalDep: r.totalDepreciation,
      finalBV: r.finalBookValue,
    };
  });
}

/** Compute book value at year N. */
export function bookValueAtYear(result: DepreciationResult, year: number): number {
  const entry = result.schedule.find((s) => s.year === year);
  return entry ? entry.endingBookValue : result.finalBookValue;
}

/** Section 179 immediate expensing (max $1.16M for 2023). */
export function section179(cost: number, limit = 1_160_000): number {
  return Math.min(cost, limit);
}

/** Bonus depreciation percentage by tax year (US phase-down). */
export function bonusDepreciationPercent(taxYear: number): number {
  if (taxYear >= 2023 && taxYear <= 2026) {
    const map: Record<number, number> = { 2023: 0.8, 2024: 0.6, 2025: 0.4, 2026: 0.2 };
    return map[taxYear] ?? 0;
  }
  return 0;
}

/** Tax shield (savings) from depreciation at a given tax rate. */
export function taxShield(result: DepreciationResult, taxRate: number): number {
  return result.totalDepreciation * taxRate;
}

/** Per-year tax shield. */
export function perYearTaxShield(result: DepreciationResult, taxRate: number): Array<{ year: number; shield: number }> {
  return result.schedule.map((s) => ({ year: s.year, shield: s.depreciation * taxRate }));
}
