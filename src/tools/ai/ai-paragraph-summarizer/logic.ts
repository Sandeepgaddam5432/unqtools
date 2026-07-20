/**
 * AI Paragraph Summarizer — pure logic.
 *
 * Extractive summarization that scores each sentence by:
 *   - TF-IDF (term frequency × inverse document frequency across sentences)
 *   - Position (first and last sentences of each paragraph get a bonus)
 *   - Keyword presence (sentences containing the document's top keywords)
 *   - Length normalization (very short or very long sentences are penalized)
 *
 * Supports:
 *   - Adjustable length: short / medium / long
 *   - Output format: paragraph or bullets
 *   - Multi-paragraph input
 *   - Map-reduce chunking for very long inputs
 *   - Top key-points extraction
 *   - Compression-ratio readout
 *   - Local history (max 20) and shareable URL
 *   - Optional BYO-key LLM prompt builder
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: this is deterministic extractive summarization. It does not
 * rephrase or generate new text — selected sentences are kept verbatim.
 * For abstractive (rewritten) summaries, use the optional BYO-key LLM
 * hook. Always verify the summary against the source before quoting.
 */

// ---------- Types ----------

export type SummaryLength = "short" | "medium" | "long";
export type OutputFormat = "paragraph" | "bullets";

export interface Paragraph {
  index: number;
  text: string;
  sentences: string[];
}

export interface ScoredSentence {
  /** 0-based sentence index within the entire document. */
  globalIndex: number;
  /** 0-based paragraph index. */
  paragraphIndex: number;
  /** 0-based sentence index within its paragraph. */
  localIndex: number;
  text: string;
  wordCount: number;
  tfidfScore: number;
  positionScore: number;
  keywordScore: number;
  lengthScore: number;
  score: number;
}

export interface KeyPoint {
  text: string;
  score: number;
}

export interface ChunkSummary {
  chunkIndex: number;
  startSentence: number;
  endSentence: number;
  summary: string;
  sentenceCount: number;
}

export interface SummaryResult {
  summary: string;
  bullets: string[];
  selectedSentences: ScoredSentence[];
  keyPoints: KeyPoint[];
  keywords: string[];
  stats: {
    originalWordCount: number;
    summaryWordCount: number;
    originalSentenceCount: number;
    summarySentenceCount: number;
    paragraphCount: number;
    chunkCount: number;
    compressionRatio: number;
    length: SummaryLength;
    format: OutputFormat;
  };
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  length: SummaryLength;
  format: OutputFormat;
  originalWordCount: number;
  summaryWordCount: number;
  compressionRatio: number;
  preview: string;
}

export interface SummarizeOptions {
  length?: SummaryLength;
  format?: OutputFormat;
  /** Max sentences per chunk before map-reduce kicks in. */
  chunkSize?: number;
  /** Number of keywords to extract. */
  keywordCount?: number;
  /** Number of key points to return. */
  keyPointCount?: number;
}

// ---------- Constants ----------

/** Stop words excluded from TF-IDF and keyword extraction. */
export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to",
  "in", "on", "for", "with", "as", "is", "are", "be", "been", "being",
  "was", "were", "this", "that", "these", "those", "i", "you", "we",
  "they", "he", "she", "it", "its", "their", "his", "her", "our", "your",
  "so", "do", "does", "did", "done", "have", "has", "had", "will",
  "would", "should", "could", "can", "may", "might", "must", "shall",
  "just", "really", "very", "going", "get", "got", "want", "need",
  "like", "know", "think", "said", "say", "says", "okay", "ok", "yeah",
  "yes", "no", "not", "from", "at", "by", "about", "into", "out", "up",
  "down", "over", "under", "again", "more", "most", "some", "any", "all",
  "each", "every", "few", "both", "than", "too", "also", "only", "own",
  "same", "such", "there", "here", "when", "where", "why", "how", "what",
  "which", "who", "whom", "while", "during", "after", "before", "since",
  "until", "because", "though", "although", "through", "between", "among",
]);

/** Length presets → fraction of sentences to keep. */
export const LENGTH_FRACTIONS: Record<SummaryLength, number> = {
  short: 0.15,
  medium: 0.3,
  long: 0.5,
};

