/**
 * SEO Experiment Tracker — pure logic.
 *
 * Track SEO A/B experiments (title tag, meta description, content changes).
 * Parse before/after CSV, compute deltas, % change, winners/losers,
 * significance, recommendation, status, confidence score.
 *
 * Pure functions only — no DOM, no network.
 */

export type ExperimentType =
  | "title-tag"
  | "meta-description"
  | "content-change"
  | "url-structure"
  | "internal-linking";

export type ControlMetric =
  | "organic-traffic"
  | "rankings"
  | "clicks"
  | "impressions"
  | "conversions";

export type ExperimentStatus = "planned" | "running" | "completed" | "paused";

export type PageCategory = "winner" | "loser" | "neutral";

export type Significance = "winning" | "losing" | "inconclusive";

export type Recommendation = "roll-out" | "roll-back" | "extend-test";

export type FilterMode = "all" | "winners" | "losers";

export interface PageMetric {
  page: string;
  before: number;
  after: number;
}

export interface PageMetricResult extends PageMetric {
  delta: number;
  pctChange: number;
  category: PageCategory;
}

export interface AggregateMetrics {
  totalBefore: number;
  totalAfter: number;
  totalDelta: number;
  totalPctChange: number;
  avgPctChange: number;
  winners: number;
  losers: number;
  neutral: number;
}

export interface ExperimentInput {
  name: string;
  type: ExperimentType;
  hypothesis: string;
  startDate: string;
  endDate: string;
  pagesAffected: number;
  controlMetric: ControlMetric;
  beforeData: string;
  afterData: string;
}

export interface ExperimentResult {
  pages: PageMetricResult[];
  aggregate: AggregateMetrics;
  significance: Significance;
  recommendation: Recommendation;
  status: ExperimentStatus;
  confidence: number;
}

export interface SummaryStats {
  totalPages: number;
  winners: number;
  losers: number;
  neutral: number;
  avgPctChange: number;
  totalDelta: number;
  significance: Significance;
  status: ExperimentStatus;
  recommendation: Recommendation;
  confidence: number;
}

export const EXPERIMENT_TYPE_PRESETS: Record<
  ExperimentType,
  { label: string; hypothesis: string }
> = {
  "title-tag": {
    label: "Title Tag",
    hypothesis:
      "Updating the title tag to include the primary keyword earlier will increase organic clicks and improve CTR.",
  },
  "meta-description": {
    label: "Meta Description",
    hypothesis:
      "Rewriting meta descriptions with a clearer value proposition and call-to-action will increase CTR from search results.",
  },
  "content-change": {
    label: "Content Change",
    hypothesis:
      "Expanding content depth and adding related subtopics will improve rankings and organic traffic.",
  },
  "url-structure": {
    label: "URL Structure",
    hypothesis:
      "Shortening URLs and including the target keyword will improve crawlability and rankings.",
  },
  "internal-linking": {
    label: "Internal Linking",
    hypothesis:
      "Adding contextual internal links from high-authority pages will boost rankings and traffic to target pages.",
  },
};

export const CONTROL_METRIC_PRESETS: Record<ControlMetric, string> = {
  "organic-traffic": "Organic Traffic",
  "rankings": "Rankings",
  "clicks": "Clicks",
  "impressions": "Impressions",
  "conversions": "Conversions",
};

export const SIGNIFICANCE_LABELS: Record<Significance, string> = {
  "winning": "Winning",
  "losing": "Losing",
  "inconclusive": "Inconclusive",
};

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  "roll-out": "Roll out to all pages",
  "roll-back": "Roll back the change",
  "extend-test": "Extend the test",
};

export const STATUS_LABELS: Record<ExperimentStatus, string> = {
  "planned": "Planned",
  "running": "Running",
  "completed": "Completed",
  "paused": "Paused",
};

