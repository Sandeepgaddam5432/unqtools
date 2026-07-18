/**
 * TF-IDF Content Optimizer — pure logic.
 *
 * Compute Term Frequency-Inverse Document Frequency (TF-IDF) for a piece of
 * content, optionally comparing to competitor content. Pure functions only —
 * no DOM, no network.
 */

export interface TermScore {
  term: string;
  tf: number; // term frequency (count / total words in doc)
  idf: number; // inverse document frequency
  tfidf: number; // tf * idf
  count: number; // raw count in primary doc
  competitorCount: number; // # of competitor docs containing the term
}

export interface ContentResult {
  totalWords: number;
  uniqueTerms: number;
  topTerms: TermScore[]; // sorted by tfidf desc
  missingTerms: string[]; // in competitors but not in primary
  overOptimized: Array<{ term: string; yourTf: number; competitorAvgTf: number }>;
  contentScore: number; // 0-100
  cloudData: Array<{ text: string; value: number }>;
}

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

export const TOP_LIMIT = 30;
export const OVER_OPTIMIZATION_RATIO = 2; // 2x competitor avg = over-optimized

/** Tokenize a string into lowercased alphanumeric words. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

/** Filter out stop words. */
export function removeStopWords(words: string[]): string[] {
  return words.filter((w) => !STOP_WORDS.has(w) && w.length > 1);
}

/** Compute term frequency map (count). */
export function countTerms(words: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of words) {
    map.set(w, (map.get(w) || 0) + 1);
  }
  return map;
}

/** Compute TF (term count / total terms). */
export function computeTf(count: number, totalWords: number): number {
  if (totalWords === 0) return 0;
  return count / totalWords;
}

/** Compute IDF: log( (N + 1) / (df + 1) ) + 1 (smoothed). */
export function computeIdf(documentFrequency: number, totalDocs: number): number {
  if (totalDocs === 0) return 0;
  return Math.log((totalDocs + 1) / (documentFrequency + 1)) + 1;
}

/** Analyze a single document (no competitors). */
export function analyzeSingle(text: string): TermScore[] {
  const words = removeStopWords(tokenize(text));
  const total = words.length;
  if (total === 0) return [];
  const counts = countTerms(words);
  // Single document: IDF = 1 for all terms (no comparison)
  const out: TermScore[] = [];
  for (const [term, count] of counts) {
    const tf = computeTf(count, total);
    out.push({
      term,
      tf,
      idf: 1,
      tfidf: tf,
      count,
      competitorCount: 0,
    });
  }
  out.sort((a, b) => b.tfidf - a.tfidf || b.count - a.count);
  return out;
}

