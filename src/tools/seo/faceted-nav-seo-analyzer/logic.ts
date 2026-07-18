/**
 * Faceted Nav SEO Analyzer — pure logic.
 *
 * Analyze faceted navigation URLs for SEO issues: duplicate content,
 * parameter bloat, crawl waste. Pure functions only — no DOM, no network.
 */

export type RecommendationType =
  | "self-canonical"
  | "canonical-to-base"
  | "block-in-robots";

export interface ParsedUrl {
  /** Original raw URL string from the user. */
  raw: string;
  /** URL without query string and hash. */
  basePath: string;
  /** Query parameters as an ordered record (insertion order from URL). */
  params: Record<string, string>;
  /** Canonical, sorted "k=v&k=v" string for duplicate detection. */
  paramKey: string;
  /** Number of distinct query parameters. */
  paramCount: number;
}

export interface BasePathGroup {
  basePath: string;
  urls: ParsedUrl[];
  /** Number of unique paramKeys (i.e. unique value combinations, ignoring order). */
  combinationCount: number;
  /** Distinct query parameter names seen in this group. */
  paramNames: string[];
  /** Map paramKey → count of URLs with that key (duplicates by order). */
  duplicateMap: Record<string, number>;
  /** True if combinationCount > BLOAT_THRESHOLD. */
  hasBloat: boolean;
  /** True if any paramKey has count > 1 (duplicate-content risk). */
  hasDuplicateContentRisk: boolean;
}

export interface UrlRecommendation {
  raw: string;
  basePath: string;
  /** Human-readable parameter list "color=red; size=m". */
  params: string;
  recommendation: RecommendationType;
  reason: string;
}

export interface ParameterTableEntry {
  name: string;
  distinctValuesCount: number;
  exampleValues: string[];
}

export interface RobotsRule {
  userAgent: string;
  disallow: string[];
}

export interface SummaryStats {
  totalUrls: number;
  basePaths: number;
  totalParams: number;
  duplicateContentCount: number;
  bloatCount: number;
  recommendationsByType: Record<RecommendationType, number>;
}

export interface AnalysisResult {
  urls: ParsedUrl[];
  groups: BasePathGroup[];
  recommendations: UrlRecommendation[];
  paramTable: ParameterTableEntry[];
  robotsRules: RobotsRule[];
  summary: SummaryStats;
}

export const HISTORY_KEY = "unqtools:faceted-nav-seo-analyzer:history";
export const HISTORY_MAX = 20;
export const BLOAT_THRESHOLD = 10;

/** Normalize a raw URL string (trim only). */
export function normalizeUrl(raw: string): string {
  return (raw || "").trim();
}

/** Extract the base path of a URL (strip query + hash). */
export function getBasePath(url: string): string {
  const s = (url || "").trim();
  if (!s) return "";
  const qIdx = s.indexOf("?");
  const hIdx = s.indexOf("#");
  let end = s.length;
  if (qIdx >= 0 && qIdx < end) end = qIdx;
  if (hIdx >= 0 && hIdx < end) end = hIdx;
  return s.slice(0, end);
}