/** Map-reduce chunk size (in sentences). */
export const DEFAULT_CHUNK_SIZE = 60;

/** Default number of keywords to extract. */
export const DEFAULT_KEYWORD_COUNT = 10;

/** Default number of key points to return. */
export const DEFAULT_KEYPOINT_COUNT = 5;

/** Threshold (in sentences) above which map-reduce kicks in. */
export const CHUNK_THRESHOLD = 80;

// ---------- Text splitting ----------

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/g;
const PARAGRAPH_SPLIT_RE = /\n\s*\n+/g;

/** Split text into paragraphs (double-newline separated). */
export function splitParagraphs(text: string): string[] {
  if (!text) return [];
  // Normalize line endings and tabs, but preserve newlines for paragraph splitting.
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!cleaned) return [];
  // If no double newlines, treat the whole text as one paragraph.
  if (!PARAGRAPH_SPLIT_RE.test(cleaned)) {
    return [cleaned.replace(/\s+/g, " ").trim()].filter(Boolean);
  }
  return cleaned
    .split(PARAGRAPH_SPLIT_RE)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Split a paragraph into sentences. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenize text into lowercase alpha words (apostrophes/hyphens allowed). */
export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]+/g) || []).filter(Boolean);
}

/** Filter out stop words. */
export function removeStopWords(words: string[]): string[] {
  return words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
}

/** Count words in text (whitespace-separated alpha tokens). */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.toLowerCase().match(/[a-z][a-z'-]*/g);
  return matches ? matches.length : 0;
}

/** Count sentences in text. */
export function countSentences(text: string): number {
  return splitSentences(text).length;
}

// ---------- TF-IDF ----------

/** Build a frequency map of content words in a sentence. */
export function buildTermFreq(words: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const w of words) {
    const key = w.toLowerCase();
    tf.set(key, (tf.get(key) ?? 0) + 1);
  }
  return tf;
}

