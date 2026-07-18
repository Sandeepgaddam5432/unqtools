/**
 * Index Coverage Reporter — pure logic.
 *
 * Parses URL metadata CSV and classifies each URL for index coverage:
 * indexable / canonicalized / noindex / robots_blocked / error_status /
 * duplicate_canonical. Detects canonical chains, duplicates, and missing
 * canonicals, and generates actionable recommendations.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type Classification =
  | "indexable"
  | "canonicalized"
  | "noindex"
  | "robots_blocked"
  | "error_status"
  | "duplicate_canonical";

export interface UrlRecord {
  url: string;
  canonical: string;
  noindex: boolean;
  robotsBlocked: boolean;
  statusCode: number;
  lineNumber: number;
}

export interface ClassifiedRecord extends UrlRecord {
  classification: Classification;
  selfCanonical: boolean;
  reason: string;
}

export interface CanonicalGroup {
  target: string;
  sources: string[];
}

export interface CanonicalChain {
  start: string;
  steps: string[];
  cyclic: boolean;
}

export interface CoverageSummary {
  total: number;
  indexable: number;
  canonicalized: number;
  noindex: number;
  robotsBlocked: number;
  errorStatus: number;
  duplicateCanonical: number;
  selfCanonicalCount: number;
  nonSelfCanonicalCount: number;
  missingCanonicalCount: number;
  indexablePercent: number;
  blockedPercent: number;
  uniqueCanonicalTargets: number;
  duplicateGroups: number;
  chainCount: number;
}

export interface Recommendation {
  severity: "high" | "medium" | "low";
  message: string;
  url?: string;
}

export interface ParseError {
  line: number;
  raw: string;
  message: string;
}

export interface ParsedCsv {
  records: UrlRecord[];
  errors: ParseError[];
  totalLines: number;
}

export interface HistoryEntry {
  ts: number;
  total: number;
  indexable: number;
  blocked: number;
  recommendations: number;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:index-coverage-reporter:history";
export const HISTORY_MAX = 20;

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  indexable: "Indexable",
  canonicalized: "Canonicalized",
  noindex: "Noindex",
  robots_blocked: "Robots Blocked",
  error_status: "Error Status",
  duplicate_canonical: "Duplicate Canonical",
};

export const CLASSIFICATION_COLORS: Record<Classification, string> = {
  indexable: "text-emerald-600 dark:text-emerald-400",
  canonicalized: "text-blue-600 dark:text-blue-400",
  noindex: "text-amber-600 dark:text-amber-400",
  robots_blocked: "text-orange-600 dark:text-orange-400",
  error_status: "text-red-600 dark:text-red-400",
  duplicate_canonical: "text-purple-600 dark:text-purple-400",
};

export const CLASSIFICATION_ORDER: Classification[] = [
  "indexable",
  "canonicalized",
  "duplicate_canonical",
  "noindex",
  "robots_blocked",
  "error_status",
];

// ---- CSV parsing ----

/** Split a CSV row, honoring double-quoted fields with embedded commas. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseBool(s: string | undefined): boolean {
  if (s === undefined) return false;
  const t = s.trim().toLowerCase();
  return t === "yes" || t === "true" || t === "1" || t === "y";
}

function parseStatusCode(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 100 || n > 599) return undefined;
  return Math.floor(n);
}

const HEADER_TOKENS = new Set(["url", "canonical", "noindex", "robots_blocked", "status_code", "status"]);

/** Parse multi-line CSV input into UrlRecord[] with field validation. */
export function parseCsv(input: string): ParsedCsv {
  if (!input) return { records: [], errors: [], totalLines: 0 };
  const lines = input.split(/\r?\n/);
  const records: UrlRecord[] = [];
  const errors: ParseError[] = [];
  let startIndex = 0;
  // Auto-detect header
  if (lines.length > 0) {
    const first = splitCsvRow(lines[0]).map((s) => s.toLowerCase());
    if (first.includes("url") && (first.includes("canonical") || first.includes("noindex"))) {
      startIndex = 1;
    }
  }
  for (let i = startIndex; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cols = splitCsvRow(raw);
    if (cols.length < 1 || !cols[0]) {
      errors.push({ line: i + 1, raw, message: "Missing URL (first column)" });
      continue;
    }
    const url = cols[0];
    const canonical = cols[1] ?? "";
    const noindex = parseBool(cols[2]);
    const robotsBlocked = parseBool(cols[3]);
    const statusCodeRaw = cols[4];
    let statusCode: number;
    if (statusCodeRaw === undefined || statusCodeRaw.trim() === "") {
      statusCode = 200; // default
    } else {
      const parsed = parseStatusCode(statusCodeRaw);
      if (parsed === undefined) {
        errors.push({ line: i + 1, raw, message: `Invalid status_code: ${statusCodeRaw}` });
        continue;
      }
      statusCode = parsed;
    }
    records.push({
      url,
      canonical: canonical ?? "",
      noindex,
      robotsBlocked,
      statusCode,
      lineNumber: i + 1,
    });
  }
  return { records, errors, totalLines: lines.length };
}

