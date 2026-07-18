/**
 * Crawl Budget Estimator — pure logic.
 *
 * Heuristic crawl-budget estimation based on site metrics + faceted-nav
 * penalty. Pure functions only — no DOM, no network.
 */

export interface CrawlInputs {
  totalPages: number;
  avgPageSizeKb: number;
  avgServerResponseMs: number;
  dailyCrawlRequests?: number;
  crawlErrorsPercent: number;
  duplicateContentPercent: number;
  facetUrlCount: number;
}

export interface CrawlEstimate {
  effectiveBudget: number;
  duplicatePenalty: number;
  facetPenalty: number;
  crawlRatePerPageMin: number;
  efficiencyPercent: number;
  timeToFullCrawlMin: number;
  score: number;
  estimatedDailyCrawlRequests: number;
}

export interface Recommendation {
  rule: string;
  message: string;
  severity: "critical" | "warning" | "info";
}

export interface ComparisonRow {
  metric: string;
  current: string;
  optimized: string;
  delta: string;
}

export interface HistoryEntry {
  ts: number;
  inputs: CrawlInputs;
  estimate: CrawlEstimate;
  recommendationCount: number;
}

export type SitePresetKey = "small" | "medium" | "large" | "enterprise";

export interface SitePreset {
  key: SitePresetKey;
  label: string;
  inputs: CrawlInputs;
}

export const SITE_PRESETS: SitePreset[] = [
  {
    key: "small",
    label: "Small (100 pages)",
    inputs: {
      totalPages: 100,
      avgPageSizeKb: 600,
      avgServerResponseMs: 250,
      crawlErrorsPercent: 2,
      duplicateContentPercent: 5,
      facetUrlCount: 20,
    },
  },
  {
    key: "medium",
    label: "Medium (1,000 pages)",
    inputs: {
      totalPages: 1000,
      avgPageSizeKb: 850,
      avgServerResponseMs: 350,
      crawlErrorsPercent: 5,
      duplicateContentPercent: 15,
      facetUrlCount: 800,
    },
  },
  {
    key: "large",
    label: "Large (10,000 pages)",
    inputs: {
      totalPages: 10000,
      avgPageSizeKb: 1100,
      avgServerResponseMs: 450,
      crawlErrorsPercent: 8,
      duplicateContentPercent: 20,
      facetUrlCount: 3000,
    },
  },
  {
    key: "enterprise",
    label: "Enterprise (50,000 pages)",
    inputs: {
      totalPages: 50000,
      avgPageSizeKb: 1400,
      avgServerResponseMs: 600,
      crawlErrorsPercent: 12,
      duplicateContentPercent: 25,
      facetUrlCount: 18000,
    },
  },
];

export const HISTORY_KEY = "unqtools:crawl-budget-estimator:history";
export const HISTORY_MAX = 20;

/** Validate and normalize inputs. Returns errors per field (empty = ok). */
export function validateInputs(inputs: Partial<CrawlInputs>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (inputs.totalPages === undefined || isNaN(inputs.totalPages) || inputs.totalPages <= 0) {
    errors.totalPages = "Total pages must be a positive number";
  } else if (inputs.totalPages > 10_000_000) {
    errors.totalPages = "Total pages must be less than 10,000,000";
  }
  if (inputs.avgPageSizeKb === undefined || isNaN(inputs.avgPageSizeKb) || inputs.avgPageSizeKb <= 0) {
    errors.avgPageSizeKb = "Avg page size must be a positive number (KB)";
  } else if (inputs.avgPageSizeKb > 50_000) {
    errors.avgPageSizeKb = "Avg page size unrealistic (>50MB)";
  }
  if (inputs.avgServerResponseMs === undefined || isNaN(inputs.avgServerResponseMs) || inputs.avgServerResponseMs <= 0) {
    errors.avgServerResponseMs = "Server response time must be positive (ms)";
  } else if (inputs.avgServerResponseMs > 30_000) {
    errors.avgServerResponseMs = "Server response time unrealistic (>30s)";
  }
  if (inputs.crawlErrorsPercent !== undefined && (isNaN(inputs.crawlErrorsPercent) || inputs.crawlErrorsPercent < 0 || inputs.crawlErrorsPercent > 100)) {
    errors.crawlErrorsPercent = "Crawl errors % must be 0–100";
  }
  if (inputs.duplicateContentPercent !== undefined && (isNaN(inputs.duplicateContentPercent) || inputs.duplicateContentPercent < 0 || inputs.duplicateContentPercent > 100)) {
    errors.duplicateContentPercent = "Duplicate content % must be 0–100";
  }
  if (inputs.facetUrlCount !== undefined && (isNaN(inputs.facetUrlCount) || inputs.facetUrlCount < 0)) {
    errors.facetUrlCount = "Facet URL count must be ≥ 0";
  }
  if (inputs.dailyCrawlRequests !== undefined && inputs.dailyCrawlRequests !== null && !isNaN(inputs.dailyCrawlRequests) && inputs.dailyCrawlRequests < 0) {
    errors.dailyCrawlRequests = "Daily crawl requests must be ≥ 0";
  }
  return errors;
}

