/**
 * Referring Domains Explorer — pure logic.
 *
 * Explore referring domains from pasted backlink data. Extract unique
 * referring domains, count links per domain, rank top domains, estimate
 * domain authority, TLD distribution, anchor text per domain.
 *
 * Pure functions only — no DOM, no network.
 */

export interface BacklinkRow {
  sourceUrl: string;
  targetUrl: string;
  anchor?: string;
  domainAuthority?: number;
}

export interface DomainStat {
  domain: string;
  tld: string;
  linkCount: number;
  anchors: string[];
  daEstimate: number; // 0-100 (avg of provided DA, or heuristic)
  sourceUrls: string[];
  targetUrls: string[];
}

export interface ExplorerResult {
  totalBacklinks: number;
  uniqueDomains: number;
  topDomains: DomainStat[];
  tldDistribution: Record<string, number>;
  averageLinksPerDomain: number;
  totalAnchors: number;
  byDaBucket: { low: number; medium: number; high: number; unknown: number };
}

export type SortField = "linkCount" | "domain" | "daEstimate" | "tld";
export type SortDir = "asc" | "desc";

/** Normalize a string. */
export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract hostname/domain from a URL string. */
export function extractDomain(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/^\/\/+/, "");
  s = s.replace(/[/?#].*$/, "");
  s = s.replace(/:\d+$/, "");
  return s;
}

/** Extract the TLD from a domain (last segment after the last dot). */
export function extractTld(domain: string): string {
  if (!domain) return "";
  const parts = domain.split(".");
  if (parts.length < 2) return "";
  // Handle multi-part TLDs like co.uk, com.au — pick last two when matches
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  const multiTlds = ["co", "com", "org", "net", "gov", "ac", "edu"];
  if (multiTlds.includes(secondLast) && parts.length >= 3) {
    return `${secondLast}.${last}`;
  }
  return last;
}

/** Estimate domain authority when none provided. Uses simple heuristic:
 *  gov/edu = 80, well-known TLDs = 50, otherwise 30, unknown TLDs = 10.
 */
export function estimateDa(domain: string): number {
  if (!domain) return 0;
  const tld = extractTld(domain);
  if (tld === "gov" || tld === "edu") return 80;
  if (["com", "org", "net", "io", "co"].includes(tld)) return 50;
  if (["info", "biz", "xyz", "online", "site", "top"].includes(tld)) return 15;
  return 30;
}

/** Split a CSV row, handling quoted values. */
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

/** Parse a CSV/TSV blob into BacklinkRow[]. Auto-detects header. */
export function parseInput(input: string): { rows: BacklinkRow[]; errors: string[] } {
  if (!input || !input.trim()) return { rows: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: [] };

  // Header detection
  const firstCells = splitCsvRow(lines[0]).map((c) => c.toLowerCase().trim());
  const hasHeader = firstCells.some((c) =>
    /^(source_url|source|url|target_url|target|anchor|anchor_text|da|domain_authority|dr)$/.test(c)
  );

  let colMap: Record<string, number> = {};
  let startIdx = 0;
  if (hasHeader) {
    firstCells.forEach((c, i) => {
      if (c === "source_url" || c === "source" || c === "url" || c === "referring_url") colMap.sourceUrl = i;
      else if (c === "target_url" || c === "target") colMap.targetUrl = i;
      else if (c === "anchor" || c === "anchor_text") colMap.anchor = i;
      else if (c === "da" || c === "domain_authority" || c === "dr") colMap.da = i;
    });
    startIdx = 1;
  } else {
    // Default order: source, target, anchor, da
    colMap = { sourceUrl: 0, targetUrl: 1, anchor: 2, da: 3 };
  }

  const rows: BacklinkRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const sourceUrl = (cols[colMap.sourceUrl ?? 0] ?? "").trim();
    const targetUrl = (cols[colMap.targetUrl ?? 1] ?? "").trim();
    if (!sourceUrl) {
      errors.push(`Row ${i + 1}: missing source URL — skipped`);
      continue;
    }
    const anchor = colMap.anchor !== undefined ? (cols[colMap.anchor] ?? "").trim() : "";
    const daStr = colMap.da !== undefined ? (cols[colMap.da] ?? "").trim() : "";
    const daNum = daStr ? parseFloat(daStr) : NaN;
    rows.push({
      sourceUrl,
      targetUrl,
      anchor: anchor || undefined,
      domainAuthority: Number.isFinite(daNum) ? daNum : undefined,
    });
  }
  return { rows, errors };
}