// ---- Normalization ----

/** Normalize URL: lowercase host, strip trailing slash (except root), trim. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  let u = url.trim();
  let isRoot = false;
  try {
    const parsed = new URL(u);
    parsed.hostname = parsed.hostname.toLowerCase();
    isRoot = parsed.pathname === "/" || parsed.pathname === "";
    u = parsed.toString();
  } catch {
    // not absolute — leave as-is
  }
  if (u.length > 1 && u.endsWith("/") && !isRoot) u = u.slice(0, -1);
  return u;
}

/** Returns true if canonical URL points to itself (after normalization). */
export function isSelfCanonical(url: string, canonical: string): boolean {
  if (!canonical) return false; // empty canonical is NOT self-canonical
  return normalizeUrl(url) === normalizeUrl(canonical);
}

// ---- Classification ----

/**
 * Detect duplicate-canonical sources: build a map of canonical_target → source URLs.
 * Returns groups with 2+ sources.
 */
export function findDuplicateCanonicalGroups(records: UrlRecord[]): CanonicalGroup[] {
  const map = new Map<string, string[]>();
  for (const r of records) {
    if (!r.canonical) continue;
    if (normalizeUrl(r.canonical) === normalizeUrl(r.url)) continue; // self-canonical
    const key = normalizeUrl(r.canonical);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r.url);
  }
  const groups: CanonicalGroup[] = [];
  for (const [target, sources] of map) {
    if (sources.length >= 2) {
      groups.push({ target, sources });
    }
  }
  groups.sort((a, b) => b.sources.length - a.sources.length);
  return groups;
}

/**
 * Detect canonical chains: A→B, B→C means A→B→C is a chain.
 * Walks canonical pointers until reaching a self-canonical or missing canonical.
 */
export function detectCanonicalChains(records: UrlRecord[]): CanonicalChain[] {
  const urlToRecord = new Map<string, UrlRecord>();
  for (const r of records) {
    urlToRecord.set(normalizeUrl(r.url), r);
  }
  const chains: CanonicalChain[] = [];
  const visited = new Set<string>();
  for (const r of records) {
    const startUrl = normalizeUrl(r.url);
    if (visited.has(startUrl)) continue;
    if (!r.canonical) continue;
    if (isSelfCanonical(r.url, r.canonical)) continue;
    // Walk the chain
    const steps: string[] = [r.url];
    const seenInWalk = new Set<string>([startUrl]);
    let current = r;
    let cyclic = false;
    while (current.canonical && !isSelfCanonical(current.url, current.canonical)) {
      const nextUrl = normalizeUrl(current.canonical);
      if (seenInWalk.has(nextUrl)) {
        cyclic = true;
        break;
      }
      seenInWalk.add(nextUrl);
      steps.push(current.canonical);
      const next = urlToRecord.get(nextUrl);
      if (!next) break; // canonical points to URL not in dataset
      current = next;
    }
    if (cyclic || steps.length >= 3) { // A → B → C is 3+ steps, OR cyclic chain (A ↔ B)
      chains.push({ start: r.url, steps, cyclic });
      for (const s of seenInWalk) visited.add(s);
    }
  }
  return chains;
}

