/**
 * ROI Calculator — pure logic.
 *
 * Compute ROI, annualized ROI, payback period, NPV and IRR.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export interface RoiInput {
  initialInvestment: number;
  cashFlowsText: string; // one number per line
  discountRate: number; // percent, e.g. 10 for 10%
  terminalValue: number; // salvage value at end
}

export interface CashFlowRow {
  year: number; // 1-indexed
  cashFlow: number;
  cumulative: number; // cumulative cash flow including initial as negative at year 0
  discounted: number; // discounted cash flow at this year
}

export interface RoiResult {
  initialInvestment: number;
  cashFlows: number[];
  totalCashFlow: number; // sum of cash flows + terminal value
  netProfit: number; // totalCashFlow - initialInvestment
  roi: number; // percent
  years: number; // number of cash flow periods
  annualizedRoi: number; // percent; 0 when not computable
  paybackPeriod: number | null; // years (with fractional); null if never paid back
  paybackYears: number | null;
  paybackMonths: number | null;
  npv: number; // at given discount rate
  irr: number | null; // percent; null if not found
  profitability: "profitable" | "unprofitable" | "indeterminate";
  rows: CashFlowRow[];
}

export interface RoiHistoryEntry {
  ts: number;
  initialInvestment: number;
  totalCashFlow: number;
  roi: number;
  npv: number;
  irr: number | null;
}

// ---- Constants / Presets ----

/** 5 target ROI presets for quick comparison (percent). */
export const ROI_TARGET_PRESETS: number[] = [5, 10, 15, 20, 25];

export const DEFAULT_DISCOUNT_RATE = 10;

// ---- Parsing ----

/** Parse annual cash flows — one number per line. Returns parsed values + errors. */
export function parseCashFlows(text: string): { values: number[]; errors: string[] } {
  const values: number[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { values, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const n = Number(line);
    if (!Number.isFinite(n)) {
      errors.push(`Line ${idx + 1}: invalid number "${line}"`);
      return;
    }
    values.push(n);
  });
  return { values, errors };
}

// ---- Calculations ----

/** Apply terminal value: append it to the cash flow stream (at final year). */
export function applyTerminalValue(cashFlows: number[], terminalValue: number): number[] {
  if (!Number.isFinite(terminalValue) || terminalValue === 0) return [...cashFlows];
  if (cashFlows.length === 0) return [terminalValue];
  const out = [...cashFlows];
  out[out.length - 1] = round2(out[out.length - 1] + terminalValue);
  return out;
}

/** Total cash flow = sum of cash flows + terminal value. */
export function calcTotalCashFlow(cashFlows: number[], terminalValue: number): number {
  const withTerminal = applyTerminalValue(cashFlows, terminalValue);
  return round2(withTerminal.reduce((s, n) => s + n, 0));
}

/** Net profit = total cash flow - initial investment. */
export function calcNetProfit(totalCashFlow: number, initialInvestment: number): number {
  return round2(totalCashFlow - initialInvestment);
}

/** ROI (basic) = netProfit / initialInvestment * 100. Returns 0 when initial is 0. */
export function calcRoi(netProfit: number, initialInvestment: number): number {
  if (!Number.isFinite(initialInvestment) || initialInvestment === 0) return 0;
  return round2((netProfit / initialInvestment) * 100);
}

/** Apply discount rate to a single cash flow at year `t` (1-indexed). */
export function applyDiscountRate(cashFlow: number, ratePercent: number, year: number): number {
  if (year < 0) return cashFlow;
  const r = ratePercent / 100;
  return round2(cashFlow / Math.pow(1 + r, year));
}

/** Annualized ROI = ((totalCF / initial) ^ (1/years)) - 1, as percent. Returns 0 when not computable. */
export function calcAnnualizedRoi(totalCashFlow: number, initialInvestment: number, years: number): number {
  if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) return 0;
  if (!Number.isFinite(years) || years <= 0) return 0;
  if (!Number.isFinite(totalCashFlow) || totalCashFlow <= 0) return 0;
  const ratio = totalCashFlow / initialInvestment;
  const annualized = Math.pow(ratio, 1 / years) - 1;
  return round2(annualized * 100);
}