/** Build inverse-document-frequency across a set of sentences (documents). */
export function buildInverseDocFreq(sentences: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const n = Math.max(sentences.length, 1);
  for (const s of sentences) {
    const content = new Set(removeStopWords(tokenizeWords(s)));
    for (const w of content) {
      df.set(w, (df.get(w) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [w, freq] of df) {
    // Smoothed IDF: log((1 + N) / (1 + df)) + 1
    idf.set(w, Math.log((1 + n) / (1 + freq)) + 1);
  }
  return idf;
}

/** Compute the TF-IDF score of a sentence given an IDF table. */
export function sentenceTfidf(sentence: string, idf: Map<string, number>): number {
  const words = removeStopWords(tokenizeWords(sentence));
  if (words.length === 0) return 0;
  const tf = buildTermFreq(words);
  let score = 0;
  for (const [w, f] of tf) {
    const idfVal = idf.get(w) ?? 1;
    score += f * idfVal;
  }
  // Normalize by sentence length (sqrt) to avoid long-sentence bias.
  return score / Math.sqrt(words.length);
}

// ---------- Keyword extraction ----------

/** Extract the top N keywords by summed TF-IDF across the document. */
export function extractKeywords(sentences: string[], n: number = DEFAULT_KEYWORD_COUNT): string[] {
  const idf = buildInverseDocFreq(sentences);
  const totals = new Map<string, number>();
  for (const s of sentences) {
    const tf = buildTermFreq(removeStopWords(tokenizeWords(s)));
    for (const [w, f] of tf) {
      const idfVal = idf.get(w) ?? 1;
      totals.set(w, (totals.get(w) ?? 0) + f * idfVal);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// ---------- Scoring ----------

/** Position score: bonus for first/last sentence of a paragraph. */
export function scoreByPosition(localIndex: number, paragraphLength: number): number {
  if (paragraphLength <= 1) return 1.0;
  if (localIndex === 0 || localIndex === paragraphLength - 1) return 1.0;
  // Slight decay for middle sentences.
  const mid = (paragraphLength - 1) / 2;
  const dist = Math.abs(localIndex - mid) / mid;
  return 0.5 + 0.3 * dist;
}

/** Keyword-presence score: fraction of the document's top keywords present. */
export function scoreByKeyword(sentence: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const words = new Set(tokenizeWords(sentence).map((w) => w.toLowerCase()));
  let hits = 0;
  for (const k of keywords) {
    if (words.has(k.toLowerCase())) hits++;
  }
  return hits / keywords.length;
}

/** Length score: penalize very short (<5) or very long (>40) sentences. */
export function scoreByLength(wordCount: number): number {
  if (wordCount < 5) return 0.3;
  if (wordCount > 40) return 0.6;
  // Ideal range 8–25.
  if (wordCount >= 8 && wordCount <= 25) return 1.0;
  if (wordCount < 8) return 0.5 + 0.5 * (wordCount / 8);
  return 0.5 + 0.5 * (25 / wordCount);
}

/** Score every sentence in the document. */
export function scoreSentences(
  paragraphs: Paragraph[],
  keywords: string[],
): ScoredSentence[] {
  // Build IDF across the entire document.
  const allSentences: string[] = [];
  for (const p of paragraphs) allSentences.push(...p.sentences);
  const idf = buildInverseDocFreq(allSentences);

  const out: ScoredSentence[] = [];
  let globalIndex = 0;
  for (const p of paragraphs) {
    const pLen = p.sentences.length;
    for (let i = 0; i < pLen; i++) {
      const text = p.sentences[i];
      const words = removeStopWords(tokenizeWords(text));
      const wordCount = tokenizeWords(text).length;
      const tfidf = sentenceTfidf(text, idf);
      const position = scoreByPosition(i, pLen);
      const keyword = scoreByKeyword(text, keywords);
      const length = scoreByLength(wordCount);
      // Weighted combination.
      const score =
        0.5 * normalize(tfidf, allSentences) +
        0.25 * position +
        0.15 * keyword +
        0.1 * length;
      out.push({
        globalIndex,
        paragraphIndex: p.index,
        localIndex: i,
        text,
        wordCount,
        tfidfScore: tfidf,
        positionScore: position,
        keywordScore: keyword,
        lengthScore: length,
        score,
      });
      globalIndex++;
    }
  }
  return out;
}

/** Normalize a TF-IDF value against the max across the document. */
function normalize(value: number, allSentences: string[]): number {
  const idf = buildInverseDocFreq(allSentences);
  let max = 0;
  for (const s of allSentences) {
    const sc = sentenceTfidf(s, idf);
    if (sc > max) max = sc;
  }
  return max > 0 ? value / max : 0;
}

// ---------- Selection ----------

/** Pick the top-N sentences by score, preserving original order. */
export function pickTopSentences(scored: ScoredSentence[], n: number): ScoredSentence[] {
  if (n <= 0) return [];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, n);
  // Re-sort by global index so the summary reads in original order.
  return top.sort((a, b) => a.globalIndex - b.globalIndex);
}

/** Map a SummaryLength preset to a sentence count. */
export function summaryLengthCount(
  length: SummaryLength,
  totalSentences: number,
): number {
  const frac = LENGTH_FRACTIONS[length];
  const raw = Math.round(totalSentences * frac);
  return Math.max(1, Math.min(raw, totalSentences));
}

// ---------- Chunking (map-reduce) ----------

/** Split a flat list of sentences into chunks of approximately chunkSize each. */
export function chunkSentences(sentences: string[], chunkSize: number = DEFAULT_CHUNK_SIZE): string[][] {
  if (sentences.length === 0) return [];
  if (chunkSize <= 0) return [sentences];
  const chunks: string[][] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    chunks.push(sentences.slice(i, i + chunkSize));
  }
  return chunks;
}

/** Summarize a single chunk (returns the picked sentences in order). */
export function summarizeChunk(chunk: string[], length: SummaryLength): string[] {
  if (chunk.length === 0) return [];
  const paragraphs: Paragraph[] = [{ index: 0, text: chunk.join(" "), sentences: chunk }];
  const keywords = extractKeywords(chunk, DEFAULT_KEYWORD_COUNT);
  const scored = scoreSentences(paragraphs, keywords);
  const n = summaryLengthCount(length, chunk.length);
  const picked = pickTopSentences(scored, n);
  return picked.map((s) => s.text);
}

/**
 * Map-reduce summarization for very long inputs.
 * Step 1 (map): summarize each chunk independently.
 * Step 2 (reduce): concatenate chunk summaries and re-summarize.
 */
export function mapReduceSummarize(
  paragraphs: Paragraph[],
  length: SummaryLength,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkSummary[] {
  const allSentences: string[] = [];
  for (const p of paragraphs) allSentences.push(...p.sentences);
  const chunks = chunkSentences(allSentences, chunkSize);
  const out: ChunkSummary[] = [];
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const summary = summarizeChunk(chunk, length);
    out.push({
      chunkIndex: i,
      startSentence: offset,
      endSentence: offset + chunk.length - 1,
      summary: summary.join(" "),
      sentenceCount: summary.length,
    });
    offset += chunk.length;
  }
  return out;
}

// ---------- Main entry ----------

/** Summarize text. Pure function — no DOM, no network. */
export function summarize(text: string, options: SummarizeOptions = {}): SummaryResult {
  const length: SummaryLength = options.length ?? "medium";
  const format: OutputFormat = options.format ?? "paragraph";
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const keywordCount = options.keywordCount ?? DEFAULT_KEYWORD_COUNT;
  const keyPointCount = options.keyPointCount ?? DEFAULT_KEYPOINT_COUNT;

  const warnings: string[] = [];
  const cleaned = (text || "").trim();
  if (!cleaned) {
    return emptyResult(length, format);
  }

  const paragraphTexts = splitParagraphs(cleaned);
  const paragraphs: Paragraph[] = paragraphTexts.map((t, i) => ({
    index: i,
    text: t,
    sentences: splitSentences(t),
  }));

  const allSentences: string[] = [];
  for (const p of paragraphs) allSentences.push(...p.sentences);

  if (allSentences.length === 0) {
    warnings.push("No sentence terminators found — output is the full text.");
    return {
      summary: cleaned,
      bullets: [cleaned],
      selectedSentences: [],
      keyPoints: [],
      keywords: [],
      stats: {
        originalWordCount: countWords(cleaned),
        summaryWordCount: countWords(cleaned),
        originalSentenceCount: 0,
        summarySentenceCount: 1,
        paragraphCount: paragraphs.length,
        chunkCount: 1,
        compressionRatio: 1,
        length,
        format,
      },
      warnings,
    };
  }

  const keywords = extractKeywords(allSentences, keywordCount);
  const scored = scoreSentences(paragraphs, keywords);

  // Map-reduce for very long inputs.
  let chunkCount = 1;
  let summarySentences: ScoredSentence[];
  if (allSentences.length > CHUNK_THRESHOLD) {
    chunkCount = Math.ceil(allSentences.length / chunkSize);
    const chunks = mapReduceSummarize(paragraphs, length, chunkSize);
    const combinedSentences: string[] = [];
    for (const c of chunks) {
      if (c.summary) combinedSentences.push(...splitSentences(c.summary));
    }
    // Reduce step: re-summarize the combined chunk summaries.
    const reduceParagraphs: Paragraph[] = [
      { index: 0, text: combinedSentences.join(" "), sentences: combinedSentences },
    ];
    const reduceKeywords = extractKeywords(combinedSentences, keywordCount);
    const reduceScored = scoreSentences(reduceParagraphs, reduceKeywords);
    const reduceN = summaryLengthCount(length, combinedSentences.length);
    summarySentences = pickTopSentences(reduceScored, reduceN);
    warnings.push(
      `Long input (${allSentences.length} sentences) — used map-reduce across ${chunkCount} chunks.`,
    );
  } else {
    const n = summaryLengthCount(length, allSentences.length);
    summarySentences = pickTopSentences(scored, n);
  }

  // Key points: top-N sentences by score across the whole document.
  const keyPoints: KeyPoint[] = pickTopSentences(scored, keyPointCount).map((s) => ({
    text: s.text,
    score: s.score,
  }));

  const summary = renderParagraph(summarySentences.map((s) => s.text));
  const bullets = renderBullets(summarySentences.map((s) => s.text));

  const originalWordCount = countWords(cleaned);
  const summaryWordCount = countWords(summary);

  return {
    summary,
    bullets,
    selectedSentences: summarySentences,
    keyPoints,
    keywords,
    stats: {
      originalWordCount,
      summaryWordCount,
      originalSentenceCount: allSentences.length,
      summarySentenceCount: summarySentences.length,
      paragraphCount: paragraphs.length,
      chunkCount,
      compressionRatio: originalWordCount > 0 ? summaryWordCount / originalWordCount : 0,
      length,
      format,
    },
    warnings,
  };
}

/** Empty result for blank input. */
function emptyResult(length: SummaryLength, format: OutputFormat): SummaryResult {
  return {
    summary: "",
    bullets: [],
    selectedSentences: [],
    keyPoints: [],
    keywords: [],
    stats: {
      originalWordCount: 0,
      summaryWordCount: 0,
      originalSentenceCount: 0,
      summarySentenceCount: 0,
      paragraphCount: 0,
      chunkCount: 0,
      compressionRatio: 0,
      length,
      format,
    },
    warnings: [],
  };
}

// ---------- Rendering ----------

/** Render selected sentences as a flowing paragraph. */
export function renderParagraph(sentences: string[]): string {
  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

/** Render selected sentences as a Markdown bullet list. */
export function renderBullets(sentences: string[]): string[] {
  return sentences.map((s) => `- ${s}`);
}

/** Render the full summary result as Markdown. */
export function renderMarkdown(result: SummaryResult): string {
  const lines: string[] = [];
  lines.push(`# Summary (${result.stats.length})`);
  lines.push("");
  lines.push(`**Compression:** ${result.stats.summaryWordCount}/${result.stats.originalWordCount} words (${(result.stats.compressionRatio * 100).toFixed(1)}%)`);
  lines.push(`**Sentences:** ${result.stats.summarySentenceCount}/${result.stats.originalSentenceCount}`);
  lines.push(`**Paragraphs:** ${result.stats.paragraphCount}`);
  if (result.stats.chunkCount > 1) {
    lines.push(`**Chunks (map-reduce):** ${result.stats.chunkCount}`);
  }
  lines.push("");
  if (result.keywords.length > 0) {
    lines.push("## Keywords");
    lines.push("");
    lines.push(result.keywords.map((k) => `\`${k}\``).join(" "));
    lines.push("");
  }
  if (result.keyPoints.length > 0) {
    lines.push("## Key Points");
    lines.push("");
    for (const kp of result.keyPoints) {
      lines.push(`- ${kp.text}`);
    }
    lines.push("");
  }
  lines.push("## Summary");
  lines.push("");
  if (result.stats.format === "bullets") {
    lines.push(...result.bullets);
  } else {
    lines.push(result.summary);
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("## Notes");
    lines.push("");
    for (const w of result.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-paragraph-summarizer:history";
const HISTORY_MAX = 20;

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

// ---------- Shareable URL ----------

export function buildShareUrl(
  text: string,
  length: SummaryLength,
  format: OutputFormat,
): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  params.set("length", length);
  params.set("format", format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { text: string; length: SummaryLength; format: OutputFormat } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", length: "medium", format: "paragraph" };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const lengthRaw = params.get("length") ?? "medium";
  const formatRaw = params.get("format") ?? "paragraph";
  const length: SummaryLength =
    lengthRaw === "short" || lengthRaw === "medium" || lengthRaw === "long"
      ? lengthRaw
      : "medium";
  const format: OutputFormat =
    formatRaw === "paragraph" || formatRaw === "bullets" ? formatRaw : "paragraph";
  return { text, length, format };
}

// ---------- BYO-key LLM prompt ----------

/** Build a system+user prompt for an external LLM (abstractive summary). */
export function buildLlmPrompt(text: string, length: SummaryLength, format: OutputFormat): {
  system: string;
  user: string;
} {
  const wordTarget =
    length === "short"
      ? "≈50 words"
      : length === "medium"
        ? "≈120 words"
        : "≈250 words";
  const shape = format === "bullets" ? "as 3-6 concise bullets" : "as a single flowing paragraph";
  return {
    system:
      "You are a precise summarization assistant. Summarize the user's text faithfully, preserving facts, numbers, and named entities. Do not invent information. Output in the requested shape only.",
    user: `Summarize the following text in ${wordTarget}, ${shape}.\n\nTEXT:\n"""\n${text}\n"""`,
  };
}
