/**
 * AI Book Summary Generator — pure logic.
 *
 * Generate multi-level summaries (premise, key ideas, chapter breakdown,
 * takeaways) from book-length text using extractive summarization.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: extractive summarization picks the highest-scoring sentences
 * from the source text. It does not generate new prose or capture subtle
 * literary nuance. For tough cases (e.g. abstract themes), paste your own
 * LLM API key for abstractive enhancement. Summarize only content you
 * have the rights to.
 */

// ---------- Types ----------

export type Depth = "low" | "medium" | "high";

export interface Chapter {
  index: number;
  title: string;
  text: string;
  start: number;
  end: number;
}

export interface QAPair {
  question: string;
  answer: string;
}

export interface ChapterSummary {
  chapter: Chapter;
  summary: string[];
  keywords: string[];
  premise: string;
  takeaways: string[];
  qaPairs: QAPair[];
  sentenceCount: number;
  wordCount: number;
}

export interface OutlineNode {
  title: string;
  children: OutlineNode[];
}

export interface BookStats {
  wordCount: number;
  sentenceCount: number;
  chapterCount: number;
  readingTimeMinutes: number;
  keywordsDetected: string[];
}

export interface BookReport {
  input: string;
  depth: Depth;
  premise: string;
  keyIdeas: string[];
  overallSummary: string[];
  chapterSummaries: ChapterSummary[];
  takeaways: string[];
  outline: OutlineNode[];
  stats: BookStats;
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  title: string;
  wordCount: number;
  chapterCount: number;
  depth: Depth;
}

export interface ShareState {
  text: string;
  depth: Depth;
}

export type LlmProvider = "openai" | "anthropic";

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-book-summary:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-book-summary:llm-key";

export const DEPTH_LABELS: Record<Depth, string> = {
  "low": "Low (1 sentence/chapter)",
  "medium": "Medium (3 sentences/chapter)",
  "high": "High (5 sentences/chapter)",
};

export const DEPTH_SENTENCE_COUNT: Record<Depth, number> = {
  "low": 1,
  "medium": 3,
  "high": 5,
};

export const DEPTH_KEY_IDEAS: Record<Depth, number> = {
  "low": 3,
  "medium": 5,
  "high": 7,
};

export const DEPTH_TAKEAWAYS: Record<Depth, number> = {
  "low": 3,
  "medium": 5,
  "high": 7,
};

export const MAX_CHUNK_CHARS = 5000;
export const CHUNK_OVERLAP_CHARS = 200;
export const READING_WPM = 250;

// Stopwords — common English words excluded from keyword / frequency analysis.
export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when",
  "at", "by", "for", "with", "about", "against", "between", "into",
  "through", "during", "before", "after", "above", "below", "to", "from",
  "up", "down", "in", "out", "on", "off", "over", "under", "again",
  "is", "are", "was", "were", "be", "been", "being", "am", "have", "has",
  "had", "do", "does", "did", "will", "would", "should", "could", "may",
  "might", "must", "shall", "can", "of", "as", "this", "that", "these",
  "those", "it", "its", "he", "she", "they", "we", "you", "i", "me",
  "him", "her", "us", "them", "my", "your", "their", "our", "his", "hers",
  "theirs", "ours", "what", "which", "who", "whom", "whose", "where",
  "why", "how", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "just", "also", "here", "there", "now",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "because", "while", "until", "since", "though", "although", "unless",
]);