/** Analyze primary content vs competitor documents. */
export function analyze(
  primary: string,
  competitors: string[] = [],
  options: { topLimit?: number; overOptRatio?: number } = {},
): ContentResult {
  const topLimit = options.topLimit ?? TOP_LIMIT;
  const overOptRatio = options.overOptRatio ?? OVER_OPTIMIZATION_RATIO;
  const primaryWords = removeStopWords(tokenize(primary));
  const total = primaryWords.length;
  const primaryCounts = countTerms(primaryWords);
  const competitorTokenArrays = competitors.map((c) => removeStopWords(tokenize(c)));
  const competitorCountMaps = competitorTokenArrays.map(countTerms);
  const competitorTotals = competitorTokenArrays.map((arr) => arr.length);
  const numCompetitors = competitors.length;
  const totalDocs = 1 + numCompetitors;

  // Document frequency — how many docs (primary + competitors) contain each term
  const allTerms = new Set<string>([
    ...primaryCounts.keys(),
    ...competitorCountMaps.flatMap((m) => Array.from(m.keys())),
  ]);

  const termScores: TermScore[] = [];
  for (const term of allTerms) {
    const count = primaryCounts.get(term) || 0;
    let df = count > 0 ? 1 : 0;
    let competitorWithTerm = 0;
    for (const cm of competitorCountMaps) {
      if (cm.has(term)) {
        df++;
        competitorWithTerm++;
      }
    }
    const tf = computeTf(count, total);
    const idf = computeIdf(df, totalDocs);
    termScores.push({
      term,
      tf,
      idf,
      tfidf: tf * idf,
      count,
      competitorCount: competitorWithTerm,
    });
  }
  termScores.sort((a, b) => b.tfidf - a.tfidf || b.count - a.count);

  const topTerms = termScores.slice(0, topLimit);

  // Missing terms: in competitors (>= 2 of them) but not in primary
  const missingTerms = termScores
    .filter((s) => s.count === 0 && s.competitorCount >= 2)
    .sort((a, b) => b.competitorCount - a.competitorCount)
    .slice(0, 20)
    .map((s) => s.term);

  // Over-optimized: TF in primary is N× competitor average TF
  const overOptimized: Array<{ term: string; yourTf: number; competitorAvgTf: number }> = [];
  for (const score of termScores) {
    if (score.count === 0) continue;
    // Compute competitor avg TF
    let sumTf = 0;
    let usedCount = 0;
    for (let i = 0; i < numCompetitors; i++) {
      const cm = competitorCountMaps[i];
      const ct = competitorTotals[i];
      const c = cm.get(score.term) || 0;
      if (c > 0) {
        sumTf += computeTf(c, ct);
        usedCount++;
      }
    }
    if (usedCount === 0) continue;
    const competitorAvgTf = sumTf / usedCount;
    if (competitorAvgTf > 0 && score.tf > competitorAvgTf * overOptRatio) {
      overOptimized.push({
        term: score.term,
        yourTf: score.tf,
        competitorAvgTf,
      });
    }
  }
  overOptimized.sort((a, b) => (b.yourTf / b.competitorAvgTf) - (a.yourTf / a.competitorAvgTf));

  // Content score: how many "shared" competitor terms does primary also cover?
  let contentScore = 0;
  if (numCompetitors > 0) {
    const termsInMultipleCompetitors = termScores.filter((s) => s.competitorCount >= 2).length;
    const alsoInPrimary = termScores.filter((s) => s.competitorCount >= 2 && s.count > 0).length;
    contentScore = termsInMultipleCompetitors === 0 ? 0 : Math.round((alsoInPrimary / termsInMultipleCompetitors) * 100);
  } else {
    // No competitors — score by content length & term diversity
    if (total > 0) {
      const diversity = primaryCounts.size / total;
      contentScore = Math.round(Math.min(100, (total / 5) + diversity * 50));
    }
  }

  const cloudData = topTerms.map((t) => ({ text: t.term, value: t.count }));

  return {
    totalWords: total,
    uniqueTerms: primaryCounts.size,
    topTerms,
    missingTerms,
    overOptimized,
    contentScore,
    cloudData,
  };
}

/** Render as CSV. */
export function renderCsv(result: ContentResult): string {
  const lines = ["term,tf,idf,tfidf,count,competitor_count"];
  for (const t of result.topTerms) {
    lines.push(
      [
        escapeCsv(t.term),
        t.tf.toFixed(5),
        t.idf.toFixed(5),
        t.tfidf.toFixed(5),
        t.count,
        t.competitorCount,
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

const HISTORY_KEY = "unqtools:tf-idf-content-optimizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalWords: number;
  uniqueTerms: number;
  contentScore: number;
  competitorCount: number;
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

export function buildShareUrl(input: { primary: string; competitors: string[] }): string {
  const params = new URLSearchParams();
  if (input.primary) params.set("p", input.primary);
  input.competitors.forEach((c, i) => {
    if (c) params.set(`c${i + 1}`, c);
  });
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { primary: string; competitors: string[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { primary: "", competitors: [] };
  const params = new URLSearchParams(clean);
  const primary = params.get("p") ?? "";
  const competitors: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const c = params.get(`c${i}`);
    if (c) competitors.push(c);
  }
  return { primary, competitors };
}