/** Normalize inputs: clamp and fill defaults for optional fields. */
export function normalizeInputs(inputs: Partial<CrawlInputs>): CrawlInputs {
  return {
    totalPages: Math.max(1, Math.round(inputs.totalPages ?? 0)),
    avgPageSizeKb: Math.max(1, inputs.avgPageSizeKb ?? 0),
    avgServerResponseMs: Math.max(1, Math.round(inputs.avgServerResponseMs ?? 0)),
    dailyCrawlRequests: inputs.dailyCrawlRequests && inputs.dailyCrawlRequests > 0 ? Math.round(inputs.dailyCrawlRequests) : undefined,
    crawlErrorsPercent: clampPct(inputs.crawlErrorsPercent ?? 0),
    duplicateContentPercent: clampPct(inputs.duplicateContentPercent ?? 0),
    facetUrlCount: Math.max(0, Math.round(inputs.facetUrlCount ?? 0)),
  };
}

function clampPct(v: number): number {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/** Compute facet penalty (0–0.5). */
export function computeFacetPenalty(facetUrlCount: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.min(0.5, facetUrlCount / totalPages);
}

/** Compute crawl budget estimate from inputs. */
export function computeEstimate(inputs: CrawlInputs): CrawlEstimate {
  const facetPenalty = computeFacetPenalty(inputs.facetUrlCount, inputs.totalPages);
  const duplicatePenalty = inputs.duplicateContentPercent / 100;
  const effectiveBudget = Math.max(
    0,
    Math.round(inputs.totalPages * (1 - duplicatePenalty) * (1 - facetPenalty)),
  );

  // Crawl rate heuristic (pages/min)
  const denom = inputs.avgServerResponseMs + inputs.avgPageSizeKb / 10;
  const crawlRatePerPageMin = denom > 0 ? 60000 / denom : 0;

  const efficiencyPercent = inputs.totalPages > 0
    ? (effectiveBudget / inputs.totalPages) * 100
    : 0;

  const timeToFullCrawlMin = crawlRatePerPageMin > 0 ? inputs.totalPages / crawlRatePerPageMin : Infinity;

  // Estimated daily crawl requests = rate × 60 min/hour × ~6 active crawl hours
  const estimatedDailyCrawlRequests = Math.round(crawlRatePerPageMin * 60 * 6);

  // Score 0-100: weighted blend of efficiency, errors, response time, page size
  const efficiencyScore = Math.max(0, Math.min(100, efficiencyPercent));
  const errorsScore = Math.max(0, 100 - inputs.crawlErrorsPercent * 4);
  const responseScore = inputs.avgServerResponseMs <= 200 ? 100
    : Math.max(0, 100 - (inputs.avgServerResponseMs - 200) / 8);
  const sizeScore = inputs.avgPageSizeKb <= 500 ? 100
    : Math.max(0, 100 - (inputs.avgPageSizeKb - 500) / 20);
  const score = Math.round(
    efficiencyScore * 0.4 + errorsScore * 0.2 + responseScore * 0.2 + sizeScore * 0.2,
  );

  return {
    effectiveBudget,
    duplicatePenalty,
    facetPenalty,
    crawlRatePerPageMin,
    efficiencyPercent,
    timeToFullCrawlMin,
    score,
    estimatedDailyCrawlRequests,
  };
}

/** Generate recommendations from inputs + estimate. */
export function generateRecommendations(inputs: CrawlInputs, est: CrawlEstimate): Recommendation[] {
  const recs: Recommendation[] = [];

  if (inputs.duplicateContentPercent > 10) {
    recs.push({
      rule: "duplicate-content",
      message: "Add canonical tags to duplicate pages and consolidate parameter variants.",
      severity: inputs.duplicateContentPercent > 25 ? "critical" : "warning",
    });
  }
  if (inputs.totalPages > 0 && inputs.facetUrlCount / inputs.totalPages > 0.3) {
    recs.push({
      rule: "facet-nav",
      message: "Block faceted nav params in robots.txt and use rel=canonical to root URL.",
      severity: "warning",
    });
  }
  if (inputs.avgServerResponseMs > 500) {
    recs.push({
      rule: "ttfb",
      message: "Optimize server response time (TTFB) — target under 200ms via CDN + caching.",
      severity: inputs.avgServerResponseMs > 1000 ? "critical" : "warning",
    });
  }
  if (inputs.avgPageSizeKb > 1000) {
    recs.push({
      rule: "page-size",
      message: "Compress images, enable Brotli, lazy-load below-the-fold media.",
      severity: inputs.avgPageSizeKb > 2000 ? "critical" : "warning",
    });
  }
  if (inputs.crawlErrorsPercent > 5) {
    recs.push({
      rule: "crawl-errors",
      message: "Fix crawl errors in Google Search Console — 404s, 5xx, soft 404s.",
      severity: inputs.crawlErrorsPercent > 15 ? "critical" : "warning",
    });
  }
  if (est.efficiencyPercent < 70) {
    recs.push({
      rule: "internal-linking",
      message: "Improve internal linking to deep pages — add XML sitemap + hub pages.",
      severity: est.efficiencyPercent < 40 ? "critical" : "info",
    });
  }
  if (recs.length === 0) {
    recs.push({
      rule: "all-clear",
      message: "No major crawl-budget issues detected. Continue monitoring in GSC.",
      severity: "info",
    });
  }
  return recs;
}

/** Map score 0-100 to a color label. */
export function scoreColor(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "emerald" };
  if (score >= 60) return { label: "Good", color: "lime" };
  if (score >= 40) return { label: "Fair", color: "amber" };
  if (score >= 20) return { label: "Poor", color: "orange" };
  return { label: "Critical", color: "red" };
}

