/**
 * Keyword Research Explorer — pure logic.
 *
 * Generate keyword suggestions (synonyms, related, questions, comparisons,
 * intent modifiers) from seed keywords. Algorithmic search-volume and
 * difficulty estimates. Pure functions only — no DOM, no network.
 */

export type KeywordCategory =
  | "seed"
  | "synonym"
  | "related"
  | "question"
  | "comparison"
  | "intent";

export type SortField = "volume" | "difficulty" | "keyword" | "category";
export type SortDir = "asc" | "desc";

export interface ModifierOptions {
  synonyms?: boolean;
  related?: boolean;
  questions?: boolean;
  comparisons?: boolean;
  intent?: boolean;
}

export interface GeneratedKeyword {
  keyword: string;
  category: KeywordCategory;
  modifier: string;
  seed: string;
  volume: number; // algorithmic estimate 0-10000
  difficulty: number; // 0-100
}

export interface GenerationResult {
  keywords: GeneratedKeyword[];
  total: number;
  byCategory: Record<string, number>;
  duplicatesRemoved: number;
}

export const QUESTION_MODIFIERS = [
  "what", "how", "why", "when", "where", "who", "which",
];

export const COMPARISON_MODIFIERS = [
  "vs", "or", "alternative to", "compared to", "better than",
];

export const INTENT_MODIFIERS = [
  "best", "top", "cheap", "free", "affordable", "how to", "buy", "review",
  "professional", "premium",
];

export const RELATED_MODIFIERS = [
  "tools", "software", "services", "guide", "tips", "examples", "templates",
  "for beginners", "for small business", "checklist",
];

/** Basic synonym dictionary for common seed words. Extendable. */
export const SYNONYMS: Record<string, string[]> = {
  seo: ["search engine optimization", "organic search", "serp ranking"],
  marketing: ["advertising", "promotion", "outreach", "growth"],
  content: ["article", "blog post", "copy", "material"],
  tool: ["software", "app", "platform", "application", "utility"],
  tools: ["software", "apps", "platforms", "applications", "utilities"],
  email: ["mail", "newsletter", "campaign"],
  design: ["layout", "ui", "ux", "visual"],
  website: ["site", "web page", "landing page"],
  business: ["company", "brand", "enterprise", "startup"],
  ai: ["artificial intelligence", "machine learning", "ml", "automation"],
  crypto: ["cryptocurrency", "bitcoin", "blockchain", "tokens"],
  fitness: ["exercise", "workout", "training", "gym"],
  recipe: ["cooking", "dish", "meal", "food"],
  travel: ["trip", "vacation", "tour", "destination"],
};

