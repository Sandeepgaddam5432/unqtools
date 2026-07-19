/**
 * Sales Commission Tracker — pure logic.
 *
 * Track sales commissions per rep with four calculation models:
 * flat-percent, tiered-percent (progressive brackets),
 * base-plus-percent, and bonus-per-deal. Pure functions only —
 * no DOM, no network.
 */

export type CommissionType =
  | "flat-percent"
  | "tiered-percent"
  | "base-plus-percent"
  | "bonus-per-deal";

export type PayoutFrequency = "monthly" | "quarterly" | "annually";

export type DealStatus = "closed-won" | "closed-lost" | "open";

export type StatusFilter = "all" | DealStatus;

export interface Deal {
  dealName: string;
  salesRep: string;
  amount: number;
  closeDate: string; // YYYY-MM-DD
  status: DealStatus;
}

export interface ParsedDeal extends Deal {
  /** 1-based source line number for error reporting. */
  line: number;
  /** Validation warnings (non-fatal). */
  warnings: string[];
}

export interface Tier {
  minAmount: number;
  percent: number;
}

export interface DealWithCommission extends Deal {
  commission: number;
  payoutPeriod: string;
}

export interface RepTotals {
  salesRep: string;
  dealCount: number;
  closedWonCount: number;
  totalAmount: number;
  totalCommission: number;
  avgCommissionPerDeal: number;
}

export interface PayoutBucket {
  period: string;
  dealCount: number;
  totalCommission: number;
}

export interface CommissionParams {
  type: CommissionType;
  baseCommission: number;
  commissionPercent: number;
  tiers: Tier[];
  bonusPerDeal: number;
}

export interface SummaryStats {
  totalDeals: number;
  closedWonDeals: number;
  closedLostDeals: number;
  openDeals: number;
  totalAmount: number;
  totalCommission: number;
  averageCommissionPerDeal: number;
  topPerformer: RepTotals | null;
  repCount: number;
}

export interface CapWarning {
  dealName: string;
  salesRep: string;
  amount: number;
  commission: number;
  reason: string;
}

export const COMMISSION_TYPES: { value: CommissionType; label: string }[] = [
  { value: "flat-percent", label: "Flat %" },
  { value: "tiered-percent", label: "Tiered %" },
  { value: "base-plus-percent", label: "Base + %" },
  { value: "bonus-per-deal", label: "Bonus / Deal" },
];

export const PAYOUT_FREQUENCIES: { value: PayoutFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "closed-won", label: "Closed Won" },
  { value: "closed-lost", label: "Closed Lost" },
  { value: "open", label: "Open" },
];

export const DEFAULT_TIERS_TEXT = "0,5\n50000,10\n100000,15";

export const DEFAULT_DEALS_TEXT =
  "Acme Renewal,Alice,50000,2026-07-15,closed-won\nNewCo Demo,Bob,25000,2026-07-20,closed-won\nGlobex New,Alice,120000,2026-08-05,closed-won\nInitech Pilot,Bob,15000,2026-08-10,open\nUmbrella Renew,Charlie,80000,2026-09-01,closed-lost";

// ---- Normalize / parse ----

/** Trim and collapse internal whitespace. */
export function normalizeString(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Validate a deal status string. */
export function parseDealStatus(raw: string): DealStatus | null {
  const v = normalizeString(raw).toLowerCase().replace(/\s+/g, "-");
  if (v === "closed-won" || v === "won" || v === "closed") return "closed-won";
  if (v === "closed-lost" || v === "lost") return "closed-lost";
  if (v === "open" || v === "pending" || v === "in-progress") return "open";
  return null;
}

/** Parse a single CSV deal row. Returns null if line is blank. */
export function parseDealLine(line: string, lineNumber: number): ParsedDeal | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = splitCsvRow(trimmed);
  if (parts.length < 5) {
    return {
      line: lineNumber,
      dealName: trimmed,
      salesRep: "",
      amount: 0,
      closeDate: "",
      status: "open",
      warnings: [`Line ${lineNumber}: expected 5 fields (deal_name,sales_rep,amount,close_date,status)`],
    };
  }
  const [dealName, salesRep, amountStr, closeDate, statusStr] = parts;
  const warnings: string[] = [];
  const num = Number(amountStr.replace(/[$,\s]/g, ""));
  const amount = Number.isFinite(num) ? num : 0;
  if (!Number.isFinite(num)) {
    warnings.push(`Line ${lineNumber}: amount "${amountStr}" is not a number — using 0`);
  }
  if (amount < 0) {
    warnings.push(`Line ${lineNumber}: negative amount clamped to 0`);
  }
  const status = parseDealStatus(statusStr) ?? "open";
  if (parseDealStatus(statusStr) === null) {
    warnings.push(`Line ${lineNumber}: unknown status "${statusStr}" — defaulting to open`);
  }
  const date = normalizeString(closeDate);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    warnings.push(`Line ${lineNumber}: close_date "${date}" is not YYYY-MM-DD`);
  }
  return {
    line: lineNumber,
    dealName: normalizeString(dealName),
    salesRep: normalizeString(salesRep),
    amount: Math.max(0, amount),
    closeDate: date,
    status,
    warnings,
  };
}

