/**
 * Competitor Website Analyzer — pure logic.
 *
 * Compare your domain against competitors across multiple SEO dimensions.
 * Paste CSV (`domain,metric,value`) and the tool pivots into a comparison
 * matrix, finds the leader per metric, ranks your domain, identifies
 * quick wins and critical gaps. Pure functions only — no DOM, no network.
 */

export type MetricDirection = "higher-better" | "lower-better";

export type MetricKey =
  | "organic_traffic"
  | "organic_keywords"
  | "backlinks"
  | "referring_domains"
  | "domain_authority"
  | "page_authority"
  | "avg_position"
  | "pages_indexed"
  | "load_time_ms"
  | "mobile_score";

export interface MetricRecord {
  domain: string;
  metric: string;
  value: number;
}

export interface MetricStats {
  metric: string;
  direction: MetricDirection;
  values: Record<string, number | null>;
  min: number;
  max: number;
  avg: number;
  leader: string | null;
  leaderValue: number | null;
  yourValue: number | null;
  yourRank: number | null;
  gapAbs: number | null;
  gapPct: number | null;
}

export interface AnalysisResult {
  yourDomain: string;
  domains: string[];
  metrics: MetricStats[];
  strengths: MetricStats[];
  weaknesses: MetricStats[];
  quickWins: MetricStats[];
  criticalGaps: MetricStats[];
  yourWins: number;
  yourCriticalGaps: number;
}

export const METRIC_DIRECTIONS: Record<MetricKey, MetricDirection> = {
  organic_traffic: "higher-better",
  organic_keywords: "higher-better",
  backlinks: "higher-better",
  referring_domains: "higher-better",
  domain_authority: "higher-better",
  page_authority: "higher-better",
  avg_position: "lower-better",
  pages_indexed: "higher-better",
  load_time_ms: "lower-better",
  mobile_score: "higher-better",
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  organic_traffic: "Organic Traffic",
  organic_keywords: "Organic Keywords",
  backlinks: "Backlinks",
  referring_domains: "Referring Domains",
  domain_authority: "Domain Authority",
  page_authority: "Page Authority",
  avg_position: "Avg Position",
  pages_indexed: "Pages Indexed",
  load_time_ms: "Load Time (ms)",
  mobile_score: "Mobile Score",
};

export const METRIC_KEYS: MetricKey[] = [
  "organic_traffic",
  "organic_keywords",
  "backlinks",
  "referring_domains",
  "domain_authority",
  "page_authority",
  "avg_position",
  "pages_indexed",
  "load_time_ms",
  "mobile_score",
];

const VALID_METRICS_SET = new Set<string>(METRIC_KEYS);

const CSV_HEADER_RE = /^(domain|url|site|metric),/i;

/** Split a CSV row, handling quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** Normalize a domain: lowercase, strip protocol/path, trim. */
export function normalizeDomain(s: string): string {
  let d = (s || "").toLowerCase().trim();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0];
  return d.trim();
}

/** Normalize a metric key. */
export function normalizeMetric(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, "_").trim();
}

/** Get direction for a metric (default higher-better for unknown). */
export function getMetricDirection(metric: string): MetricDirection {
  return METRIC_DIRECTIONS[metric as MetricKey] ?? "higher-better";
}

/** Get display label for a metric. */
export function getMetricLabel(metric: string): string {
  return METRIC_LABELS[metric as MetricKey] ?? metric.replace(/_/g, " ");
}

