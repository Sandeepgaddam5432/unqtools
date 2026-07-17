/**
 * Keyword Match Type Builder — pure logic.
 *
 * Build Google Ads keyword match types from a list:
 *   - Broad match:        keyword (no modifier)
 *   - Phrase match:       "keyword"
 *   - Exact match:        [keyword]
 *   - Negative match:     -keyword (negative broad), -"keyword" (negative phrase), -[keyword] (negative exact)
 *
 * Google Ads reference:
 *   https://support.google.com/google-ads/answer/2497836
 *
 * Pure functions only — no DOM, no network.
 */

export type MatchType = "broad" | "phrase" | "exact" | "negative";

export interface KeywordEntry {
  raw: string;
  normalized: string;
  matchType: MatchType;
  formatted: string;
}

export interface ConversionStats {
  total: number;
  broad: number;
  phrase: number;
  exact: number;
  negative: number;
  duplicatesRemoved: number;
}

export interface ConversionResult {
  entries: KeywordEntry[];
  stats: ConversionStats;
  errors: string[];
}

/** Normalize a keyword — trim, collapse spaces, remove extra quotes/brackets. */
export function normalizeKeyword(input: string): string {
  if (!input) return "";
  let s = input.trim();
  // Strip surrounding quotes / brackets if user pasted already-formatted text
  s = s.replace(/^[-\s]*"+/, "").replace(/"+\s*$/, "");
  s = s.replace(/^\[-\s*/, "[").replace(/\s*\]$/, "]");
  s = s.replace(/^-+\[+/, "[").replace(/\]+$/, "]");
  // Collapse internal whitespace
  s = s.replace(/\s+/g, " ");
  return s;
}

/** Format a single keyword as the given match type. */
export function formatKeyword(keyword: string, matchType: MatchType): string {
  const norm = normalizeKeyword(keyword);
  if (!norm) return "";
  switch (matchType) {
    case "broad":
      return norm;
    case "phrase":
      return `"${norm}"`;
    case "exact":
      return `[${norm}]`;
    case "negative":
      return `-${norm}`;
  }
}

/** Detect the match type of an already-formatted keyword. */
export function detectMatchType(keyword: string): MatchType | null {
  const s = keyword.trim();
  if (!s) return null;
  if (s.startsWith("-[")) return "negative"; // negative exact (rare in practice)
  if (s.startsWith('-"')) return "negative"; // negative phrase (rare)
  if (s.startsWith("-")) return "negative";
  if (s.startsWith("[") && s.endsWith("]")) return "exact";
  if (s.startsWith('"') && s.endsWith('"')) return "phrase";
  if (/^[a-z0-9].*/i.test(s)) return "broad";
  return null;
}