/** Today as YYYY-MM-DD (UTC). */
export function todayIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normalize a page identifier (lowercase, collapse whitespace). */
export function normalizePage(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Validate a YYYY-MM-DD date string. */
export function isValidDate(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

/** Split CSV row with quoted values. */
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

/** Parse a single before/after CSV (page,metric_value). */
export function parseMetricCsv(csv: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!csv) return map;
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return map;
  let startIdx = 0;
  const firstCells = splitCsvRow(lines[0]).map((c) => c.trim().toLowerCase());
  if (firstCells.length >= 2) {
    const c0 = firstCells[0];
    const c1 = firstCells[1];
    if (
      (c0 === "page" || c0 === "url" || c0 === "path") &&
      (c1.includes("metric") || c1.includes("value") || c1 === "clicks" ||
        c1 === "traffic" || c1 === "impressions" || c1 === "conversions")
    ) {
      startIdx = 1;
    }
  }
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    if (cells.length < 2) continue;
    const page = normalizePage(cells[0] ?? "");
    if (!page) continue;
    const val = Number((cells[1] ?? "").trim());
    if (!Number.isFinite(val)) continue;
    map.set(page, val);
  }
  return map;
}

/** Parse before/after CSV and pair rows by page name. */
export function parseBeforeAfterCsv(
  beforeCsv: string,
  afterCsv: string,
): PageMetric[] {
  const beforeMap = parseMetricCsv(beforeCsv);
  const afterMap = parseMetricCsv(afterCsv);
  const allPages = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
  const pages: PageMetric[] = [];
  for (const page of allPages) {
    const before = beforeMap.get(page);
    const after = afterMap.get(page);
    if (before === undefined || after === undefined) continue;
    pages.push({ page, before, after });
  }
  pages.sort((a, b) => a.page.localeCompare(b.page));
  return pages;
}

/** Per-page delta = after - before. */
export function computePageDelta(p: PageMetric): number {
  return p.after - p.before;
}

/** Per-page % change. before=0 → 0 (avoid divide by zero). */
export function computePagePctChange(p: PageMetric): number {
  if (p.before === 0) return 0;
  return ((p.after - p.before) / p.before) * 100;
}

/** Categorize a page by % change: winner (>5%), loser (<-5%), neutral (else). */
export function categorizePage(pctChange: number): PageCategory {
  if (pctChange > 5) return "winner";
  if (pctChange < -5) return "loser";
  return "neutral";
}

/** Convert a PageMetric to a PageMetricResult. */
export function scorePage(p: PageMetric): PageMetricResult {
  const delta = computePageDelta(p);
  const pctChange = Math.round(computePagePctChange(p) * 100) / 100;
  return {
    ...p,
    delta,
    pctChange,
    category: categorizePage(pctChange),
  };
}

/** Score all pages. */
export function scoreAllPages(pages: PageMetric[]): PageMetricResult[] {
  return pages.map(scorePage);
}

/** Compute aggregate metrics from scored pages. */
export function computeAggregate(pages: PageMetricResult[]): AggregateMetrics {
  if (pages.length === 0) {
    return {
      totalBefore: 0,
      totalAfter: 0,
      totalDelta: 0,
      totalPctChange: 0,
      avgPctChange: 0,
      winners: 0,
      losers: 0,
      neutral: 0,
    };
  }
  let totalBefore = 0;
  let totalAfter = 0;
  let sumPct = 0;
  let winners = 0;
  let losers = 0;
  let neutral = 0;
  for (const p of pages) {
    totalBefore += p.before;
    totalAfter += p.after;
    sumPct += p.pctChange;
    if (p.category === "winner") winners++;
    else if (p.category === "loser") losers++;
    else neutral++;
  }
  const totalDelta = totalAfter - totalBefore;
  const totalPctChange = totalBefore === 0 ? 0 : (totalDelta / totalBefore) * 100;
  const avgPctChange = sumPct / pages.length;
  return {
    totalBefore,
    totalAfter,
    totalDelta,
    totalPctChange: Math.round(totalPctChange * 100) / 100,
    avgPctChange: Math.round(avgPctChange * 100) / 100,
    winners,
    losers,
    neutral,
  };
}

