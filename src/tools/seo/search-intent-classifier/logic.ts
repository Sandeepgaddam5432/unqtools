/**
 * Search Intent Classifier — pure logic.
 *
 * Classify search intent (informational, transactional, navigational,
 * commercial) from word patterns. Pure functions only — no DOM, no network.
 */

export type IntentType = "informational" | "navigational" | "transactional" | "commercial";

export interface IntentScore {
  intent: IntentType;
  score: number; // raw match score
  confidence: number; // 0-100 percentage
}

export interface ClassificationResult {
  keyword: string;
  primaryIntent: IntentType;
  confidence: number; // 0-100
  isMixed: boolean;
  scores: Record<IntentType, number>;
  matchedPatterns: string[];
  contentRecommendation: string;
  serpFeature: string;
}

export interface BulkResult {
  results: ClassificationResult[];
  total: number;
  distribution: Record<IntentType, number>;
  averageConfidence: number;
}

export const INTENT_PATTERNS: Record<IntentType, Array<{ pattern: string; weight: number }>> = {
  informational: [
    { pattern: "what is", weight: 3 },
    { pattern: "what are", weight: 3 },
    { pattern: "how to", weight: 3 },
    { pattern: "how do", weight: 3 },
    { pattern: "why", weight: 2 },
    { pattern: "when", weight: 2 },
    { pattern: "where", weight: 2 },
    { pattern: "who", weight: 2 },
    { pattern: "which", weight: 1 },
    { pattern: "guide", weight: 2 },
    { pattern: "tutorial", weight: 2 },
    { pattern: "examples", weight: 2 },
    { pattern: "definition", weight: 3 },
    { pattern: "meaning", weight: 3 },
    { pattern: "explained", weight: 2 },
    { pattern: "learn", weight: 2 },
    { pattern: "ideas", weight: 1 },
    { pattern: "tips", weight: 1 },
  ],
  navigational: [
    { pattern: "login", weight: 3 },
    { pattern: "log in", weight: 3 },
    { pattern: "sign in", weight: 3 },
    { pattern: "signin", weight: 3 },
    { pattern: "signup", weight: 3 },
    { pattern: "sign up", weight: 3 },
    { pattern: "register", weight: 2 },
    { pattern: "dashboard", weight: 3 },
    { pattern: "account", weight: 2 },
    { pattern: "official site", weight: 3 },
    { pattern: "website", weight: 1 },
    { pattern: "homepage", weight: 3 },
    { pattern: "app", weight: 1 },
  ],
  transactional: [
    { pattern: "buy", weight: 3 },
    { pattern: "purchase", weight: 3 },
    { pattern: "order", weight: 2 },
    { pattern: "shop", weight: 2 },
    { pattern: "cheap", weight: 2 },
    { pattern: "discount", weight: 2 },
    { pattern: "deal", weight: 2 },
    { pattern: "coupon", weight: 3 },
    { pattern: "for sale", weight: 3 },
    { pattern: "shipping", weight: 2 },
    { pattern: "subscribe", weight: 2 },
    { pattern: "download", weight: 2 },
    { pattern: "free trial", weight: 3 },
    { pattern: "price", weight: 2 },
    { pattern: "cost", weight: 2 },
  ],
  commercial: [
    { pattern: "best", weight: 3 },
    { pattern: "top", weight: 2 },
    { pattern: "review", weight: 3 },
    { pattern: "reviews", weight: 3 },
    { pattern: "vs", weight: 3 },
    { pattern: "versus", weight: 3 },
    { pattern: "compared", weight: 2 },
    { pattern: "comparison", weight: 3 },
    { pattern: "alternative", weight: 2 },
    { pattern: "alternatives", weight: 2 },
    { pattern: "rating", weight: 2 },
    { pattern: "rated", weight: 2 },
    { pattern: "premium", weight: 1 },
    { pattern: "professional", weight: 1 },
    { pattern: "cheap", weight: 1 },
    { pattern: "affordable", weight: 1 },
  ],
};

export const CONTENT_RECOMMENDATIONS: Record<IntentType, string> = {
  informational:
    "Write a comprehensive how-to guide or FAQ page (1,500+ words). Include a clear definition, step-by-step instructions, and answer common follow-up questions. Target the featured snippet with a concise summary at the top.",
  navigational:
    "Ensure your homepage or branded landing page ranks #1 for this query. Add sitelinks via clear site architecture and schema markup. If the query targets a competitor's brand, you cannot rank directly — bid on the keyword with paid search instead.",
  transactional:
    "Build a product or pricing page with a clear 'Buy' CTA above the fold. Show price, shipping, trust badges, and social proof. Optimize for Google Shopping by including product schema with price, availability, and rating.",
  commercial:
    "Create a comparison article or 'best of' listicle with a feature comparison table. Include individual product reviews, pros/cons, ratings, and a clear recommendation. Target the featured snippet with a concise comparison summary.",
};

