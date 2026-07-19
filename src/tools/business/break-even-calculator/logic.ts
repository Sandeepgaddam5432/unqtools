/**
 * Break-Even Calculator — pure logic.
 *
 * Compute break-even units / revenue, contribution margin, margin of safety,
 * target profit units, profit at expected sales, and price sensitivity.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export interface BreakEvenInput {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  expectedSalesUnits: number; // 0 if not provided
  targetProfit: number; // 0 if not provided
}

export interface BreakEvenResult {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  expectedSalesUnits: number;
  targetProfit: number;
  contributionMarginPerUnit: number; // price - variable cost
  contributionMarginRatio: number; // 0..1 (cmPerUnit / price)
  breakEvenUnits: number; // fixedCosts / cmPerUnit
  breakEvenRevenue: number; // fixedCosts / cmRatio
  targetProfitUnits: number | null; // (fixedCosts + targetProfit) / cmPerUnit
  targetProfitRevenue: number | null;
  marginOfSafetyUnits: number | null; // expected - breakEvenUnits
  marginOfSafetyPct: number | null; // (MoS / expected) * 100
  profitAtExpected: number | null; // expected * cmPerUnit - fixedCosts
  valid: boolean;
  errors: string[];
}

export interface SensitivityRow {
  label: string; // e.g. "−20% price"
  pricePerUnit: number;
  contributionMarginPerUnit: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  valid: boolean;
}

export interface BreakEvenSummaryStats {
  breakEvenUnits: number;
  breakEvenRevenue: number;
  marginOfSafetyUnits: number | null;
  marginOfSafetyPct: number | null;
  profitAtExpected: number | null;
  contributionMarginPerUnit: number;
  contributionMarginRatio: number;
}

export interface BreakEvenHistoryEntry {
  ts: number;
  fixedCosts: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
}

// ---- Constants / Presets ----

/** Sensitivity offsets to apply to price (fractions of original price). */
export const SENSITIVITY_OFFSETS: { label: string; factor: number }[] = [
  { label: "−20% price", factor: -0.20 },
  { label: "−10% price", factor: -0.10 },
  { label: "Base price", factor: 0 },
  { label: "+10% price", factor: 0.10 },
  { label: "+20% price", factor: 0.20 },
];

/** Example presets for quick fills (fixed, variable, price, expected). */
export const PRESET_EXAMPLES: { name: string; input: BreakEvenInput }[] = [
  {
    name: "Coffee shop",
    input: { fixedCosts: 5000, variableCostPerUnit: 1.5, pricePerUnit: 4, expectedSalesUnits: 2500, targetProfit: 0 },
  },
  {
    name: "SaaS subscription",
    input: { fixedCosts: 20000, variableCostPerUnit: 5, pricePerUnit: 50, expectedSalesUnits: 600, targetProfit: 10000 },
  },
  {
    name: "Handmade crafts",
    input: { fixedCosts: 800, variableCostPerUnit: 8, pricePerUnit: 25, expectedSalesUnits: 100, targetProfit: 500 },
  },
  {
    name: "Consulting hour",
    input: { fixedCosts: 3000, variableCostPerUnit: 0, pricePerUnit: 120, expectedSalesUnits: 50, targetProfit: 0 },
  },
];

// ---- Validation ----

/** Validate input — returns list of human-readable error strings. */
export function validateInput(input: BreakEvenInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.fixedCosts) || input.fixedCosts < 0) {
    errors.push("Fixed costs must be a non-negative number.");
  }
  if (!Number.isFinite(input.variableCostPerUnit) || input.variableCostPerUnit < 0) {
    errors.push("Variable cost per unit must be a non-negative number.");
  }
  if (!Number.isFinite(input.pricePerUnit) || input.pricePerUnit < 0) {
    errors.push("Price per unit must be a non-negative number.");
  }
  if (
    Number.isFinite(input.pricePerUnit) &&
    Number.isFinite(input.variableCostPerUnit) &&
    input.pricePerUnit <= input.variableCostPerUnit
  ) {
    errors.push("Price per unit must be greater than variable cost per unit (otherwise no contribution margin).");
  }
  if (
    Number.isFinite(input.expectedSalesUnits) &&
    input.expectedSalesUnits < 0
  ) {
    errors.push("Expected sales units cannot be negative.");
  }
  if (
    Number.isFinite(input.targetProfit) &&
    input.targetProfit < 0
  ) {
    errors.push("Target profit cannot be negative.");
  }
  return errors;
}

