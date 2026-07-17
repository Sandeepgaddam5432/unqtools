/**
 * Content Gap Analyzer — pure logic.
 *
 * Compare your content against up to 3 competitors to find keyword gaps
 * (in competitor but not in yours) and unique keywords (in yours but not in theirs).
 *
 * Pure functions only — no DOM, no network.
 */

export interface CompetitorContent {
  label: string;
  text: string;
}

export interface KeywordStat {
  word: string;
  count: number;
}

export interface GapEntry {
  word: string;
  competitors: string[]; // labels of competitors that have it
  totalCompetitorCount: number; // sum of counts across competitors
  priority: number; // 0-100 priority score
}

export interface UniqueEntry {
  word: string;
  count: number; // count in your content
}

export interface GapAnalysisResult {
  yourWordCount: number;
  competitorWordCounts: Record<string, number>;
  overlapPercentage: number;
  gaps: GapEntry[];        // keywords in competitors but NOT in yours
  unique: UniqueEntry[];   // keywords in yours but NOT in any competitor
  shared: KeywordStat[];   // keywords in both yours and at least one competitor
  totalUniqueAcrossAll: number;
}

export const TOP_LIMIT = 50;

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

/** Build a word frequency map from text, optionally filtering stop words and custom excludes. */
export function buildFrequency(
  text: string,
  excludeStopWords: boolean = true,
  customExclude: string[] = [],
): Map<string, number> {
  const words = tokenizeWords(text);
  const custom = new Set(customExclude.map((s) => s.toLowerCase().trim()).filter(Boolean));
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 2) continue;
    if (excludeStopWords && STOP_WORDS.has(w)) continue;
    if (custom.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

/** Convert a frequency map to a sorted array (descending count). */
export function freqToSortedArray(freq: Map<string, number>, limit: number = TOP_LIMIT): KeywordStat[] {
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, limit).map(([word, count]) => ({ word, count }));
}

/** Compute overlap percentage between your words and union of competitor words. */
export function computeOverlap(yourWords: Set<string>, competitorWords: Set<string>): number {
  if (yourWords.size === 0 && competitorWords.size === 0) return 0;
  const intersection = new Set<string>();
  for (const w of yourWords) {
    if (competitorWords.has(w)) intersection.add(w);
  }
  const union = new Set<string>([...yourWords, ...competitorWords]);
  return union.size === 0 ? 0 : (intersection.size / union.size) * 100;
}

/** Run the full gap analysis. */
export function analyzeGap(
  yourText: string,
  competitors: CompetitorContent[],
  options: { excludeStopWords?: boolean; customExclude?: string[] } = {},
): GapAnalysisResult {
  const { excludeStopWords = true, customExclude = [] } = options;
  const yourFreq = buildFrequency(yourText, excludeStopWords, customExclude);
  const competitorFreqs = competitors.map((c) => ({
    label: c.label,
    freq: buildFrequency(c.text, excludeStopWords, customExclude),
  }));

  // Your word count (filtered)
  const yourWordCount = Array.from(yourFreq.values()).reduce((sum, n) => sum + n, 0);
  const competitorWordCounts: Record<string, number> = {};
  for (const c of competitorFreqs) {
    competitorWordCounts[c.label] = Array.from(c.freq.values()).reduce((sum, n) => sum + n, 0);
  }

  const yourWords = new Set(yourFreq.keys());
  const allCompetitorWords = new Set<string>();
  for (const c of competitorFreqs) {
    for (const w of c.freq.keys()) allCompetitorWords.add(w);
  }

  const overlapPercentage = computeOverlap(yourWords, allCompetitorWords);

  // Gaps: words in competitors but NOT in yours
  const gaps: GapEntry[] = [];
  for (const w of allCompetitorWords) {
    if (yourWords.has(w)) continue;
    const presentIn: string[] = [];
    let totalCount = 0;
    for (const c of competitorFreqs) {
      const n = c.freq.get(w) || 0;
      if (n > 0) {
        presentIn.push(c.label);
        totalCount += n;
      }
    }
    // Priority score: (number of competitors that have it * 25) + (count capped at 25)
    const priority = Math.min(100, presentIn.length * 25 + Math.min(25, totalCount));
    gaps.push({ word: w, competitors: presentIn, totalCompetitorCount: totalCount, priority });
  }
  gaps.sort((a, b) => b.priority - a.priority || b.totalCompetitorCount - a.totalCompetitorCount);

  // Unique: words in yours but NOT in any competitor
  const unique: UniqueEntry[] = [];
  for (const [word, count] of yourFreq.entries()) {
    if (!allCompetitorWords.has(word)) {
      unique.push({ word, count });
    }
  }
  unique.sort((a, b) => b.count - a.count);

  // Shared: in both yours and at least one competitor
  const shared: KeywordStat[] = [];
  for (const [word, count] of yourFreq.entries()) {
    if (allCompetitorWords.has(word)) {
      shared.push({ word, count });
    }
  }
  shared.sort((a, b) => b.count - a.count);

  const totalUniqueAcrossAll = new Set([...yourWords, ...allCompetitorWords]).size;

  return {
    yourWordCount,
    competitorWordCounts,
    overlapPercentage,
    gaps: gaps.slice(0, TOP_LIMIT),
    unique: unique.slice(0, TOP_LIMIT),
    shared: shared.slice(0, TOP_LIMIT),
    totalUniqueAcrossAll,
  };
}

