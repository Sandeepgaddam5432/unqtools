/**
 * Keyword Extractor — pure logic.
 *
 * Extracts the most relevant keywords from a single document using:
 *   • Tokenization + stop-word removal
 *   • Term frequency (TF)
 *   • Inverse-document-frequency (IDF) when an optional corpus is given
 *   • Position weight (words appearing earlier / in titles score higher)
 *   • Length bonus (penalises 1-char tokens, slight bonus for 5–9 chars)
 *
 * The final score is a normalised 0..100 rank, suitable for tag clouds.
 */

export interface KeywordOptions {
  /** Top-K keywords to return (default: 15). */
  topK?: number;
  /** Min word length (default: 3). */
  minWordLength?: number;
  /** Extra stop words to merge with built-in set. */
  extraStopWords?: string[];
  /** Include bigrams (default: true). */
  includeBigrams?: boolean;
  /** Boost words in the first N% of the document (default: 15). */
  positionBoostPercent?: number;
}

export interface Keyword {
  word: string;
  count: number;
  tf: number;
  idf: number;
  score: number; // 0..100
  /** First position (token index, 0-based). */
  firstPosition: number;
  isBigram: boolean;
}

export interface KeywordResult {
  keywords: Keyword[];
  totalTokens: number;
  uniqueUnigrams: number;
  uniqueBigrams: number;
  warnings: string[];
}

const STOP_WORDS = new Set<string>([
  "a","an","the","and","or","but","if","then","else","for","of","to","in","on","at","by","with","from","as","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","must","shall","can","that","this","these","those","i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","its","our","their","what","which","who","whom","whose","when","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","just","also","here","there","about","above","below","up","down","out","off","over","under","again","further","once","because","while","during","before","after","through","between","into","until","against","am","among","now","get","got","make","made","making","like","see","seen","say","said","one","two","three","new","use","used","using","way","want","wants","wanted","go","went","gone","come","came","done","well","even","still","back","much","many","every","any",
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
}

function buildBigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    out.push(`${tokens[i]!} ${tokens[i + 1]!}`);
  }
  return out;
}

/** Compute IDF map from a corpus of token lists. */
export function computeIdf(corpus: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const n = Math.max(1, corpus.length);
  for (const doc of corpus) {
    const seen = new Set(doc);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
  }
  return idf;
}

export function extractKeywords(
  text: string,
  options: KeywordOptions = {},
  corpus?: string[][],
): KeywordResult {
  const topK = options.topK ?? 15;
  const minLen = options.minWordLength ?? 3;
  const includeBigrams = options.includeBigrams ?? true;
  const positionBoostPercent = options.positionBoostPercent ?? 15;
  const warnings: string[] = [];

  const stop = new Set(STOP_WORDS);
  for (const w of options.extraStopWords ?? []) stop.add(w.toLowerCase());

  const allTokens = tokenize(text);
  const totalTokens = allTokens.length;
  if (totalTokens === 0) {
    return { keywords: [], totalTokens: 0, uniqueUnigrams: 0, uniqueBigrams: 0, warnings: ["No tokens found."] };
  }

  // Filter unigrams
  const filtered: string[] = [];
  for (const t of allTokens) {
    if (t.length < minLen) continue;
    if (stop.has(t)) continue;
    filtered.push(t);
  }
  if (filtered.length === 0) {
    warnings.push("All words were filtered out. Try lowering min word length.");
  }

  // Build frequency + first-position maps
  const freq = new Map<string, number>();
  const firstPos = new Map<string, number>();
  for (let i = 0; i < filtered.length; i++) {
    const t = filtered[i]!;
    freq.set(t, (freq.get(t) ?? 0) + 1);
    if (!firstPos.has(t)) firstPos.set(t, i);
  }
  const uniqueUnigrams = freq.size;

  // Bigrams (only those where both tokens survived filtering)
  const bigramFreq = new Map<string, number>();
  const bigramFirstPos = new Map<string, number>();
  if (includeBigrams) {
    for (let i = 0; i + 1 < filtered.length; i++) {
      const bg = `${filtered[i]!} ${filtered[i + 1]!}`;
      bigramFreq.set(bg, (bigramFreq.get(bg) ?? 0) + 1);
      if (!bigramFirstPos.has(bg)) bigramFirstPos.set(bg, i);
    }
  }
  const uniqueBigrams = bigramFreq.size;

  // IDF
  const idfMap = corpus && corpus.length > 0 ? computeIdf(corpus) : new Map<string, number>();

  // Position boost threshold (in filtered-token index)
  const boostThreshold = Math.max(1, Math.floor(filtered.length * (positionBoostPercent / 100)));

  // Score unigrams
  const rows: Keyword[] = [];
  const totalForTf = filtered.length || 1;
  for (const [word, count] of freq) {
    const tf = count / totalForTf;
    const idf = idfMap.get(word) ?? 1;
    const pos = firstPos.get(word) ?? 0;
    const positionBoost = pos < boostThreshold ? 1.25 : 1.0;
    const lengthBonus = word.length >= 5 && word.length <= 9 ? 1.1 : 1.0;
    const rawScore = tf * idf * positionBoost * lengthBonus;
    rows.push({ word, count, tf, idf, score: rawScore, firstPosition: pos, isBigram: false });
  }
  for (const [word, count] of bigramFreq) {
    const tf = count / totalForTf;
    const idf = idfMap.get(word) ?? 1.2; // bigrams are rarer by default
    const pos = bigramFirstPos.get(word) ?? 0;
    const positionBoost = pos < boostThreshold ? 1.25 : 1.0;
    const rawScore = tf * idf * positionBoost * 1.15; // bigram bonus
    rows.push({ word, count, tf, idf, score: rawScore, firstPosition: pos, isBigram: true });
  }

  // Normalise to 0..100
  const maxScore = rows.length ? Math.max(...rows.map((r) => r.score)) : 1;
  for (const r of rows) {
    r.score = Math.round((r.score / maxScore) * 100);
  }

  rows.sort((a, b) => b.score - a.score || b.count - a.count);

  // De-duplicate: drop a unigram that already appears as part of a top-ranked bigram
  const seenWords = new Set<string>();
  const deduped: Keyword[] = [];
  for (const r of rows) {
    if (r.isBigram) {
      deduped.push(r);
      for (const w of r.word.split(" ")) seenWords.add(w);
    } else {
      if (seenWords.has(r.word)) continue;
      deduped.push(r);
    }
    if (deduped.length >= topK) break;
  }

  if (rows.length > topK) {
    warnings.push(`Showing top ${topK} of ${rows.length} candidates.`);
  }

  return {
    keywords: deduped,
    totalTokens,
    uniqueUnigrams,
    uniqueBigrams,
    warnings,
  };
}

/** Convert keywords to CSV. */
export function keywordsToCsv(result: KeywordResult): string {
  const lines = ["keyword,count,tf,idf,score,position,isBigram"];
  for (const k of result.keywords) {
    lines.push(
      [
        `"${k.word.replace(/"/g, '""')}"`,
        k.count,
        k.tf.toFixed(5),
        k.idf.toFixed(5),
        k.score,
        k.firstPosition,
        k.isBigram,
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Convert keywords to a JSON array. */
export function keywordsToJson(result: KeywordResult): string {
  return JSON.stringify(result.keywords, null, 2);
}