// ---- Calculations ----

/** Contribution margin per unit = price − variable cost. */
export function calcContributionMarginPerUnit(pricePerUnit: number, variableCostPerUnit: number): number {
  if (!Number.isFinite(pricePerUnit) || !Number.isFinite(variableCostPerUnit)) return 0;
  return round2(pricePerUnit - variableCostPerUnit);
}

/** Contribution margin ratio = cmPerUnit / price (0..1). Returns 0 when price is 0. */
export function calcContributionMarginRatio(cmPerUnit: number, pricePerUnit: number): number {
  if (!Number.isFinite(pricePerUnit) || pricePerUnit === 0) return 0;
  return round4(cmPerUnit / pricePerUnit);
}

/** Break-even units = fixedCosts / cmPerUnit. Returns 0 when cmPerUnit is 0. */
export function calcBreakEvenUnits(fixedCosts: number, cmPerUnit: number): number {
  if (!Number.isFinite(cmPerUnit) || cmPerUnit <= 0) return 0;
  return round2(fixedCosts / cmPerUnit);
}

/** Break-even revenue = fixedCosts / cmRatio. Returns 0 when cmRatio is 0. */
export function calcBreakEvenRevenue(fixedCosts: number, cmRatio: number): number {
  if (!Number.isFinite(cmRatio) || cmRatio === 0) return 0;
  return round2(fixedCosts / cmRatio);
}

/** Units needed to reach a target profit = (fixedCosts + targetProfit) / cmPerUnit. Returns null if not computable. */
export function calcTargetProfitUnits(
  fixedCosts: number,
  targetProfit: number,
  cmPerUnit: number,
): number | null {
  if (!Number.isFinite(targetProfit) || targetProfit <= 0) return null;
  if (!Number.isFinite(cmPerUnit) || cmPerUnit <= 0) return null;
  return round2((fixedCosts + targetProfit) / cmPerUnit);
}

/** Revenue needed to reach a target profit = (fixedCosts + targetProfit) / cmRatio. Returns null if not computable. */
export function calcTargetProfitRevenue(
  fixedCosts: number,
  targetProfit: number,
  cmRatio: number,
): number | null {
  if (!Number.isFinite(targetProfit) || targetProfit <= 0) return null;
  if (!Number.isFinite(cmRatio) || cmRatio === 0) return null;
  return round2((fixedCosts + targetProfit) / cmRatio);
}

/** Margin of safety (units) = expected sales − break-even units. Returns null if expected sales not provided. */
export function calcMarginOfSafetyUnits(expectedSales: number, breakEvenUnits: number): number | null {
  if (!Number.isFinite(expectedSales) || expectedSales <= 0) return null;
  return round2(expectedSales - breakEvenUnits);
}

/** Margin of safety (%) = (MoS units / expected) × 100. Returns null if expected sales not provided. */
export function calcMarginOfSafetyPct(moSUnits: number | null, expectedSales: number): number | null {
  if (moSUnits === null) return null;
  if (!Number.isFinite(expectedSales) || expectedSales === 0) return null;
  return round2((moSUnits / expectedSales) * 100);
}

/** Profit at expected sales = expected × cmPerUnit − fixedCosts. Returns null if not computable. */
export function calcProfitAtExpected(expectedSales: number, cmPerUnit: number, fixedCosts: number): number | null {
  if (!Number.isFinite(expectedSales) || expectedSales <= 0) return null;
  if (!Number.isFinite(cmPerUnit)) return null;
  return round2(expectedSales * cmPerUnit - fixedCosts);
}