/** Render the analysis as a CSV report. */
export function renderCsv(result: GapAnalysisResult): string {
  const lines: string[] = ["category,word,your_count,competitor_count,competitors,priority"];
  for (const g of result.gaps) {
    lines.push(`gap,${escapeCsv(g.word)},0,${g.totalCompetitorCount},"${g.competitors.join("; ")}",${g.priority}`);
  }
  for (const u of result.unique) {
    lines.push(`unique,${escapeCsv(u.word)},${u.count},0,"",0`);
  }
  for (const s of result.shared) {
    lines.push(`shared,${escapeCsv(s.word)},${s.count},0,"",0`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Render a Markdown report. */
export function renderMarkdown(yourText: string, competitors: CompetitorContent[], result: GapAnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Content Gap Analysis Report");
  lines.push("");
  lines.push(`**Your content word count (filtered):** ${result.yourWordCount}`);
  for (const [label, count] of Object.entries(result.competitorWordCounts)) {
    lines.push(`**${label} word count (filtered):** ${count}`);
  }
  lines.push(`**Overlap:** ${result.overlapPercentage.toFixed(1)}%`);
  lines.push(`**Total unique words across all content:** ${result.totalUniqueAcrossAll}`);
  lines.push("");
  lines.push("## Gap keywords (in competitors but not in yours) — top 20");
  lines.push("");
  if (result.gaps.length === 0) {
    lines.push("_No gaps found — your content covers all competitor keywords._");
  } else {
    lines.push("| Word | Total count | In competitors | Priority |");
    lines.push("|------|-------------|----------------|----------|");
    for (const g of result.gaps.slice(0, 20)) {
      lines.push(`| ${g.word} | ${g.totalCompetitorCount} | ${g.competitors.join(", ")} | ${g.priority} |`);
    }
  }
  lines.push("");
  lines.push("## Unique keywords (in yours but not in competitors) — top 20");
  lines.push("");
  if (result.unique.length === 0) {
    lines.push("_No unique keywords — your content matches competitors closely._");
  } else {
    for (const u of result.unique.slice(0, 20)) {
      lines.push(`- ${u.word} (${u.count}×)`);
    }
  }
  lines.push("");
  lines.push("## Shared keywords — top 20");
  lines.push("");
  for (const s of result.shared.slice(0, 20)) {
    lines.push(`- ${s.word} (${s.count}× in your content)`);
  }
  lines.push("");
  lines.push("---");
  lines.push("_Generated with UnQTools Content Gap Analyzer_");
  return lines.join("\n");
}

/** Build a visual diff: side-by-side summary of gaps / unique / shared counts. */
export function buildVisualDiff(result: GapAnalysisResult): {
  gaps: number;
  unique: number;
  shared: number;
  overlapPct: number;
} {
  return {
    gaps: result.gaps.length,
    unique: result.unique.length,
    shared: result.shared.length,
    overlapPct: result.overlapPercentage,
  };
}

// ---- History ----

const HISTORY_KEY = "unqtools:content-gap-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  yourWordCount: number;
  competitorCount: number;
  gapCount: number;
  uniqueCount: number;
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

export function buildShareUrl(yourText: string, competitors: CompetitorContent[]): string {
  const params = new URLSearchParams();
  params.set("yours", yourText);
  for (let i = 0; i < competitors.length; i++) {
    params.set(`c${i}_label`, competitors[i].label);
    params.set(`c${i}_text`, competitors[i].text);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { yours?: string; competitors: CompetitorContent[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { competitors: [] };
  const params = new URLSearchParams(clean);
  const yours = params.get("yours") || undefined;
  const competitors: CompetitorContent[] = [];
  for (let i = 0; i < 3; i++) {
    const label = params.get(`c${i}_label`);
    const text = params.get(`c${i}_text`);
    if (label !== null && text !== null && text.trim()) {
      competitors.push({ label, text });
    }
  }
  return { yours, competitors };
}
