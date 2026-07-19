/**
 * Sales Pipeline Tracker — pure logic.
 *
 * Track sales pipeline deals across 6 stages, compute weighted value,
 * win rate, average deal size, and produce text + CSV reports.
 * Pure functions only — no DOM, no network.
 */

export type Stage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed-won"
  | "closed-lost";

export type StageFilter = "all" | Stage;

export interface StagePreset {
  stage: Stage;
  label: string;
  defaultProbability: number; // 0-100
  closed: boolean;
  won: boolean;
}

export const STAGE_PRESETS: StagePreset[] = [
  { stage: "lead", label: "Lead", defaultProbability: 10, closed: false, won: false },
  { stage: "qualified", label: "Qualified", defaultProbability: 25, closed: false, won: false },
  { stage: "proposal", label: "Proposal", defaultProbability: 50, closed: false, won: false },
  { stage: "negotiation", label: "Negotiation", defaultProbability: 75, closed: false, won: false },
  { stage: "closed-won", label: "Closed Won", defaultProbability: 100, closed: true, won: true },
  { stage: "closed-lost", label: "Closed Lost", defaultProbability: 0, closed: true, won: false },
];

export const STAGE_LABELS: Record<Stage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  "closed-won": "Closed Won",
  "closed-lost": "Closed Lost",
};

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCY_PRESETS: CurrencyOption[] = [
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen (¥)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
];

export interface Deal {
  dealName: string;
  customer: string;
  stage: Stage;
  amount: number;
  probability: number; // 0-100
  expectedCloseDate: string; // YYYY-MM-DD or ""
  lineIndex: number; // 1-based
}

export interface ParsedDeals {
  deals: Deal[];
  errors: string[];
}

export interface PipelineInput {
  dealsText: string;
  stageFilter: StageFilter;
  dateRangeStart: string; // YYYY-MM-DD or ""
  dateRangeEnd: string; // YYYY-MM-DD or ""
  currencySymbol: string;
  today: string; // YYYY-MM-DD used for stale detection
}

export const DEFAULT_INPUT: PipelineInput = {
  dealsText: "",
  stageFilter: "all",
  dateRangeStart: "",
  dateRangeEnd: "",
  currencySymbol: "$",
  today: "",
};

export interface StageBreakdownRow {
  stage: Stage;
  label: string;
  count: number;
  totalAmount: number;
  weightedValue: number;
  defaultProbability: number;
}

export interface PipelineStats {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  weightedPipeline: number;
  wonAmount: number;
  lostAmount: number;
  winRate: number;
  averageDealSize: number;
  staleCount: number;
  topDeal: Deal | null;
}

// ---------- Normalization ----------

const STAGE_ALIASES: Record<string, Stage> = {
  lead: "lead",
  "new": "lead",
  qualified: "qualified",
  "qual": "qualified",
  proposal: "proposal",
  "prop": "proposal",
  negotiation: "negotiation",
  "negotiate": "negotiation",
  "closed-won": "closed-won",
  "closedwon": "closed-won",
  "won": "closed-won",
  "closed-lost": "closed-lost",
  "closedlost": "closed-lost",
  "lost": "closed-lost",
};

/** Normalize a stage string into a Stage enum or null if unknown. */
export function normalizeStage(s: string): Stage | null {
  const lower = (s || "").toLowerCase().trim().replace(/\s+/g, "-");
  if (!lower) return null;
  if (lower in STAGE_ALIASES) return STAGE_ALIASES[lower];
  // also try without hyphen (e.g. "closedwon")
  const squashed = lower.replace(/-/g, "");
  if (squashed in STAGE_ALIASES) return STAGE_ALIASES[squashed];
  return null;
}

/** Get the default probability for a stage. Returns 0 for unknown. */
export function defaultProbabilityForStage(stage: Stage): number {
  const preset = STAGE_PRESETS.find((p) => p.stage === stage);
  return preset ? preset.defaultProbability : 0;
}

/** Return true if the deal is open (not closed-won or closed-lost). */
export function isOpen(deal: Deal): boolean {
  return deal.stage !== "closed-won" && deal.stage !== "closed-lost";
}

// ---------- Date validation ----------

