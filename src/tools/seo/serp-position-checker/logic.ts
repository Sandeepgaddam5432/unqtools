/**
 * SERP Position Checker — pure logic.
 *
 * Estimate SERP position from keyword difficulty factors. Pure functions
 * only — no DOM, no network.
 */

export interface EstimateInput {
  keyword: string;
  url: string;
  domainAuthority: number; // 0-100
  backlinks: number; // raw count
  contentWords: number; // page content length
  titleHasKeyword: boolean;
  intentMatch: boolean; // page intent matches search intent
}

export interface FactorScore {
  name: string;
  raw: number; // 0-100 score for this factor
  weight: number; // 0-1
  contribution: number; // weighted position adjustment
  note: string;
}

export type PositionCategory =
  | "Top 3"
  | "Top 10"
  | "Top 20"
  | "Top 50"
  | "Top 100"
  | "Beyond 100";

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";

export interface EstimateResult {
  keyword: string;
  url: string;
  estimatedPosition: number; // 1-100+
  category: PositionCategory;
  difficulty: number; // 0-100
  intent: SearchIntent;
  factors: FactorScore[];
  recommendations: string[];
  urlMatch: "exact" | "partial" | "none";
}

export interface BulkResult {
  results: EstimateResult[];
  total: number;
  byCategory: Record<string, number>;
}

export const RANKING_FACTORS_REFERENCE: { name: string; weight: number; description: string }[] = [
  { name: "URL match", weight: 0.18, description: "Exact keyword in URL slug = strongest signal" },
  { name: "Title tag", weight: 0.20, description: "Exact keyword in title tag — critical on-page factor" },
  { name: "Content depth", weight: 0.12, description: "Long-form content (1000+ words) ranks better for competitive terms" },
  { name: "Domain authority", weight: 0.22, description: "Higher DA = stronger site-level ranking power" },
  { name: "Backlink count", weight: 0.13, description: "More referring domains = more authority transferred" },
  { name: "Keyword difficulty", weight: 0.10, description: "Inverse — higher difficulty pushes position down" },
  { name: "Intent match", weight: 0.05, description: "Page intent must match search intent" },
];

const INTENT_KEYWORDS: Record<SearchIntent, string[]> = {
  informational: ["what", "how", "why", "guide", "tutorial", "examples", "definition"],
  commercial: ["best", "top", "review", "compare", "vs", "alternatives"],
  transactional: ["buy", "price", "cheap", "discount", "deal", "for sale", "order"],
  navigational: ["login", "sign in", "official", "website"],
};