// Cue phrases for "takeaway" detection.
export const TAKEAWAY_CUES: RegExp[] = [
  /\b(should|must|ought to|need to|always|never|remember|important|essential|crucial|key|lesson|takeaway)\b/i,
  /\b(in summary|in conclusion|to summarize|in short|the bottom line|the point is)\b/i,
  /\b(you can|you should|you must|you need|you will|you can't|you cannot)\b/i,
  /\b(first|second|third|finally|ultimately)\b/i,
];

// Imperative cue — sentence starts with a base-form verb.
export const IMPERATIVE_CUE = /^\s*(make|take|get|find|use|try|start|stop|build|create|remember|consider|focus|avoid|learn|practice|apply|ask|read|write|think|choose|set|keep|let|don't|do not|never|always)\b/i;

// ---------- Text utilities ----------

/** Split text into sentences with start/end offsets. */
export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  if (!text) return out;
  const re = /[^.!?]*[.!?]+["')\]]?\s*|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!raw) continue;
    const start = m.index;
    const end = start + raw.length;
    const clean = raw.trim();
    if (clean) out.push({ text: clean, start, end });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** Tokenize text into lowercase word tokens. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter(Boolean);
}

/** Count words. */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Count syllables (heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

// ---------- Frequency & keywords ----------

/** Compute word frequencies (excluding stopwords, single-letter tokens). */
export function computeWordFrequencies(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (t.length < 2) continue;
    if (/^\d+$/.test(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

/** Extract top-N keywords by frequency. */
export function extractKeywords(text: string, n: number): string[] {
  if (!text || n <= 0) return [];
  const tokens = tokenize(text);
  const freq = computeWordFrequencies(tokens);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted.slice(0, n).map(([w]) => w);
}

/** Extract top-N bigram keywords. */
export function extractBigrams(text: string, n: number): string[] {
  if (!text || n <= 0) return [];
  const tokens = tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length >= 2);
  const freq = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
  }
  const sorted = [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted.slice(0, n).map(([w]) => w);
}

/** Combined keyword extraction: mix of unigrams and bigrams. */
export function extractKeyIdeas(text: string, n: number): string[] {
  if (!text || n <= 0) return [];
  const unigrams = extractKeywords(text, n);
  const bigrams = extractBigrams(text, Math.ceil(n / 2));
  // Interleave: prefer bigrams then unigrams, dedupe.
  const out: string[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(unigrams.length, bigrams.length);
  for (let i = 0; i < maxLen && out.length < n; i++) {
    if (i < bigrams.length) {
      const b = bigrams[i];
      const words = b.split(" ");
      // Skip if either word already in output as unigram.
      if (!seen.has(b) && !words.some((w) => seen.has(w))) {
        out.push(b);
        seen.add(b);
        words.forEach((w) => seen.add(w));
      }
    }
    if (i < unigrams.length && out.length < n) {
      const u = unigrams[i];
      if (!seen.has(u)) {
        out.push(u);
        seen.add(u);
      }
    }
  }
  return out;
}

// ---------- Chapter detection ----------

/** Detect chapters in the text. Returns at least 1 chapter (whole text). */
export function splitChapters(text: string): Chapter[] {
  if (!text) return [];
  const lines = text.split(/\n/);
  const chapterStarts: { index: number; title: string; offset: number }[] = [];
  let offset = 0;
  // Regexes for chapter headings.
  const reChapterNum = /^(\s*)(chapter|chapter\s+\d+|chapter\s+[ivxlc]+|ch\.?\s+\d+)\b[:.\s-]*(.*)$/i;
  const rePartNum = /^(\s*)(part|book|section|prologue|epilogue|preface|introduction|foreword|appendix)\b[:.\s-]*(.*)$/i;
  const reAllCapsShort = /^[A-Z][A-Z0-9 \-:'",&.]{2,60}$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLen = line.length + 1; // +1 for the \n that was removed
    let m: RegExpMatchArray | null;
    if ((m = line.match(reChapterNum))) {
      const title = (m[3] || line).trim() || line.trim();
      chapterStarts.push({ index: i, title: title.slice(0, 120), offset });
    } else if ((m = line.match(rePartNum))) {
      const title = (m[3] || line).trim() || line.trim();
      chapterStarts.push({ index: i, title: title.slice(0, 120), offset });
    } else if (i === 0 && reAllCapsShort.test(line) && lines.length > 1) {
      // First line all-caps short → likely title.
      // Don't treat as chapter (will fall through to whole-text-as-one-chapter).
    } else if (reAllCapsShort.test(line) && i > 0) {
      // All-caps short line in the middle → likely chapter heading.
      // Only treat as chapter if previous line is blank or very short.
      const prevLine = (lines[i - 1] || "").trim();
      if (!prevLine || prevLine.length < 40) {
        chapterStarts.push({ index: i, title: line.trim().slice(0, 120), offset });
      }
    }
    offset += lineLen;
  }

  if (chapterStarts.length === 0) {
    return [{
      index: 0,
      title: "Full text",
      text,
      start: 0,
      end: text.length,
    }];
  }

  // If first chapter doesn't start at offset 0, prepend a "Front matter" chapter.
  const chapters: Chapter[] = [];
  if (chapterStarts[0].offset > 0) {
    const front = text.slice(0, chapterStarts[0].offset);
    if (front.trim()) {
      chapters.push({
        index: 0,
        title: "Front matter",
        text: front,
        start: 0,
        end: chapterStarts[0].offset,
      });
    }
  }
  for (let i = 0; i < chapterStarts.length; i++) {
    const start = chapterStarts[i].offset;
    const end = i + 1 < chapterStarts.length ? chapterStarts[i + 1].offset : text.length;
    chapters.push({
      index: chapters.length,
      title: chapterStarts[i].title || `Chapter ${i + 1}`,
      text: text.slice(start, end),
      start,
      end,
    });
  }
  // Re-index.
  return chapters.map((c, i) => ({ ...c, index: i }));
}

// ---------- Chunking ----------

/** Split long text into chunks at sentence boundaries (roughly maxChars each). */
export function chunkText(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (!text) return [];
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  const sentences = splitSentences(text);
  let current = "";
  for (const s of sentences) {
    if (current.length + s.text.length + 1 > maxChars) {
      if (current) chunks.push(current);
      current = s.text;
    } else {
      current = current ? `${current} ${s.text}` : s.text;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ---------- Sentence scoring ----------

/**
 * Score a sentence for extractive summarization. Higher = more important.
 * Factors: word frequency, position, keyword presence, length penalty.
 */
export function scoreSentence(
  sentence: string,
  index: number,
  totalSentences: number,
  freqMap: Map<string, number>,
  keywords: string[],
): number {
  const tokens = tokenize(sentence).filter((t) => !STOPWORDS.has(t) && t.length >= 2);
  if (tokens.length === 0) return 0;
  const maxFreq = Math.max(1, ...freqMap.values());
  // TF score: sum of normalized frequencies / sqrt(length) (to avoid length bias).
  let tfScore = 0;
  for (const t of tokens) {
    tfScore += (freqMap.get(t) ?? 0) / maxFreq;
  }
  tfScore = tfScore / Math.sqrt(tokens.length);
  // Position score: first 3 sentences get boost, last few sentences also get small boost.
  let positionScore = 0.5;
  if (index < 3) positionScore = 1.0;
  else if (index < 5) positionScore = 0.85;
  else if (index < 10) positionScore = 0.7;
  else if (totalSentences - index <= 3) positionScore = 0.65;
  else positionScore = 0.5;
  // Keyword score: each keyword present adds 0.3.
  const lower = sentence.toLowerCase();
  let keywordScore = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) keywordScore += 0.3;
  }
  // Length penalty: too short or too long is bad.
  let lengthMultiplier = 1.0;
  if (tokens.length < 4) lengthMultiplier = 0.3;
  else if (tokens.length < 6) lengthMultiplier = 0.7;
  else if (tokens.length > 40) lengthMultiplier = 0.5;
  else if (tokens.length > 30) lengthMultiplier = 0.8;
  // Cue phrase bonus.
  let cueBonus = 0;
  if (TAKEAWAY_CUES.some((re) => re.test(sentence))) cueBonus += 0.2;
  if (IMPERATIVE_CUE.test(sentence)) cueBonus += 0.15;
  // Numeric content bonus (often signals important data).
  if (/\b\d+(\.\d+)?%?\b/.test(sentence)) cueBonus += 0.1;
  return (tfScore * 0.5 + positionScore * 0.3 + keywordScore * 0.2 + cueBonus) * lengthMultiplier;
}

/** Summarize a chunk of text by selecting the top-N highest-scoring sentences. */
export function summarizeChunk(
  text: string,
  sentenceCount: number,
  freqMap?: Map<string, number>,
  keywords?: string[],
): string[] {
  if (!text || sentenceCount <= 0) return [];
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  if (sentences.length <= sentenceCount) return sentences.map((s) => s.text);
  const fm = freqMap ?? computeWordFrequencies(tokenize(text));
  const kws = keywords ?? extractKeywords(text, 5);
  const scored = sentences.map((s, i) => ({
    text: s.text,
    index: i,
    score: scoreSentence(s.text, i, sentences.length, fm, kws),
  }));
  // Pick top-N by score, then re-sort by original index for readability.
  const topN = [...scored].sort((a, b) => b.score - a.score).slice(0, sentenceCount);
  topN.sort((a, b) => a.index - b.index);
  return topN.map((s) => s.text);
}

/** Hierarchical merge: summarize each chunk, then summarize the merged summaries. */
export function hierarchicalMerge(
  text: string,
  sentenceCount: number,
  maxChars: number = MAX_CHUNK_CHARS,
): string[] {
  if (!text) return [];
  const chunks = chunkText(text, maxChars);
  if (chunks.length <= 1) {
    return summarizeChunk(text, sentenceCount);
  }
  // Summarize each chunk to ~2-3 sentences.
  const perChunk = Math.max(2, Math.ceil(sentenceCount / Math.max(1, chunks.length)) + 1);
  const chunkSummaries: string[] = [];
  for (const chunk of chunks) {
    chunkSummaries.push(...summarizeChunk(chunk, perChunk));
  }
  if (chunkSummaries.length <= sentenceCount) return chunkSummaries;
  // Re-summarize the merged text of chunk summaries.
  const merged = chunkSummaries.join(" ");
  return summarizeChunk(merged, sentenceCount);
}

// ---------- Premise, takeaways, Q&A ----------

/** Extract a single-sentence premise (highest-scoring sentence from the first chunk). */
export function extractPremise(text: string): string {
  if (!text) return "";
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  if (sentences.length === 1) return sentences[0].text;
  // Prefer the first 5 sentences — pick the highest-scoring one.
  const head = sentences.slice(0, Math.min(5, sentences.length));
  const fm = computeWordFrequencies(tokenize(text));
  const kws = extractKeywords(text, 5);
  const scored = head.map((s, i) => ({
    text: s.text,
    score: scoreSentence(s.text, i, sentences.length, fm, kws),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.text ?? sentences[0].text;
}

/** Extract actionable takeaway sentences. */
export function extractTakeaways(sentences: { text: string }[], n: number): string[] {
  if (sentences.length === 0 || n <= 0) return [];
  // Score by cue phrases + imperative starts only.
  const scored = sentences.map((s, i) => {
    let cueScore = 0;
    for (const re of TAKEAWAY_CUES) if (re.test(s.text)) cueScore += 1;
    if (IMPERATIVE_CUE.test(s.text)) cueScore += 1;
    return { text: s.text, cueScore, index: i };
  });
  const withCues = scored.filter((s) => s.cueScore > 0);
  // Fallback: if no cue sentences, return the first N.
  if (withCues.length === 0) {
    return sentences.slice(0, n).map((s) => s.text);
  }
  // Sort by cue score; break ties with first-half boost.
  const sorted = [...withCues].sort((a, b) => {
    const aBoost = a.index < sentences.length / 2 ? 0.2 : 0;
    const bBoost = b.index < sentences.length / 2 ? 0.2 : 0;
    return (b.cueScore + bBoost) - (a.cueScore + aBoost);
  });
  const top = sorted.slice(0, n);
  // Restore original order for readability.
  top.sort((a, b) => a.index - b.index);
  return top.map((s) => s.text);
}

/** Generate Q&A pairs from a chapter's text and keywords. */
export function generateQAPairs(
  chapterTitle: string,
  chapterText: string,
  summary: string[],
  keywords: string[],
  n: number,
): QAPair[] {
  if (n <= 0) return [];
  const pairs: QAPair[] = [];
  const sentences = splitSentences(chapterText);
  const lowerSummary = summary.map((s) => s.toLowerCase());
  for (const kw of keywords) {
    if (pairs.length >= n) break;
    // Find a sentence containing this keyword that's not already in the summary.
    const candidate = sentences.find(
      (s) =>
        s.text.toLowerCase().includes(kw.toLowerCase()) &&
        !lowerSummary.some((sum) => sum.includes(s.text.toLowerCase().slice(0, 40))),
    );
    if (candidate) {
      pairs.push({
        question: `What does ${chapterTitle} say about "${kw}"?`,
        answer: candidate.text,
      });
    } else if (summary.length > 0) {
      // Fallback: use the first summary sentence.
      pairs.push({
        question: `What is a key point in ${chapterTitle}?`,
        answer: summary[0],
      });
    }
  }
  // If we still need more pairs, generate from summary sentences.
  while (pairs.length < n && pairs.length < summary.length) {
    pairs.push({
      question: `What is a key point in ${chapterTitle}?`,
      answer: summary[pairs.length],
    });
  }
  return pairs;
}

// ---------- Chapter summarization ----------

/** Summarize a single chapter. */
export function summarizeChapter(chapter: Chapter, depth: Depth): ChapterSummary {
  const sentenceCount = DEPTH_SENTENCE_COUNT[depth];
  const sentences = splitSentences(chapter.text);
  const tokens = tokenize(chapter.text);
  const freq = computeWordFrequencies(tokens);
  const keywords = extractKeywords(chapter.text, 5);
  const summary = sentences.length <= sentenceCount
    ? sentences.map((s) => s.text)
    : summarizeChunk(chapter.text, sentenceCount, freq, keywords);
  const premise = extractPremise(chapter.text);
  const takeaways = extractTakeaways(sentences, Math.min(3, DEPTH_TAKEAWAYS[depth]));
  const qaPairs = generateQAPairs(
    chapter.title,
    chapter.text,
    summary,
    keywords.slice(0, 3),
    Math.min(3, sentenceCount),
  );
  return {
    chapter,
    summary,
    keywords,
    premise,
    takeaways,
    qaPairs,
    sentenceCount: sentences.length,
    wordCount: countWords(chapter.text),
  };
}

// ---------- Outline ----------

/** Build a hierarchical outline from chapters and summaries. */
export function buildOutline(
  bookTitle: string,
  chapterSummaries: ChapterSummary[],
  keyIdeas: string[],
): OutlineNode[] {
  const ideaNodes: OutlineNode[] = keyIdeas.map((k) => ({
    title: k,
    children: [],
  }));
  const chapterNodes: OutlineNode[] = chapterSummaries.map((cs) => ({
    title: cs.chapter.title,
    children: [
      { title: `Premise: ${cs.premise.slice(0, 80)}${cs.premise.length > 80 ? "…" : ""}`, children: [] },
      {
        title: "Key sentences",
        children: cs.summary.map((s) => ({
          title: s.slice(0, 100) + (s.length > 100 ? "…" : ""),
          children: [],
        })),
      },
      {
        title: "Keywords",
        children: cs.keywords.map((k) => ({ title: k, children: [] })),
      },
    ],
  }));
  return [
    { title: bookTitle, children: [
      { title: "Key ideas", children: ideaNodes },
      { title: "Chapters", children: chapterNodes },
    ] },
  ];
}

/** Render an outline as nested bullet text. */
export function renderOutlineText(outline: OutlineNode[], indent = 0): string {
  const lines: string[] = [];
  for (const node of outline) {
    lines.push(`${"  ".repeat(indent)}- ${node.title}`);
    if (node.children.length > 0) {
      lines.push(renderOutlineText(node.children, indent + 1));
    }
  }
  return lines.join("\n");
}

// ---------- Main analysis ----------

/** Analyze book-length text and produce a multi-level summary. */
export function analyzeBook(text: string, depth: Depth = "medium"): BookReport {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return emptyReport(depth);
  }
  const warnings: string[] = [];

  // Word & sentence stats.
  const sentences = splitSentences(trimmed);
  const wordCount = countWords(trimmed);
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / READING_WPM));

  // Chapter detection.
  const chapters = splitChapters(trimmed);
  const chapterSummaries = chapters.map((c) => summarizeChapter(c, depth));

  // Overall premise.
  const premise = extractPremise(trimmed);

  // Key ideas (top-N across the whole book).
  const keyIdeas = extractKeyIdeas(trimmed, DEPTH_KEY_IDEAS[depth]);

  // Overall summary: use hierarchical merge for very long text.
  const overallSummary = hierarchicalMerge(trimmed, DEPTH_SENTENCE_COUNT[depth] * 2);

  // Takeaways from the whole book.
  const takeaways = extractTakeaways(sentences, DEPTH_TAKEAWAYS[depth]);

  // Outline.
  const outline = buildOutline("Summary", chapterSummaries, keyIdeas);

  // Warnings.
  if (wordCount < 100) {
    warnings.push("This text is very short — the summary may not be meaningful.");
  }
  if (chapters.length === 1) {
    warnings.push("No chapter headings detected — treating the whole text as one section.");
  }
  if (trimmed.length > MAX_CHUNK_CHARS * 10) {
    warnings.push("Very long text — using hierarchical chunk-and-merge summarization.");
  }

  return {
    input: trimmed,
    depth,
    premise,
    keyIdeas,
    overallSummary,
    chapterSummaries,
    takeaways,
    outline,
    stats: {
      wordCount,
      sentenceCount: sentences.length,
      chapterCount: chapters.length,
      readingTimeMinutes,
      keywordsDetected: keyIdeas,
    },
    warnings,
  };
}

// ---------- Stats helper ----------

export function computeStats(report: BookReport): BookStats {
  return report.stats;
}

// ---------- Renderers ----------

/** Render report as Markdown. */
export function renderMarkdown(report: BookReport): string {
  const lines: string[] = [];
  lines.push("# Book Summary");
  lines.push("");
  lines.push(`**Depth:** ${DEPTH_LABELS[report.depth]}`);
  lines.push(`**Words:** ${report.stats.wordCount} · **Sentences:** ${report.stats.sentenceCount} · **Chapters:** ${report.stats.chapterCount} · **Est. reading time:** ${report.stats.readingTimeMinutes} min`);
  lines.push("");
  if (report.warnings.length > 0) {
    lines.push("> **Note:** " + report.warnings.join(" "));
    lines.push("");
  }
  lines.push("## Premise");
  lines.push(report.premise || "_(none)_");
  lines.push("");
  lines.push("## Key ideas");
  if (report.keyIdeas.length > 0) {
    for (const k of report.keyIdeas) lines.push(`- ${k}`);
  } else {
    lines.push("_(none detected)_");
  }
  lines.push("");
  lines.push("## Overall summary");
  for (const s of report.overallSummary) lines.push(`- ${s}`);
  lines.push("");
  lines.push("## Chapter breakdown");
  for (const cs of report.chapterSummaries) {
    lines.push(`### ${cs.chapter.title}`);
    lines.push(`_${cs.wordCount} words, ${cs.sentenceCount} sentences_`);
    lines.push("");
    if (cs.summary.length > 0) {
      for (const s of cs.summary) lines.push(`- ${s}`);
    }
    if (cs.keywords.length > 0) {
      lines.push("");
      lines.push(`**Keywords:** ${cs.keywords.join(", ")}`);
    }
    if (cs.takeaways.length > 0) {
      lines.push("");
      lines.push("**Takeaways:**");
      for (const t of cs.takeaways) lines.push(`- ${t}`);
    }
    if (cs.qaPairs.length > 0) {
      lines.push("");
      lines.push("**Q&A:**");
      for (const qa of cs.qaPairs) {
        lines.push(`- **Q:** ${qa.question}`);
        lines.push(`  **A:** ${qa.answer}`);
      }
    }
    lines.push("");
  }
  lines.push("## Takeaways");
  for (const t of report.takeaways) lines.push(`- ${t}`);
  lines.push("");
  lines.push("## Outline");
  lines.push("```");
  lines.push(renderOutlineText(report.outline));
  lines.push("```");
  return lines.join("\n");
}

/** Render report as JSON string. */
export function renderJson(report: BookReport): string {
  return JSON.stringify(report, null, 2);
}

/** Render only the outline as a Markdown nested list. */
export function renderOutlineMarkdown(report: BookReport): string {
  return renderOutlineText(report.outline);
}

// ---------- History (localStorage) ----------

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

export function buildShareUrl(text: string, depth: Depth): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (depth !== "medium") params.set("depth", depth);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", depth: "medium" };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const d = params.get("depth");
  const depth: Depth = d === "low" || d === "high" ? d : "medium";
  return { text, depth };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(text: string, depth: Depth): string {
  const targetChapter = DEPTH_SENTENCE_COUNT[depth];
  return [
    "You are an expert summarizer. Generate a multi-level summary of the book/manuscript below.",
    "Output a JSON object with:",
    '- "premise": one-sentence premise',
    '- "keyIdeas": array of 5-7 key idea phrases',
    '- "overallSummary": array of 3-5 summary sentences',
    '- "takeaways": array of 3-5 actionable takeaway sentences',
    '- "chapterSummaries": array of { "title": string, "summary": array of up to ' + targetChapter + ' sentences }',
    '- "reasoning": array of strings explaining your summarization choices',
    "",
    "Honesty rules:",
    "- Pick sentences from the source text where possible (extractive).",
    "- Do not invent facts or claim things the text does not say.",
    "- Skip chapters/sections you cannot summarize; note it in reasoning.",
    "",
    "TEXT (first 8000 chars):",
    text.slice(0, 8000),
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; result: LlmEnhancement }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((x) => typeof x === "string") as string[] : [];
  const chapterSummaries = Array.isArray(o.chapterSummaries)
    ? (o.chapterSummaries as unknown[])
        .filter((x) => typeof x === "object" && x !== null)
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            title: typeof r.title === "string" ? r.title : "Untitled",
            summary: arr(r.summary),
          };
        })
    : [];
  const result: LlmEnhancement = {
    premise: typeof o.premise === "string" ? o.premise : "",
    keyIdeas: arr(o.keyIdeas),
    overallSummary: arr(o.overallSummary),
    takeaways: arr(o.takeaways),
    chapterSummaries,
    reasoning: arr(o.reasoning),
  };
  return { ok: true, result };
}

export interface LlmEnhancement {
  premise: string;
  keyIdeas: string[];
  overallSummary: string[];
  takeaways: string[];
  chapterSummaries: Array<{ title: string; summary: string[] }>;
  reasoning: string[];
}

// ---------- Helpers ----------

function emptyReport(depth: Depth): BookReport {
  return {
    input: "",
    depth,
    premise: "",
    keyIdeas: [],
    overallSummary: [],
    chapterSummaries: [],
    takeaways: [],
    outline: [],
    stats: {
      wordCount: 0,
      sentenceCount: 0,
      chapterCount: 0,
      readingTimeMinutes: 0,
      keywordsDetected: [],
    },
    warnings: [],
  };
}
