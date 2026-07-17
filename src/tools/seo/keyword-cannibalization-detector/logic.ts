/**
 * Keyword Cannibalization Detector — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export interface PageEntry {
  url: string;
  keyword: string;
}

export interface CannibalizationCluster {
  keyword: string;
  urls: string[];
  count: number;
  severity: "high" | "medium" | "low";
  recommendation: string;
}

export interface CannibalizationReport {
  totalEntries: number;
  uniqueKeywords: number;
  clusters: CannibalizationCluster[];
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  cleanEntries: number;
}

/** Parse one-per-line "url,keyword" entries. */
export function parseEntries(input: string): PageEntry[] {
  if (!input) return [];
  const out: PageEntry[] = [];
  for (const line of input.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const commaIdx = trimmed.indexOf(",");
    if (commaIdx === -1) continue;
    const url = trimmed.slice(0, commaIdx).trim();
    const keyword = trimmed.slice(commaIdx + 1).trim();
    if (!url || !keyword) continue;
    out.push({ url, keyword });
  }
  return out;
}

/** Normalize a keyword: lowercase, collapse whitespace, trim. */
export function normalizeKeyword(keyword: string): string {
  return (keyword || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Dedup identical URL+keyword pairs (case-insensitive on keyword). */
export function dedupEntries(entries: PageEntry[]): { unique: PageEntry[]; removed: number } {
  const seen = new Set<string>();
  const unique: PageEntry[] = [];
  let removed = 0;
  for (const e of entries) {
    const key = `${e.url}::${normalizeKeyword(e.keyword)}`;
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    unique.push(e);
  }
  return { unique, removed };
}

/** Detect clusters of URLs targeting the same normalized keyword. */
export function detectClusters(entries: PageEntry[]): CannibalizationCluster[] {
  const byKw = new Map<string, Set<string>>();
  for (const e of entries) {
    const k = normalizeKeyword(e.keyword);
    if (!k) continue;
    if (!byKw.has(k)) byKw.set(k, new Set());
    byKw.get(k)!.add(e.url);
  }
  const clusters: CannibalizationCluster[] = [];
  for (const [keyword, urlSet] of byKw) {
    const urls = Array.from(urlSet);
    if (urls.length < 2) continue;
    let severity: "high" | "medium" | "low";
    let recommendation: string;
    if (urls.length >= 3) {
      severity = "high";
      recommendation = `Merge the ${urls.length} pages into one authoritative resource, or canonicalize the duplicates to the strongest URL.`;
    } else if (urls.length === 2) {
      severity = "medium";
      recommendation = `Review both pages. If intent matches, 301-redirect or canonicalize one to the other. If intent differs, differentiate the keyword targeting.`;
    } else {
      severity = "low";
      recommendation = `Minor overlap. Differentiate title/H1/heading intent.`;
    }
    clusters.push({
      keyword,
      urls,
      count: urls.length,
      severity,
      recommendation,
    });
  }
  // Sort by severity desc, then count
  const order = { high: 0, medium: 1, low: 2 };
  clusters.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
  return clusters;
}

/** Build a full report. */
export function buildReport(entries: PageEntry[]): CannibalizationReport {
  const { unique, removed: _removed } = dedupEntries(entries);
  const clusters = detectClusters(unique);
  const uniqueKeywords = new Set(unique.map((e) => normalizeKeyword(e.keyword))).size;
  const cannibalizedKeywords = new Set(clusters.map((c) => c.keyword));
  const cleanEntries = unique.filter((e) => !cannibalizedKeywords.has(normalizeKeyword(e.keyword))).length;
  return {
    totalEntries: unique.length,
    uniqueKeywords,
    clusters,
    highSeverityCount: clusters.filter((c) => c.severity === "high").length,
    mediumSeverityCount: clusters.filter((c) => c.severity === "medium").length,
    lowSeverityCount: clusters.filter((c) => c.severity === "low").length,
    cleanEntries,
  };
}

/** Render the report as Markdown. */
export function renderMarkdown(report: CannibalizationReport): string {
  const lines: string[] = [
    "# Keyword Cannibalization Report",
    "",
    `**Total entries:** ${report.totalEntries}`,
    `**Unique keywords:** ${report.uniqueKeywords}`,
    `**High severity clusters:** ${report.highSeverityCount}`,
    `**Medium severity clusters:** ${report.mediumSeverityCount}`,
    `**Low severity clusters:** ${report.lowSeverityCount}`,
    `**Clean (no cannibalization):** ${report.cleanEntries}`,
    "",
  ];
  if (report.clusters.length === 0) {
    lines.push("_No cannibalization detected. Every keyword maps to one URL._");
  } else {
    for (const c of report.clusters) {
      lines.push(`## [${c.severity.toUpperCase()}] "${c.keyword}" — ${c.count} URLs`);
      for (const u of c.urls) lines.push(`- ${u}`);
      lines.push("");
      lines.push(`**Recommendation:** ${c.recommendation}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Render the report as CSV (cluster keyword, severity, count, urls). */
export function renderCsv(report: CannibalizationReport): string {
  const lines = ["keyword,severity,url_count,urls"];
  for (const c of report.clusters) {
    lines.push(
      `${escapeCsv(c.keyword)},${c.severity},${c.count},${escapeCsv(c.urls.join(", "))}`,
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:keyword-cannibalization-detector:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalEntries: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  clusterCount: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

export function buildShareUrl(input: string): string {
  const params = new URLSearchParams();
  if (input) params.set("input", input);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "" };
  const params = new URLSearchParams(clean);
  return { input: params.get("input") ?? "" };
}
