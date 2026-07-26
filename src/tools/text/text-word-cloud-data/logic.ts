/**
 * Word Cloud Data — pure logic.
 *
 * Builds word-frequency and TF-IDF weightings suitable for rendering a
 * word cloud. Steps:
 *   1. Tokenize (lowercase, strip punctuation, split on whitespace).
 *   2. Remove stop words (English default; caller may extend).
 *   3. Count raw frequencies.
 *   4. Compute TF (term frequency) and — when given a corpus of documents —
 *      IDF and TF-IDF for relative-importance scoring.
 *   5. Normalise weights to a 1–100 scale so any UI can map to font sizes.
 */

export interface WordCloudOptions {
  /** Remove English stop words (default: true). */
  removeStopWords?: boolean;
  /** Extra stop words to merge with the built-in set. */
  extraStopWords?: string[];
  /** Minimum word length to keep (default: 2). */
  minWordLength?: number;
  /** Maximum number of results to return (default: 200). */
  maxResults?: number;
}

export interface WordDatum {
  word: string;
  count: number;
  tf: number;
  idf: number;
  tfidf: number;
  /** Normalised weight 1..100 (relative to top term). */
  weight: number;
}

export interface WordCloudResult {
  words: WordDatum[];
  totalTokens: number;
  uniqueWords: number;
  averageWordLength: number;
  warnings: string[];
}

const STOP_WORDS = new Set<string>([
  "a","an","the","and","or","but","if","then","else","for","of","to","in","on","at","by","with","from","as","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","must","shall","can","need","dare","ought","used","that","this","these","those","i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","its","our","their","mine","yours","hers","ours","theirs","what","which","who","whom","whose","when","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","just","also","here","there","about","above","below","up","down","out","off","over","under","again","further","once","because","while","during","before","after","through","between","into","until","against","am","among","any","now",
]);

/** Tokenize raw text into lowercase alpha-numeric word units. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[\p{L}\p{N}']+/gu);
  return matches ? matches.filter((w) => w.length > 0) : [];
}

/** Count raw word frequency, returning a Map. */
export function countFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

/** Compute inverse-document-frequency for a corpus. */
export function computeIdf(corpus: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const n = Math.max(1, corpus.length);
  for (const doc of corpus) {
    const seen = new Set(doc);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    // smoothed idf; never zero so a unique term still gets weight
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
  }
  return idf;
}

/**
 * Build word cloud data from one text. If `corpus` is supplied, TF-IDF
 * is computed across documents — otherwise IDF is treated as 1 (TF only).
 */
export function buildWordCloud(
  text: string,
  options: WordCloudOptions = {},
  corpus?: string[][],
): WordCloudResult {
  const removeStop = options.removeStopWords ?? true;
  const minLen = options.minWordLength ?? 2;
  const maxResults = options.maxResults ?? 200;
  const warnings: string[] = [];

  const stop = new Set(STOP_WORDS);
  for (const w of options.extraStopWords ?? []) stop.add(w.toLowerCase());

  let tokens = tokenize(text);
  const totalTokens = tokens.length;

  if (removeStop) {
    tokens = tokens.filter((t) => !stop.has(t));
  }
  if (minLen > 1) {
    tokens = tokens.filter((t) => t.length >= minLen);
  }

  const freq = countFrequency(tokens);
  const uniqueWords = freq.size;
  if (uniqueWords === 0) {
    warnings.push("No words left after filtering. Try lowering min word length or disabling stop-word removal.");
  }
  const totalFiltered = tokens.length || 1;

  // Compute average word length
  let totalLen = 0;
  for (const t of tokens) totalLen += t.length;
  const averageWordLength = totalFiltered > 0 ? totalLen / totalFiltered : 0;

  // IDF
  const idfMap = corpus && corpus.length > 0 ? computeIdf(corpus) : new Map<string, number>();

  // Build raw word data
  const rows: WordDatum[] = [];
  let maxTfidf = 0;
  for (const [word, count] of freq) {
    const tf = count / totalFiltered;
    const idf = idfMap.get(word) ?? 1;
    const tfidf = tf * idf;
    if (tfidf > maxTfidf) maxTfidf = tfidf;
    rows.push({ word, count, tf, idf, tfidf, weight: 0 });
  }

  // Normalise weight to 1..100
  if (maxTfidf === 0) maxTfidf = 1;
  for (const r of rows) {
    r.weight = Math.max(1, Math.round((r.tfidf / maxTfidf) * 100));
  }

  rows.sort((a, b) => b.count - a.count || b.tfidf - a.tfidf);
  const words = rows.slice(0, maxResults);

  if (rows.length > maxResults) {
    warnings.push(`Truncated to ${maxResults} of ${rows.length} unique terms.`);
  }

  return { words, totalTokens, uniqueWords, averageWordLength, warnings };
}

/** Convert word cloud data to CSV (word,count,tf,idf,tfidf,weight). */
export function wordCloudToCsv(result: WordCloudResult): string {
  const lines = ["word,count,tf,idf,tfidf,weight"];
  for (const w of result.words) {
    lines.push(
      [
        w.word,
        w.count,
        w.tf.toFixed(5),
        w.idf.toFixed(5),
        w.tfidf.toFixed(5),
        w.weight,
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Convert word cloud data to a JSON string suitable for external renderers. */
export function wordCloudToJson(result: WordCloudResult): string {
  return JSON.stringify(
    result.words.map((w) => ({ text: w.word, value: w.count, weight: w.weight })),
    null,
    2,
  );
}

/** Build a sample corpus from an array of plain strings. */
export function buildCorpus(docs: string[]): string[][] {
  return docs.map((d) => tokenize(d));
}