/** Find URLs with empty canonical field. */
export function findMissingCanonicals(records: UrlRecord[]): UrlRecord[] {
  return records.filter((r) => !r.canonical.trim());
}

/** Classify a single URL record. */
export function classifyRecord(
  r: UrlRecord,
  duplicateSources: Set<string>,
): ClassifiedRecord {
  const selfCanonical = isSelfCanonical(r.url, r.canonical);
  let classification: Classification;
  let reason: string;

  if (r.statusCode < 200 || r.statusCode >= 300) {
    classification = "error_status";
    reason = `Status code ${r.statusCode} — not 2xx, will not be indexed.`;
  } else if (r.robotsBlocked) {
    classification = "robots_blocked";
    reason = "Blocked by robots.txt — Google cannot crawl, may still index if linked.";
  } else if (r.noindex) {
    classification = "noindex";
    reason = "Has noindex directive — explicitly excluded from index.";
  } else if (!r.canonical) {
    // missing canonical — treat as duplicate_canonical risk
    classification = "duplicate_canonical";
    reason = "Missing canonical tag — risk of duplicate content. Add a self-canonical.";
  } else if (!selfCanonical) {
    if (duplicateSources.has(r.url)) {
      classification = "duplicate_canonical";
      reason = `Canonical points to ${r.canonical} along with other URLs — duplicate consolidation risk.`;
    } else {
      classification = "canonicalized";
      reason = `Canonical points to ${r.canonical} — signals consolidated to canonical URL.`;
    }
  } else {
    classification = "indexable";
    reason = "Self-canonical, no noindex, not blocked, status 2xx — fully indexable.";
  }

  return { ...r, classification, selfCanonical, reason };
}

/** Classify all records and return them in classification order. */
export function classifyRecords(records: UrlRecord[]): ClassifiedRecord[] {
  const dupGroups = findDuplicateCanonicalGroups(records);
  const duplicateSources = new Set<string>();
  for (const g of dupGroups) for (const s of g.sources) duplicateSources.add(s);
  const out = records.map((r) => classifyRecord(r, duplicateSources));
  const order: Record<Classification, number> = {
    error_status: 0,
    noindex: 1,
    robots_blocked: 2,
    duplicate_canonical: 3,
    canonicalized: 4,
    indexable: 5,
  };
  out.sort((a, b) => order[a.classification] - order[b.classification]);
  return out;
}

// ---- Summary ----

export function summarizeCoverage(records: ClassifiedRecord[]): CoverageSummary {
  const sum: CoverageSummary = {
    total: records.length,
    indexable: 0,
    canonicalized: 0,
    noindex: 0,
    robotsBlocked: 0,
    errorStatus: 0,
    duplicateCanonical: 0,
    selfCanonicalCount: 0,
    nonSelfCanonicalCount: 0,
    missingCanonicalCount: 0,
    indexablePercent: 0,
    blockedPercent: 0,
    uniqueCanonicalTargets: 0,
    duplicateGroups: 0,
    chainCount: 0,
  };
  for (const r of records) {
    switch (r.classification) {
      case "indexable": sum.indexable++; break;
      case "canonicalized": sum.canonicalized++; break;
      case "noindex": sum.noindex++; break;
      case "robots_blocked": sum.robotsBlocked++; break;
      case "error_status": sum.errorStatus++; break;
      case "duplicate_canonical": sum.duplicateCanonical++; break;
    }
    if (!r.canonical) sum.missingCanonicalCount++;
    else if (r.selfCanonical) sum.selfCanonicalCount++;
    else sum.nonSelfCanonicalCount++;
  }
  sum.indexablePercent = sum.total > 0
    ? Math.round((sum.indexable / sum.total) * 1000) / 10
    : 0;
  const blockedCount = sum.noindex + sum.robotsBlocked + sum.errorStatus;
  sum.blockedPercent = sum.total > 0
    ? Math.round((blockedCount / sum.total) * 1000) / 10
    : 0;
  // unique canonical targets (excluding self + empty)
  const targets = new Set<string>();
  for (const r of records) {
    if (r.canonical && !r.selfCanonical) targets.add(normalizeUrl(r.canonical));
  }
  sum.uniqueCanonicalTargets = targets.size;
  sum.duplicateGroups = findDuplicateCanonicalGroups(records).length;
  sum.chainCount = detectCanonicalChains(records).length;
  return sum;
}