/** Parse the deals textarea into an array of deals (with warnings). */
export function parseDeals(input: string): ParsedDeal[] {
  if (!input) return [];
  const lines = input.split(/\r?\n/);
  const out: ParsedDeal[] = [];
  lines.forEach((raw, i) => {
    const parsed = parseDealLine(raw, i + 1);
    if (parsed) out.push(parsed);
  });
  return out;
}

/** Parse the tiers textarea: `min_amount,percent` per line. */
export function parseTiers(input: string): Tier[] {
  if (!input) return [];
  const lines = input.split(/\r?\n/);
  const out: Tier[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",").map((s) => s.trim());
    if (parts.length < 2) continue;
    const minAmount = Number(parts[0]);
    const percent = Number(parts[1]);
    if (!Number.isFinite(minAmount) || !Number.isFinite(percent)) continue;
    out.push({ minAmount, percent });
  }
  out.sort((a, b) => a.minAmount - b.minAmount);
  return out;
}

// ---- Commission calculators ----

/** Flat percent: amount × percent / 100. */
export function calculateFlatCommission(amount: number, percent: number): number {
  if (amount <= 0 || percent <= 0) return 0;
  return (amount * percent) / 100;
}

/** Base + percent: base + (amount × percent / 100). */
export function calculateBasePlusCommission(
  amount: number,
  base: number,
  percent: number,
): number {
  const basePart = base > 0 ? base : 0;
  const pctPart = amount > 0 && percent > 0 ? (amount * percent) / 100 : 0;
  return basePart + pctPart;
}

/** Bonus per deal: flat bonus amount. */
export function calculateBonusCommission(bonusPerDeal: number): number {
  return bonusPerDeal > 0 ? bonusPerDeal : 0;
}

/**
 * Tiered commission with progressive brackets.
 * Tiers must be sorted ascending by minAmount.
 * Each bracket applies only to the portion of `amount` within that bracket.
 */
export function calculateTieredCommission(amount: number, tiers: Tier[]): number {
  if (amount <= 0 || tiers.length === 0) return 0;
  let commission = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (amount <= tier.minAmount) break;
    const nextMin = i + 1 < tiers.length ? tiers[i + 1].minAmount : Infinity;
    const bracketCeiling = Math.min(amount, nextMin);
    const bracketSize = bracketCeiling - tier.minAmount;
    if (bracketSize > 0 && tier.percent > 0) {
      commission += (bracketSize * tier.percent) / 100;
    }
  }
  return commission;
}

/** Calculate commission for a single deal based on type + params. */
export function calculateCommissionForDeal(
  deal: Deal,
  params: CommissionParams,
): number {
  if (deal.status !== "closed-won") return 0;
  switch (params.type) {
    case "flat-percent":
      return calculateFlatCommission(deal.amount, params.commissionPercent);
    case "tiered-percent":
      return calculateTieredCommission(deal.amount, params.tiers);
    case "base-plus-percent":
      return calculateBasePlusCommission(
        deal.amount,
        params.baseCommission,
        params.commissionPercent,
      );
    case "bonus-per-deal":
      return calculateBonusCommission(params.bonusPerDeal);
    default:
      return 0;
  }
}

// ---- Payout periods ----

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format a YYYY-MM-DD date as a payout period label. */
export function formatPayoutPeriod(
  dateStr: string,
  frequency: PayoutFrequency,
): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "—";
  const [y, m] = dateStr.split("-").map((n) => Number(n));
  if (!y || !m || m < 1 || m > 12) return "—";
  if (frequency === "monthly") {
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }
  if (frequency === "quarterly") {
    const q = Math.ceil(m / 3);
    return `Q${q} ${y}`;
  }
  return `${y}`;
}

// ---- Aggregation ----

/** Apply a status filter to a deal list. */
export function applyStatusFilter(deals: Deal[], filter: StatusFilter): Deal[] {
  if (filter === "all") return deals;
  return deals.filter((d) => d.status === filter);
}