export const SERP_FEATURES: Record<IntentType, string> = {
  informational: "Featured snippet, People Also Ask, sitelinks, video carousel",
  navigational: "Sitelinks, knowledge panel, brand pack",
  transactional: "Google Shopping, product carousel, sitelinks search box",
  commercial: "Featured snippet, reviews, product carousel, People Also Ask",
};

export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tokenize the keyword into words. */
export function tokenize(keyword: string): string[] {
  return normalize(keyword).split(" ").filter(Boolean);
}

/** Detect matched patterns for each intent. */
export function detectPatterns(keyword: string): {
  matched: Record<IntentType, string[]>;
  scores: Record<IntentType, number>;
} {
  const k = normalize(keyword);
  const matched: Record<IntentType, string[]> = {
    informational: [],
    navigational: [],
    transactional: [],
    commercial: [],
  };
  const scores: Record<IntentType, number> = {
    informational: 0,
    navigational: 0,
    transactional: 0,
    commercial: 0,
  };
  if (!k) return { matched, scores };
  const tokens = tokenize(k);
  for (const intent of Object.keys(INTENT_PATTERNS) as IntentType[]) {
    for (const { pattern, weight } of INTENT_PATTERNS[intent]) {
      // Match as full phrase (multi-word patterns)
      if (pattern.includes(" ")) {
        if (k.includes(pattern)) {
          matched[intent].push(pattern);
          scores[intent] += weight;
        }
      } else {
        // Match as a whole word
        if (tokens.includes(pattern)) {
          matched[intent].push(pattern);
          scores[intent] += weight;
        }
      }
    }
  }
  return { matched, scores };
}

/** Calculate confidence (0-100) from scores. */
export function calculateConfidence(scores: Record<IntentType, number>): {
  primary: IntentType;
  confidence: number;
  isMixed: boolean;
} {
  const entries = Object.entries(scores) as Array<[IntentType, number]>;
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) {
    // Default to informational when no signals
    return { primary: "informational", confidence: 25, isMixed: true };
  }
  entries.sort((a, b) => b[1] - a[1]);
  const [top, second] = entries;
  const primary = top[0];
  const confidence = Math.round((top[1] / total) * 100);
  const isMixed = second[1] > 0 && top[1] - second[1] <= 1;
  return { primary, confidence: Math.max(25, confidence), isMixed };
}

/** Classify a single keyword. */
export function classify(keyword: string): ClassificationResult {
  const k = normalize(keyword);
  const { matched, scores } = detectPatterns(k);
  const { primary, confidence, isMixed } = calculateConfidence(scores);
  return {
    keyword: k,
    primaryIntent: primary,
    confidence,
    isMixed,
    scores,
    matchedPatterns: matched[primary],
    contentRecommendation: CONTENT_RECOMMENDATIONS[primary],
    serpFeature: SERP_FEATURES[primary],
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

/** Dedup (case-insensitive). */
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

/** Classify many keywords in bulk. */
export function classifyBulk(keywords: string[]): BulkResult {
  const { unique } = dedup(keywords);
  const results = unique.map(classify);
  const distribution: Record<IntentType, number> = {
    informational: 0,
    navigational: 0,
    transactional: 0,
    commercial: 0,
  };
  let confSum = 0;
  for (const r of results) {
    distribution[r.primaryIntent]++;
    confSum += r.confidence;
  }
  const averageConfidence = results.length > 0 ? Math.round(confSum / results.length) : 0;
  return { results, total: results.length, distribution, averageConfidence };
}

/** Render as CSV. */
export function renderCsv(result: BulkResult): string {
  const lines = [
    "keyword,primary_intent,confidence,is_mixed,informational,navigational,transactional,commercial,matched_patterns",
  ];
  for (const r of result.results) {
    lines.push(
      [
        escapeCsv(r.keyword),
        r.primaryIntent,
        r.confidence,
        r.isMixed ? "yes" : "no",
        r.scores.informational,
        r.scores.navigational,
        r.scores.transactional,
        r.scores.commercial,
        escapeCsv(r.matchedPatterns.join("|")),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Get all patterns flattened for the reference table. */
export function getPatternReference(): Array<{ intent: IntentType; pattern: string; weight: number }> {
  const out: Array<{ intent: IntentType; pattern: string; weight: number }> = [];
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as Array<[IntentType, typeof INTENT_PATTERNS.informational]>) {
    for (const p of patterns) out.push({ intent, ...p });
  }
  return out;
}

// ---- History ----

const HISTORY_KEY = "unqtools:search-intent-classifier:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  keywordCount: number;
  distribution: Record<IntentType, number>;
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
