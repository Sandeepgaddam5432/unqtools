/**
 * Keyword Difficulty Estimator — pure logic.
 *
 * Estimate keyword difficulty (0-100) from known factors — word count,
 * character length, commercial intent, brand presence, SERP competition
 * indicators. Pure functions only — no DOM, no network.
 */

export type DifficultyCategory = "Easy" | "Medium" | "Hard" | "Very Hard";
export type SortField = "difficulty" | "opportunity" | "keyword";
export type SortDir = "asc" | "desc";

export interface DifficultyFactor {
  label: string;
  value: number; // contribution to difficulty (positive = harder)
  detail: string;
}

export interface DifficultyResult {
  keyword: string;
  difficulty: number;
  category: DifficultyCategory;
  opportunity: number;
  factors: DifficultyFactor[];
  recommendation: string;
}

export interface BulkResult {
  results: DifficultyResult[];
  total: number;
  averageDifficulty: number;
  categoryDistribution: Record<DifficultyCategory, number>;
}

export const COMMERCIAL_INTENT_WORDS = [
  "buy", "cheap", "price", "deal", "discount", "sale", "cost", "for sale",
  "order", "shop", "shipping", "coupon", "promo",
];

export const INTENT_PREFIXES = ["best", "top", "premium", "professional"];

export const QUESTION_WORDS = ["what", "how", "why", "when", "where", "who", "which"];

export const COMPARISON_WORDS = ["vs", "versus", "or", "alternative", "compared"];

/** Common brand-like TLD-free tokens — used as a heuristic for brand presence. */
const BRAND_TOKENS = new Set([
  "apple", "google", "amazon", "microsoft", "facebook", "meta", "netflix",
  "spotify", "tesla", "nike", "adidas", "samsung", "sony", "ibm", "intel",
  "nvidia", "zoom", "slack", "github", "gitlab", "shopify", "stripe",
]);

export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tokenize into words. */
export function tokenize(keyword: string): string[] {
  const k = normalize(keyword);
  if (!k) return [];
  return k.split(" ").filter(Boolean);
}

/** Detect commercial-intent tokens. */
export function findCommercialIntent(keyword: string): string[] {
  const words = tokenize(keyword);
  return COMMERCIAL_INTENT_WORDS.filter((w) => words.some((x) => x === w || x.startsWith(w)));
}

/** Detect brand-like tokens. */
export function findBrandTokens(keyword: string): string[] {
  const words = tokenize(keyword);
  return words.filter((w) => BRAND_TOKENS.has(w));
}

/** Detect intent-prefix tokens. */
export function findIntentPrefix(keyword: string): string | null {
  const words = tokenize(keyword);
  for (const p of INTENT_PREFIXES) {
    if (words[0] === p) return p;
  }
  return null;
}

/** Detect question word at start. */
export function findQuestionWord(keyword: string): string | null {
  const words = tokenize(keyword);
  if (words.length > 0 && QUESTION_WORDS.includes(words[0])) return words[0];
  return null;
}

/** Detect comparison modifier. */
export function findComparisonWord(keyword: string): string | null {
  const words = tokenize(keyword);
  for (const w of COMPARISON_WORDS) {
    if (words.includes(w)) return w;
  }
  return null;
}

/** Categorize a difficulty score. */
export function categorize(d: number): DifficultyCategory {
  if (d < 30) return "Easy";
  if (d < 55) return "Medium";
  if (d < 75) return "Hard";
  return "Very Hard";
}

/** Compute factor breakdown for a keyword. */
export function computeFactors(keyword: string): DifficultyFactor[] {
  const k = normalize(keyword);
  const words = tokenize(k);
  const wordCount = words.length;
  const factors: DifficultyFactor[] = [];

  // Word count factor
  let wcScore = 0;
  if (wordCount === 1) wcScore = 35;
  else if (wordCount === 2) wcScore = 18;
  else if (wordCount === 3) wcScore = 5;
  else if (wordCount === 4) wcScore = -8;
  else wcScore = -18;
  factors.push({
    label: "Word count",
    value: wcScore,
    detail: `${wordCount} word${wordCount === 1 ? "" : "s"} → ${wcScore >= 0 ? "+" : ""}${wcScore}`,
  });

  // Character length factor
  let charScore = 0;
  if (k.length > 35) charScore = -6;
  else if (k.length < 8) charScore = 5;
  factors.push({
    label: "Character length",
    value: charScore,
    detail: `${k.length} chars → ${charScore >= 0 ? "+" : ""}${charScore}`,
  });

  // Commercial intent factor
  const commercial = findCommercialIntent(k);
  let ciScore = 0;
  if (commercial.length > 0) ciScore = 12;
  factors.push({
    label: "Commercial intent",
    value: ciScore,
    detail: commercial.length > 0 ? `tokens: ${commercial.join(", ")} → +${ciScore}` : "none → 0",
  });

  // Brand presence factor
  const brands = findBrandTokens(k);
  let bScore = 0;
  if (brands.length > 0) bScore = 15;
  factors.push({
    label: "Brand presence",
    value: bScore,
    detail: brands.length > 0 ? `brands: ${brands.join(", ")} → +${bScore}` : "none → 0",
  });

  // Intent prefix factor
  const intent = findIntentPrefix(k);
  let iScore = 0;
  if (intent) iScore = 6;
  factors.push({
    label: "Intent prefix",
    value: iScore,
    detail: intent ? `"${intent}" → +${iScore}` : "none → 0",
  });

  // Question modifier factor
  const q = findQuestionWord(k);
  let qScore = 0;
  if (q) qScore = -12;
  factors.push({
    label: "Question modifier",
    value: qScore,
    detail: q ? `"${q}" → ${qScore}` : "none → 0",
  });

  // Comparison modifier factor
  const cmp = findComparisonWord(k);
  let cScore = 0;
  if (cmp) cScore = -5;
  factors.push({
    label: "Comparison modifier",
    value: cScore,
    detail: cmp ? `"${cmp}" → ${cScore}` : "none → 0",
  });

  return factors;
}