/** Format minutes → human readable (min / hours / days). */
export function formatTime(minutes: number): string {
  if (!isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

/** Format large numbers (1.2K, 3.4M). */
export function formatNumber(n: number): string {
  if (!isFinite(n)) return "—";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** Build comparison rows between current and optimized inputs. */
export function buildComparison(
  current: CrawlInputs,
  optimized: CrawlInputs,
): ComparisonRow[] {
  const ce = computeEstimate(current);
  const oe = computeEstimate(optimized);
  const rows: ComparisonRow[] = [];
  rows.push({
    metric: "Effective crawl budget",
    current: formatNumber(ce.effectiveBudget),
    optimized: formatNumber(oe.effectiveBudget),
    delta: formatDelta(oe.effectiveBudget - ce.effectiveBudget),
  });
  rows.push({
    metric: "Crawl rate (pages/min)",
    current: ce.crawlRatePerPageMin.toFixed(2),
    optimized: oe.crawlRatePerPageMin.toFixed(2),
    delta: formatDelta(oe.crawlRatePerPageMin - ce.crawlRatePerPageMin),
  });
  rows.push({
    metric: "Crawl efficiency %",
    current: `${ce.efficiencyPercent.toFixed(1)}%`,
    optimized: `${oe.efficiencyPercent.toFixed(1)}%`,
    delta: formatDelta(oe.efficiencyPercent - ce.efficiencyPercent, "%"),
  });
  rows.push({
    metric: "Time to full crawl",
    current: formatTime(ce.timeToFullCrawlMin),
    optimized: formatTime(oe.timeToFullCrawlMin),
    delta: formatDelta(oe.timeToFullCrawlMin - ce.timeToFullCrawlMin, " min"),
  });
  rows.push({
    metric: "Score (0-100)",
    current: String(ce.score),
    optimized: String(oe.score),
    delta: formatDelta(oe.score - ce.score),
  });
  return rows;
}

function formatDelta(diff: number, unit = ""): string {
  if (!isFinite(diff)) return "—";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}${unit}`;
}

/** Render estimate as text report. */
export function renderTextReport(
  inputs: CrawlInputs,
  est: CrawlEstimate,
  recs: Recommendation[],
): string {
  const lines: string[] = [];
  lines.push("=== Crawl Budget Estimator Report ===");
  lines.push("");
  lines.push("INPUTS");
  lines.push(`  Total pages:              ${formatNumber(inputs.totalPages)}`);
  lines.push(`  Avg page size:            ${inputs.avgPageSizeKb} KB`);
  lines.push(`  Avg server response time: ${inputs.avgServerResponseMs} ms`);
  lines.push(`  Crawl errors:             ${inputs.crawlErrorsPercent}%`);
  lines.push(`  Duplicate content:        ${inputs.duplicateContentPercent}%`);
  lines.push(`  Faceted-nav URL count:    ${formatNumber(inputs.facetUrlCount)}`);
  if (inputs.dailyCrawlRequests) {
    lines.push(`  Daily crawl requests:     ${formatNumber(inputs.dailyCrawlRequests)}`);
  }
  lines.push("");
  lines.push("ESTIMATES");
  lines.push(`  Effective crawl budget:   ${formatNumber(est.effectiveBudget)} pages`);
  lines.push(`  Duplicate penalty:        ${(est.duplicatePenalty * 100).toFixed(1)}%`);
  lines.push(`  Facet penalty:            ${(est.facetPenalty * 100).toFixed(1)}%`);
  lines.push(`  Crawl rate:               ${est.crawlRatePerPageMin.toFixed(2)} pages/min`);
  lines.push(`  Crawl efficiency:         ${est.efficiencyPercent.toFixed(1)}%`);
  lines.push(`  Time to full crawl:       ${formatTime(est.timeToFullCrawlMin)}`);
  lines.push(`  Est. daily crawl reqs:    ${formatNumber(est.estimatedDailyCrawlRequests)}`);
  lines.push(`  Crawl score:              ${est.score}/100 (${scoreColor(est.score).label})`);
  lines.push("");
  lines.push("RECOMMENDATIONS");
  if (recs.length === 0) {
    lines.push("  (none)");
  } else {
    recs.forEach((r, i) => {
      lines.push(`  ${i + 1}. [${r.severity.toUpperCase()}] ${r.message}`);
    });
  }
  lines.push("");
  lines.push("--- Generated by UnQTools Crawl Budget Estimator (100% client-side) ---");
  return lines.join("\n");
}

/** Render inputs + estimate as CSV. */
export function renderCsv(
  inputs: CrawlInputs,
  est: CrawlEstimate,
  recs: Recommendation[],
): string {
  const lines: string[] = [];
  lines.push("metric,value");
  lines.push(`total_pages,${inputs.totalPages}`);
  lines.push(`avg_page_size_kb,${inputs.avgPageSizeKb}`);
  lines.push(`avg_server_response_ms,${inputs.avgServerResponseMs}`);
  lines.push(`crawl_errors_percent,${inputs.crawlErrorsPercent}`);
  lines.push(`duplicate_content_percent,${inputs.duplicateContentPercent}`);
  lines.push(`facet_url_count,${inputs.facetUrlCount}`);
  if (inputs.dailyCrawlRequests) {
    lines.push(`daily_crawl_requests,${inputs.dailyCrawlRequests}`);
  }
  lines.push(`effective_budget,${est.effectiveBudget}`);
  lines.push(`duplicate_penalty,${(est.duplicatePenalty * 100).toFixed(2)}`);
  lines.push(`facet_penalty,${(est.facetPenalty * 100).toFixed(2)}`);
  lines.push(`crawl_rate_per_min,${est.crawlRatePerPageMin.toFixed(4)}`);
  lines.push(`efficiency_percent,${est.efficiencyPercent.toFixed(2)}`);
  lines.push(`time_to_full_crawl_min,${isFinite(est.timeToFullCrawlMin) ? est.timeToFullCrawlMin.toFixed(2) : "inf"}`);
  lines.push(`est_daily_crawl_requests,${est.estimatedDailyCrawlRequests}`);
  lines.push(`score,${est.score}`);
  lines.push("");
  lines.push("rule,severity,message");
  for (const r of recs) {
    lines.push([r.rule, r.severity, escapeCsv(r.message)].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

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

export function buildShareUrl(inputs: CrawlInputs): string {
  const params = new URLSearchParams();
  params.set("pages", String(inputs.totalPages));
  params.set("size", String(inputs.avgPageSizeKb));
  params.set("ttfb", String(inputs.avgServerResponseMs));
  params.set("errors", String(inputs.crawlErrorsPercent));
  params.set("dup", String(inputs.duplicateContentPercent));
  params.set("facet", String(inputs.facetUrlCount));
  if (inputs.dailyCrawlRequests) {
    params.set("daily", String(inputs.dailyCrawlRequests));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<CrawlInputs> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<CrawlInputs> = {};
  const pages = numParam(params, "pages");
  if (pages !== undefined) out.totalPages = pages;
  const size = numParam(params, "size");
  if (size !== undefined) out.avgPageSizeKb = size;
  const ttfb = numParam(params, "ttfb");
  if (ttfb !== undefined) out.avgServerResponseMs = ttfb;
  const errors = numParam(params, "errors");
  if (errors !== undefined) out.crawlErrorsPercent = errors;
  const dup = numParam(params, "dup");
  if (dup !== undefined) out.duplicateContentPercent = dup;
  const facet = numParam(params, "facet");
  if (facet !== undefined) out.facetUrlCount = facet;
  const daily = numParam(params, "daily");
  if (daily !== undefined && daily > 0) out.dailyCrawlRequests = daily;
  return out;
}

function numParam(params: URLSearchParams, key: string): number | undefined {
  const v = params.get(key);
  if (v === null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
