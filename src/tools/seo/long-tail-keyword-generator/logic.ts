/**
 * Long-Tail Keyword Generator — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export interface ModifierOptions {
  question?: boolean;
  comparison?: boolean;
  location?: boolean;
  intent?: boolean;
  customLocation?: string;
}

export interface GeneratedKeyword {
  keyword: string;
  modifier: string;
  category: "question" | "comparison" | "location" | "intent" | "seed";
  seed: string;
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
  "vs", "or", "compared to", "alternative to", "better than",
];

export const DEFAULT_LOCATION_MODIFIERS = [
  "near me", "in USA", "in UK", "in Canada", "in Australia", "in India",
];

export const INTENT_MODIFIERS = [
  "best", "top", "cheap", "free", "affordable", "how to", "buy", "review",
  "professional", "premium",
];

/** Apply a single question modifier to a seed keyword. */
export function applyQuestionModifier(seed: string, modifier: string): string {
  if (!seed) return "";
  return `${modifier} ${seed}`.trim().toLowerCase();
}

/** Apply comparison modifier. */
export function applyComparisonModifier(seed: string, modifier: string): string {
  if (!seed) return "";
  if (modifier === "vs" || modifier === "or") return `${seed} ${modifier} ?`.toLowerCase();
  return `${seed} ${modifier} ?`.toLowerCase();
}

/** Apply location modifier. */
export function applyLocationModifier(seed: string, modifier: string): string {
  if (!seed) return "";
  return `${seed} ${modifier}`.trim().toLowerCase();
}

/** Apply intent modifier. */
export function applyIntentModifier(seed: string, modifier: string): string {
  if (!seed) return "";
  if (modifier === "how to") return `how to ${seed}`.toLowerCase();
  return `${modifier} ${seed}`.trim().toLowerCase();
}

/** Normalize a keyword: lowercase, collapse whitespace. */
export function normalize(keyword: string): string {
  return (keyword || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Generate all variants for a single seed keyword. */
export function generateForSeed(seed: string, options: ModifierOptions = {}): GeneratedKeyword[] {
  if (!seed || !seed.trim()) return [];
  const s = normalize(seed);
  const out: GeneratedKeyword[] = [];
  out.push({ keyword: s, modifier: "(seed)", category: "seed", seed: s });
  if (options.question) {
    for (const m of QUESTION_MODIFIERS) {
      out.push({ keyword: applyQuestionModifier(s, m), modifier: m, category: "question", seed: s });
    }
  }
  if (options.comparison) {
    for (const m of COMPARISON_MODIFIERS) {
      out.push({ keyword: applyComparisonModifier(s, m), modifier: m, category: "comparison", seed: s });
    }
  }
  if (options.location) {
    const locations = options.customLocation
      ? [normalize(options.customLocation)]
      : DEFAULT_LOCATION_MODIFIERS;
    for (const m of locations) {
      out.push({ keyword: applyLocationModifier(s, m), modifier: m, category: "location", seed: s });
    }
  }
  if (options.intent) {
    for (const m of INTENT_MODIFIERS) {
      out.push({ keyword: applyIntentModifier(s, m), modifier: m, category: "intent", seed: s });
    }
  }
  return out;
}

/** Parse bulk seed input (one per line / comma-separated). */
export function parseSeeds(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
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

/** Generate variants for multiple seeds. */
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

/** Render keywords as CSV. */
export function renderCsv(result: GenerationResult): string {
  const lines = ["keyword,category,modifier,seed"];
  for (const k of result.keywords) {
    lines.push(`${escapeCsv(k.keyword)},${k.category},${escapeCsv(k.modifier)},${escapeCsv(k.seed)}`);
  }
  return lines.join("\n");
}

/** Render keywords as a plain text list (one per line). */
export function renderList(result: GenerationResult): string {
  return result.keywords.map((k) => k.keyword).join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:long-tail-keyword-generator:history";
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

export function buildShareUrl(input: {
  seeds: string;
  options: ModifierOptions;
}): string {
  const params = new URLSearchParams();
  if (input.seeds) params.set("seeds", input.seeds);
  if (input.options.question) params.set("question", "1");
  if (input.options.comparison) params.set("comparison", "1");
  if (input.options.location) params.set("location", "1");
  if (input.options.intent) params.set("intent", "1");
  if (input.options.customLocation) params.set("customLocation", input.options.customLocation);
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
      question: params.get("question") === "1",
      comparison: params.get("comparison") === "1",
      location: params.get("location") === "1",
      intent: params.get("intent") === "1",
      customLocation: params.get("customLocation") ?? undefined,
    },
  };
}
