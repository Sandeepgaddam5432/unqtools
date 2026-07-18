/**
 * Broken Backlink Finder — pure logic.
 *
 * Find broken backlinks from imported data. Categorize HTTP status codes
 * (2xx/3xx/4xx/5xx), detect broken links (4xx, 5xx), score reclamation
 * opportunity, show anchor text for broken links.
 *
 * Pure functions only — no DOM, no network.
 */

export interface BacklinkEntry {
  url: string;
  statusCode: number;
  anchor?: string;
  sourceUrl?: string;
  sourceDomain?: string;
}

export type StatusCategory = "2xx" | "3xx" | "4xx" | "5xx" | "unknown";

export interface BrokenBacklink extends BacklinkEntry {
  category: StatusCategory;
  isBroken: boolean;
  opportunityScore: number; // 0-100
  reason: string;
  recommendation: string;
}

export interface FinderResult {
  total: number;
  broken: number;
  healthy: number;
  byCategory: Record<StatusCategory, number>;
  topOpportunities: BrokenBacklink[];
  all: BrokenBacklink[];
  averageOpportunity: number;
  uniqueBrokenDomains: number;
}

export interface StatusCodeInfo {
  code: number;
  category: StatusCategory;
  label: string;
  description: string;
  isBroken: boolean;
}

/** Status code reference data. */
export const STATUS_CODE_REFERENCE: Record<number, Omit<StatusCodeInfo, "code">> = {
  200: { category: "2xx", label: "OK", description: "Request succeeded.", isBroken: false },
  201: { category: "2xx", label: "Created", description: "Resource created.", isBroken: false },
  204: { category: "2xx", label: "No Content", description: "No content returned.", isBroken: false },
  301: { category: "3xx", label: "Moved Permanently", description: "Permanent redirect.", isBroken: false },
  302: { category: "3xx", label: "Found", description: "Temporary redirect.", isBroken: false },
  304: { category: "3xx", label: "Not Modified", description: "Cached version used.", isBroken: false },
  307: { category: "3xx", label: "Temporary Redirect", description: "Temporary redirect, preserves method.", isBroken: false },
  308: { category: "3xx", label: "Permanent Redirect", description: "Permanent redirect, preserves method.", isBroken: false },
  400: { category: "4xx", label: "Bad Request", description: "Malformed request.", isBroken: true },
  401: { category: "4xx", label: "Unauthorized", description: "Authentication required.", isBroken: true },
  403: { category: "4xx", label: "Forbidden", description: "Access denied.", isBroken: true },
  404: { category: "4xx", label: "Not Found", description: "Resource does not exist. Prime reclamation target.", isBroken: true },
  410: { category: "4xx", label: "Gone", description: "Resource permanently removed.", isBroken: true },
  429: { category: "4xx", label: "Too Many Requests", description: "Rate limited. Try later.", isBroken: false },
  500: { category: "5xx", label: "Internal Server Error", description: "Server error. May be temporary.", isBroken: true },
  502: { category: "5xx", label: "Bad Gateway", description: "Upstream server error.", isBroken: true },
  503: { category: "5xx", label: "Service Unavailable", description: "Server overloaded or down.", isBroken: true },
  504: { category: "5xx", label: "Gateway Timeout", description: "Upstream timeout.", isBroken: true },
};

/** Categorize a status code into 2xx/3xx/4xx/5xx/unknown. */
export function categorizeStatus(code: number): StatusCategory {
  if (!Number.isFinite(code) || code < 100 || code > 599) return "unknown";
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  return "5xx";
}

/** Look up info for a status code (with fallback). */
export function lookupStatus(code: number): StatusCodeInfo {
  const ref = STATUS_CODE_REFERENCE[code];
  if (ref) return { code, ...ref };
  const category = categorizeStatus(code);
  const isBroken = category === "4xx" || category === "5xx";
  return {
    code,
    category,
    label: "Unknown",
    description: "Status code not in reference list.",
    isBroken,
  };
}