/** Compute the full break-even result from raw input. */
export function computeBreakEven(input: BreakEvenInput): BreakEvenResult {
  const errors = validateInput(input);
  const valid = errors.length === 0;

  const cmPerUnit = calcContributionMarginPerUnit(input.pricePerUnit, input.variableCostPerUnit);
  const cmRatio = calcContributionMarginRatio(cmPerUnit, input.pricePerUnit);
  const breakEvenUnits = valid ? calcBreakEvenUnits(input.fixedCosts, cmPerUnit) : 0;
  const breakEvenRevenue = valid ? calcBreakEvenRevenue(input.fixedCosts, cmRatio) : 0;
  const targetProfitUnits = valid ? calcTargetProfitUnits(input.fixedCosts, input.targetProfit, cmPerUnit) : null;
  const targetProfitRevenue = valid ? calcTargetProfitRevenue(input.fixedCosts, input.targetProfit, cmRatio) : null;
  const marginOfSafetyUnits = valid ? calcMarginOfSafetyUnits(input.expectedSalesUnits, breakEvenUnits) : null;
  const marginOfSafetyPct = valid ? calcMarginOfSafetyPct(marginOfSafetyUnits, input.expectedSalesUnits) : null;
  const profitAtExpected = valid ? calcProfitAtExpected(input.expectedSalesUnits, cmPerUnit, input.fixedCosts) : null;

  return {
    fixedCosts: input.fixedCosts,
    variableCostPerUnit: input.variableCostPerUnit,
    pricePerUnit: input.pricePerUnit,
    expectedSalesUnits: input.expectedSalesUnits,
    targetProfit: input.targetProfit,
    contributionMarginPerUnit: cmPerUnit,
    contributionMarginRatio: cmRatio,
    breakEvenUnits,
    breakEvenRevenue,
    targetProfitUnits,
    targetProfitRevenue,
    marginOfSafetyUnits,
    marginOfSafetyPct,
    profitAtExpected,
    valid,
    errors,
  };
}

// ---- Sensitivity analysis ----

/** Run a price-sensitivity sweep across the configured offsets. */
export function runSensitivity(input: BreakEvenInput): SensitivityRow[] {
  return SENSITIVITY_OFFSETS.map(({ label, factor }) => {
    const adjustedPrice = round2(input.pricePerUnit * (1 + factor));
    const cmPerUnit = calcContributionMarginPerUnit(adjustedPrice, input.variableCostPerUnit);
    const valid = cmPerUnit > 0 && Number.isFinite(input.fixedCosts) && input.fixedCosts >= 0;
    const breakEvenUnits = valid ? calcBreakEvenUnits(input.fixedCosts, cmPerUnit) : 0;
    const cmRatio = calcContributionMarginRatio(cmPerUnit, adjustedPrice);
    const breakEvenRevenue = valid ? calcBreakEvenRevenue(input.fixedCosts, cmRatio) : 0;
    return {
      label,
      pricePerUnit: adjustedPrice,
      contributionMarginPerUnit: cmPerUnit,
      breakEvenUnits,
      breakEvenRevenue,
      valid,
    };
  });
}

// ---- Formatting ----

/** Format a number with 2 decimals. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

/** Format a percentage (input is 0..100 already). */
export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