/** Normalize: lowercase, collapse whitespace, trim. */
export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse bulk seed input (newline or comma separated). */
export function parseSeeds(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Apply a question modifier. */
export function applyQuestion(seed: string, m: string): string {
  if (!seed) return "";
  return normalize(`${m} ${seed}`);
}

/** Apply a comparison modifier. */
export function applyComparison(seed: string, m: string): string {
  if (!seed) return "";
  if (m === "vs" || m === "or") return normalize(`${seed} ${m} ?`);
  return normalize(`${seed} ${m} ?`);
}

/** Apply an intent modifier. */
export function applyIntent(seed: string, m: string): string {
  if (!seed) return "";
  if (m === "how to") return normalize(`how to ${seed}`);
  return normalize(`${m} ${seed}`);
}

/** Apply a related modifier. */
export function applyRelated(seed: string, m: string): string {
  if (!seed) return "";
  return normalize(`${seed} ${m}`);
}

/** Get synonyms for a seed (multi-word seeds use the head word). */
export function getSynonyms(seed: string): string[] {
  const s = normalize(seed);
  if (!s) return [];
  const words = s.split(" ");
  const head = words[0];
  const direct = SYNONYMS[head] || SYNONYMS[s];
  if (!direct) return [];
  return direct.map((syn) => normalize(words.length > 1 ? `${syn} ${words.slice(1).join(" ")}` : syn));
}

/** True when keyword contains a commercial-intent token. */
export function hasCommercialIntent(keyword: string): boolean {
  const k = normalize(keyword);
  return INTENT_MODIFIERS.some((m) => k.split(" ").includes(m.split(" ")[0])) ||
    /\b(buy|price|cheap|deal|discount|sale|cost|for sale)\b/.test(k);
}

/** Algorithmic search-volume estimate (0-10000). */
export function estimateVolume(keyword: string): number {
  const k = normalize(keyword);
  if (!k) return 0;
  const words = k.split(" ").filter(Boolean);
  const wordCount = words.length;
  const charCount = k.length;
  // Base: short head terms = high volume, long-tail = low
  let base: number;
  if (wordCount === 1) base = 8000;
  else if (wordCount === 2) base = 3500;
  else if (wordCount === 3) base = 1500;
  else if (wordCount === 4) base = 700;
  else base = 250;
  // Commercial intent boost
  if (hasCommercialIntent(k)) base *= 1.15;
  // Question modifiers reduce volume slightly
  if (QUESTION_MODIFIERS.includes(words[0])) base *= 0.85;
  // Comparison modifiers reduce volume
  if (COMPARISON_MODIFIERS.some((m) => k.includes(m.split(" ")[0]))) base *= 0.9;
  // Long character count reduces volume
  if (charCount > 40) base *= 0.7;
  // Deterministic jitter based on character sum (so volume is stable per keyword)
  const sum = k.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const jitter = 1 + ((sum % 20) - 10) / 100; // -9% to +9%
  base *= jitter;
  return Math.max(10, Math.min(10000, Math.round(base)));
}

/** Algorithmic difficulty score (0-100). Higher = harder. */
export function estimateDifficulty(keyword: string): number {
  const k = normalize(keyword);
  if (!k) return 0;
  const words = k.split(" ").filter(Boolean);
  const wordCount = words.length;
  let score = 50;
  // Word count: fewer words = harder
  if (wordCount === 1) score += 35;
  else if (wordCount === 2) score += 18;
  else if (wordCount === 3) score += 5;
  else if (wordCount === 4) score -= 8;
  else score -= 18;
  // Commercial intent: harder
  if (hasCommercialIntent(k)) score += 12;
  // Brand-like single tokens: very hard
  if (wordCount === 1 && /^[a-z]+$/.test(k) && k.length <= 6) score += 8;
  // Question modifiers: easier (long-tail)
  if (QUESTION_MODIFIERS.includes(words[0])) score -= 12;
  // Comparison: slightly easier
  if (COMPARISON_MODIFIERS.some((m) => k.includes(m.split(" ")[0]))) score -= 5;
  // Long character count: easier
  if (k.length > 35) score -= 6;
  // Intent modifier prefix (best, top): harder
  if (["best", "top", "buy"].includes(words[0])) score += 6;
  // Stable jitter
  const sum = k.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  score += ((sum % 12) - 6);
  return Math.max(1, Math.min(100, Math.round(score)));
}

/** Categorize difficulty into Easy / Medium / Hard / Very Hard. */
export function difficultyCategory(d: number): "Easy" | "Medium" | "Hard" | "Very Hard" {
  if (d < 30) return "Easy";
  if (d < 55) return "Medium";
  if (d < 75) return "Hard";
  return "Very Hard";
}

/** Generate variants for a single seed. */
export function generateForSeed(seed: string, options: ModifierOptions = {}): GeneratedKeyword[] {
  const s = normalize(seed);
  if (!s) return [];
  const out: GeneratedKeyword[] = [];
  // Seed itself
  out.push({
    keyword: s,
    category: "seed",
    modifier: "(seed)",
    seed: s,
    volume: estimateVolume(s),
    difficulty: estimateDifficulty(s),
  });
  if (options.synonyms) {
    for (const syn of getSynonyms(s)) {
      out.push({
        keyword: syn,
        category: "synonym",
        modifier: "synonym",
        seed: s,
        volume: estimateVolume(syn),
        difficulty: estimateDifficulty(syn),
      });
    }
  }
  if (options.related) {
    for (const m of RELATED_MODIFIERS) {
      const k = applyRelated(s, m);
      out.push({
        keyword: k,
        category: "related",
        modifier: m,
        seed: s,
        volume: estimateVolume(k),
        difficulty: estimateDifficulty(k),
      });
    }
  }
  if (options.questions) {
    for (const m of QUESTION_MODIFIERS) {
      const k = applyQuestion(s, m);
      out.push({
        keyword: k,
        category: "question",
        modifier: m,
        seed: s,
        volume: estimateVolume(k),
        difficulty: estimateDifficulty(k),
      });
    }
  }
  if (options.comparisons) {
    for (const m of COMPARISON_MODIFIERS) {
      const k = applyComparison(s, m);
      out.push({
        keyword: k,
        category: "comparison",
        modifier: m,
        seed: s,
        volume: estimateVolume(k),
        difficulty: estimateDifficulty(k),
      });
    }
  }
  if (options.intent) {
    for (const m of INTENT_MODIFIERS) {
      const k = applyIntent(s, m);
      out.push({
        keyword: k,
        category: "intent",
        modifier: m,
        seed: s,
        volume: estimateVolume(k),
        difficulty: estimateDifficulty(k),
      });
    }
  }
  return out;
}

/** Dedup a list of generated keywords (case-insensitive). */
export function dedupKeywords(keywords: GeneratedKeyword[]): { unique: GeneratedKeyword[]; removed: number } {
  const seen = new Set<string>();
  const out: GeneratedKeyword[] = [];
  let removed = 0;
  for (const k of keywords) {
    const norm = normalize(k.keyword);
    if (seen.has(norm)) {
      removed++;
      continue;
    }
    seen.add(norm);
    out.push(k);
  }
  return { unique: out, removed };
}

/** Sort keywords by a chosen field + direction. */
export function sortKeywords(
  keywords: GeneratedKeyword[],
  field: SortField = "volume",
  dir: SortDir = "desc",
): GeneratedKeyword[] {
  const sorted = [...keywords];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === "volume") cmp = a.volume - b.volume;
    else if (field === "difficulty") cmp = a.difficulty - b.difficulty;
    else if (field === "keyword") cmp = a.keyword.localeCompare(b.keyword);
    else if (field === "category") cmp = a.category.localeCompare(b.category);
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/** Full pipeline: parse seeds, generate, dedup, categorize. */
export function generate(seeds: string[], options: ModifierOptions = {}): GenerationResult {
  const all: GeneratedKeyword[] = [];
  for (const s of seeds) {
    all.push(...generateForSeed(s, options));
  }
  const { unique, removed } = dedupKeywords(all);
  const byCategory: Record<string, number> = {};
  for (const k of unique) {
    byCategory[k.category] = (byCategory[k.category] ?? 0) + 1;
  }
  return {
    keywords: unique,
    total: unique.length,
    byCategory,
    duplicatesRemoved: removed,
  };
}

/** Render as CSV. */
export function renderCsv(result: GenerationResult): string {
  const lines = ["keyword,category,modifier,seed,volume,difficulty,difficulty_category"];
  for (const k of result.keywords) {
    lines.push(
      [
        escapeCsv(k.keyword),
        k.category,
        escapeCsv(k.modifier),
        escapeCsv(k.seed),
        k.volume,
        k.difficulty,
        difficultyCategory(k.difficulty),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History ----

const HISTORY_KEY = "unqtools:keyword-research-explorer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  seedCount: number;
  total: number;
  options: ModifierOptions;
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

export function buildShareUrl(input: { seeds: string; options: ModifierOptions }): string {
  const params = new URLSearchParams();
  if (input.seeds) params.set("seeds", input.seeds);
  if (input.options.synonyms) params.set("synonyms", "1");
  if (input.options.related) params.set("related", "1");
  if (input.options.questions) params.set("questions", "1");
  if (input.options.comparisons) params.set("comparisons", "1");
  if (input.options.intent) params.set("intent", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { seeds: string; options: ModifierOptions } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { seeds: "", options: {} };
  const params = new URLSearchParams(clean);
  return {
    seeds: params.get("seeds") ?? "",
    options: {
      synonyms: params.get("synonyms") === "1",
      related: params.get("related") === "1",
      questions: params.get("questions") === "1",
      comparisons: params.get("comparisons") === "1",
      intent: params.get("intent") === "1",
    },
  };
}