/** Determine if a status code indicates a broken backlink.
 *  4xx and 5xx are broken, except 429 (rate limited — temporary).
 */
export function isBrokenStatus(code: number): boolean {
  if (code === 429) return false;
  const cat = categorizeStatus(code);
  return cat === "4xx" || cat === "5xx";
}

/** Compute reclamation opportunity score 0-100.
 *  Higher = better opportunity to reclaim the link.
 *  404/410 with anchor and source domain = highest.
 */
export function opportunityScore(entry: BacklinkEntry): number {
  if (!isBrokenStatus(entry.statusCode)) return 0;
  let score = 50;
  // 404 is the best reclamation target
  if (entry.statusCode === 404) score += 30;
  else if (entry.statusCode === 410) score += 25;
  else if (entry.statusCode >= 500) score += 10;
  else if (entry.statusCode === 403) score += 5;
  else if (entry.statusCode === 400 || entry.statusCode === 401) score += 5;
  // Has anchor — easier to recreate content
  if (entry.anchor && entry.anchor.trim()) score += 10;
  // Has source — easier to reach out
  if (entry.sourceDomain && entry.sourceDomain.trim()) score += 10;
  return Math.max(0, Math.min(100, score));
}

/** Compute a reason for a broken link. */
export function brokenReason(entry: BacklinkEntry): string {
  if (!isBrokenStatus(entry.statusCode)) return "OK";
  const info = lookupStatus(entry.statusCode);
  return `${info.label} (${entry.statusCode})`;
}

/** Generate a recommendation. */
export function recommendation(entry: BacklinkEntry): string {
  if (!isBrokenStatus(entry.statusCode)) return "No action needed";
  if (entry.statusCode === 404 || entry.statusCode === 410) {
    return "Reclaim: recreate the page or 301 redirect to a similar live URL, then ask the source to update.";
  }
  if (entry.statusCode >= 500) {
    return "Investigate: server-side issue. Contact the site owner or check if temporary.";
  }
  if (entry.statusCode === 403) {
    return "Check: access denied. Verify the page is publicly accessible.";
  }
  if (entry.statusCode === 401) {
    return "Check: page requires authentication. Move content to a public URL.";
  }
  return "Investigate the broken link and decide whether to reclaim or disavow.";
}

