/**
 * Keyword Density Analyzer — pure logic.
 *
 * Analyze keyword density and frequency: 1-word, 2-word, 3-word phrases.
 * Compute density percentages, filter stop words, flag stuffing (>3%).
 *
 * Pure functions only — no DOM, no network.
 */

export interface KeywordHit {
  phrase: string;
  count: number;
  density: number; // percentage of total words
}

export interface AnalysisResult {
  totalWords: number;
  uniqueWords: number;
  oneWord: KeywordHit[];
  twoWord: KeywordHit[];
  threeWord: KeywordHit[];
  stuffingWarnings: string[];
}

export const TOP_LIMIT = 20;
export const STUFFING_THRESHOLD = 3; // % — over this is "keyword stuffing"

/** Common English stop words. */
export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to", "in",
  "for", "on", "with", "as", "by", "at", "from", "up", "down", "out", "over",
  "under", "again", "further", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should", "could",
  "can", "may", "might", "must", "shall", "this", "that", "these", "those", "i",
  "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
  "your", "his", "its", "our", "their", "what", "which", "who", "whom", "where",
  "when", "why", "how", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "also", "into", "via", "per", "off", "about",
  "above", "below", "between", "through", "during", "before", "after",
]);

export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

/** Generate n-word phrases from a word array. */
export function generatePhrases(words: string[], n: number): string[] {
  if (!words || n < 1) return [];
  if (n === 1) return words.slice();
  const phrases: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    phrases.push(words.slice(i, i + n).join(" "));
  }
  return phrases;
}

/** Check if a phrase contains any stop word (when filtering). */
export function phraseHasStopWord(phrase: string): boolean {
  const words = phrase.split(" ");
  return words.some((w) => STOP_WORDS.has(w));
}

/** Count phrase frequencies, return as sorted array. */
export function countPhrases(
  phrases: string[],
  limit: number = TOP_LIMIT,
): KeywordHit[] {
  if (phrases.length === 0) return [];
  const total = phrases.length;
  const freq = new Map<string, number>();
  for (const p of phrases) {
    freq.set(p, (freq.get(p) || 0) + 1);
  }
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, limit).map(([phrase, count]) => ({
    phrase,
    count,
    density: (count / total) * 100,
  }));
}

/** Filter phrases — exclude those containing stop words. */
export function filterPhrases(
  phrases: string[],
  excludeStopWords: boolean,
  customExclude?: string[],
): string[] {
  if (!excludeStopWords && !customExclude) return phrases;
  const custom = new Set((customExclude || []).map((s) => s.toLowerCase().trim()).filter(Boolean));
  return phrases.filter((p) => {
    if (excludeStopWords && phraseHasStopWord(p)) return false;
    if (custom.has(p.toLowerCase())) return false;
    return true;
  });
}

/** Detect keyword stuffing — phrases over the threshold. */
export function detectStuffing(hits: KeywordHit[], threshold: number = STUFFING_THRESHOLD): string[] {
  const warnings: string[] = [];
  for (const h of hits) {
    if (h.density > threshold) {
      warnings.push(
        `"${h.phrase}" appears ${h.count}× (${h.density.toFixed(2)}%) — over ${threshold}% threshold (stuffing risk)`,
      );
    }
  }
  return warnings;
}

/** Run the full analysis on text. */
export function analyze(
  text: string,
  options: { excludeStopWords?: boolean; customExclude?: string[]; limit?: number } = {},
): AnalysisResult {
  const { excludeStopWords = true, customExclude, limit = TOP_LIMIT } = options;
  const words = tokenizeWords(text);
  const totalWords = words.length;
  const uniqueWords = new Set(words).size;

  if (totalWords === 0) {
    return {
      totalWords: 0,
      uniqueWords: 0,
      oneWord: [],
      twoWord: [],
      threeWord: [],
      stuffingWarnings: [],
    };
  }

  // 1-word: filter stop words before counting
  const onePhrases = filterPhrases(words, excludeStopWords, customExclude);
  const oneWord = countPhrases(onePhrases, limit);

  // 2-word: filter phrases that contain stop words
  const twoPhrasesRaw = generatePhrases(words, 2);
  const twoPhrases = filterPhrases(twoPhrasesRaw, excludeStopWords, customExclude);
  // For density, use the total count of the *raw* 2-word phrases (so density is meaningful)
  const twoWord = countPhrases(twoPhrases, limit).map((h) => ({
    ...h,
    density: (h.count / Math.max(1, twoPhrasesRaw.length)) * 100,
  }));

  // 3-word
  const threePhrasesRaw = generatePhrases(words, 3);
  const threePhrases = filterPhrases(threePhrasesRaw, excludeStopWords, customExclude);
  const threeWord = countPhrases(threePhrases, limit).map((h) => ({
    ...h,
    density: (h.count / Math.max(1, threePhrasesRaw.length)) * 100,
  }));

  // Stuffing warnings — check 1-word and 2-word
  const stuffingWarnings: string[] = [];
  stuffingWarnings.push(...detectStuffing(oneWord));
  stuffingWarnings.push(...detectStuffing(twoWord));

  return {
    totalWords,
    uniqueWords,
    oneWord,
    twoWord,
    threeWord,
    stuffingWarnings,
  };
}

/** Render analysis as CSV (phrase, count, density for each n-gram type). */
export function renderCsv(result: AnalysisResult): string {
  const lines: string[] = ["type,phrase,count,density_percent"];
  for (const h of result.oneWord) {
    lines.push(`1-word,${escapeCsv(h.phrase)},${h.count},${h.density.toFixed(2)}`);
  }
  for (const h of result.twoWord) {
    lines.push(`2-word,${escapeCsv(h.phrase)},${h.count},${h.density.toFixed(2)}`);
  }
  for (const h of result.threeWord) {
    lines.push(`3-word,${escapeCsv(h.phrase)},${h.count},${h.density.toFixed(2)}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Generate keyword cloud data (phrase + weight for sizing). */
export function generateCloudData(hits: KeywordHit[]): Array<{ text: string; value: number }> {
  if (hits.length === 0) return [];
  const max = hits[0].count;
  return hits.map((h) => ({
    text: h.phrase,
    value: h.count,
  }));
}

// ---- History ----

const HISTORY_KEY = "unqtools:keyword-density-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  wordCount: number;
  uniqueWords: number;
  stuffingWarnings: number;
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

export function buildShareUrl(text: string): string {
  const params = new URLSearchParams();
  params.set("text", text);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { text?: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const text = params.get("text");
  if (text === null) return {};
  return { text };
}