/** Format a number for display. */
export function formatNumber(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "k";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

/** Parse the pasted metrics CSV blob. */
export function parseMetricsCsv(input: string): { rows: MetricRecord[]; errors: string[] } {
  if (!input || !input.trim()) return { rows: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: [] };
  const firstLine = lines[0].toLowerCase();
  const hasHeader = CSV_HEADER_RE.test(firstLine);
  const startIdx = hasHeader ? 1 : 0;
  let colMap: { domain: number; metric: number; value: number } | null = null;
  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    const domainIdx = headers.findIndex((h) => h === "domain" || h === "url" || h === "site");
    const metricIdx = headers.findIndex((h) => h === "metric" || h === "kpi");
    const valueIdx = headers.findIndex((h) => h === "value" || h === "amount" || h === "count");
    if (domainIdx >= 0 && metricIdx >= 0 && valueIdx >= 0) {
      colMap = { domain: domainIdx, metric: metricIdx, value: valueIdx };
    }
  }
  const rows: MetricRecord[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    let domain: string, metric: string, valueStr: string;
    if (colMap) {
      domain = normalizeDomain(cols[colMap.domain] ?? "");
      metric = normalizeMetric(cols[colMap.metric] ?? "");
      valueStr = (cols[colMap.value] ?? "").trim();
    } else {
      domain = normalizeDomain(cols[0] ?? "");
      metric = normalizeMetric(cols[1] ?? "");
      valueStr = (cols[2] ?? "").trim();
    }
    if (!domain || !metric) {
      errors.push(`Row ${i + 1}: missing domain or metric — skipped`);
      continue;
    }
    if (!VALID_METRICS_SET.has(metric)) {
      errors.push(`Row ${i + 1}: unknown metric "${metric}" — skipped`);
      continue;
    }
    const value = parseFloat(valueStr);
    if (!Number.isFinite(value)) {
      errors.push(`Row ${i + 1}: invalid value "${valueStr}" — skipped`);
      continue;
    }
    rows.push({ domain, metric, value });
  }
  return { rows, errors };
}

/** Build a comparison matrix (domains × metrics). */
export function buildComparisonMatrix(records: MetricRecord[]): {
  domains: string[];
  metrics: string[];
  cells: Record<string, Record<string, number | null>>;
} {
  const domainSet = new Set<string>();
  const metricSet = new Set<string>();
  for (const r of records) {
    domainSet.add(r.domain);
    metricSet.add(r.metric);
  }
  const domains = Array.from(domainSet).sort();
  const metrics = Array.from(metricSet).sort();
  const cells: Record<string, Record<string, number | null>> = {};
  for (const d of domains) {
    cells[d] = {};
    for (const m of metrics) cells[d][m] = null;
  }
  for (const r of records) {
    cells[r.domain][r.metric] = r.value;
  }
  return { domains, metrics, cells };
}

/** Find the leader for a metric based on direction. */
export function findLeader(
  values: Record<string, number | null>,
  direction: MetricDirection,
): { leader: string | null; leaderValue: number | null } {
  let best: { domain: string; value: number } | null = null;
  for (const [domain, v] of Object.entries(values)) {
    if (v === null || !Number.isFinite(v)) continue;
    if (best === null) {
      best = { domain, value: v };
    } else if (direction === "higher-better" && v > best.value) {
      best = { domain, value: v };
    } else if (direction === "lower-better" && v < best.value) {
      best = { domain, value: v };
    }
  }
  if (best === null) return { leader: null, leaderValue: null };
  return { leader: best.domain, leaderValue: best.value };
}

/** Compute your rank for a metric (1 = best). */
export function computeYourRank(
  values: Record<string, number | null>,
  yourValue: number | null,
  direction: MetricDirection,
): number | null {
  if (yourValue === null || !Number.isFinite(yourValue)) return null;
  let better = 0;
  for (const v of Object.values(values)) {
    if (v === null || !Number.isFinite(v)) continue;
    if (direction === "higher-better" && v > yourValue) better++;
    else if (direction === "lower-better" && v < yourValue) better++;
  }
  return better + 1;
}