/** Score a single entry. */
export function scoreEntry(entry: BacklinkEntry): BrokenBacklink {
  const info = lookupStatus(entry.statusCode);
  return {
    ...entry,
    category: info.category,
    isBroken: info.isBroken,
    opportunityScore: opportunityScore(entry),
    reason: brokenReason(entry),
    recommendation: recommendation(entry),
  };
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

/** Parse CSV input with header detection. */
export function parseCsv(input: string): { entries: BacklinkEntry[]; errors: string[] } {
  if (!input || !input.trim()) return { entries: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { entries: [], errors: [] };
  const firstCells = splitCsvRow(lines[0]).map((c) => c.toLowerCase().trim());
  const hasHeader = firstCells.some((c) =>
    /^(url|status|status_code|anchor|source_url|source_domain)$/.test(c)
  );
  let colMap: Record<string, number> = {};
  let startIdx = 0;
  if (hasHeader) {
    firstCells.forEach((c, i) => {
      if (c === "url") colMap.url = i;
      else if (c === "status" || c === "status_code") colMap.statusCode = i;
      else if (c === "anchor" || c === "anchor_text") colMap.anchor = i;
      else if (c === "source_url" || c === "source") colMap.sourceUrl = i;
      else if (c === "source_domain" || c === "domain") colMap.sourceDomain = i;
    });
    startIdx = 1;
  } else {
    colMap = { url: 0, statusCode: 1, anchor: 2, sourceUrl: 3, sourceDomain: 4 };
  }
  const entries: BacklinkEntry[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const url = (cols[colMap.url ?? 0] ?? "").trim();
    if (!url) { errors.push(`Row ${i + 1}: missing URL — skipped`); continue; }
    const statusStr = (cols[colMap.statusCode ?? 1] ?? "").trim();
    const statusCode = parseInt(statusStr, 10);
    if (!Number.isFinite(statusCode)) {
      errors.push(`Row ${i + 1}: invalid status code — skipped`);
      continue;
    }
    entries.push({
      url,
      statusCode,
      anchor: colMap.anchor !== undefined ? (cols[colMap.anchor] ?? "").trim() || undefined : undefined,
      sourceUrl: colMap.sourceUrl !== undefined ? (cols[colMap.sourceUrl] ?? "").trim() || undefined : undefined,
      sourceDomain: colMap.sourceDomain !== undefined ? (cols[colMap.sourceDomain] ?? "").trim() || undefined : undefined,
    });
  }
  return { entries, errors };
}

/** Score all entries and compute summary. */
export function scoreAll(entries: BacklinkEntry[]): FinderResult {
  const all = entries.map(scoreEntry);
  const byCategory: Record<StatusCategory, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, unknown: 0 };
  for (const e of all) byCategory[e.category] += 1;
  const broken = all.filter((e) => e.isBroken);
  const healthy = all.length - broken.length;
  const topOpportunities = [...broken].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 20);
  const averageOpportunity = broken.length > 0
    ? Math.round((broken.reduce((acc, e) => acc + e.opportunityScore, 0) / broken.length) * 10) / 10
    : 0;
  const uniqueBrokenDomains = new Set(
    broken.map((e) => e.sourceDomain || "").filter(Boolean),
  ).size;
  return {
    total: all.length,
    broken: broken.length,
    healthy,
    byCategory,
    topOpportunities,
    all,
    averageOpportunity,
    uniqueBrokenDomains,
  };
}

/** Render CSV export. */
export function renderCsv(result: FinderResult): string {
  const lines: string[] = [];
  lines.push("# Summary");
  lines.push(`total,${result.total}`);
  lines.push(`broken,${result.broken}`);
  lines.push(`healthy,${result.healthy}`);
  lines.push(`average_opportunity,${result.averageOpportunity}`);
  lines.push("");
  lines.push("# Broken backlinks");
  lines.push("url,status_code,category,anchor,source_domain,opportunity_score,recommendation");
  for (const e of result.all.filter((e) => e.isBroken)) {
    lines.push([
      escapeCsv(e.url),
      e.statusCode,
      e.category,
      escapeCsv(e.anchor ?? ""),
      escapeCsv(e.sourceDomain ?? ""),
      e.opportunityScore,
      escapeCsv(e.recommendation),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a plain-text report. */
export function renderReport(result: FinderResult): string {
  const lines: string[] = [];
  lines.push("Broken Backlink Report");
  lines.push("======================");
  lines.push(`Total: ${result.total}`);
  lines.push(`Broken: ${result.broken}`);
  lines.push(`Healthy: ${result.healthy}`);
  lines.push(`Average opportunity: ${result.averageOpportunity}/100`);
  lines.push("");
  lines.push("By category:");
  lines.push(`  2xx: ${result.byCategory["2xx"]}`);
  lines.push(`  3xx: ${result.byCategory["3xx"]}`);
  lines.push(`  4xx: ${result.byCategory["4xx"]}`);
  lines.push(`  5xx: ${result.byCategory["5xx"]}`);
  lines.push("");
  lines.push("Top reclamation opportunities:");
  for (const e of result.topOpportunities.slice(0, 10)) {
    lines.push(`  [${e.statusCode}] ${e.url} — score ${e.opportunityScore}`);
    lines.push(`    → ${e.recommendation}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:broken-backlink-finder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  total: number;
  broken: number;
  healthy: number;
  averageOpportunity: number;
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

export function buildShareUrl(payload: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "" };
}