/** Payback period in years (with fractional). Returns null if never paid back. */
export function calcPaybackPeriod(cashFlows: number[], initialInvestment: number): number | null {
  if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) return 0;
  if (cashFlows.length === 0) return null;
  let cumulative = -initialInvestment;
  for (let i = 0; i < cashFlows.length; i++) {
    const prev = cumulative;
    cumulative += cashFlows[i];
    if (cumulative >= 0 && prev < 0) {
      // crossed zero between year i and i+1
      const fraction = cashFlows[i] === 0 ? 0 : (-prev) / cashFlows[i];
      return round2(i + fraction);
    }
  }
  return null;
}

/** NPV = -initial + sum of (cashFlow[i] / (1+r)^(i+1)). r as decimal. */
export function calcNpv(cashFlows: number[], initialInvestment: number, ratePercent: number): number {
  if (!Number.isFinite(ratePercent)) return round2(-initialInvestment);
  const r = ratePercent / 100;
  let npv = -initialInvestment;
  for (let i = 0; i < cashFlows.length; i++) {
    npv += cashFlows[i] / Math.pow(1 + r, i + 1);
  }
  return round2(npv);
}

/** IRR via bisection. Returns percent or null if not found. */
export function calcIrr(cashFlows: number[], initialInvestment: number): number | null {
  if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) return null;
  if (cashFlows.length === 0) return null;

  // Need at least one sign change in cash flows for IRR to exist.
  const stream = [-initialInvestment, ...cashFlows];
  let signChanges = 0;
  let prevSign: number | null = null;
  for (const v of stream) {
    if (v === 0) continue;
    const sign = v > 0 ? 1 : -1;
    if (prevSign !== null && sign !== prevSign) signChanges += 1;
    prevSign = sign;
  }
  if (signChanges === 0) return null;

  const npvAt = (rate: number): number => {
    let npv = -initialInvestment;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + rate, i + 1);
    }
    return npv;
  };

  let lo = -0.99; // -99%
  let hi = 10.0; // 1000%
  let loNpv = npvAt(lo);
  let hiNpv = npvAt(hi);

  // If both same sign, IRR not bracketed in this range.
  if (loNpv * hiNpv > 0) return null;

  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const midNpv = npvAt(mid);
    if (Math.abs(midNpv) < 1e-7) return round2(mid * 100);
    if (loNpv * midNpv < 0) {
      hi = mid;
      hiNpv = midNpv;
    } else {
      lo = mid;
      loNpv = midNpv;
    }
    if (hi - lo < 1e-9) return round2(mid * 100);
  }
  return round2(((lo + hi) / 2) * 100);
}

/** Profitability indicator: profitable if NPV > 0 AND IRR > discount rate. */
export function checkProfitability(
  npv: number,
  irr: number | null,
  discountRate: number,
): "profitable" | "unprofitable" | "indeterminate" {
  if (irr === null) {
    return npv > 0 ? "profitable" : npv < 0 ? "unprofitable" : "indeterminate";
  }
  if (npv > 0 && irr > discountRate) return "profitable";
  if (npv < 0 && irr < discountRate) return "unprofitable";
  return "indeterminate";
}

/** Compute the full ROI result from raw input. */
export function computeRoi(input: RoiInput): RoiResult {
  const cashFlows = parseCashFlows(input.cashFlowsText).values;
  const initialInvestment = Number.isFinite(input.initialInvestment) ? input.initialInvestment : 0;
  const discountRate = Number.isFinite(input.discountRate) ? input.discountRate : 0;
  const terminalValue = Number.isFinite(input.terminalValue) ? input.terminalValue : 0;

  const cashFlowsWithTerminal = applyTerminalValue(cashFlows, terminalValue);
  const totalCashFlow = calcTotalCashFlow(cashFlows, terminalValue);
  const netProfit = calcNetProfit(totalCashFlow, initialInvestment);
  const roi = calcRoi(netProfit, initialInvestment);
  const years = cashFlows.length;
  const annualizedRoi = calcAnnualizedRoi(totalCashFlow, initialInvestment, years);
  const paybackPeriod = calcPaybackPeriod(cashFlowsWithTerminal, initialInvestment);
  const paybackYears = paybackPeriod === null ? null : Math.floor(paybackPeriod);
  const paybackMonths = paybackPeriod === null
    ? null
    : Math.round((paybackPeriod - Math.floor(paybackPeriod)) * 12);
  const npv = calcNpv(cashFlowsWithTerminal, initialInvestment, discountRate);
  const irr = calcIrr(cashFlowsWithTerminal, initialInvestment);
  const profitability = checkProfitability(npv, irr, discountRate);

  // Build per-year rows including terminal value in the final year.
  const rows: CashFlowRow[] = [];
  let cumulative = -initialInvestment;
  for (let i = 0; i < cashFlowsWithTerminal.length; i++) {
    cumulative = round2(cumulative + cashFlowsWithTerminal[i]);
    rows.push({
      year: i + 1,
      cashFlow: cashFlowsWithTerminal[i],
      cumulative,
      discounted: applyDiscountRate(cashFlowsWithTerminal[i], discountRate, i + 1),
    });
  }

  return {
    initialInvestment,
    cashFlows: cashFlowsWithTerminal,
    totalCashFlow,
    netProfit,
    roi,
    years,
    annualizedRoi,
    paybackPeriod,
    paybackYears,
    paybackMonths,
    npv,
    irr,
    profitability,
    rows,
  };
}