/** Group rows by source domain and compute stats. */
export function buildDomainStats(rows: BacklinkRow[]): DomainStat[] {
  const map = new Map<string, DomainStat>();
  for (const r of rows) {
    const domain = extractDomain(r.sourceUrl);
    if (!domain) continue;
    if (!map.has(domain)) {
      map.set(domain, {
        domain,
        tld: extractTld(domain),
        linkCount: 0,
        anchors: [],
        daEstimate: 0,
        sourceUrls: [],
        targetUrls: [],
      });
    }
    const stat = map.get(domain)!;
    stat.linkCount += 1;
    if (r.anchor && !stat.anchors.includes(r.anchor)) stat.anchors.push(r.anchor);
    stat.sourceUrls.push(r.sourceUrl);
    if (r.targetUrl) stat.targetUrls.push(r.targetUrl);
  }
  // Compute DA estimate per domain
  const rowsByDomain = new Map<string, BacklinkRow[]>();
  for (const r of rows) {
    const d = extractDomain(r.sourceUrl);
    if (!d) continue;
    if (!rowsByDomain.has(d)) rowsByDomain.set(d, []);
    rowsByDomain.get(d)!.push(r);
  }
  for (const [domain, stat] of map) {
    const list = rowsByDomain.get(domain) ?? [];
    const daVals = list
      .map((r) => r.domainAuthority)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (daVals.length > 0) {
      stat.daEstimate = Math.round(daVals.reduce((a, b) => a + b, 0) / daVals.length);
    } else {
      stat.daEstimate = estimateDa(domain);
    }
  }
  return [...map.values()];
}

/** Sort domains by a field. */
export function sortDomains(
  stats: DomainStat[],
  field: SortField = "linkCount",
  dir: SortDir = "desc",
): DomainStat[] {
  const sorted = [...stats];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === "linkCount") cmp = a.linkCount - b.linkCount;
    else if (field === "domain") cmp = a.domain.localeCompare(b.domain);
    else if (field === "daEstimate") cmp = a.daEstimate - b.daEstimate;
    else if (field === "tld") cmp = a.tld.localeCompare(b.tld);
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/** Filter domains by search query. */
export function filterDomains(stats: DomainStat[], query: string): DomainStat[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return stats;
  return stats.filter((s) => s.domain.includes(q) || s.tld.includes(q));
}

/** Compute TLD distribution. */
export function computeTldDistribution(stats: DomainStat[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stats) {
    const t = s.tld || "(unknown)";
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

/** Compute the full explorer result. */
export function explore(rows: BacklinkRow[]): ExplorerResult {
  const stats = buildDomainStats(rows);
  const tldDistribution = computeTldDistribution(stats);
  const totalBacklinks = rows.length;
  const uniqueDomains = stats.length;
  const averageLinksPerDomain = uniqueDomains > 0
    ? Math.round((totalBacklinks / uniqueDomains) * 10) / 10
    : 0;
  const totalAnchors = rows.filter((r) => r.anchor && r.anchor.trim()).length;
  const byDaBucket = {
    low: stats.filter((s) => s.daEstimate < 30).length,
    medium: stats.filter((s) => s.daEstimate >= 30 && s.daEstimate < 60).length,
    high: stats.filter((s) => s.daEstimate >= 60).length,
    unknown: stats.filter((s) => s.daEstimate === 0).length,
  };
  const topDomains = sortDomains(stats, "linkCount", "desc");
  return {
    totalBacklinks,
    uniqueDomains,
    topDomains,
    tldDistribution,
    averageLinksPerDomain,
    totalAnchors,
    byDaBucket,
  };
}

/** Render CSV export. */
export function renderCsv(result: ExplorerResult): string {
  const lines: string[] = [];
  lines.push("# Summary");
  lines.push(`total_backlinks,${result.totalBacklinks}`);
  lines.push(`unique_domains,${result.uniqueDomains}`);
  lines.push(`average_links_per_domain,${result.averageLinksPerDomain}`);
  lines.push(`total_anchors,${result.totalAnchors}`);
  lines.push("");
  lines.push("# TLD distribution");
  for (const [tld, count] of Object.entries(result.tldDistribution)) {
    lines.push(`${tld},${count}`);
  }
  lines.push("");
  lines.push("# Top domains");
  lines.push("domain,tld,link_count,da_estimate,anchors,target_count");
  for (const s of result.topDomains) {
    lines.push([
      escapeCsv(s.domain),
      s.tld,
      s.linkCount,
      s.daEstimate,
      escapeCsv(s.anchors.join("; ")),
      s.targetUrls.length,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a plain-text human-readable report. */
export function renderReport(result: ExplorerResult): string {
  const lines: string[] = [];
  lines.push("Referring Domains Report");
  lines.push("=======================");
  lines.push(`Total backlinks: ${result.totalBacklinks}`);
  lines.push(`Unique referring domains: ${result.uniqueDomains}`);
  lines.push(`Average links per domain: ${result.averageLinksPerDomain}`);
  lines.push(`Total anchors: ${result.totalAnchors}`);
  lines.push("");
  lines.push("Top referring domains:");
  for (const s of result.topDomains.slice(0, 10)) {
    lines.push(`  ${s.domain} — ${s.linkCount} link(s), DA ~${s.daEstimate}, TLD .${s.tld}`);
  }
  lines.push("");
  lines.push("TLD distribution:");
  for (const [tld, count] of Object.entries(result.tldDistribution).sort((a, b) => b[1] - a[1])) {
    lines.push(`  .${tld}: ${count}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:referring-domains-explorer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalBacklinks: number;
  uniqueDomains: number;
  topDomain: string;
  topDomainCount: number;
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