/** Normalize a keyword or URL. */
export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract the slug from a URL. */
export function extractSlug(url: string): string {
  if (!url) return "";
  const s = normalize(url);
  const cleaned = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slash = cleaned.indexOf("/");
  if (slash < 0) return "";
  const path = cleaned.slice(slash + 1);
  // Strip query/hash
  const q = path.indexOf("?");
  const h = path.indexOf("#");
  let slug = path;
  if (q >= 0) slug = slug.slice(0, q);
  if (h >= 0) slug = slug.slice(0, h);
  // Use the last segment
  const parts = slug.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

/** Extract domain from URL. */
export function extractDomain(url: string): string {
  if (!url) return "";
  const s = normalize(url);
  const cleaned = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slash = cleaned.indexOf("/");
  return slash >= 0 ? cleaned.slice(0, slash) : cleaned;
}

/** Classify search intent from keyword. */
export function classifyIntent(keyword: string): SearchIntent {
  const k = normalize(keyword);
  if (!k) return "informational";
  const words = k.split(" ");
  for (const intent of Object.keys(INTENT_KEYWORDS) as SearchIntent[]) {
    if (INTENT_KEYWORDS[intent].some((m) => words.includes(m) || k.includes(m))) {
      return intent;
    }
  }
  return "informational";
}

/** Detect URL match type. */
export function urlMatch(keyword: string, url: string): "exact" | "partial" | "none" {
  const k = normalize(keyword);
  const slug = extractSlug(url);
  if (!k || !slug) return "none";
  const slugWords = slug.split(/[-_/.]+/).filter(Boolean);
  const kwWords = k.split(" ").filter(Boolean);
  if (slug === k.replace(/\s+/g, "-") || slug === k.replace(/\s+/g, "")) return "exact";
  const overlap = kwWords.filter((w) => slugWords.includes(w)).length;
  if (overlap >= Math.ceil(kwWords.length / 2)) return "partial";
  return "none";
}

/** Algorithmic keyword difficulty (0-100). Higher = harder. */
export function estimateDifficulty(keyword: string): number {
  const k = normalize(keyword);
  if (!k) return 0;
  const words = k.split(" ").filter(Boolean);
  const wordCount = words.length;
  let score = 50;
  if (wordCount === 1) score += 30;
  else if (wordCount === 2) score += 15;
  else if (wordCount === 3) score += 5;
  else if (wordCount === 4) score -= 8;
  else score -= 15;
  const intent = classifyIntent(k);
  if (intent === "commercial" || intent === "transactional") score += 12;
  if (k.length > 35) score -= 6;
  const sum = k.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  score += (sum % 12) - 6;
  return Math.max(1, Math.min(100, Math.round(score)));
}

/** Clamp a number to a range. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Compute the per-factor scores for an input. */
export function computeFactors(input: EstimateInput): FactorScore[] {
  const factors: FactorScore[] = [];
  // URL match
  const match = urlMatch(input.keyword, input.url);
  const matchScore = match === "exact" ? 95 : match === "partial" ? 65 : 25;
  factors.push({
    name: "URL match",
    raw: matchScore,
    weight: 0.18,
    contribution: (matchScore - 50) * 0.18 * -0.2,
    note: match === "exact" ? "Exact keyword in URL" : match === "partial" ? "Partial keyword match in URL" : "No keyword in URL — consider rewriting slug",
  });
  // Title tag
  const titleScore = input.titleHasKeyword ? 90 : 35;
  factors.push({
    name: "Title tag",
    raw: titleScore,
    weight: 0.20,
    contribution: (titleScore - 50) * 0.20 * -0.2,
    note: input.titleHasKeyword ? "Keyword in title tag" : "Add keyword to title tag",
  });
  // Content depth
  const depthScore = clamp((input.contentWords / 1500) * 100, 0, 100);
  factors.push({
    name: "Content depth",
    raw: Math.round(depthScore),
    weight: 0.12,
    contribution: (depthScore - 50) * 0.12 * -0.2,
    note: input.contentWords < 500 ? "Thin content — aim for 1000+ words" : input.contentWords < 1000 ? "Add more depth" : "Good content depth",
  });
  // Domain authority
  const daScore = clamp(input.domainAuthority, 0, 100);
  factors.push({
    name: "Domain authority",
    raw: daScore,
    weight: 0.22,
    contribution: (daScore - 50) * 0.22 * -0.2,
    note: daScore < 30 ? "Low DA — focus on long-tail first" : daScore < 60 ? "Medium DA — competitive for mid-tail" : "High DA — competitive for head terms",
  });
  // Backlinks
  const backlinkScore = clamp(Math.log10(Math.max(1, input.backlinks)) * 25, 0, 100);
  factors.push({
    name: "Backlink count",
    raw: Math.round(backlinkScore),
    weight: 0.13,
    contribution: (backlinkScore - 50) * 0.13 * -0.2,
    note: input.backlinks < 10 ? "Few backlinks — build more referring domains" : input.backlinks < 50 ? "Growing backlink profile" : "Strong backlink profile",
  });
  // Keyword difficulty (inverse)
  const diff = estimateDifficulty(input.keyword);
  const diffScore = 100 - diff;
  factors.push({
    name: "Keyword difficulty",
    raw: diffScore,
    weight: 0.10,
    contribution: (diffScore - 50) * 0.10 * -0.2,
    note: diff < 30 ? "Easy keyword" : diff < 55 ? "Medium difficulty" : diff < 75 ? "Hard keyword" : "Very hard keyword",
  });
  // Intent match
  const intentScore = input.intentMatch ? 90 : 30;
  factors.push({
    name: "Intent match",
    raw: intentScore,
    weight: 0.05,
    contribution: (intentScore - 50) * 0.05 * -0.2,
    note: input.intentMatch ? "Page intent matches search intent" : "Mismatch — align page intent with keyword",
  });
  return factors;
}

/** Categorize an estimated position. */
export function positionCategory(position: number): PositionCategory {
  if (position <= 3) return "Top 3";
  if (position <= 10) return "Top 10";
  if (position <= 20) return "Top 20";
  if (position <= 50) return "Top 50";
  if (position <= 100) return "Top 100";
  return "Beyond 100";
}

/** Build recommendations for the result. */
export function buildRecommendations(factors: FactorScore[], category: PositionCategory): string[] {
  const recs: string[] = [];
  for (const f of factors) {
    if (f.raw < 50) recs.push(`Improve ${f.name.toLowerCase()}: ${f.note}`);
  }
  if (category === "Beyond 100" || category === "Top 100") {
    recs.push("Target a less competitive long-tail variant of this keyword");
  }
  if (category === "Top 3" || category === "Top 10") {
    recs.push("Maintain content freshness — update quarterly");
  }
  if (recs.length === 0) recs.push("Profile is balanced — keep monitoring");
  return recs;
}

/** Estimate SERP position for a single input. */
export function estimate(input: EstimateInput): EstimateResult {
  const factors = computeFactors(input);
  const totalContribution = factors.reduce((acc, f) => acc + f.contribution, 0);
  // Base position 30 (mid-SERP) + adjustments
  const base = 30;
  const adjusted = base + totalContribution;
  const difficulty = estimateDifficulty(input.keyword);
  const intent = classifyIntent(input.keyword);
  const estimatedPosition = Math.max(1, Math.min(101, Math.round(adjusted)));
  const category = positionCategory(estimatedPosition);
  const recommendations = buildRecommendations(factors, category);
  return {
    keyword: normalize(input.keyword),
    url: input.url,
    estimatedPosition,
    category,
    difficulty,
    intent,
    factors,
    recommendations,
    urlMatch: urlMatch(input.keyword, input.url),
  };
}

/** Parse bulk input — one keyword per line, optionally with URL. */
export function parseBulk(input: string, defaults: Partial<EstimateInput> = {}): EstimateInput[] {
  if (!input || !input.trim()) return [];
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: EstimateInput[] = [];
  for (const line of lines) {
    const cols = line.split(/[,\t]/).map((c) => c.trim());
    const keyword = cols[0];
    const url = cols[1] ?? "";
    if (!keyword) continue;
    out.push({
      keyword,
      url,
      domainAuthority: defaults.domainAuthority ?? 40,
      backlinks: defaults.backlinks ?? 20,
      contentWords: defaults.contentWords ?? 1000,
      titleHasKeyword: defaults.titleHasKeyword ?? true,
      intentMatch: defaults.intentMatch ?? true,
    });
  }
  return out;
}

/** Run bulk estimation. */
export function estimateBulk(inputs: EstimateInput[]): BulkResult {
  const results = inputs.map(estimate);
  const byCategory: Record<string, number> = {};
  for (const r of results) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }
  return { results, total: results.length, byCategory };
}

/** Render results as CSV. */
export function renderCsv(result: BulkResult): string {
  const lines = ["keyword,url,estimated_position,category,difficulty,intent,url_match"];
  for (const r of result.results) {
    lines.push([
      escapeCsv(r.keyword),
      escapeCsv(r.url),
      r.estimatedPosition,
      r.category,
      r.difficulty,
      r.intent,
      r.urlMatch,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:serp-position-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  total: number;
  top10: number;
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