/** Parse query string parameters from a URL. */
export function getParams(url: string): Record<string, string> {
  const s = (url || "").trim();
  const qIdx = s.indexOf("?");
  if (qIdx < 0) return {};
  let qs = s.slice(qIdx + 1);
  const hIdx = qs.indexOf("#");
  if (hIdx >= 0) qs = qs.slice(0, hIdx);
  if (!qs) return {};
  const out: Record<string, string> = {};
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    let k: string;
    let v: string;
    if (eq < 0) { k = pair; v = ""; }
    else { k = pair.slice(0, eq); v = pair.slice(eq + 1); }
    try {
      k = decodeURIComponent(k.replace(/\+/g, " "));
      v = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      // keep raw if decode fails
    }
    // First occurrence wins (consistent with most URL parsing conventions for SEO analysis)
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/** Build canonical sorted "k=v&k=v" key for duplicate detection. */
export function buildParamKey(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${params[k]}`).join("&");
}

/** Parse a single URL into a ParsedUrl, or null if blank/invalid. */
export function parseUrl(raw: string): ParsedUrl | null {
  const s = normalizeUrl(raw);
  if (!s) return null;
  // Basic validation: must contain a path-like character or scheme.
  // Reject strings with embedded whitespace (not a URL).
  if (/\s/.test(s)) return null;
  const basePath = getBasePath(s);
  if (!basePath) return null;
  const params = getParams(s);
  const paramKey = buildParamKey(params);
  return {
    raw: s,
    basePath,
    params,
    paramKey,
    paramCount: Object.keys(params).length,
  };
}

/** Parse a multi-line URL list into ParsedUrl[]. Skips blanks and duplicates by raw string. */
export function parseUrlList(input: string): ParsedUrl[] {
  if (!input) return [];
  const out: ParsedUrl[] = [];
  const seen = new Set<string>();
  for (const line of input.split(/\r?\n/)) {
    const parsed = parseUrl(line);
    if (!parsed) continue;
    if (seen.has(parsed.raw)) continue;
    seen.add(parsed.raw);
    out.push(parsed);
  }
  return out;
}

/** Count unique parameter combinations (by paramKey) for a group of URLs sharing a base path. */
export function countCombinations(urls: ParsedUrl[]): number {
  const set = new Set<string>();
  for (const u of urls) set.add(u.paramKey);
  return set.size;
}

/** Group parsed URLs by their base path. */
export function groupByBasePath(urls: ParsedUrl[]): BasePathGroup[] {
  const map = new Map<string, ParsedUrl[]>();
  for (const u of urls) {
    if (!map.has(u.basePath)) map.set(u.basePath, []);
    map.get(u.basePath)!.push(u);
  }
  const groups: BasePathGroup[] = [];
  for (const [basePath, groupUrls] of map) {
    const dupMap: Record<string, number> = {};
    const nameSet = new Set<string>();
    for (const u of groupUrls) {
      dupMap[u.paramKey] = (dupMap[u.paramKey] || 0) + 1;
      for (const k of Object.keys(u.params)) nameSet.add(k);
    }
    const combinationCount = Object.keys(dupMap).length;
    groups.push({
      basePath,
      urls: groupUrls,
      combinationCount,
      paramNames: Array.from(nameSet).sort(),
      duplicateMap: dupMap,
      hasBloat: combinationCount > BLOAT_THRESHOLD,
      hasDuplicateContentRisk: Object.values(dupMap).some((c) => c > 1),
    });
  }
  groups.sort((a, b) => b.urls.length - a.urls.length || a.basePath.localeCompare(b.basePath));
  return groups;
}

/** Detect parameter bloat for a group (combination count > threshold). */
export function detectBloat(group: BasePathGroup): boolean {
  return group.combinationCount > BLOAT_THRESHOLD;
}

/** Detect duplicate-content risk (same paramKey appears more than once). */
export function detectDuplicateContent(group: BasePathGroup): boolean {
  return group.hasDuplicateContentRisk;
}

/** Build a human-readable parameter string "k=v; k=v" preserving original URL order. */
export function formatParams(params: Record<string, string>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Generate canonical recommendation for a single URL based on its group. */
export function generateCanonicalRecommendation(
  url: ParsedUrl,
  group: BasePathGroup,
): UrlRecommendation {
  const params = formatParams(url.params);
  if (group.hasBloat) {
    return {
      raw: url.raw,
      basePath: url.basePath,
      params,
      recommendation: "block-in-robots",
      reason: `Parameter bloat (${group.combinationCount} combinations on this base path; threshold ${BLOAT_THRESHOLD}) — block crawling of parameter combinations in robots.txt`,
    };
  }
  if (group.hasDuplicateContentRisk && group.duplicateMap[url.paramKey] > 1) {
    return {
      raw: url.raw,
      basePath: url.basePath,
      params,
      recommendation: "canonical-to-base",
      reason: `Duplicate-content risk — ${group.duplicateMap[url.paramKey]} URLs share the same parameter values (different order). Canonical to base path`,
    };
  }
  if (group.hasDuplicateContentRisk) {
    // Group has duplicates somewhere, but this URL itself is unique.
    return {
      raw: url.raw,
      basePath: url.basePath,
      params,
      recommendation: "self-canonical",
      reason: "Unique combination on a base path with other duplicates — use self-canonical",
    };
  }
  return {
    raw: url.raw,
    basePath: url.basePath,
    params,
    recommendation: "self-canonical",
    reason: "Unique combination — self-canonical",
  };
}

/** Generate robots.txt Disallow rules for groups with bloat. */
export function generateRobotsRules(groups: BasePathGroup[]): RobotsRule[] {
  const bloated = groups.filter((g) => g.hasBloat);
  if (bloated.length === 0) return [];
  const disallow: string[] = [];
  for (const g of bloated) {
    // Build a Disallow pattern that targets the base path with query params.
    // Pattern: basePath?* (block all parameterized versions of this base path)
    // Use the trailing-slash-aware pattern.
    const base = g.basePath.endsWith("/") ? g.basePath : g.basePath;
    disallow.push(`${base}?*`);
    for (const name of g.paramNames) {
      disallow.push(`${base}?*${name}=*`);
    }
  }
  return [{ userAgent: "*", disallow }];
}

/** Build URL parameter table — distinct value counts per param name. */
export function buildParameterTable(urls: ParsedUrl[]): ParameterTableEntry[] {
  const map = new Map<string, Set<string>>();
  for (const u of urls) {
    for (const [k, v] of Object.entries(u.params)) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(v);
    }
  }
  const entries: ParameterTableEntry[] = [];
  for (const [name, values] of map) {
    entries.push({
      name,
      distinctValuesCount: values.size,
      exampleValues: Array.from(values).slice(0, 5),
    });
  }
  entries.sort((a, b) => b.distinctValuesCount - a.distinctValuesCount || a.name.localeCompare(b.name));
  return entries;
}

/** Filter recommendations by type, or return all. */
export function filterByRecommendation(
  recs: UrlRecommendation[],
  type: RecommendationType | "all",
): UrlRecommendation[] {
  if (type === "all") return recs;
  return recs.filter((r) => r.recommendation === type);
}

/** Compute summary stats from the analysis. */
export function summarize(result: AnalysisResult): SummaryStats {
  const byType: Record<RecommendationType, number> = {
    "self-canonical": 0,
    "canonical-to-base": 0,
    "block-in-robots": 0,
  };
  for (const r of result.recommendations) byType[r.recommendation] += 1;
  return {
    totalUrls: result.urls.length,
    basePaths: result.groups.length,
    totalParams: result.paramTable.length,
    duplicateContentCount: result.groups.filter((g) => g.hasDuplicateContentRisk).length,
    bloatCount: result.groups.filter((g) => g.hasBloat).length,
    recommendationsByType: byType,
  };
}

/** Full analysis pipeline. */
export function analyzeUrls(urls: ParsedUrl[]): AnalysisResult {
  const groups = groupByBasePath(urls);
  const recommendations: UrlRecommendation[] = [];
  for (const g of groups) {
    for (const u of g.urls) {
      recommendations.push(generateCanonicalRecommendation(u, g));
    }
  }
  const paramTable = buildParameterTable(urls);
  const robotsRules = generateRobotsRules(groups);
  const partial: AnalysisResult = {
    urls,
    groups,
    recommendations,
    paramTable,
    robotsRules,
    summary: {
      totalUrls: 0,
      basePaths: 0,
      totalParams: 0,
      duplicateContentCount: 0,
      bloatCount: 0,
      recommendationsByType: {
        "self-canonical": 0,
        "canonical-to-base": 0,
        "block-in-robots": 0,
      },
    },
  };
  partial.summary = summarize(partial);
  return partial;
}

/** Render the analysis as a plain-text report. */
export function renderTextReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("=== Faceted Nav SEO Analysis ===");
  lines.push("");
  lines.push(`Total URLs:        ${result.summary.totalUrls}`);
  lines.push(`Base paths:        ${result.summary.basePaths}`);
  lines.push(`Distinct params:   ${result.summary.totalParams}`);
  lines.push(`Duplicate-content groups: ${result.summary.duplicateContentCount}`);
  lines.push(`Parameter-bloat groups:   ${result.summary.bloatCount}`);
  lines.push("");
  lines.push("Recommendations:");
  lines.push(`  self-canonical:      ${result.summary.recommendationsByType["self-canonical"]}`);
  lines.push(`  canonical-to-base:   ${result.summary.recommendationsByType["canonical-to-base"]}`);
  lines.push(`  block-in-robots:     ${result.summary.recommendationsByType["block-in-robots"]}`);
  lines.push("");
  lines.push("--- Base-path groups ---");
  for (const g of result.groups) {
    lines.push("");
    lines.push(`Base path: ${g.basePath}`);
    lines.push(`  URLs: ${g.urls.length}`);
    lines.push(`  Combinations: ${g.combinationCount}${g.hasBloat ? " [BLOAT]" : ""}`);
    lines.push(`  Duplicate-content risk: ${g.hasDuplicateContentRisk ? "YES" : "no"}`);
    lines.push(`  Parameters: ${g.paramNames.join(", ") || "(none)"}`);
  }
  lines.push("");
  lines.push("--- URL parameter table ---");
  if (result.paramTable.length === 0) {
    lines.push("(no query parameters detected)");
  } else {
    for (const p of result.paramTable) {
      lines.push(`  ${p.name}: ${p.distinctValuesCount} distinct value(s) — e.g. ${p.exampleValues.slice(0, 3).join(", ")}`);
    }
  }
  lines.push("");
  lines.push("--- robots.txt suggestions ---");
  if (result.robotsRules.length === 0) {
    lines.push("(no robots.txt blocking required)");
  } else {
    for (const rule of result.robotsRules) {
      lines.push(`User-agent: ${rule.userAgent}`);
      for (const d of rule.disallow) lines.push(`Disallow: ${d}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Render recommendations as CSV. */
export function renderCsv(recs: UrlRecommendation[]): string {
  const lines = ["url,base_path,params,recommendation,reason"];
  for (const r of recs) {
    lines.push([
      escapeCsv(r.raw),
      escapeCsv(r.basePath),
      escapeCsv(r.params),
      r.recommendation,
      escapeCsv(r.reason),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render robots.txt as a string. */
export function renderRobotsTxt(rules: RobotsRule[]): string {
  if (rules.length === 0) return "# No robots.txt blocking required";
  const lines: string[] = [];
  for (const rule of rules) {
    lines.push(`User-agent: ${rule.userAgent}`);
    for (const d of rule.disallow) lines.push(`Disallow: ${d}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

export interface HistoryEntry {
  ts: number;
  urlCount: number;
  basePathsCount: number;
  duplicateGroups: number;
  bloatGroups: number;
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

export function buildShareUrl(urls: string): string {
  const params = new URLSearchParams();
  if (urls) params.set("urls", urls);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { urls: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { urls: "" };
  const params = new URLSearchParams(clean);
  return { urls: params.get("urls") ?? "" };
}