/** Attach commission + payout period to each deal (closed-won only get commission). */
export function attachCommission(
  deals: Deal[],
  params: CommissionParams,
  frequency: PayoutFrequency,
): DealWithCommission[] {
  return deals.map((d) => {
    const commission = calculateCommissionForDeal(d, params);
    const payoutPeriod = formatPayoutPeriod(d.closeDate, frequency);
    return { ...d, commission, payoutPeriod };
  });
}

/** Compute per-rep totals across the (commission-attached) deal list. */
export function computePerRepTotals(deals: DealWithCommission[]): RepTotals[] {
  const map = new Map<string, DealWithCommission[]>();
  for (const d of deals) {
    const rep = d.salesRep || "(unassigned)";
    if (!map.has(rep)) map.set(rep, []);
    map.get(rep)!.push(d);
  }
  const out: RepTotals[] = [];
  for (const [rep, list] of map) {
    const closedWon = list.filter((d) => d.status === "closed-won");
    const totalAmount = closedWon.reduce((s, d) => s + d.amount, 0);
    const totalCommission = closedWon.reduce((s, d) => s + d.commission, 0);
    out.push({
      salesRep: rep,
      dealCount: list.length,
      closedWonCount: closedWon.length,
      totalAmount,
      totalCommission,
      avgCommissionPerDeal: closedWon.length > 0
        ? totalCommission / closedWon.length
        : 0,
    });
  }
  return out;
}

/** Sort reps by total commission descending — the leaderboard. */
export function sortLeaderboard(reps: RepTotals[]): RepTotals[] {
  return [...reps].sort((a, b) => b.totalCommission - a.totalCommission);
}

/** Find the top performer (highest total commission). */
export function findTopPerformer(reps: RepTotals[]): RepTotals | null {
  if (reps.length === 0) return null;
  return reps.reduce((top, r) => (r.totalCommission > top.totalCommission ? r : top), reps[0]);
}

/** Average commission per closed-won deal. */
export function computeAverageCommission(deals: DealWithCommission[]): number {
  const closedWon = deals.filter((d) => d.status === "closed-won");
  if (closedWon.length === 0) return 0;
  const total = closedWon.reduce((s, d) => s + d.commission, 0);
  return total / closedWon.length;
}

/** Group closed-won commissions by payout period. */
export function generatePayoutSchedule(
  deals: DealWithCommission[],
  frequency: PayoutFrequency,
): PayoutBucket[] {
  const map = new Map<string, { dealCount: number; totalCommission: number }>();
  for (const d of deals) {
    if (d.status !== "closed-won") continue;
    const period = formatPayoutPeriod(d.closeDate, frequency);
    if (!map.has(period)) map.set(period, { dealCount: 0, totalCommission: 0 });
    const bucket = map.get(period)!;
    bucket.dealCount += 1;
    bucket.totalCommission += d.commission;
  }
  const out: PayoutBucket[] = [];
  for (const [period, b] of map) {
    out.push({ period, dealCount: b.dealCount, totalCommission: b.totalCommission });
  }
  // Sort by period ascending. For mixed frequencies this is alphanumeric-ish.
  out.sort((a, b) => a.period.localeCompare(b.period));
  return out;
}

/** Compute the full summary stats block. */
export function computeSummary(
  deals: DealWithCommission[],
  reps: RepTotals[],
): SummaryStats {
  const closedWon = deals.filter((d) => d.status === "closed-won");
  const closedLost = deals.filter((d) => d.status === "closed-lost");
  const open = deals.filter((d) => d.status === "open");
  const totalAmount = closedWon.reduce((s, d) => s + d.amount, 0);
  const totalCommission = closedWon.reduce((s, d) => s + d.commission, 0);
  return {
    totalDeals: deals.length,
    closedWonDeals: closedWon.length,
    closedLostDeals: closedLost.length,
    openDeals: open.length,
    totalAmount,
    totalCommission,
    averageCommissionPerDeal: computeAverageCommission(deals),
    topPerformer: findTopPerformer(reps),
    repCount: reps.length,
  };
}

/** Detect cap warnings — commission that exceeds the deal amount. */
export function detectCommissionCaps(deals: DealWithCommission[]): CapWarning[] {
  const out: CapWarning[] = [];
  for (const d of deals) {
    if (d.status !== "closed-won") continue;
    if (d.amount > 0 && d.commission > d.amount) {
      out.push({
        dealName: d.dealName,
        salesRep: d.salesRep,
        amount: d.amount,
        commission: d.commission,
        reason: `Commission ($${d.commission.toFixed(2)}) exceeds deal amount ($${d.amount.toFixed(2)}) — check percent/tiers`,
      });
    }
  }
  return out;
}