/** Validate a date string in YYYY-MM-DD format (strict). */
export function isValidDate(s: string): boolean {
  if (!s) return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

// ---------- CSV row splitter ----------

/** Split a CSV row, supporting quoted fields with embedded commas. */
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

// ---------- Parsing ----------

/** Parse the deals textarea. Collects errors instead of throwing. */
export function parseDeals(text: string): ParsedDeals {
  const deals: Deal[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { deals, errors };
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue; // comment
    const lineIndex = i + 1;
    const fields = splitCsvRow(line);
    if (fields.length < 4) {
      errors.push(
        `Line ${lineIndex}: expected at least 4 fields (deal_name,customer,stage,amount), got ${fields.length}`,
      );
      continue;
    }
    const dealName = fields[0].trim();
    const customer = fields[1].trim();
    const stageRaw = fields[2].trim();
    const amountStr = fields[3].trim();
    const probabilityStr = (fields[4] ?? "").trim();
    const expectedCloseDate = (fields[5] ?? "").trim();

    if (!dealName) {
      errors.push(`Line ${lineIndex}: empty deal name`);
      continue;
    }
    if (!customer) {
      errors.push(`Line ${lineIndex}: empty customer`);
      continue;
    }
    const stage = normalizeStage(stageRaw);
    if (!stage) {
      errors.push(
        `Line ${lineIndex}: unknown stage "${stageRaw}" (use: lead, qualified, proposal, negotiation, closed-won, closed-lost)`,
      );
      continue;
    }
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push(`Line ${lineIndex}: invalid amount "${amountStr}"`);
      continue;
    }
    let probability: number;
    if (probabilityStr) {
      probability = Number(probabilityStr);
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
        errors.push(`Line ${lineIndex}: invalid probability "${probabilityStr}" (must be 0-100)`);
        continue;
      }
    } else {
      probability = defaultProbabilityForStage(stage);
    }
    if (expectedCloseDate && !isValidDate(expectedCloseDate)) {
      errors.push(`Line ${lineIndex}: invalid close date "${expectedCloseDate}" (use YYYY-MM-DD)`);
      continue;
    }
    deals.push({
      dealName,
      customer,
      stage,
      amount,
      probability,
      expectedCloseDate,
      lineIndex,
    });
  }
  return { deals, errors };
}

// ---------- Filtering ----------

/** Filter deals by stage. "all" returns the full list. */
export function filterByStage(deals: Deal[], stageFilter: StageFilter): Deal[] {
  if (stageFilter === "all") return deals;
  return deals.filter((d) => d.stage === stageFilter);
}

/** Filter deals by expected close date range (inclusive). Empty bounds = open. */
export function filterByDateRange(
  deals: Deal[],
  start: string,
  end: string,
): Deal[] {
  if (!start && !end) return deals;
  return deals.filter((d) => {
    // Deals with no close date are always included (unbounded).
    if (!d.expectedCloseDate) return true;
    if (start && d.expectedCloseDate < start) return false;
    if (end && d.expectedCloseDate > end) return false;
    return true;
  });
}

/** Apply stage + date range filters in one call. */
export function applyFilters(
  deals: Deal[],
  stageFilter: StageFilter,
  dateRangeStart: string,
  dateRangeEnd: string,
): Deal[] {
  const byStage = filterByStage(deals, stageFilter);
  return filterByDateRange(byStage, dateRangeStart, dateRangeEnd);
}

// ---------- Calculations ----------

/** Weighted value for a single deal = amount × probability / 100. */
export function computeWeightedValue(deal: Deal): number {
  return (deal.amount * deal.probability) / 100;
}

/** Sum of all OPEN deal amounts (potential revenue not yet closed). */
export function computePipelineValue(deals: Deal[]): number {
  return deals.filter(isOpen).reduce((s, d) => s + d.amount, 0);
}

/** Sum of weighted values for OPEN deals (probability-adjusted expected revenue). */
export function computeWeightedPipeline(deals: Deal[]): number {
  return deals.filter(isOpen).reduce((s, d) => s + computeWeightedValue(d), 0);
}