// ---- Recommendations ----

export function generateRecommendations(
  records: ClassifiedRecord[],
  chains: CanonicalChain[],
  dupGroups: CanonicalGroup[],
  missingCanonicals: UrlRecord[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  // High: error status
  const errorUrls = records.filter((r) => r.classification === "error_status");
  for (const r of errorUrls.slice(0, 5)) {
    recs.push({
      severity: "high",
      message: `Fix status code ${r.statusCode} on ${r.url} — currently not indexable.`,
      url: r.url,
    });
  }
  // High: canonical chains
  for (const c of chains.slice(0, 5)) {
    recs.push({
      severity: "high",
      message: `Canonical chain detected: ${c.steps.join(" → ")}. Flatten to a single canonical target.`,
      url: c.start,
    });
  }
  // Medium: duplicate canonicals (multiple sources → same target)
  for (const g of dupGroups.slice(0, 5)) {
    recs.push({
      severity: "medium",
      message: `${g.sources.length} URLs canonicalize to ${g.target}. Review for true duplicates — consider 301 redirects.`,
      url: g.target,
    });
  }
  // Medium: missing canonical
  for (const r of missingCanonicals.slice(0, 5)) {
    recs.push({
      severity: "medium",
      message: `Add a self-canonical tag to ${r.url} — currently missing canonical.`,
      url: r.url,
    });
  }
  // Low: robots blocked with noindex
  const rbNoindex = records.filter((r) => r.classification === "robots_blocked");
  for (const r of rbNoindex.slice(0, 3)) {
    recs.push({
      severity: "low",
      message: `${r.url} is robots-blocked. If you want it deindexed, add noindex instead (Google won't see noindex if it can't crawl).`,
      url: r.url,
    });
  }
  // Severity sort: high → medium → low
  const order: Record<Recommendation["severity"], number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.severity] - order[b.severity]);
  return recs;
}

// ---- Filtering ----

export type ClassificationFilter = "all" | Classification;

export function filterByClassification(
  records: ClassifiedRecord[],
  filter: ClassificationFilter,
): ClassifiedRecord[] {
  if (filter === "all") return records;
  return records.filter((r) => r.classification === filter);
}