/** Basic significance check based on winner/loser count and magnitude. */
export function checkSignificance(agg: AggregateMetrics): Significance {
  if (agg.winners > agg.losers && agg.avgPctChange > 5) return "winning";
  if (agg.losers > agg.winners && agg.avgPctChange < -5) return "losing";
  return "inconclusive";
}

/** Compute experiment status from start/end dates. */
export function computeStatus(
  startDate: string,
  endDate: string,
  today: string = todayIso(),
): ExperimentStatus {
  if (!isValidDate(startDate) && !isValidDate(endDate)) return "planned";
  if (isValidDate(startDate) && today < startDate) return "planned";
  if (isValidDate(endDate) && today > endDate) return "completed";
  if (isValidDate(startDate) && isValidDate(endDate) && today >= startDate && today <= endDate) {
    return "running";
  }
  if (isValidDate(startDate) && !isValidDate(endDate) && today >= startDate) {
    return "running";
  }
  return "planned";
}

/** Generate recommendation from significance + status. */
export function generateRecommendation(
  significance: Significance,
  status: ExperimentStatus,
): Recommendation {
  if (status === "planned") return "extend-test";
  if (significance === "winning") return "roll-out";
  if (significance === "losing") return "roll-back";
  if (status === "running") return "extend-test";
  return "extend-test";
}

/** Confidence score 0-100 based on sample size + magnitude of change. */
export function computeConfidence(
  pagesAffected: number,
  avgPctChange: number,
): number {
  // Sample size score (0-50): 0 pages = 0, 30+ pages = 50
  const sampleScore = Math.min(50, (pagesAffected / 30) * 50);
  // Magnitude score (0-50): 0% change = 0, 20%+ = 50
  const magScore = Math.min(50, (Math.abs(avgPctChange) / 20) * 50);
  return Math.round(sampleScore + magScore);
}

/** Run the full experiment analysis. */
export function runExperiment(input: ExperimentInput): ExperimentResult {
  const pages = parseBeforeAfterCsv(input.beforeData, input.afterData);
  const scored = scoreAllPages(pages);
  const aggregate = computeAggregate(scored);
  const significance = checkSignificance(aggregate);
  const status = computeStatus(input.startDate, input.endDate);
  const recommendation = generateRecommendation(significance, status);
  const confidence = computeConfidence(
    input.pagesAffected > 0 ? input.pagesAffected : scored.length,
    aggregate.avgPctChange,
  );
  return {
    pages: scored,
    aggregate,
    significance,
    recommendation,
    status,
    confidence,
  };
}

/** Filter pages by mode. */
export function filterPages(
  pages: PageMetricResult[],
  mode: FilterMode,
): PageMetricResult[] {
  if (mode === "all") return pages;
  if (mode === "winners") return pages.filter((p) => p.category === "winner");
  if (mode === "losers") return pages.filter((p) => p.category === "loser");
  return pages;
}

/** Compute summary stats. */
export function computeSummaryStats(
  result: ExperimentResult,
): SummaryStats {
  return {
    totalPages: result.pages.length,
    winners: result.aggregate.winners,
    losers: result.aggregate.losers,
    neutral: result.aggregate.neutral,
    avgPctChange: result.aggregate.avgPctChange,
    totalDelta: result.aggregate.totalDelta,
    significance: result.significance,
    status: result.status,
    recommendation: result.recommendation,
    confidence: result.confidence,
  };
}