/** Compute gap to leader (absolute + percentage). */
export function computeGapToLeader(
  yourValue: number | null,
  leaderValue: number | null,
  direction: MetricDirection,
): { gapAbs: number | null; gapPct: number | null } {
  if (yourValue === null || leaderValue === null) {
    return { gapAbs: null, gapPct: null };
  }
  if (!Number.isFinite(yourValue) || !Number.isFinite(leaderValue)) {
    return { gapAbs: null, gapPct: null };
  }
  // Gap is how far you are from leader — always positive.
  // For higher-better: gap = leader - you (if you're behind)
  // For lower-better: gap = you - leader (if you're behind)
  const gapAbs = direction === "higher-better"
    ? Math.round((leaderValue - yourValue) * 1000) / 1000
    : Math.round((yourValue - leaderValue) * 1000) / 1000;
  // Gap % relative to leader value (clamped at 0 for negative)
  let gapPct: number;
  if (leaderValue === 0) {
    gapPct = yourValue === leaderValue ? 0 : 100;
  } else {
    gapPct = (gapAbs / Math.abs(leaderValue)) * 100;
  }
  // If gapAbs is negative (you're the leader), clamp pct to 0
  if (gapAbs < 0) gapPct = 0;
  return {
    gapAbs,
    gapPct: Math.round(gapPct * 10) / 10,
  };
}

/** Compute stats for a single metric. */
export function computeMetricStats(
  metric: string,
  cells: Record<string, Record<string, number | null>>,
  yourDomain: string,
): MetricStats {
  const direction = getMetricDirection(metric);
  const values: Record<string, number | null> = {};
  const numericValues: number[] = [];
  for (const [domain, row] of Object.entries(cells)) {
    const v = row[metric] ?? null;
    values[domain] = v;
    if (v !== null && Number.isFinite(v)) numericValues.push(v);
  }
  const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;
  const avg = numericValues.length > 0
    ? Math.round((numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 1000) / 1000
    : 0;
  const { leader, leaderValue } = findLeader(values, direction);
  const yourValue = values[yourDomain] ?? null;
  const yourRank = computeYourRank(values, yourValue, direction);
  const { gapAbs, gapPct } = computeGapToLeader(yourValue, leaderValue, direction);
  return {
    metric,
    direction,
    values,
    min: Math.round(min * 1000) / 1000,
    max: Math.round(max * 1000) / 1000,
    avg,
    leader,
    leaderValue,
    yourValue,
    yourRank,
    gapAbs,
    gapPct,
  };
}

/** Compute full analysis. */
export function analyze(
  records: MetricRecord[],
  yourDomain: string,
): AnalysisResult {
  const yd = normalizeDomain(yourDomain);
  const { domains, metrics, cells } = buildComparisonMatrix(records);
  const allMetrics = metrics.map((m) => computeMetricStats(m, cells, yd));
  // Sort by metric name for stable output
  allMetrics.sort((a, b) => a.metric.localeCompare(b.metric));

  const strengths: MetricStats[] = [];
  const weaknesses: MetricStats[] = [];
  const quickWins: MetricStats[] = [];
  const criticalGaps: MetricStats[] = [];
  let yourWins = 0;
  let yourCriticalGaps = 0;

  for (const m of allMetrics) {
    if (m.yourRank === null) continue;
    if (m.yourRank === 1) {
      strengths.push(m);
      yourWins++;
    } else if (m.gapPct !== null) {
      weaknesses.push(m);
      if (m.gapPct < 20) quickWins.push(m);
      if (m.gapPct > 50) criticalGaps.push(m);
      if (m.gapPct > 50) yourCriticalGaps++;
    }
  }

  // Sort weaknesses by gap desc (biggest gaps first)
  weaknesses.sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0));
  criticalGaps.sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0));
  quickWins.sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0));

  return {
    yourDomain: yd,
    domains,
    metrics: allMetrics,
    strengths,
    weaknesses,
    quickWins,
    criticalGaps,
    yourWins,
    yourCriticalGaps,
  };
}

/** Filter metrics by name substring. */
export function filterByMetric(metrics: MetricStats[], query: string): MetricStats[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return metrics;
  return metrics.filter((m) => m.metric.includes(q) || getMetricLabel(m.metric).toLowerCase().includes(q));
}