/** Per-stage breakdown: count, total amount, weighted value. Returns rows in stage order. */
export function computeStageBreakdown(deals: Deal[]): StageBreakdownRow[] {
  const rows: StageBreakdownRow[] = STAGE_PRESETS.map((p) => ({
    stage: p.stage,
    label: p.label,
    count: 0,
    totalAmount: 0,
    weightedValue: 0,
    defaultProbability: p.defaultProbability,
  }));
  const byStage = new Map<Stage, StageBreakdownRow>();
  for (const row of rows) byStage.set(row.stage, row);
  for (const d of deals) {
    const row = byStage.get(d.stage);
    if (!row) continue;
    row.count += 1;
    row.totalAmount += d.amount;
    row.weightedValue += computeWeightedValue(d);
  }
  return rows;
}

/** Win rate = closed-won / (closed-won + closed-lost) × 100. Returns 0 if no closed deals. */
export function computeWinRate(deals: Deal[]): number {
  const won = deals.filter((d) => d.stage === "closed-won").length;
  const lost = deals.filter((d) => d.stage === "closed-lost").length;
  const total = won + lost;
  if (total === 0) return 0;
  return (won / total) * 100;
}

/** Average deal size across all deals. */
export function computeAverageDealSize(deals: Deal[]): number {
  if (deals.length === 0) return 0;
  return deals.reduce((s, d) => s + d.amount, 0) / deals.length;
}

