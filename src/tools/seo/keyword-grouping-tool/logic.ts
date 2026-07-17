/**
 * Keyword Grouping Tool — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export type Intent = "informational" | "transactional" | "navigational" | "other";

export interface KeywordGroup {
  name: string;
  keywords: string[];
  count: number;
  intent: Intent;
}

export interface GroupingResult {
  clusters: KeywordGroup[];
  totalKeywords: number;
  uniqueKeywords: number;
  duplicatesRemoved: number;
  intentCounts: Record<Intent, number>;
}

export interface GroupingOptions {
  strategy: "common-word" | "intent";
  minClusterSize: number;
  removeStopWords: boolean;
}

/** Common English stop words. */
export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "for", "on", "with",
  "as", "by", "at", "from", "is", "are", "was", "were", "be", "this", "that",
  "it", "we", "you", "they", "i", "my", "your", "what", "which", "who", "how",
  "why", "when", "where", "best", "top", "cheap", "free", "buy", "near me",
]);

/** Intent signals. */
export const INTENT_SIGNALS: Record<Intent, string[]> = {
  informational: ["how", "what", "why", "when", "where", "who", "which", "guide", "tutorial", "examples", "ideas", "tips", "learn"],
  transactional: ["buy", "price", "cheap", "discount", "deal", "sale", "coupon", "order", "shipping", "shop", "best", "top", "review", "vs", "compare", "premium", "pro"],
  navigational: ["login", "log in", "sign in", "signin", "dashboard", "account", "official", "website"],
  other: [],
};

/** Parse keyword list (one per line / comma-separated). */
export function parseKeywords(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Dedup keywords (case-insensitive). */
export function dedupKeywords(keywords: string[]): { unique: string[]; removed: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const k of keywords) {
    const norm = k.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(norm)) {
      removed++;
      continue;
    }
    seen.add(norm);
    out.push(norm);
  }
  return { unique: out, removed };
}

/** Find the head term of a keyword — most meaningful non-stop word. */
export function findHeadTerm(keyword: string, removeStopWords: boolean): string {
  if (!keyword) return "";
  const words = keyword.split(/\s+/);
  if (words.length === 0) return "";
  if (!removeStopWords) return words[0];
  for (const w of words) {
    if (!STOP_WORDS.has(w)) return w;
  }
  return words[0];
}

/** Classify a single keyword's intent. */
export function classifyIntent(keyword: string): Intent {
  if (!keyword) return "other";
  const lower = keyword.toLowerCase();
  // Check navigational first (most specific)
  for (const sig of INTENT_SIGNALS.navigational) {
    if (lower.includes(sig)) return "navigational";
  }
  // Then transactional
  for (const sig of INTENT_SIGNALS.transactional) {
    if (lower.includes(sig)) return "transactional";
  }
  // Then informational
  for (const sig of INTENT_SIGNALS.informational) {
    if (lower.includes(sig)) return "informational";
  }
  return "other";
}

/** Group keywords by common head term. */
export function groupByCommonWord(
  keywords: string[],
  options: { minClusterSize: number; removeStopWords: boolean },
): KeywordGroup[] {
  const byHead = new Map<string, string[]>();
  for (const k of keywords) {
    const head = findHeadTerm(k, options.removeStopWords);
    if (!head) continue;
    if (!byHead.has(head)) byHead.set(head, []);
    byHead.get(head)!.push(k);
  }
  const clusters: KeywordGroup[] = [];
  for (const [name, kws] of byHead) {
    if (kws.length < options.minClusterSize) continue;
    const intents = kws.map((k) => classifyIntent(k));
    const intentCount: Record<Intent, number> = {
      informational: 0, transactional: 0, navigational: 0, other: 0,
    };
    for (const i of intents) intentCount[i]++;
    // Pick dominant intent
    const dominant = (Object.entries(intentCount) as [Intent, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    clusters.push({
      name,
      keywords: kws.sort(),
      count: kws.length,
      intent: dominant,
    });
  }
  clusters.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return clusters;
}

/** Group keywords by intent. */
export function groupByIntent(keywords: string[]): KeywordGroup[] {
  const byIntent = new Map<Intent, string[]>();
  for (const k of keywords) {
    const intent = classifyIntent(k);
    if (!byIntent.has(intent)) byIntent.set(intent, []);
    byIntent.get(intent)!.push(k);
  }
  const clusters: KeywordGroup[] = [];
  for (const [intent, kws] of byIntent) {
    clusters.push({
      name: intent,
      keywords: kws.sort(),
      count: kws.length,
      intent,
    });
  }
  clusters.sort((a, b) => b.count - a.count);
  return clusters;
}

/** Run full grouping. */
export function group(keywords: string[], options: GroupingOptions): GroupingResult {
  const { unique, removed } = dedupKeywords(keywords);
  const clusters =
    options.strategy === "intent"
      ? groupByIntent(unique)
      : groupByCommonWord(unique, {
          minClusterSize: options.minClusterSize,
          removeStopWords: options.removeStopWords,
        });
  const intentCounts: Record<Intent, number> = {
    informational: 0, transactional: 0, navigational: 0, other: 0,
  };
  for (const k of unique) intentCounts[classifyIntent(k)]++;
  return {
    clusters,
    totalKeywords: unique.length,
    uniqueKeywords: unique.length,
    duplicatesRemoved: removed,
    intentCounts,
  };
}

/** Render clusters as CSV. */
export function renderCsv(result: GroupingResult): string {
  const lines = ["cluster,intent,keyword"];
  for (const c of result.clusters) {
    for (const k of c.keywords) {
      lines.push(`${escapeCsv(c.name)},${c.intent},${escapeCsv(k)}`);
    }
  }
  return lines.join("\n");
}

/** Render clusters as JSON. */
export function renderJson(result: GroupingResult): string {
  return JSON.stringify(
    {
      totalKeywords: result.totalKeywords,
      duplicatesRemoved: result.duplicatesRemoved,
      intentCounts: result.intentCounts,
      clusters: result.clusters,
    },
    null,
    2,
  );
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:keyword-grouping-tool:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalKeywords: number;
  clusterCount: number;
  strategy: "common-word" | "intent";
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
  keywords: string;
  options: GroupingOptions;
}): string {
  const params = new URLSearchParams();
  if (input.keywords) params.set("keywords", input.keywords);
  params.set("strategy", input.options.strategy);
  params.set("minClusterSize", String(input.options.minClusterSize));
  params.set("removeStopWords", input.options.removeStopWords ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { keywords: string; options: GroupingOptions } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      keywords: "",
      options: { strategy: "common-word", minClusterSize: 2, removeStopWords: true },
    };
  }
  const params = new URLSearchParams(clean);
  const strategy = params.get("strategy");
  const minClusterSize = parseInt(params.get("minClusterSize") ?? "2", 10);
  return {
    keywords: params.get("keywords") ?? "",
    options: {
      strategy: strategy === "intent" ? "intent" : "common-word",
      minClusterSize: Number.isNaN(minClusterSize) ? 2 : minClusterSize,
      removeStopWords: params.get("removeStopWords") !== "0",
    },
  };
}