// ---- Renderers ----

export function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

/** Render per-rep summary as a plain text report. */
export function renderTextReport(
  reps: RepTotals[],
  summary: SummaryStats,
  schedule: PayoutBucket[],
): string {
  const lines: string[] = [];
  lines.push("=== Commission Report ===");
  lines.push(`Total deals:        ${summary.totalDeals}`);
  lines.push(`Closed-won deals:   ${summary.closedWonDeals}`);
  lines.push(`Closed-lost deals:  ${summary.closedLostDeals}`);
  lines.push(`Open deals:         ${summary.openDeals}`);
  lines.push(`Total closed amount: ${formatCurrency(summary.totalAmount)}`);
  lines.push(`Total commission:    ${formatCurrency(summary.totalCommission)}`);
  lines.push(`Avg commission/deal: ${formatCurrency(summary.averageCommissionPerDeal)}`);
  lines.push(`Reps:                ${summary.repCount}`);
  if (summary.topPerformer) {
    lines.push(`Top performer:       ${summary.topPerformer.salesRep} (${formatCurrency(summary.topPerformer.totalCommission)})`);
  }
  lines.push("");
  lines.push("=== Per-Rep Leaderboard (sorted by commission) ===");
  const sorted = sortLeaderboard(reps);
  sorted.forEach((r, i) => {
    lines.push(
      `${i + 1}. ${r.salesRep} — deals: ${r.dealCount}, closed-won: ${r.closedWonCount}, amount: ${formatCurrency(r.totalAmount)}, commission: ${formatCurrency(r.totalCommission)}, avg: ${formatCurrency(r.avgCommissionPerDeal)}`,
    );
  });
  if (schedule.length > 0) {
    lines.push("");
    lines.push("=== Payout Schedule ===");
    schedule.forEach((b) => {
      lines.push(`${b.period}: ${b.dealCount} deal(s), ${formatCurrency(b.totalCommission)}`);
    });
  }
  return lines.join("\n");
}

/** Render deals as CSV: deal_name,sales_rep,amount,close_date,status,commission,payout_period. */
export function renderCsv(deals: DealWithCommission[]): string {
  const lines = ["deal_name,sales_rep,amount,close_date,status,commission,payout_period"];
  for (const d of deals) {
    lines.push([
      escapeCsv(d.dealName),
      escapeCsv(d.salesRep),
      d.amount.toFixed(2),
      d.closeDate,
      d.status,
      d.commission.toFixed(2),
      escapeCsv(d.payoutPeriod),
    ].join(","));
  }
  return lines.join("\n");
}

/** Split CSV row honoring quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:commission-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: CommissionType;
  dealCount: number;
  repCount: number;
  totalCommission: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
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

export interface ShareState {
  type: CommissionType;
  baseCommission: number;
  commissionPercent: number;
  bonusPerDeal: number;
  deals: string;
  tiers: string;
  frequency: PayoutFrequency;
  statusFilter: StatusFilter;
}

const VALID_TYPES: CommissionType[] = [
  "flat-percent", "tiered-percent", "base-plus-percent", "bonus-per-deal",
];
const VALID_FREQS: PayoutFrequency[] = ["monthly", "quarterly", "annually"];
const VALID_FILTERS: StatusFilter[] = ["all", "closed-won", "closed-lost", "open"];

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("type", state.type);
  params.set("base", String(state.baseCommission));
  params.set("pct", String(state.commissionPercent));
  params.set("bonus", String(state.bonusPerDeal));
  params.set("freq", state.frequency);
  params.set("filter", state.statusFilter);
  if (state.deals) params.set("deals", state.deals);
  if (state.tiers) params.set("tiers", state.tiers);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const type = params.get("type");
  if (type && VALID_TYPES.includes(type as CommissionType)) out.type = type as CommissionType;
  const base = Number(params.get("base"));
  if (Number.isFinite(base)) out.baseCommission = base;
  const pct = Number(params.get("pct"));
  if (Number.isFinite(pct)) out.commissionPercent = pct;
  const bonus = Number(params.get("bonus"));
  if (Number.isFinite(bonus)) out.bonusPerDeal = bonus;
  const freq = params.get("freq");
  if (freq && VALID_FREQS.includes(freq as PayoutFrequency)) out.frequency = freq as PayoutFrequency;
  const filter = params.get("filter");
  if (filter && VALID_FILTERS.includes(filter as StatusFilter)) out.statusFilter = filter as StatusFilter;
  const deals = params.get("deals");
  if (deals) out.deals = deals;
  const tiers = params.get("tiers");
  if (tiers) out.tiers = tiers;
  return out;
}
