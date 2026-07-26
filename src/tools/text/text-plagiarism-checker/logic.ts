/**
 * Plagiarism Checker — pure logic.
 *
 * Compares two texts using n-gram (shingle) overlap and Jaccard
 * similarity. Highlights matching spans so the UI can render a
 * side-by-side diff with the suspicious passages marked.
 *
 * Note: this is a *similarity heuristic*, not a definitive plagiarism
 * detector. It does not consult external databases — both texts are
 * compared locally in the browser.
 */

export interface PlagiarismOptions {
  /** N-gram size (default: 3). */
  ngramSize?: number;
  /** Case-sensitive comparison (default: false). */
  caseSensitive?: boolean;
  /** Remove stop words before shingling (default: true). */
  removeStopWords?: boolean;
  /** Minimum match length (in characters) to highlight (default: 20). */
  minHighlightLength?: number;
}

export interface PlagiarismMatch {
  /** Source-text span. */
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  /** Suspicious-text span. */
  suspectStart: number;
  suspectEnd: number;
  suspectText: string;
}

export interface PlagiarismResult {
  similarity: number; // 0..1
  similarityPercent: number; // 0..100
  jaccardIndex: number;
  overlapCoefficient: number;
  matches: PlagiarismMatch[];
  sourceWordCount: number;
  suspectWordCount: number;
  sharedNgrams: number;
  totalNgrams: number;
  warnings: string[];
}

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","of","to","in","on","at","by","with","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","this","that","these","those","i","you","he","she","it","we","they","as",
]);

function normalise(text: string, caseSensitive: boolean, removeStop: boolean): { tokens: string[]; raw: string } {
  const lower = caseSensitive ? text : text.toLowerCase();
  const tokensAll = (lower.match(/[\p{L}\p{N}']+/gu) ?? []);
  const tokens = removeStop ? tokensAll.filter((t) => !STOP_WORDS.has(t)) : tokensAll;
  return { tokens, raw: lower };
}

/** Build a set of n-grams (as joined strings) from a token list. */
export function buildNgrams(tokens: string[], n: number): Set<string> {
  if (n < 1) n = 1;
  const set = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) {
    set.add(tokens.slice(i, i + n).join(" "));
  }
  return set;
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B|. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Overlap coefficient: |A ∩ B| / min(|A|, |B|). */
export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

/** Find concrete spans in the source & suspect texts where shared n-grams occur. */
function findHighlightMatches(
  sourceRaw: string,
  suspectRaw: string,
  sharedNgrams: string[],
  n: number,
  minLen: number,
): PlagiarismMatch[] {
  const matches: PlagiarismMatch[] = [];
  for (const ng of sharedNgrams) {
    if (ng.length < minLen) continue;
    const sIdx = sourceRaw.indexOf(ng);
    const tIdx = suspectRaw.indexOf(ng);
    if (sIdx >= 0 && tIdx >= 0) {
      matches.push({
        sourceStart: sIdx,
        sourceEnd: sIdx + ng.length,
        sourceText: sourceRaw.slice(sIdx, sIdx + ng.length),
        suspectStart: tIdx,
        suspectEnd: tIdx + ng.length,
        suspectText: suspectRaw.slice(tIdx, tIdx + ng.length),
      });
    }
  }
  // Merge overlapping matches
  matches.sort((a, b) => a.sourceStart - b.sourceStart);
  const merged: PlagiarismMatch[] = [];
  for (const m of matches) {
    const last = merged[merged.length - 1];
    if (last && m.sourceStart <= last.sourceEnd + 1) {
      last.sourceEnd = Math.max(last.sourceEnd, m.sourceEnd);
      last.sourceText = sourceRaw.slice(last.sourceStart, last.sourceEnd);
    } else {
      merged.push({ ...m });
    }
  }
  return merged;
}

/**
 * Compare two texts and return similarity metrics + matched spans.
 * The "similarity" field is a blend of Jaccard (70%) and overlap (30%)
 * to balance large-vs-small document comparisons.
 */
export function checkPlagiarism(
  source: string,
  suspect: string,
  options: PlagiarismOptions = {},
): PlagiarismResult {
  const n = Math.max(1, options.ngramSize ?? 3);
  const caseSensitive = options.caseSensitive ?? false;
  const removeStop = options.removeStopWords ?? true;
  const minLen = options.minHighlightLength ?? 20;
  const warnings: string[] = [];

  if (!source || !source.trim()) {
    return emptyResult("Source text is empty.");
  }
  if (!suspect || !suspect.trim()) {
    return emptyResult("Suspect text is empty.");
  }

  const sN = normalise(source, caseSensitive, removeStop);
  const tN = normalise(suspect, caseSensitive, removeStop);
  if (sN.tokens.length < n || tN.tokens.length < n) {
    warnings.push(`One of the texts is shorter than the ${n}-gram size; falling back to word-level comparison.`);
  }
  const sGrams = buildNgrams(sN.tokens, n);
  const tGrams = buildNgrams(tN.tokens, n);
  const shared: string[] = [];
  for (const g of sGrams) if (tGrams.has(g)) shared.push(g);

  const j = jaccard(sGrams, tGrams);
  const ov = overlapCoefficient(sGrams, tGrams);
  const similarity = 0.7 * j + 0.3 * ov;
  const totalNgrams = sGrams.size + tGrams.size - shared.length;

  if (similarity > 0.8) warnings.push("Very high similarity — likely copied text.");
  else if (similarity > 0.5) warnings.push("Moderate similarity — review highlighted passages.");
  else if (similarity > 0.2) warnings.push("Low similarity — probably coincidental phrasing.");

  const matches = findHighlightMatches(sN.raw, tN.raw, shared, n, minLen);

  return {
    similarity,
    similarityPercent: Math.round(similarity * 1000) / 10,
    jaccardIndex: j,
    overlapCoefficient: ov,
    matches,
    sourceWordCount: sN.tokens.length,
    suspectWordCount: tN.tokens.length,
    sharedNgrams: shared.length,
    totalNgrams,
    warnings,
  };
}

function emptyResult(warning: string): PlagiarismResult {
  return {
    similarity: 0,
    similarityPercent: 0,
    jaccardIndex: 0,
    overlapCoefficient: 0,
    matches: [],
    sourceWordCount: 0,
    suspectWordCount: 0,
    sharedNgrams: 0,
    totalNgrams: 0,
    warnings: [warning],
  };
}

/** Render an HTML string with <mark> tags around each highlighted match span. */
export function highlightHtml(rawText: string, matches: { start: number; end: number }[]): string {
  if (matches.length === 0) return escapeHtml(rawText);
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const m of sorted) {
    if (m.start < cursor) continue; // skip overlaps
    out += escapeHtml(rawText.slice(cursor, m.start));
    out += `<mark class="bg-yellow-300/60 dark:bg-yellow-500/30 rounded px-0.5">${escapeHtml(rawText.slice(m.start, m.end))}</mark>`;
    cursor = m.end;
  }
  out += escapeHtml(rawText.slice(cursor));
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convert a result to a JSON report. */
export function resultToJson(r: PlagiarismResult): string {
  return JSON.stringify(
    {
      similarity: r.similarity,
      similarityPercent: r.similarityPercent,
      jaccardIndex: r.jaccardIndex,
      overlapCoefficient: r.overlapCoefficient,
      sharedNgrams: r.sharedNgrams,
      totalNgrams: r.totalNgrams,
      matches: r.matches,
    },
    null,
    2,
  );
}