/** Format a ratio (0..1) as a percentage. */
export function formatRatio(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Renderers ----

/** Render the break-even analysis as a plain-text report. */
export function renderText(input: BreakEvenInput, r: BreakEvenResult): string {
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("BREAK-EVEN ANALYSIS");
  L.push("=".repeat(60));
  L.push("");
  L.push("INPUTS");
  L.push("-".repeat(60));
  L.push(`  Fixed costs:            ${formatNumber(input.fixedCosts)}`);
  L.push(`  Variable cost / unit:   ${formatNumber(input.variableCostPerUnit)}`);
  L.push(`  Price / unit:           ${formatNumber(input.pricePerUnit)}`);
  if (input.expectedSalesUnits > 0) {
    L.push(`  Expected sales units:   ${formatNumber(input.expectedSalesUnits)}`);
  }
  if (input.targetProfit > 0) {
    L.push(`  Target profit:          ${formatNumber(input.targetProfit)}`);
  }
  L.push("");

  if (!r.valid) {
    L.push("VALIDATION ERRORS");
    L.push("-".repeat(60));
    for (const e of r.errors) L.push(`  ! ${e}`);
    L.push("=".repeat(60));
    return L.join("\n");
  }

  L.push("CONTRIBUTION MARGIN");
  L.push("-".repeat(60));
  L.push(`  CM per unit:            ${formatNumber(r.contributionMarginPerUnit)}    (price − variable cost)`);
  L.push(`  CM ratio:               ${formatRatio(r.contributionMarginRatio)}    (CM / price)`);
  L.push("");

  L.push("BREAK-EVEN POINT");
  L.push("-".repeat(60));
  L.push(`  Break-even units:       ${formatNumber(r.breakEvenUnits)}    (fixed costs / CM per unit)`);
  L.push(`  Break-even revenue:     ${formatNumber(r.breakEvenRevenue)}    (fixed costs / CM ratio)`);
  L.push("");

  if (r.targetProfitUnits !== null) {
    L.push("TARGET PROFIT");
    L.push("-".repeat(60));
    L.push(`  Units for target:       ${formatNumber(r.targetProfitUnits)}    ((fixed + target) / CM)`);
    if (r.targetProfitRevenue !== null) {
      L.push(`  Revenue for target:     ${formatNumber(r.targetProfitRevenue)}    ((fixed + target) / CM ratio)`);
    }
    L.push("");
  }

  if (r.marginOfSafetyUnits !== null) {
    L.push("MARGIN OF SAFETY");
    L.push("-".repeat(60));
    L.push(`  MoS units:              ${formatNumber(r.marginOfSafetyUnits)}    (expected − break-even)`);
    L.push(`  MoS %:                  ${formatPercent(r.marginOfSafetyPct)}    (MoS / expected)`);
    L.push("");
  }

  if (r.profitAtExpected !== null) {
    L.push("PROFIT AT EXPECTED SALES");
    L.push("-".repeat(60));
    L.push(`  Profit:                 ${formatNumber(r.profitAtExpected)}    (expected × CM − fixed)`);
    L.push("");
  }

  L.push("PRICE SENSITIVITY");
  L.push("-".repeat(60));
  L.push(`  ${"Scenario".padEnd(14)} ${"Price".padStart(10)} ${"CM/unit".padStart(10)} ${"BE units".padStart(12)} ${"BE revenue".padStart(14)}`);
  const sens = runSensitivity(input);
  for (const row of sens) {
    L.push(
      `  ${row.label.padEnd(14)} ${formatNumber(row.pricePerUnit).padStart(10)} ${formatNumber(row.contributionMarginPerUnit).padStart(10)} ${formatNumber(row.breakEvenUnits).padStart(12)} ${formatNumber(row.breakEvenRevenue).padStart(14)}`,
    );
  }
  L.push("=".repeat(60));
  return L.join("\n");
}

/** Render the break-even analysis as CSV (metric, value, formula). */
export function renderCsv(input: BreakEvenInput, r: BreakEvenResult): string {
  const lines: string[] = [];
  lines.push("metric,value,formula");
  lines.push(`fixed_costs,${num(input.fixedCosts)},input`);
  lines.push(`variable_cost_per_unit,${num(input.variableCostPerUnit)},input`);
  lines.push(`price_per_unit,${num(input.pricePerUnit)},input`);
  lines.push(`expected_sales_units,${num(input.expectedSalesUnits)},input`);
  lines.push(`target_profit,${num(input.targetProfit)},input`);
  if (r.valid) {
    lines.push(`contribution_margin_per_unit,${num(r.contributionMarginPerUnit)},price - variable_cost`);
    lines.push(`contribution_margin_ratio,${num(r.contributionMarginRatio)},cm_per_unit / price`);
    lines.push(`break_even_units,${num(r.breakEvenUnits)},fixed_costs / cm_per_unit`);
    lines.push(`break_even_revenue,${num(r.breakEvenRevenue)},fixed_costs / cm_ratio`);
    if (r.targetProfitUnits !== null) {
      lines.push(`target_profit_units,${num(r.targetProfitUnits)},(fixed_costs + target_profit) / cm_per_unit`);
    }
    if (r.targetProfitRevenue !== null) {
      lines.push(`target_profit_revenue,${num(r.targetProfitRevenue)},(fixed_costs + target_profit) / cm_ratio`);
    }
    if (r.marginOfSafetyUnits !== null) {
      lines.push(`margin_of_safety_units,${num(r.marginOfSafetyUnits)},expected_sales - break_even_units`);
    }
    if (r.marginOfSafetyPct !== null) {
      lines.push(`margin_of_safety_pct,${num(r.marginOfSafetyPct)},(mos_units / expected_sales) * 100`);
    }
    if (r.profitAtExpected !== null) {
      lines.push(`profit_at_expected,${num(r.profitAtExpected)},expected_sales * cm_per_unit - fixed_costs`);
    }
  } else {
    for (const e of r.errors) lines.push(`error,${escapeCsv(e)},validation`);
  }
  // sensitivity block
  lines.push("");
  lines.push("scenario,price_per_unit,cm_per_unit,break_even_units,break_even_revenue");
  const sens = runSensitivity(input);
  for (const row of sens) {
    lines.push([
      escapeCsv(row.label),
      num(row.pricePerUnit),
      num(row.contributionMarginPerUnit),
      num(row.breakEvenUnits),
      num(row.breakEvenRevenue),
    ].join(","));
  }
  return lines.join("\n");
}

function num(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(4);
}

// ---- Summary stats ----

/** Build a compact summary stats object from a result. */
export function summaryStats(r: BreakEvenResult): BreakEvenSummaryStats {
  return {
    breakEvenUnits: r.breakEvenUnits,
    breakEvenRevenue: r.breakEvenRevenue,
    marginOfSafetyUnits: r.marginOfSafetyUnits,
    marginOfSafetyPct: r.marginOfSafetyPct,
    profitAtExpected: r.profitAtExpected,
    contributionMarginPerUnit: r.contributionMarginPerUnit,
    contributionMarginRatio: r.contributionMarginRatio,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:break-even-calculator:history";
const HISTORY_MAX = 20;

export function loadHistory(): BreakEvenHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BreakEvenHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: BreakEvenHistoryEntry): BreakEvenHistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<BreakEvenInput>): string {
  const params = new URLSearchParams();
  if (Number.isFinite(input.fixedCosts)) params.set("fc", String(input.fixedCosts));
  if (Number.isFinite(input.variableCostPerUnit)) params.set("vc", String(input.variableCostPerUnit));
  if (Number.isFinite(input.pricePerUnit)) params.set("p", String(input.pricePerUnit));
  if (Number.isFinite(input.expectedSalesUnits) && (input.expectedSalesUnits ?? 0) > 0) {
    params.set("exp", String(input.expectedSalesUnits));
  }
  if (Number.isFinite(input.targetProfit) && (input.targetProfit ?? 0) > 0) {
    params.set("tp", String(input.targetProfit));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<BreakEvenInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<BreakEvenInput> = {};
  const fc = params.get("fc");
  if (fc !== null) {
    const n = Number(fc);
    if (Number.isFinite(n)) out.fixedCosts = n;
  }
  const vc = params.get("vc");
  if (vc !== null) {
    const n = Number(vc);
    if (Number.isFinite(n)) out.variableCostPerUnit = n;
  }
  const p = params.get("p");
  if (p !== null) {
    const n = Number(p);
    if (Number.isFinite(n)) out.pricePerUnit = n;
  }
  const exp = params.get("exp");
  if (exp !== null) {
    const n = Number(exp);
    if (Number.isFinite(n)) out.expectedSalesUnits = n;
  }
  const tp = params.get("tp");
  if (tp !== null) {
    const n = Number(tp);
    if (Number.isFinite(n)) out.targetProfit = n;
  }
  return out;
}

// ---- Helpers ----

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