// ---- Formatting ----

/** Format a currency-like number with 2 decimals. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

/** Format a percent value with 2 decimals. */
export function formatPercent(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Renderers ----

/** Render the ROI analysis as a plain-text report. */
export function renderText(input: RoiInput, r: RoiResult): string {
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("ROI ANALYSIS");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Initial investment:  ${formatNumber(r.initialInvestment)}`);
  L.push(`Annual cash flows:    ${r.cashFlows.length} year(s)`);
  L.push(`Discount rate:        ${input.discountRate.toFixed(2)}%`);
  if (input.terminalValue !== 0) {
    L.push(`Terminal value:      ${formatNumber(input.terminalValue)}`);
  }
  L.push("");

  L.push("RESULTS");
  L.push("-".repeat(60));
  L.push(`Total cash flow:      ${formatNumber(r.totalCashFlow)}`);
  L.push(`Net profit:           ${formatNumber(r.netProfit)}`);
  L.push(`ROI:                  ${formatPercent(r.roi)}`);
  L.push(`Annualized ROI:       ${formatPercent(r.annualizedRoi)}`);
  if (r.paybackPeriod === null) {
    L.push(`Payback period:       never (does not recover)`);
  } else {
    L.push(`Payback period:       ${r.paybackYears}y ${r.paybackMonths}m (${r.paybackPeriod.toFixed(2)} years)`);
  }
  L.push(`NPV @ ${input.discountRate.toFixed(2)}%:       ${formatNumber(r.npv)}`);
  L.push(`IRR:                  ${formatPercent(r.irr)}`);
  L.push(`Profitability:        ${r.profitability.toUpperCase()}`);
  L.push("");

  L.push("CASH FLOW SCHEDULE");
  L.push("-".repeat(60));
  L.push(`  ${"Year".padEnd(6)} ${"Cash Flow".padStart(14)} ${"Cumulative".padStart(14)} ${"Discounted".padStart(14)}`);
  L.push("-".repeat(60));
  L.push(`  ${"0".padEnd(6)} ${formatNumber(-r.initialInvestment).padStart(14)} ${formatNumber(-r.initialInvestment).padStart(14)} ${formatNumber(-r.initialInvestment).padStart(14)}`);
  for (const row of r.rows) {
    L.push(
      `  ${String(row.year).padEnd(6)} ${formatNumber(row.cashFlow).padStart(14)} ${formatNumber(row.cumulative).padStart(14)} ${formatNumber(row.discounted).padStart(14)}`,
    );
  }
  L.push("=".repeat(60));

  // ROI target comparison
  L.push("");
  L.push("ROI TARGET COMPARISON");
  L.push("-".repeat(60));
  for (const target of ROI_TARGET_PRESETS) {
    const marker = r.roi >= target ? "✓" : "✗";
    L.push(`  ${marker} ${target.toFixed(0).padStart(3)}% target — actual ${formatPercent(r.roi)}`);
  }
  L.push("=".repeat(60));
  return L.join("\n");
}

/** Render the ROI analysis as CSV (year, cash_flow, cumulative, discounted). */
export function renderCsv(input: RoiInput, r: RoiResult): string {
  const lines: string[] = [];
  lines.push(`initial_investment,${r.initialInvestment.toFixed(2)}`);
  lines.push(`years,${r.years}`);
  lines.push(`discount_rate_pct,${input.discountRate.toFixed(2)}`);
  lines.push(`terminal_value,${input.terminalValue.toFixed(2)}`);
  lines.push("");
  lines.push("year,cash_flow,cumulative,discounted");
  lines.push(`0,${(-r.initialInvestment).toFixed(2)},${(-r.initialInvestment).toFixed(2)},${(-r.initialInvestment).toFixed(2)}`);
  for (const row of r.rows) {
    lines.push([
      String(row.year),
      row.cashFlow.toFixed(2),
      row.cumulative.toFixed(2),
      row.discounted.toFixed(2),
    ].join(","));
  }
  lines.push("");
  lines.push(`total_cash_flow,${r.totalCashFlow.toFixed(2)}`);
  lines.push(`net_profit,${r.netProfit.toFixed(2)}`);
  lines.push(`roi_pct,${r.roi.toFixed(2)}`);
  lines.push(`annualized_roi_pct,${r.annualizedRoi.toFixed(2)}`);
  lines.push(`payback_period_years,${r.paybackPeriod === null ? "never" : r.paybackPeriod.toFixed(2)}`);
  lines.push(`npv,${r.npv.toFixed(2)}`);
  lines.push(`irr_pct,${r.irr === null ? "n/a" : r.irr.toFixed(2)}`);
  lines.push(`profitability,${escapeCsv(r.profitability)}`);
  return lines.join("\n");
}

// ---- Summary stats ----

export interface RoiSummaryStats {
  initialInvestment: number;
  totalCashFlow: number;
  netProfit: number;
  roi: number;
  annualizedRoi: number;
  paybackPeriod: number | null;
  npv: number;
  irr: number | null;
  years: number;
  profitability: "profitable" | "unprofitable" | "indeterminate";
  maxCashFlow: number;
  minCashFlow: number;
  avgCashFlow: number;
}

/** Build a compact summary stats object from a result. */
export function summaryStats(r: RoiResult): RoiSummaryStats {
  const cf = r.cashFlows;
  const sum = cf.reduce((s, n) => s + n, 0);
  return {
    initialInvestment: r.initialInvestment,
    totalCashFlow: r.totalCashFlow,
    netProfit: r.netProfit,
    roi: r.roi,
    annualizedRoi: r.annualizedRoi,
    paybackPeriod: r.paybackPeriod,
    npv: r.npv,
    irr: r.irr,
    years: r.years,
    profitability: r.profitability,
    maxCashFlow: cf.length ? round2(Math.max(...cf)) : 0,
    minCashFlow: cf.length ? round2(Math.min(...cf)) : 0,
    avgCashFlow: cf.length ? round2(sum / cf.length) : 0,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:roi-calculator:history";
const HISTORY_MAX = 20;

export function loadHistory(): RoiHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RoiHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: RoiHistoryEntry): RoiHistoryEntry[] {
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

export function buildShareUrl(input: Partial<RoiInput>): string {
  const params = new URLSearchParams();
  if (input.initialInvestment !== undefined && Number.isFinite(input.initialInvestment)) {
    params.set("init", String(input.initialInvestment));
  }
  if (input.cashFlowsText) params.set("cf", input.cashFlowsText);
  if (input.discountRate !== undefined && Number.isFinite(input.discountRate)) {
    params.set("rate", String(input.discountRate));
  }
  if (input.terminalValue !== undefined && Number.isFinite(input.terminalValue)) {
    params.set("tv", String(input.terminalValue));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<RoiInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<RoiInput> = {};
  const init = params.get("init");
  if (init !== null) {
    const n = Number(init);
    if (Number.isFinite(n)) out.initialInvestment = n;
  }
  if (params.get("cf")) out.cashFlowsText = params.get("cf")!;
  const rate = params.get("rate");
  if (rate !== null) {
    const n = Number(rate);
    if (Number.isFinite(n)) out.discountRate = n;
  }
  const tv = params.get("tv");
  if (tv !== null) {
    const n = Number(tv);
    if (Number.isFinite(n)) out.terminalValue = n;
  }
  return out;
}

// ---- Helpers ----

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
