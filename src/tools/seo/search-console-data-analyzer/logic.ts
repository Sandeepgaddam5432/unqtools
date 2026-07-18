/**
 * Search Console Data Analyzer — pure logic.
 *
 * Parse Google Search Console CSV exports and surface SEO opportunities:
 * - Aggregate by URL and by query
 * - Find high-impression low-CTR queries
 * - Find striking-distance keywords (positions 5-15)
 * - Find low-position high-impression pages
 * - Find high-position low-impression pages
 * - Generate optimization recommendations
 *
 * Pure functions only — no DOM, no network.
 */

export type OpportunityType =
  | "high-imp-low-ctr"
  | "low-pos-high-imp"
  | "high-pos-low-imp"
  | "striking-distance"
  | "none";

export interface SearchConsoleRecord {
  url: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // percentage (e.g. 3.0 = 3%)
  position: number; // average SERP position
}

export interface RecordWithOpportunity extends SearchConsoleRecord {
  opportunity: OpportunityType;
}

export interface UrlAggregate {
  url: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  queryCount: number;
}

export interface QueryAggregate {
  query: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  urlCount: number;
}

export interface SiteStats {
  totalRecords: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  urlCount: number;
  queryCount: number;
  opportunityCount: number;
}

export interface SummaryStats {
  totalUrls: number;
  totalQueries: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  opportunityCount: number;
}

export interface Recommendation {
  type: OpportunityType;
  url: string;
  query: string;
  message: string;
}

export type FilterMode = OpportunityType | "all";

export const OPPORTUNITY_LABELS: Record<OpportunityType, string> = {
  "high-imp-low-ctr": "High-impression / Low-CTR",
  "low-pos-high-imp": "Low-position / High-impression",
  "high-pos-low-imp": "High-position / Low-impression",
  "striking-distance": "Striking distance (pos 5-15)",
  "none": "No opportunity",
};

/** Thresholds for opportunity detection. */
export const THRESHOLDS = {
  highImpressionLowCtr: {
    minImpressions: 1000,
    maxCtr: 2,
  },
  lowPositionHighImp: {
    minPosition: 11, // page 2+
    minImpressions: 500,
  },
  highPositionLowImp: {
    maxPosition: 10, // page 1
    maxImpressions: 100,
  },
  strikingDistance: {
    minPosition: 5,
    maxPosition: 15,
  },
};