/** Format a number with thousands separators. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("en-US");
}

/** Render as text report. */
export function renderText(input: ExperimentInput, result: ExperimentResult): string {
  const lines: string[] = [];
  lines.push("SEO EXPERIMENT TRACKER REPORT");
  lines.push("=".repeat(60));
  lines.push(`Name: ${input.name || "(unnamed)"}`);
  lines.push(`Type: ${EXPERIMENT_TYPE_PRESETS[input.type].label}`);
  lines.push(`Control metric: ${CONTROL_METRIC_PRESETS[input.controlMetric]}`);
  lines.push(`Date range: ${input.startDate || "?"} → ${input.endDate || "?"}`);
  lines.push(`Pages affected: ${input.pagesAffected}`);
  lines.push(`Status: ${STATUS_LABELS[result.status]}`);
  lines.push(`Significance: ${SIGNIFICANCE_LABELS[result.significance]}`);
  lines.push(`Confidence: ${result.confidence}/100`);
  lines.push(`Recommendation: ${RECOMMENDATION_LABELS[result.recommendation]}`);
  if (input.hypothesis) {
    lines.push("");
    lines.push("Hypothesis:");
    lines.push(input.hypothesis);
  }
  lines.push("");
  lines.push("AGGREGATE METRICS");
  lines.push("-".repeat(60));
  lines.push(`Total before: ${formatNumber(result.aggregate.totalBefore)}`);
  lines.push(`Total after: ${formatNumber(result.aggregate.totalAfter)}`);
  lines.push(`Total delta: ${formatNumber(result.aggregate.totalDelta)}`);
  lines.push(`Total % change: ${result.aggregate.totalPctChange}%`);
  lines.push(`Average % change per page: ${result.aggregate.avgPctChange}%`);
  lines.push(`Winners: ${result.aggregate.winners}`);
  lines.push(`Losers: ${result.aggregate.losers}`);
  lines.push(`Neutral: ${result.aggregate.neutral}`);
  if (result.pages.length > 0) {
    lines.push("");
    lines.push("PER PAGE");
    lines.push("-".repeat(60));
    for (const p of result.pages) {
      const pctStr = p.before === 0 ? "n/a" : `${p.pctChange}%`;
      lines.push(
        `${p.page} | before=${p.before} | after=${p.after} | delta=${p.delta} | pct=${pctStr} | ${p.category}`,
      );
    }
  }
  return lines.join("\n");
}

/** Render as CSV. */
export function renderCsv(result: ExperimentResult): string {
  const lines = ["page,before,after,delta,pct_change,category"];
  for (const p of result.pages) {
    const pct = p.before === 0 ? "" : String(p.pctChange);
    lines.push([
      escapeCsv(p.page),
      String(p.before),
      String(p.after),
      String(p.delta),
      pct,
      p.category,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:seo-experiment-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  name: string;
  type: ExperimentType;
  controlMetric: ControlMetric;
  pages: number;
  avgPctChange: number;
  significance: Significance;
  recommendation: Recommendation;
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

export function buildShareUrl(input: ExperimentInput): string {
  const params = new URLSearchParams();
  if (input.name) params.set("name", input.name);
  if (input.type) params.set("type", input.type);
  if (input.hypothesis) params.set("hyp", input.hypothesis);
  if (input.startDate) params.set("start", input.startDate);
  if (input.endDate) params.set("end", input.endDate);
  if (input.pagesAffected) params.set("pages", String(input.pagesAffected));
  if (input.controlMetric) params.set("metric", input.controlMetric);
  if (input.beforeData) params.set("before", input.beforeData);
  if (input.afterData) params.set("after", input.afterData);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ExperimentInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ExperimentInput> = {};
  const name = params.get("name");
  if (name) out.name = name;
  const type = params.get("type");
  if (type && type in EXPERIMENT_TYPE_PRESETS) out.type = type as ExperimentType;
  const hyp = params.get("hyp");
  if (hyp) out.hypothesis = hyp;
  const start = params.get("start");
  if (start) out.startDate = start;
  const end = params.get("end");
  if (end) out.endDate = end;
  const pages = params.get("pages");
  if (pages) {
    const n = Number(pages);
    if (Number.isFinite(n) && n >= 0) out.pagesAffected = Math.floor(n);
  }
  const metric = params.get("metric");
  if (metric && metric in CONTROL_METRIC_PRESETS) out.controlMetric = metric as ControlMetric;
  const before = params.get("before");
  if (before) out.beforeData = before;
  const after = params.get("after");
  if (after) out.afterData = after;
  return out;
}