// ---- Rendering ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render a complete text coverage report. */
export function renderTextReport(
  records: ClassifiedRecord[],
  summary: CoverageSummary,
  chains: CanonicalChain[],
  dupGroups: CanonicalGroup[],
  missingCanonicals: UrlRecord[],
  recommendations: Recommendation[],
): string {
  const lines: string[] = [];
  lines.push("=== Index Coverage Report ===");
  lines.push("");
  lines.push(`Total URLs: ${summary.total}`);
  lines.push(`Indexable: ${summary.indexable} (${summary.indexablePercent}%)`);
  lines.push(`Canonicalized: ${summary.canonicalized}`);
  lines.push(`Noindex: ${summary.noindex}`);
  lines.push(`Robots blocked: ${summary.robotsBlocked}`);
  lines.push(`Error status: ${summary.errorStatus}`);
  lines.push(`Duplicate canonical: ${summary.duplicateCanonical}`);
  lines.push("");
  lines.push("--- Canonical stats ---");
  lines.push(`Self-canonical: ${summary.selfCanonicalCount}`);
  lines.push(`Non-self-canonical: ${summary.nonSelfCanonicalCount}`);
  lines.push(`Missing canonical: ${summary.missingCanonicalCount}`);
  lines.push(`Unique canonical targets: ${summary.uniqueCanonicalTargets}`);
  lines.push(`Duplicate groups: ${summary.duplicateGroups}`);
  lines.push(`Canonical chains: ${summary.chainCount}`);
  if (dupGroups.length > 0) {
    lines.push("");
    lines.push("--- Duplicate canonical groups ---");
    for (const g of dupGroups.slice(0, 20)) {
      lines.push(`→ ${g.target} (${g.sources.length} sources):`);
      for (const s of g.sources.slice(0, 10)) lines.push(`    ${s}`);
    }
  }
  if (chains.length > 0) {
    lines.push("");
    lines.push("--- Canonical chains ---");
    for (const c of chains.slice(0, 20)) {
      const flag = c.cyclic ? " [CYCLIC!]" : "";
      lines.push(`${c.steps.join(" → ")}${flag}`);
    }
  }
  if (missingCanonicals.length > 0) {
    lines.push("");
    lines.push(`--- Missing canonicals (${missingCanonicals.length}) ---`);
    for (const r of missingCanonicals.slice(0, 50)) lines.push(`    ${r.url}`);
  }
  if (recommendations.length > 0) {
    lines.push("");
    lines.push("--- Recommendations ---");
    for (const r of recommendations) {
      lines.push(`[${r.severity.toUpperCase()}] ${r.message}`);
    }
  }
  lines.push("");
  lines.push("--- All URLs (first 100) ---");
  for (const r of records.slice(0, 100)) {
    lines.push(`[${r.classification.padEnd(20)}] ${r.url} → ${r.canonical || "(none)"} | ${r.statusCode} | noindex=${r.noindex} | robots=${r.robotsBlocked}`);
  }
  return lines.join("\n");
}

/** Render records as CSV (url, classification, canonical_target, status, noindex, robots_blocked). */
export function renderCsv(records: ClassifiedRecord[]): string {
  const lines = ["url,classification,canonical_target,status_code,noindex,robots_blocked,reason"];
  for (const r of records) {
    lines.push([
      escapeCsv(r.url),
      r.classification,
      escapeCsv(r.canonical || ""),
      r.statusCode,
      r.noindex ? "yes" : "no",
      r.robotsBlocked ? "yes" : "no",
      escapeCsv(r.reason),
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

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

/**
 * Encode the full records list as a compact CSV string in the URL hash.
 * For very large inputs this may exceed URL length limits — caller should
 * cap before calling (e.g. first 100 records).
 */
export function buildShareUrl(records: UrlRecord[]): string {
  const params = new URLSearchParams();
  if (records.length > 0) {
    // Encode as pipe-delimited compact rows: url|canonical|noindex|robots|status
    const compact = records.slice(0, 100).map((r) =>
      [r.url, r.canonical, r.noindex ? "1" : "0", r.robotsBlocked ? "1" : "0", r.statusCode].join("|"),
    ).join("\n");
    params.set("d", compact);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): UrlRecord[] {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return [];
  const params = new URLSearchParams(clean);
  const d = params.get("d");
  if (!d) return [];
  const out: UrlRecord[] = [];
  const lines = d.split("\n");
  lines.forEach((line, idx) => {
    if (!line) return;
    const cols = line.split("|");
    if (cols.length < 5) return;
    const statusCode = Number(cols[4]);
    out.push({
      url: cols[0],
      canonical: cols[1],
      noindex: cols[2] === "1",
      robotsBlocked: cols[3] === "1",
      statusCode: Number.isFinite(statusCode) ? statusCode : 200,
      lineNumber: idx + 1,
    });
  });
  return out;
}