/** Normalize a URL (preserve case for path, trim whitespace). */
export function normalizeUrl(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Normalize a query (lowercase, collapse whitespace). */
export function normalizeQuery(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
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

/** Calculate CTR percentage = clicks / impressions × 100. Returns 0 if impressions=0. */
export function calculateCtr(clicks: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return (clicks / impressions) * 100;
}

/** Find a column index by case-insensitive name match. */
function findColumnIndex(
  headers: string[],
  candidates: string[],
): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Parse CSV into records. Header row required (case-insensitive column names). */
export function parseCsv(csv: string): SearchConsoleRecord[] {
  if (!csv) return [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.trim());
  const urlIdx = findColumnIndex(headers, ["url", "page", "landing page", "landing_page"]);
  const queryIdx = findColumnIndex(headers, ["query", "keyword", "term"]);
  const clicksIdx = findColumnIndex(headers, ["clicks"]);
  const impressionsIdx = findColumnIndex(headers, ["impressions", "impr"]);
  const ctrIdx = findColumnIndex(headers, ["ctr", "ctr (%)", "click-through rate"]);
  const positionIdx = findColumnIndex(headers, ["position", "avg position", "average position", "pos"]);

  if (urlIdx === -1 || queryIdx === -1 || clicksIdx === -1 || impressionsIdx === -1 || positionIdx === -1) {
    return [];
  }

  const out: SearchConsoleRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    const url = normalizeUrl(cells[urlIdx] ?? "");
    const query = normalizeQuery(cells[queryIdx] ?? "");
    if (!url || !query) continue;
    const clicks = Number((cells[clicksIdx] ?? "").trim());
    const impressions = Number((cells[impressionsIdx] ?? "").trim());
    const position = Number((cells[positionIdx] ?? "").trim());
    if (!Number.isFinite(clicks) || !Number.isFinite(impressions) || !Number.isFinite(position)) continue;
    let ctr: number;
    if (ctrIdx !== -1) {
      const raw = (cells[ctrIdx] ?? "").trim();
      const parsed = Number(raw.replace("%", ""));
      ctr = Number.isFinite(parsed) ? parsed : calculateCtr(clicks, impressions);
    } else {
      ctr = calculateCtr(clicks, impressions);
    }
    out.push({
      url,
      query,
      clicks: Math.max(0, clicks),
      impressions: Math.max(0, impressions),
      ctr: Math.round(ctr * 100) / 100,
      position,
    });
  }
  return out;
}

/** Validate a record: numeric checks, position > 0. */
export function validateRecord(r: SearchConsoleRecord): boolean {
  if (!r.url || !r.query) return false;
  if (!Number.isFinite(r.clicks) || r.clicks < 0) return false;
  if (!Number.isFinite(r.impressions) || r.impressions < 0) return false;
  if (!Number.isFinite(r.ctr) || r.ctr < 0) return false;
  if (!Number.isFinite(r.position) || r.position <= 0) return false;
  return true;
}

/** Filter records that pass validation. */
export function filterValid(records: SearchConsoleRecord[]): SearchConsoleRecord[] {
  return records.filter(validateRecord);
}

/** Assign opportunity type to a single record. */
export function assignOpportunity(r: SearchConsoleRecord): OpportunityType {
  // Striking distance: position 5-15
  if (
    r.position >= THRESHOLDS.strikingDistance.minPosition &&
    r.position <= THRESHOLDS.strikingDistance.maxPosition
  ) {
    return "striking-distance";
  }
  // High-impression low-CTR
  if (
    r.impressions >= THRESHOLDS.highImpressionLowCtr.minImpressions &&
    r.ctr < THRESHOLDS.highImpressionLowCtr.maxCtr
  ) {
    return "high-imp-low-ctr";
  }
  // Low-position high-impression (page 2+)
  if (
    r.position >= THRESHOLDS.lowPositionHighImp.minPosition &&
    r.impressions >= THRESHOLDS.lowPositionHighImp.minImpressions
  ) {
    return "low-pos-high-imp";
  }
  // High-position low-impression (page 1 with low volume)
  if (
    r.position <= THRESHOLDS.highPositionLowImp.maxPosition &&
    r.impressions <= THRESHOLDS.highPositionLowImp.maxImpressions
  ) {
    return "high-pos-low-imp";
  }
  return "none";
}

/** Annotate records with their opportunity type. */
export function annotateOpportunities(
  records: SearchConsoleRecord[],
): RecordWithOpportunity[] {
  return records.map((r) => ({ ...r, opportunity: assignOpportunity(r) }));
}

/** Aggregate records by URL. */
export function aggregateByUrl(records: SearchConsoleRecord[]): UrlAggregate[] {
  const map = new Map<string, SearchConsoleRecord[]>();
  for (const r of records) {
    if (!map.has(r.url)) map.set(r.url, []);
    map.get(r.url)!.push(r);
  }
  const out: UrlAggregate[] = [];
  for (const [url, list] of map) {
    const totalClicks = list.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = list.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions === 0 ? 0 : (totalClicks / totalImpressions) * 100;
    const avgPosition =
      list.reduce((s, r) => s + r.position, 0) / list.length;
    out.push({
      url,
      totalClicks,
      totalImpressions,
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgPosition: Math.round(avgPosition * 100) / 100,
      queryCount: list.length,
    });
  }
  out.sort((a, b) => b.totalClicks - a.totalClicks);
  return out;
}

/** Aggregate records by query. */
export function aggregateByQuery(records: SearchConsoleRecord[]): QueryAggregate[] {
  const map = new Map<string, SearchConsoleRecord[]>();
  for (const r of records) {
    if (!map.has(r.query)) map.set(r.query, []);
    map.get(r.query)!.push(r);
  }
  const out: QueryAggregate[] = [];
  for (const [query, list] of map) {
    const totalClicks = list.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = list.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions === 0 ? 0 : (totalClicks / totalImpressions) * 100;
    const avgPosition = list.reduce((s, r) => s + r.position, 0) / list.length;
    out.push({
      query,
      totalClicks,
      totalImpressions,
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgPosition: Math.round(avgPosition * 100) / 100,
      urlCount: list.length,
    });
  }
  out.sort((a, b) => b.totalClicks - a.totalClicks);
  return out;
}

/** Top N pages by clicks. */
export function topPages(
  urlAgg: UrlAggregate[],
  n: number = 10,
): UrlAggregate[] {
  return urlAgg.slice(0, n);
}

/** Top N queries by clicks. */
export function topQueries(
  queryAgg: QueryAggregate[],
  n: number = 10,
): QueryAggregate[] {
  return queryAgg.slice(0, n);
}

/** Find high-impression low-CTR records (impressions ≥ 1000 AND CTR < 2%). */
export function findHighImpressionLowCtr(
  records: SearchConsoleRecord[],
): SearchConsoleRecord[] {
  return records.filter(
    (r) =>
      r.impressions >= THRESHOLDS.highImpressionLowCtr.minImpressions &&
      r.ctr < THRESHOLDS.highImpressionLowCtr.maxCtr,
  );
}

/** Find striking-distance keywords (positions 5-15). */
export function findStrikingDistance(
  records: SearchConsoleRecord[],
): SearchConsoleRecord[] {
  return records.filter(
    (r) =>
      r.position >= THRESHOLDS.strikingDistance.minPosition &&
      r.position <= THRESHOLDS.strikingDistance.maxPosition,
  );
}

/** Find low-position high-impression records (page 2+ with impressions ≥ 500). */
export function findLowPositionHighImp(
  records: SearchConsoleRecord[],
): SearchConsoleRecord[] {
  return records.filter(
    (r) =>
      r.position >= THRESHOLDS.lowPositionHighImp.minPosition &&
      r.impressions >= THRESHOLDS.lowPositionHighImp.minImpressions,
  );
}

/** Find high-position low-impression records (page 1 with impressions ≤ 100). */
export function findHighPositionLowImp(
  records: SearchConsoleRecord[],
): SearchConsoleRecord[] {
  return records.filter(
    (r) =>
      r.position <= THRESHOLDS.highPositionLowImp.maxPosition &&
      r.impressions <= THRESHOLDS.highPositionLowImp.maxImpressions,
  );
}

/** Generate optimization recommendations from records. */
export function generateRecommendations(
  records: SearchConsoleRecord[],
  maxPerType: number = 5,
): Recommendation[] {
  const out: Recommendation[] = [];
  const hil = findHighImpressionLowCtr(records).sort((a, b) => b.impressions - a.impressions);
  for (const r of hil.slice(0, maxPerType)) {
    out.push({
      type: "high-imp-low-ctr",
      url: r.url,
      query: r.query,
      message: `Improve title tag and meta description for ${r.url} to boost CTR for '${r.query}' (CTR ${r.ctr}%, ${r.impressions} impressions).`,
    });
  }
  const lphi = findLowPositionHighImp(records).sort((a, b) => b.impressions - a.impressions);
  for (const r of lphi.slice(0, maxPerType)) {
    out.push({
      type: "low-pos-high-imp",
      url: r.url,
      query: r.query,
      message: `Improve content depth for ${r.url} targeting '${r.query}' (position ${r.position}, ${r.impressions} impressions).`,
    });
  }
  const sd = findStrikingDistance(records).sort((a, b) => a.position - b.position);
  for (const r of sd.slice(0, maxPerType)) {
    out.push({
      type: "striking-distance",
      url: r.url,
      query: r.query,
      message: `Add internal links + optimize ${r.url} for '${r.query}' — already at position ${r.position} (${r.impressions} impressions).`,
    });
  }
  const hpli = findHighPositionLowImp(records).sort((a, b) => a.position - b.position);
  for (const r of hpli.slice(0, maxPerType)) {
    out.push({
      type: "high-pos-low-imp",
      url: r.url,
      query: r.query,
      message: `Expand content on ${r.url} for '${r.query}' — page 1 (position ${r.position}) but only ${r.impressions} impressions.`,
    });
  }
  return out;
}

/** Compute site-level totals. */
export function computeSiteStats(records: SearchConsoleRecord[]): SiteStats {
  const totalClicks = records.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = records.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions === 0 ? 0 : (totalClicks / totalImpressions) * 100;
  const avgPosition =
    records.length === 0
      ? 0
      : records.reduce((s, r) => s + r.position, 0) / records.length;
  const urlSet = new Set(records.map((r) => r.url));
  const querySet = new Set(records.map((r) => r.query));
  const annotated = annotateOpportunities(records);
  const opportunityCount = annotated.filter((r) => r.opportunity !== "none").length;
  return {
    totalRecords: records.length,
    totalClicks,
    totalImpressions,
    avgCtr: Math.round(avgCtr * 100) / 100,
    avgPosition: Math.round(avgPosition * 100) / 100,
    urlCount: urlSet.size,
    queryCount: querySet.size,
    opportunityCount,
  };
}

/** Filter records by opportunity type. */
export function filterByOpportunity(
  records: RecordWithOpportunity[],
  mode: FilterMode,
): RecordWithOpportunity[] {
  if (mode === "all") return records;
  return records.filter((r) => r.opportunity === mode);
}

/** Compute summary stats. */
export function computeSummaryStats(
  records: SearchConsoleRecord[],
): SummaryStats {
  const site = computeSiteStats(records);
  return {
    totalUrls: site.urlCount,
    totalQueries: site.queryCount,
    totalClicks: site.totalClicks,
    totalImpressions: site.totalImpressions,
    avgCtr: site.avgCtr,
    avgPosition: site.avgPosition,
    opportunityCount: site.opportunityCount,
  };
}

/** Format a number with thousands separators. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("en-US");
}

/** Render the analysis as a text report. */
export function renderText(
  records: SearchConsoleRecord[],
  recommendations: Recommendation[],
): string {
  const lines: string[] = [];
  const stats = computeSiteStats(records);
  lines.push("SEARCH CONSOLE DATA ANALYZER REPORT");
  lines.push("=".repeat(60));
  lines.push(`Total records: ${stats.totalRecords}`);
  lines.push(`Unique URLs: ${stats.urlCount}`);
  lines.push(`Unique queries: ${stats.queryCount}`);
  lines.push(`Total clicks: ${formatNumber(stats.totalClicks)}`);
  lines.push(`Total impressions: ${formatNumber(stats.totalImpressions)}`);
  lines.push(`Average CTR: ${stats.avgCtr}%`);
  lines.push(`Average position: ${stats.avgPosition}`);
  lines.push(`Opportunity records: ${stats.opportunityCount}`);

  const top = topPages(aggregateByUrl(records), 5);
  if (top.length > 0) {
    lines.push("");
    lines.push("TOP 5 PAGES (by clicks)");
    lines.push("-".repeat(60));
    for (const p of top) {
      lines.push(`${p.url} | clicks=${p.totalClicks} | impr=${p.totalImpressions} | ctr=${p.avgCtr}% | pos=${p.avgPosition}`);
    }
  }
  const tq = topQueries(aggregateByQuery(records), 5);
  if (tq.length > 0) {
    lines.push("");
    lines.push("TOP 5 QUERIES (by clicks)");
    lines.push("-".repeat(60));
    for (const q of tq) {
      lines.push(`${q.query} | clicks=${q.totalClicks} | impr=${q.totalImpressions} | ctr=${q.avgCtr}% | pos=${q.avgPosition}`);
    }
  }
  const hil = findHighImpressionLowCtr(records);
  if (hil.length > 0) {
    lines.push("");
    lines.push(`HIGH-IMPRESSION LOW-CTR (${hil.length})`);
    lines.push("-".repeat(60));
    for (const r of hil.slice(0, 10)) {
      lines.push(`${r.url} | '${r.query}' | impr=${r.impressions} | ctr=${r.ctr}% | pos=${r.position}`);
    }
  }
  const sd = findStrikingDistance(records);
  if (sd.length > 0) {
    lines.push("");
    lines.push(`STRIKING-DISTANCE KEYWORDS (${sd.length})`);
    lines.push("-".repeat(60));
    for (const r of sd.slice(0, 10)) {
      lines.push(`${r.url} | '${r.query}' | pos=${r.position} | impr=${r.impressions} | clicks=${r.clicks}`);
    }
  }
  const lphi = findLowPositionHighImp(records);
  if (lphi.length > 0) {
    lines.push("");
    lines.push(`LOW-POSITION HIGH-IMPRESSION (${lphi.length})`);
    lines.push("-".repeat(60));
    for (const r of lphi.slice(0, 10)) {
      lines.push(`${r.url} | '${r.query}' | pos=${r.position} | impr=${r.impressions}`);
    }
  }
  const hpli = findHighPositionLowImp(records);
  if (hpli.length > 0) {
    lines.push("");
    lines.push(`HIGH-POSITION LOW-IMPRESSION (${hpli.length})`);
    lines.push("-".repeat(60));
    for (const r of hpli.slice(0, 10)) {
      lines.push(`${r.url} | '${r.query}' | pos=${r.position} | impr=${r.impressions}`);
    }
  }
  if (recommendations.length > 0) {
    lines.push("");
    lines.push("RECOMMENDATIONS");
    lines.push("-".repeat(60));
    for (const rec of recommendations) {
      lines.push(`[${rec.type}] ${rec.message}`);
    }
  }
  return lines.join("\n");
}

/** Render annotated records as CSV. */
export function renderCsv(records: RecordWithOpportunity[]): string {
  const lines = ["url,query,clicks,impressions,ctr,position,opportunity_type"];
  for (const r of records) {
    lines.push([
      escapeCsv(r.url),
      escapeCsv(r.query),
      String(r.clicks),
      String(r.impressions),
      String(r.ctr),
      String(r.position),
      r.opportunity,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:search-console-data-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  records: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  opportunityCount: number;
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

export function buildShareUrl(csv: string): string {
  const params = new URLSearchParams();
  if (csv) params.set("csv", csv);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): string {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return "";
  const params = new URLSearchParams(clean);
  return params.get("csv") ?? "";
}