/** Parse a paste of keywords (one per line) into raw list. */
export function parseKeywordList(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Dedup keywords case-insensitively per match type. */
export function dedupKeywords(entries: KeywordEntry[]): { entries: KeywordEntry[]; removed: number } {
  const seen = new Set<string>();
  const out: KeywordEntry[] = [];
  let removed = 0;
  for (const e of entries) {
    const key = `${e.matchType}:${e.normalized.toLowerCase()}`;
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(e);
  }
  return { entries: out, removed };
}

export interface ConvertOptions {
  types: MatchType[];
  dedup?: boolean;
}

/** Convert a keyword list to multiple match types (batch). */
export function convertKeywords(
  text: string,
  options: ConvertOptions,
): ConversionResult {
  const { types, dedup = true } = options;
  const errors: string[] = [];
  const rawKeywords = parseKeywordList(text);
  const entries: KeywordEntry[] = [];

  for (const raw of rawKeywords) {
    const normalized = normalizeKeyword(raw);
    if (!normalized) {
      errors.push(`Empty keyword: ${raw}`);
      continue;
    }
    // Validation: keywords can't contain [ ] " at all (those would break formatting)
    if (/[\[\]"]/.test(normalized)) {
      errors.push(`Keyword contains invalid characters ([ ] "): ${raw}`);
      continue;
    }
    for (const t of types) {
      entries.push({
        raw,
        normalized,
        matchType: t,
        formatted: formatKeyword(normalized, t),
      });
    }
  }

  let duplicatesRemoved = 0;
  let finalEntries = entries;
  if (dedup) {
    const r = dedupKeywords(finalEntries);
    finalEntries = r.entries;
    duplicatesRemoved = r.removed;
  }

  const stats: ConversionStats = {
    total: finalEntries.length,
    broad: finalEntries.filter((e) => e.matchType === "broad").length,
    phrase: finalEntries.filter((e) => e.matchType === "phrase").length,
    exact: finalEntries.filter((e) => e.matchType === "exact").length,
    negative: finalEntries.filter((e) => e.matchType === "negative").length,
    duplicatesRemoved,
  };

  return { entries: finalEntries, stats, errors };
}

/** Filter entries by match type. */
export function filterByType(entries: KeywordEntry[], type: MatchType): KeywordEntry[] {
  return entries.filter((e) => e.matchType === type);
}

/** Render entries as a CSV: keyword, match_type, formatted. */
export function renderCsv(result: ConversionResult): string {
  const lines: string[] = ["keyword,match_type,formatted"];
  for (const e of result.entries) {
    lines.push(`${escapeCsv(e.normalized)},${e.matchType},${escapeCsv(e.formatted)}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Render entries as plain text (one per line). */
export function renderPlainText(entries: KeywordEntry[]): string {
  return entries.map((e) => e.formatted).join("\n");
}

/** Google Ads match type reference. */
export interface MatchTypeInfo {
  type: MatchType;
  symbol: string;
  example: string;
  description: string;
  whenToUse: string;
}

export const MATCH_TYPE_REFERENCE: MatchTypeInfo[] = [
  {
    type: "broad",
    symbol: "(none)",
    example: "running shoes",
    description:
      "Ads may show on searches that include misspellings, synonyms, related searches, and other relevant variations.",
    whenToUse:
      "When you want maximum reach and have a strong negative keyword list to filter irrelevant traffic.",
  },
  {
    type: "phrase",
    symbol: '"..."',
    example: '"running shoes"',
    description:
      'Ads may show on searches that include the meaning of your keyword. The meaning can be implied, and user searches can be a more specific form of the meaning.',
    whenToUse:
      "When you want to target a specific phrase but allow additional words before/after.",
  },
  {
    type: "exact",
    symbol: "[...]",
    example: "[running shoes]",
    description:
      "Ads may show on searches that have the same meaning or same intent as your keyword. Exact match is the most restrictive but most relevant.",
    whenToUse:
      "When you want the tightest control over which searches trigger your ad. Highest relevance, lowest reach.",
  },
  {
    type: "negative",
    symbol: "-keyword",
    example: "-free",
    description:
      "Excludes your ads from showing on searches containing that term. Negative keywords can be broad, phrase, or exact match.",
    whenToUse:
      "When you want to filter out irrelevant traffic (e.g. add '-free' if you sell paid products).",
  },
];

export const GOOGLE_ADS_MATCH_TYPE_DOCS_URL =
  "https://support.google.com/google-ads/answer/2497836";

// ---- History ----

const HISTORY_KEY = "unqtools:keyword-match-type-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  keywordCount: number;
  types: MatchType[];
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

export interface ShareState {
  text: string;
  types: MatchType[];
  dedup: boolean;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("text", state.text);
  params.set("types", state.types.join(","));
  params.set("dedup", state.dedup ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const text = params.get("text");
  if (text !== null) out.text = text;
  const types = params.get("types");
  if (types !== null) {
    out.types = types.split(",").filter((t): t is MatchType =>
      t === "broad" || t === "phrase" || t === "exact" || t === "negative",
    );
  }
  const dedup = params.get("dedup");
  if (dedup !== null) out.dedup = dedup === "1";
  return out;
}