/** Compute summary stats. */
export function computeSummaryStats(result: AnalysisResult): {
  totalMetrics: number;
  yourWins: number;
  yourCriticalGaps: number;
  quickWinsCount: number;
  totalDomains: number;
} {
  return {
    totalMetrics: result.metrics.length,
    yourWins: result.yourWins,
    yourCriticalGaps: result.yourCriticalGaps,
    quickWinsCount: result.quickWins.length,
    totalDomains: result.domains.length,
  };
}

/** Render the analysis as a text report. */
export function renderTextReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("=== COMPETITOR ANALYSIS REPORT ===");
  lines.push(`Your domain: ${result.yourDomain}`);
  lines.push(`Competitors: ${result.domains.filter((d) => d !== result.yourDomain).join(", ") || "(none)"}`);
  lines.push(`Total metrics: ${result.metrics.length} | Wins: ${result.yourWins} | Critical gaps: ${result.yourCriticalGaps}`);
  lines.push("");
  lines.push("--- METRIC COMPARISON ---");
  for (const m of result.metrics) {
    lines.push(`▸ ${getMetricLabel(m.metric)} [${m.direction}]`);
    lines.push(`  Leader: ${m.leader ?? "—"} (${formatNumber(m.leaderValue)})`);
    lines.push(`  You: ${formatNumber(m.yourValue)} (rank #${m.yourRank ?? "—"} of ${result.domains.length})`);
    if (m.gapAbs !== null && m.gapPct !== null) {
      lines.push(`  Gap: ${formatNumber(m.gapAbs)} (${m.gapPct.toFixed(1)}%)`);
    }
    lines.push(`  Min: ${formatNumber(m.min)} | Avg: ${formatNumber(m.avg)} | Max: ${formatNumber(m.max)}`);
    lines.push("");
  }
  if (result.strengths.length > 0) {
    lines.push("--- YOUR STRENGTHS (you're the leader) ---");
    for (const s of result.strengths) lines.push(`  ✓ ${getMetricLabel(s.metric)}`);
    lines.push("");
  }
  if (result.quickWins.length > 0) {
    lines.push("--- QUICK WINS (gap < 20%) ---");
    for (const q of result.quickWins) {
      lines.push(`  ⚡ ${getMetricLabel(q.metric)} — gap ${q.gapPct?.toFixed(1)}%`);
    }
    lines.push("");
  }
  if (result.criticalGaps.length > 0) {
    lines.push("--- CRITICAL GAPS (gap > 50%) ---");
    for (const c of result.criticalGaps) {
      lines.push(`  ✗ ${getMetricLabel(c.metric)} — gap ${c.gapPct?.toFixed(1)}%`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the analysis as CSV. */
export function renderCsvReport(result: AnalysisResult): string {
  const lines = ["domain,metric,value,leader,leader_value,gap_abs,gap_pct,your_rank,direction"];
  for (const m of result.metrics) {
    for (const [domain, v] of Object.entries(m.values)) {
      const isYour = domain === result.yourDomain;
      const yourRank = isYour ? (m.yourRank ?? "") : "";
      const gapAbs = isYour ? (m.gapAbs ?? "") : "";
      const gapPct = isYour ? (m.gapPct ?? "") : "";
      lines.push([
        domain,
        m.metric,
        v ?? "",
        m.leader ?? "",
        m.leaderValue ?? "",
        gapAbs,
        gapPct,
        yourRank,
        m.direction,
      ].join(","));
    }
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:competitor-website-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  yourDomain: string;
  competitorCount: number;
  totalMetrics: number;
  yourWins: number;
  yourCriticalGaps: number;
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

export function buildShareUrl(yourDomain: string, data: string): string {
  const params = new URLSearchParams();
  if (yourDomain) params.set("you", yourDomain);
  if (data) params.set("data", data);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { yourDomain: string; data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { yourDomain: "", data: "" };
  const params = new URLSearchParams(clean);
  return {
    yourDomain: params.get("you") ?? "",
    data: params.get("data") ?? "",
  };
}