/** Compute the raw difficulty (sum of factors + base 50). */
export function computeDifficulty(keyword: string): number {
  const k = normalize(keyword);
  if (!k) return 0;
  const factors = computeFactors(k);
  let score = 50;
  for (const f of factors) score += f.value;
  // Deterministic jitter (-6 to +6) so score is stable per keyword
  const sum = k.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  score += ((sum % 12) - 6);
  return Math.max(1, Math.min(100, Math.round(score)));
}

/** Opportunity score = (100 - difficulty) + commercial boost. */
export function computeOpportunity(keyword: string, difficulty: number): number {
  const k = normalize(keyword);
  let score = 100 - difficulty;
  if (findCommercialIntent(k).length > 0) score += 10;
  if (findIntentPrefix(k)) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Generate a recommendation for the keyword. */
export function generateRecommendation(keyword: string, difficulty: number): string {
  const k = normalize(keyword);
  const cat = categorize(difficulty);
  const words = tokenize(k);
  if (cat === "Easy") {
    return `Easy difficulty — target this keyword now. Optimize title, H1, and meta description; create comprehensive content.`;
  }
  if (cat === "Medium") {
    return `Medium difficulty — target with solid long-form content (1,500+ words) and 3-5 internal links.`;
  }
  if (cat === "Hard") {
    if (words.length <= 2) {
      return `Hard head term — consider a longer-tail variant like "best ${k}" or "${k} for [audience]" to reduce difficulty.`;
    }
    return `Hard — needs authoritative content, backlinks, and strong topical coverage. Plan a content cluster around this keyword.`;
  }
  // Very Hard
  if (words.length <= 2) {
    return `Very Hard — major brands dominate. Target a 4-5 word long-tail variant containing this keyword instead.`;
  }
  return `Very Hard — skip for new sites. Consider informational content (a "how to" or "what is" variant) to build topical authority first.`;
}

/** Analyze a single keyword — full result. */
export function analyzeKeyword(keyword: string): DifficultyResult {
  const k = normalize(keyword);
  const difficulty = computeDifficulty(k);
  return {
    keyword: k,
    difficulty,
    category: categorize(difficulty),
    opportunity: computeOpportunity(k, difficulty),
    factors: computeFactors(k),
    recommendation: generateRecommendation(k, difficulty),
  };
}

/** Parse bulk keyword input. */
export function parseBulk(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Dedup a keyword list (case-insensitive). */
export function dedup(keywords: string[]): { unique: string[]; removed: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const k of keywords) {
    const norm = normalize(k);
    if (seen.has(norm)) {
      removed++;
      continue;
    }
    seen.add(norm);
    out.push(k);
  }
  return { unique: out, removed };
}

/** Sort results. */
export function sortResults(results: DifficultyResult[], field: SortField, dir: SortDir): DifficultyResult[] {
  const sorted = [...results];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === "difficulty") cmp = a.difficulty - b.difficulty;
    else if (field === "opportunity") cmp = a.opportunity - b.opportunity;
    else cmp = a.keyword.localeCompare(b.keyword);
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/** Analyze a list of keywords in bulk. */
export function analyzeBulk(keywords: string[]): BulkResult {
  const { unique } = dedup(keywords);
  const results = unique.map(analyzeKeyword);
  const total = results.length;
  const sum = results.reduce((acc, r) => acc + r.difficulty, 0);
  const averageDifficulty = total > 0 ? Math.round(sum / total) : 0;
  const categoryDistribution: Record<DifficultyCategory, number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
    "Very Hard": 0,
  };
  for (const r of results) categoryDistribution[r.category]++;
  return { results, total, averageDifficulty, categoryDistribution };
}

/** Render as CSV. */
export function renderCsv(result: BulkResult): string {
  const lines = ["keyword,difficulty,category,opportunity"];
  for (const r of result.results) {
    lines.push(`${escapeCsv(r.keyword)},${r.difficulty},${r.category},${r.opportunity}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History ----

const HISTORY_KEY = "unqtools:keyword-difficulty-estimator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  keywordCount: number;
  averageDifficulty: number;
  snippet: string;
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

export function buildShareUrl(keywords: string): string {
  const params = new URLSearchParams();
  if (keywords) params.set("kw", keywords);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { keywords: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { keywords: "" };
  const params = new URLSearchParams(clean);
  return { keywords: params.get("kw") ?? "" };
}