/** Return the top N deals by amount (descending). */
export function findTopDeals(deals: Deal[], limit: number = 5): Deal[] {
  return [...deals].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** Find stale deals: open deals whose expected close date is before `today`. */
export function findStaleDeals(deals: Deal[], today: string): Deal[] {
  if (!today) return [];
  return deals.filter((d) => isOpen(d) && d.expectedCloseDate && d.expectedCloseDate < today);
}

/** Compute all summary stats in one pass. */
export function summaryStats(deals: Deal[], today: string = ""): PipelineStats {
  const open = deals.filter(isOpen);
  const won = deals.filter((d) => d.stage === "closed-won");
  const lost = deals.filter((d) => d.stage === "closed-lost");
  const pipelineValue = open.reduce((s, d) => s + d.amount, 0);
  const weightedPipeline = open.reduce((s, d) => s + computeWeightedValue(d), 0);
  const wonAmount = won.reduce((s, d) => s + d.amount, 0);
  const lostAmount = lost.reduce((s, d) => s + d.amount, 0);
  const winRate = computeWinRate(deals);
  const averageDealSize = computeAverageDealSize(deals);
  const staleCount = findStaleDeals(deals, today).length;
  const topDeal = deals.length > 0 ? findTopDeals(deals, 1)[0] : null;
  return {
    totalDeals: deals.length,
    openDeals: open.length,
    wonDeals: won.length,
    lostDeals: lost.length,
    pipelineValue,
    weightedPipeline,
    wonAmount,
    lostAmount,
    winRate,
    averageDealSize,
    staleCount,
    topDeal,
  };
}

// ---------- Formatting ----------

/** Format a money value with 2 decimals + currency symbol. */
export function formatMoney(amount: number, symbol: string = "$"): string {
  if (!Number.isFinite(amount)) return `${symbol}0.00`;
  return `${symbol}${amount.toFixed(2)}`;
}

/** Format a percentage with 1 decimal. */
export function formatPercentage(pct: number): string {
  if (!Number.isFinite(pct)) return "0.0%";
  return `${pct.toFixed(1)}%`;
}

// ---------- Rendering ----------

/** Render as a plain text pipeline report (summary + by-stage + stale + deals list). */
export function renderText(input: PipelineInput, deals: Deal[]): string {
  if (deals.length === 0) return "No deals to report.";
  const symbol = input.currencySymbol || "$";
  const stats = summaryStats(deals, input.today);
  const breakdown = computeStageBreakdown(deals);
  const stale = findStaleDeals(deals, input.today);
  const lines: string[] = [];
  lines.push("=== Sales Pipeline Report ===");
  if (input.stageFilter !== "all") {
    lines.push(`Stage filter: ${STAGE_LABELS[input.stageFilter]}`);
  }
  if (input.dateRangeStart || input.dateRangeEnd) {
    lines.push(`Close date range: ${input.dateRangeStart || "…"} to ${input.dateRangeEnd || "…"}`);
  }
  lines.push(`Currency: ${symbol}`);
  lines.push("");
  lines.push("--- Summary ---");
  lines.push(`Total deals:       ${stats.totalDeals}`);
  lines.push(`Open deals:        ${stats.openDeals}`);
  lines.push(`Closed won:        ${stats.wonDeals} (${formatMoney(stats.wonAmount, symbol)})`);
  lines.push(`Closed lost:       ${stats.lostDeals} (${formatMoney(stats.lostAmount, symbol)})`);
  lines.push(`Pipeline value:    ${formatMoney(stats.pipelineValue, symbol)}`);
  lines.push(`Weighted pipeline: ${formatMoney(stats.weightedPipeline, symbol)}`);
  lines.push(`Win rate:          ${formatPercentage(stats.winRate)}`);
  lines.push(`Average deal size: ${formatMoney(stats.averageDealSize, symbol)}`);
  lines.push(`Stale deals:       ${stats.staleCount}`);
  if (stats.topDeal) {
    lines.push(
      `Top deal:          ${stats.topDeal.dealName} — ${formatMoney(stats.topDeal.amount, symbol)} [${STAGE_LABELS[stats.topDeal.stage]}]`,
    );
  }
  lines.push("");
  lines.push("--- By Stage ---");
  for (const row of breakdown) {
    lines.push(
      `${row.label.padEnd(13)} ${String(row.count).padStart(3)} deals  ${formatMoney(row.totalAmount, symbol).padStart(12)}  weighted ${formatMoney(row.weightedValue, symbol).padStart(12)}  (default ${row.defaultProbability}%)`,
    );
  }
  if (stale.length > 0) {
    lines.push("");
    lines.push("--- Stale Deals (open, past expected close date) ---");
    for (const d of stale) {
      lines.push(
        `${d.dealName} — ${d.customer} — expected ${d.expectedCloseDate} — ${formatMoney(d.amount, symbol)} [${STAGE_LABELS[d.stage]}]`,
      );
    }
  }
  lines.push("");
  lines.push("--- Deals ---");
  for (const d of deals) {
    lines.push(
      `${d.dealName} | ${d.customer} | ${STAGE_LABELS[d.stage]} | ${formatMoney(d.amount, symbol)} | ${d.probability}% | weighted ${formatMoney(computeWeightedValue(d), symbol)} | ${d.expectedCloseDate || "(no close date)"}`,
    );
  }
  return lines.join("\n");
}

/** Render as CSV (deal_name, customer, stage, amount, probability, weighted_value, expected_close_date). */
export function renderCsv(deals: Deal[]): string {
  const lines = ["deal_name,customer,stage,amount,probability,weighted_value,expected_close_date"];
  for (const d of deals) {
    lines.push([
      escapeCsv(d.dealName),
      escapeCsv(d.customer),
      d.stage,
      d.amount.toFixed(2),
      d.probability.toString(),
      computeWeightedValue(d).toFixed(2),
      d.expectedCloseDate,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Re-exported for tests
export { escapeCsv as _escapeCsv };

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:sales-pipeline-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dealsText: string;
  dealCount: number;
  pipelineValue: number;
  weightedPipeline: number;
  winRate: number;
  currencySymbol: string;
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

// ---------- Shareable URL ----------

const VALID_STAGES: Stage[] = STAGE_PRESETS.map((p) => p.stage);

export function buildShareUrl(input: PipelineInput): string {
  const params = new URLSearchParams();
  if (input.dealsText) params.set("deals", input.dealsText);
  if (input.stageFilter && input.stageFilter !== "all") params.set("stage", input.stageFilter);
  if (input.dateRangeStart) params.set("from", input.dateRangeStart);
  if (input.dateRangeEnd) params.set("to", input.dateRangeEnd);
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): PipelineInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_INPUT };
  const params = new URLSearchParams(clean);
  const stageRaw = params.get("stage");
  const stageFilter: StageFilter =
    stageRaw && (VALID_STAGES as string[]).includes(stageRaw) ? (stageRaw as Stage) : "all";
  const cur = params.get("cur");
  const currencySymbol =
    cur && CURRENCY_PRESETS.some((c) => c.symbol === cur) ? cur : DEFAULT_INPUT.currencySymbol;
  return {
    dealsText: params.get("deals") ?? "",
    stageFilter,
    dateRangeStart: params.get("from") ?? "",
    dateRangeEnd: params.get("to") ?? "",
    currencySymbol,
    today: "",
  };
}
