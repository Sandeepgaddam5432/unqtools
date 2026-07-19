/**
 * AI Keyword Extractor — pure logic.
 *
 * Three deterministic algorithms:
 *   1. TF-IDF   — term frequency × inverse document frequency
 *   2. RAKE     — Rapid Automatic Keyword Extraction (phrase-based)
 *   3. YAKE     — Yet Another Keyword Extractor (casing + position + freq + spread)
 *
 * Capabilities:
 *   - Multi-word keyword detection (n-gram 1–4 for TF-IDF; phrases for RAKE/YAKE).
 *   - Score by frequency, position, capitalization, co-occurrence.
 *   - Multi-language stopword packs (English, Spanish, French, German, Portuguese).
 *   - Topic clustering by word co-occurrence (graph-based, connected components).
 *   - Tag-cloud rendering, CSV/JSON export, history (localStorage), shareable URL.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Algorithm = "tfidf" | "rake" | "yake";

export type Language = "en" | "es" | "fr" | "de" | "pt";

export interface ExtractOptions {
  algorithm: Algorithm;
  language: Language;
  ngram: 1 | 2 | 3 | 4;
  topN: number;
  minWordLength: number;        // ignore words shorter than this
  includeNumbers: boolean;      // include pure-number tokens
  multiWord: boolean;           // YAKE/RAKE: produce multi-word phrases (always on for RAKE)
  clusterTopics: boolean;       // build co-occurrence topic clusters
}

export interface Keyword {
  text: string;
  score: number;
  frequency: number;
  density: number;              // frequency / totalWords (0–1)
  ngram: number;                // 1–4 (word count)
  capitalized: boolean;         // at least one word starts with uppercase
  algorithm: Algorithm;
  sentences: number[];          // sentence indices where it appears (0-based)
  firstPosition: number;        // first char offset (-1 if never)
}

export interface Cluster {
  id: number;
  members: string[];
}

export interface ExtractStats {
  totalWords: number;
  uniqueWords: number;
  totalSentences: number;
  topN: number;
  algorithm: Algorithm;
  language: Language;
  topShare: number;             // combined frequency share of the top N (0–1)
}

export interface ExtractResult {
  algorithm: Algorithm;
  language: Language;
  keywords: Keyword[];
  stats: ExtractStats;
  clusters: Cluster[];
}

export interface HistoryEntry {
  ts: number;
  algorithm: Algorithm;
  language: Language;
  topN: number;
  textLength: number;
  keywordCount: number;
  topKeyword: string;
}

export interface ShareState {
  text: string;
  algorithm: Algorithm;
  language: Language;
  ngram: 1 | 2 | 3 | 4;
  topN: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-keyword-extractor:history";
export const HISTORY_MAX = 20;

export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  tfidf: "TF-IDF",
  rake: "RAKE",
  yake: "YAKE",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

export const DEFAULT_OPTIONS: ExtractOptions = {
  algorithm: "tfidf",
  language: "en",
  ngram: 1,
  topN: 10,
  minWordLength: 2,
  includeNumbers: false,
  multiWord: true,
  clusterTopics: false,
};

export const SAMPLE_TEXTS: { label: string; language: Language; text: string }[] = [
  {
    label: "English — SEO article",
    language: "en",
    text: "Search engine optimization (SEO) is the practice of increasing the quantity and quality of traffic to your website through organic search engine results. SEO involves keyword research, on-page optimization, and link building. A successful SEO strategy requires understanding how search engines work and what people search for. Keywords are the foundation of SEO — without the right keywords, your content will not rank. Keyword research tools help identify high-traffic keywords with low competition. On-page optimization includes title tags, meta descriptions, header tags, and internal linking. Link building remains one of the most important ranking factors. Quality content that satisfies search intent will always outperform thin content. Technical SEO covers site speed, mobile-friendliness, and structured data. Analytics tools help measure SEO performance and identify opportunities for improvement.",
  },
  {
    label: "English — tech blog",
    language: "en",
    text: "Machine learning models learn patterns from training data. The model is trained using gradient descent, which minimizes a loss function. Deep learning uses neural networks with many layers. Convolutional neural networks excel at image classification. Recurrent neural networks are well-suited for sequence data. The model's performance is evaluated on a test set. Overfitting occurs when the model memorizes the training data. Regularization techniques reduce overfitting. Cross-validation provides a more robust estimate of model performance. Transfer learning leverages pre-trained models for new tasks. The learning rate controls how much the model weights are updated. Batch normalization stabilizes training. Dropout randomly disables neurons during training.",
  },
  {
    label: "English — short product",
    language: "en",
    text: "Our new noise-cancelling headphones deliver studio-quality sound with 40 hours of battery life. The lightweight design ensures all-day comfort, while the active noise cancellation blocks out distractions. Bluetooth 5.3 provides a stable wireless connection up to 30 feet.",
  },
];

// ---------- Stopword packs ----------

const STOPWORDS_EN = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "of", "at", "by",
  "for", "with", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "to", "from", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "shall", "should", "may", "might", "must", "can", "could", "i", "you",
  "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
  "his", "its", "our", "their", "this", "that", "these", "those", "what", "which",
  "who", "whom", "whose", "when", "where", "why", "how", "all", "any", "both",
  "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "also", "as",
  "am", "because", "once", "here", "there", "now", "while", "whereas", "whether",
  "per", "via", "vs", "etc", "eg", "ie", "within", "without",
]);

const STOPWORDS_ES = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero", "de",
  "del", "al", "en", "con", "por", "para", "sin", "sobre", "entre", "hasta",
  "desde", "es", "son", "era", "fueron", "ser", "estar", "está", "están", "ha",
  "han", "había", "habían", "fue", "ya", "no", "sí", "muy", "más", "menos",
  "yo", "tú", "él", "ella", "nosotros", "vosotros", "ellos", "ellas", "me",
  "te", "se", "nos", "os", "le", "les", "mi", "tu", "su", "nuestro", "vuestro",
  "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "aquel",
  "aquella", "lo", "que", "quien", "como", "cuando", "donde", "porque", "si",
  "aunque", "también", "asi", "tan", "tanto", "poco", "mucho", "todo", "nada",
]);

const STOPWORDS_FR = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "mais", "donc",
  "or", "ni", "car", "en", "dans", "sur", "pour", "par", "avec", "sans", "sous",
  "entre", "vers", "chez", "est", "sont", "était", "étaient", "être", "avoir",
  "a", "ont", "avait", "avaient", "fait", "font", "faisait", "je", "tu", "il",
  "elle", "nous", "vous", "ils", "elles", "me", "te", "se", "lui", "leur",
  "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses", "notre", "votre",
  "ce", "cet", "cette", "ces", "que", "qui", "quoi", "dont", "où", "quand",
  "comment", "pourquoi", "si", "comme", "aussi", "plus", "moins", "très", "ne",
  "pas", "oui", "non", "tout", "rien", "bien",
]);

const STOPWORDS_DE = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
  "einem", "einen", "und", "oder", "aber", "in", "an", "auf", "mit", "bei",
  "von", "zu", "zur", "zum", "aus", "nach", "vor", "über", "unter", "durch",
  "ist", "sind", "war", "waren", "sein", "haben", "hat", "hatte", "wird",
  "werden", "wurde", "wurden", "ich", "du", "er", "sie", "es", "wir", "ihr",
  "mich", "dich", "sich", "mir", "dir", "uns", "euch", "mein", "dein", "sein",
  "ihr", "unser", "euer", "dieser", "diese", "dieses", "was", "wer", "wann",
  "wo", "wie", "warum", "weil", "wenn", "ob", "auch", "nur", "noch", "schon",
  "sehr", "mehr", "nicht", "ja", "nein", "alles", "nichts", "im", "am", "zum",
]);

const STOPWORDS_PT = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "mas", "de",
  "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "por", "para",
  "com", "sem", "sob", "sobre", "entre", "até", "desde", "é", "são", "era",
  "eram", "ser", "estar", "está", "estão", "tem", "têm", "tinha", "tinham",
  "foi", "foram", "já", "não", "sim", "muito", "muita", "mais", "menos",
  "eu", "tu", "ele", "ela", "nós", "vós", "eles", "elas", "me", "te", "se",
  "nos", "lhe", "lhes", "meu", "minha", "teu", "tua", "seu", "sua", "nosso",
  "vossa", "este", "esta", "esses", "essas", "isso", "que", "quem", "como",
  "quando", "onde", "porque", "se", "embora", "também", "tão", "tanto",
]);

export const STOPWORDS: Record<Language, Set<string>> = {
  en: STOPWORDS_ES, // placeholder; replaced below
  es: STOPWORDS_ES,
  fr: STOPWORDS_FR,
  de: STOPWORDS_DE,
  pt: STOPWORDS_PT,
};
// Fix English stopword set (declared above as placeholder to keep field order stable).
STOPWORDS.en = STOPWORDS_EN;

// ---------- Helpers ----------

/** Normalize newlines + whitespace. Preserves single spaces. */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Split text into sentences (rough, terminal-punctuation based). */
export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Tokenize a string into word tokens (alphanumeric + apostrophe). */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? [];
}

/** Tokenize into (token, offset) pairs for position tracking. */
export function tokenizeWithOffsets(text: string): { token: string; offset: number }[] {
  if (!text) return [];
  const out: { token: string; offset: number }[] = [];
  const re = /[A-Za-z0-9][A-Za-z0-9'-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ token: m[0], offset: m.index });
  }
  return out;
}

/** Check whether a token starts with an uppercase letter. */
export function isCapitalized(token: string): boolean {
  if (!token) return false;
  return /[A-Z]/.test(token[0]);
}

/** Check whether a token is purely numeric. */
export function isNumber(token: string): boolean {
  return /^\d+([.,]\d+)?$/.test(token);
}

/** Lowercase a token and strip trailing punctuation for matching. */
export function normalizeToken(token: string): string {
  return (token || "").toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

/** Is the (normalized) token a stopword in the given language? */
export function isStopword(token: string, language: Language): boolean {
  const set = STOPWORDS[language] ?? STOPWORDS.en;
  return set.has((token || "").toLowerCase());
}

/** Check if a token is acceptable as a keyword candidate. */
export function isAcceptable(
  token: string,
  language: Language,
  options: ExtractOptions,
): boolean {
  const t = normalizeToken(token);
  if (!t) return false;
  if (isStopword(t, language)) return false;
  if (t.length < options.minWordLength) return false;
  if (!options.includeNumbers && isNumber(t)) return false;
  return true;
}

/** Count total words in text. */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Generate a stable pseudo-id (deterministic per-input). */
function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `kw-${Math.abs(h).toString(36)}`;
}

// ---------- TF-IDF ----------

/**
 * Tiny built-in reference corpus used to estimate document frequency (df).
 * This gives a sensible IDF floor for very common English words.
 */
export const REFERENCE_CORPUS: string[] = [
  "the quick brown fox jumps over the lazy dog",
  "she sells sea shells by the sea shore",
  "a journey of a thousand miles begins with a single step",
  "to be or not to be that is the question",
  "all that glitters is not gold",
  "the early bird catches the worm",
  "actions speak louder than words",
  "practice makes perfect",
  "knowledge is power",
  "time flies when you are having fun",
  "an apple a day keeps the doctor away",
  "the pen is mightier than the sword",
  "when in rome do as the romans do",
  "the cat sat on the mat",
  "a picture is worth a thousand words",
  "better late than never",
  "the grass is always greener on the other side",
  "make hay while the sun shines",
  "he who hesitates is lost",
  "look before you leap",
];

/** Compute document frequency (df) — number of reference docs containing the term. */
function computeReferenceDf(): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of REFERENCE_CORPUS) {
    const seen = new Set<string>();
    for (const tok of tokenize(doc.toLowerCase())) {
      const t = normalizeToken(tok);
      if (!t) continue;
      seen.add(t);
    }
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return df;
}

const REFERENCE_DF = computeReferenceDf();
const REFERENCE_N = REFERENCE_CORPUS.length;

/** Compute IDF for a term using the reference corpus. */
export function computeIdf(term: string): number {
  const t = normalizeToken(term);
  const df = REFERENCE_DF.get(t) ?? 0;
  // Smoothed IDF — never zero, never negative.
  return Math.log((REFERENCE_N + 1) / (df + 1)) + 1;
}

/** Extract keywords using TF-IDF. Supports n-grams 1–4. */
export function extractTfidf(text: string, options: ExtractOptions): Keyword[] {
  const normalized = normalizeText(text);
  const sentences = splitSentences(normalized);
  const tokens = tokenizeWithOffsets(normalized);
  const totalWords = tokens.length;
  if (totalWords === 0) return [];

  // Build n-gram tokens with their sentence index.
  interface Gram { text: string; sentenceIdx: number; offset: number; capitalized: boolean; }
  const grams: Gram[] = [];
  const lowerTokens = tokens.map((t) => normalizeToken(t.token));
  for (let i = 0; i < tokens.length; i++) {
    // Skip if the leading token is unacceptable.
    if (!isAcceptable(tokens[i].token, options.language, options)) continue;
    for (let n = 1; n <= options.ngram; n++) {
      if (i + n > tokens.length) break;
      const slice = lowerTokens.slice(i, i + n);
      // All tokens in the n-gram must be acceptable.
      if (slice.some((t) => !t || t.length < options.minWordLength)) continue;
      if (slice.some((t, idx) => idx > 0 && isStopword(t, options.language))) continue;
      // Skip if any token is a number and numbers are excluded.
      if (!options.includeNumbers && slice.some((t) => isNumber(t))) continue;
      const text2 = slice.join(" ");
      // Sentence index: find which sentence contains the start offset.
      const startOff = tokens[i].offset;
      let sentenceIdx = 0;
      for (let s = 0; s < sentences.length; s++) {
        const sStart = normalized.indexOf(sentences[s]);
        const sEnd = sStart + sentences[s].length;
        if (startOff >= sStart && startOff < sEnd) { sentenceIdx = s; break; }
      }
      const cap = slice.some((t, idx) => isCapitalized(tokens[i + idx].token));
      grams.push({ text: text2, sentenceIdx, offset: startOff, capitalized: cap });
    }
  }

  // Count frequencies and compute TF-IDF score.
  const freq = new Map<string, number>();
  const firstPos = new Map<string, number>();
  const sentencesOf = new Map<string, Set<number>>();
  const capitalizedOf = new Map<string, boolean>();
  for (const g of grams) {
    freq.set(g.text, (freq.get(g.text) ?? 0) + 1);
    if (!firstPos.has(g.text)) firstPos.set(g.text, g.offset);
    if (!sentencesOf.has(g.text)) sentencesOf.set(g.text, new Set());
    sentencesOf.get(g.text)!.add(g.sentenceIdx);
    capitalizedOf.set(g.text, (capitalizedOf.get(g.text) ?? false) || g.capitalized);
  }
  const totalGrams = grams.length || 1;
  const out: Keyword[] = [];
  for (const [text2, f] of freq.entries()) {
    const tf = f / totalGrams;
    // IDF: use the average IDF of the component words.
    const words = text2.split(" ");
    const idf = words.reduce((acc, w) => acc + computeIdf(w), 0) / words.length;
    const score = tf * idf;
    out.push({
      text: text2,
      score: Math.round(score * 10000) / 10000,
      frequency: f,
      density: Math.round((f / totalWords) * 10000) / 10000,
      ngram: words.length,
      capitalized: capitalizedOf.get(text2) ?? false,
      algorithm: "tfidf",
      sentences: [...(sentencesOf.get(text2) ?? [])].sort((a, b) => a - b),
      firstPosition: firstPos.get(text2) ?? -1,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ---------- RAKE ----------

/**
 * RAKE: Rapid Automatic Keyword Extraction.
 * 1. Split text into candidate phrases at stopwords + punctuation.
 * 2. Build word co-occurrence graph; degree(word) = sum of edge weights.
 * 3. score(word) = degree(word) / freq(word).
 * 4. score(phrase) = sum of word scores.
 */
export function extractRake(text: string, options: ExtractOptions): Keyword[] {
  const normalized = normalizeText(text);
  const sentences = splitSentences(normalized);
  const totalWords = countWords(normalized);
  if (totalWords === 0) return [];

  // Step 1: build candidate phrases.
  // A phrase is a maximal run of acceptable words; split on stopwords + punctuation.
  const phrases: string[][] = [];
  const phraseSentence: number[] = [];
  const phraseFirstPos: number[] = [];
  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const sent = sentences[sIdx];
    const sentStart = normalized.indexOf(sent);
    const toks = tokenizeWithOffsets(sent);
    let current: string[] = [];
    let currentStart = -1;
    const flush = () => {
      if (current.length > 0) {
        phrases.push(current);
        phraseSentence.push(sIdx);
        phraseFirstPos.push(currentStart >= 0 ? sentStart + currentStart : -1);
      }
      current = [];
      currentStart = -1;
    };
    for (const { token, offset } of toks) {
      const t = normalizeToken(token);
      if (isStopword(t, options.language) || t.length < options.minWordLength) {
        flush();
        continue;
      }
      if (!options.includeNumbers && isNumber(t)) {
        flush();
        continue;
      }
      if (current.length === 0) currentStart = offset;
      current.push(t);
    }
    flush();
  }

  // Step 2: build word frequency + degree (co-occurrence within phrases).
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const phrase of phrases) {
    for (const w of phrase) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      // Degree = sum of (phrase length - 1) for each phrase containing the word
      // plus 1 (self-loop). Equivalent to standard RAKE.
      degree.set(w, (degree.get(w) ?? 0) + phrase.length);
    }
  }

  // Step 3: word scores.
  const wordScore = new Map<string, number>();
  for (const w of freq.keys()) {
    const f = freq.get(w) ?? 1;
    const d = degree.get(w) ?? f;
    wordScore.set(w, d / f);
  }

  // Step 4: phrase scores.
  const phraseScore = new Map<string, { score: number; freq: number; sentences: Set<number>; firstPos: number; capitalized: boolean }>();
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const joined = phrase.join(" ");
    if (phrase.length === 0) continue;
    const score = phrase.reduce((acc, w) => acc + (wordScore.get(w) ?? 0), 0);
    const existing = phraseScore.get(joined);
    if (existing) {
      existing.freq += 1;
      existing.sentences.add(phraseSentence[i]);
      existing.capitalized = existing.capitalized || phrase.some((w) => w[0] === w[0].toUpperCase());
      // Keep earlier firstPos.
    } else {
      phraseScore.set(joined, {
        score,
        freq: 1,
        sentences: new Set([phraseSentence[i]]),
        firstPos: phraseFirstPos[i],
        capitalized: phrase.some((w) => w[0] === w[0].toUpperCase()),
      });
    }
  }

  const out: Keyword[] = [];
  for (const [text2, info] of phraseScore.entries()) {
    const wordCount = text2.split(" ").length;
    out.push({
      text: text2,
      score: Math.round(info.score * 10000) / 10000,
      frequency: info.freq,
      density: Math.round((info.freq / totalWords) * 10000) / 10000,
      ngram: wordCount,
      capitalized: info.capitalized,
      algorithm: "rake",
      sentences: [...info.sentences].sort((a, b) => a - b),
      firstPosition: info.firstPos,
    });
  }
  out.sort((a, b) => b.score - a.score || b.frequency - a.frequency);
  return out;
}

// ---------- YAKE ----------

/**
 * YAKE: Yet Another Keyword Extractor.
 * Score = (Y_casing * Y_position) / (Y_freq + (Y_spread / Y_diff_sentences))
 *
 * Features:
 *   Y_casing  = max(C / TF) where C is # of times the word appears capitalized
 *   Y_position = log(log(3 + |first_sentence_position|))
 *   Y_freq     = TF / (mean_TF + std_TF)
 *   Y_spread   = (last_sentence - first_sentence + 1)
 *   Y_diff_sentences = # of different sentences containing the word
 *
 * Lower score = better (YAKE convention). We negate so higher = better.
 */
export function extractYake(text: string, options: ExtractOptions): Keyword[] {
  const normalized = normalizeText(text);
  const sentences = splitSentences(normalized);
  const totalWords = countWords(normalized);
  if (totalWords === 0) return [];

  // Build per-sentence token lists (lowercased + offsets).
  const sentTokens: { token: string; offset: number }[][] = [];
  for (const sent of sentences) {
    sentTokens.push(tokenizeWithOffsets(sent));
  }

  // Count features per (lowercased) word.
  const tfMap = new Map<string, number>();
  const capMap = new Map<string, number>();
  const firstSentMap = new Map<string, number>();
  const lastSentMap = new Map<string, number>();
  const diffSentMap = new Map<string, Set<number>>();
  const firstPosMap = new Map<string, number>();

  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const sent = sentences[sIdx];
    const sentStart = normalized.indexOf(sent);
    for (const { token, offset } of sentTokens[sIdx]) {
      const t = normalizeToken(token);
      if (!t) continue;
      if (!options.multiWord || options.algorithm === "yake") {
        // YAKE is single-word; we still respect the minWordLength + stopword filter.
        if (isStopword(t, options.language)) continue;
        if (t.length < options.minWordLength) continue;
        if (!options.includeNumbers && isNumber(t)) continue;
      }
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
      if (isCapitalized(token)) capMap.set(t, (capMap.get(t) ?? 0) + 1);
      if (!firstSentMap.has(t)) firstSentMap.set(t, sIdx);
      lastSentMap.set(t, sIdx);
      if (!diffSentMap.has(t)) diffSentMap.set(t, new Set());
      diffSentMap.get(t)!.add(sIdx);
      if (!firstPosMap.has(t)) firstPosMap.set(t, sentStart + offset);
    }
  }

  const tfs = [...tfMap.values()];
  const meanTf = tfs.length > 0 ? tfs.reduce((a, b) => a + b, 0) / tfs.length : 1;
  const variance = tfs.length > 0
    ? tfs.reduce((acc, v) => acc + (v - meanTf) ** 2, 0) / tfs.length
    : 0;
  const stdTf = Math.sqrt(variance);

  const out: Keyword[] = [];
  for (const [word, tf] of tfMap.entries()) {
    const cap = capMap.get(word) ?? 0;
    const casing = cap > 0 ? Math.log2(1 + cap) : 0;
    const firstSent = firstSentMap.get(word) ?? 0;
    const position = Math.log(Math.log(3 + firstSent + 1) + 1);
    const freq = tf / (meanTf + stdTf || 1);
    const firstS = firstSentMap.get(word) ?? 0;
    const lastS = lastSentMap.get(word) ?? 0;
    const spread = lastS - firstS + 1;
    const diffSent = (diffSentMap.get(word)?.size ?? 1);

    // Standard YAKE lower-score-is-better; we negate so higher is better.
    const denom = freq + (spread / (diffSent || 1));
    const yakeScore = denom === 0 ? 0 : (casing * position) / denom;
    const negScore = -yakeScore;

    out.push({
      text: word,
      score: Math.round(negScore * 10000) / 10000,
      frequency: tf,
      density: Math.round((tf / totalWords) * 10000) / 10000,
      ngram: 1,
      capitalized: cap > 0,
      algorithm: "yake",
      sentences: [...(diffSentMap.get(word) ?? [])].sort((a, b) => a - b),
      firstPosition: firstPosMap.get(word) ?? -1,
    });
  }
  out.sort((a, b) => b.score - a.score || b.frequency - a.frequency);
  return out;
}

// ---------- Topic clustering ----------

/** Build co-occurrence clusters among the top keywords. */
export function clusterKeywords(keywords: Keyword[], sentences: string[]): Cluster[] {
  if (keywords.length === 0) return [];
  // Build a graph: two keywords are linked if they co-occur in at least one sentence.
  const members = keywords.map((k) => k.text);
  const memberSet = new Set(members);
  // Map: keyword -> set of sentence indices
  const sentOf = new Map<string, Set<number>>();
  for (const k of keywords) {
    sentOf.set(k.text, new Set(k.sentences));
  }
  // Union-Find
  const parent = new Map<string, string>();
  for (const m of members) parent.set(m, m);
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  // Pairwise co-occurrence.
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const sa = sentOf.get(a)!;
      const sb = sentOf.get(b)!;
      let linked = false;
      for (const s of sa) {
        if (sb.has(s)) { linked = true; break; }
      }
      if (linked) union(a, b);
    }
  }
  // Group by root.
  const groups = new Map<string, string[]>();
  for (const m of members) {
    const r = find(m);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(m);
  }
  // Convert to Cluster[]
  const out: Cluster[] = [];
  let id = 0;
  for (const [, list] of groups) {
    out.push({ id: id++, members: list.sort() });
  }
  out.sort((a, b) => b.members.length - a.members.length);
  return out;
}

// ---------- Main extract ----------

/** Extract keywords using the chosen algorithm. */
export function extract(text: string, options: ExtractOptions): ExtractResult {
  const normalized = normalizeText(text);
  const sentences = splitSentences(normalized);
  let keywords: Keyword[];
  switch (options.algorithm) {
    case "tfidf": keywords = extractTfidf(normalized, options); break;
    case "rake":  keywords = extractRake(normalized, options); break;
    case "yake":  keywords = extractYake(normalized, options); break;
  }
  // Deduplicate by text (case-insensitive), keeping the higher-score entry.
  const seen = new Map<string, Keyword>();
  for (const k of keywords) {
    const key = k.text.toLowerCase();
    const existing = seen.get(key);
    if (!existing || k.score > existing.score) seen.set(key, k);
  }
  const deduped = [...seen.values()].sort((a, b) => b.score - a.score || b.frequency - a.frequency);
  const topN = deduped.slice(0, options.topN);
  const clusters = options.clusterTopics ? clusterKeywords(topN, sentences) : [];

  // Stats.
  const allTokens = tokenize(normalized.toLowerCase());
  const uniqueWords = new Set(allTokens).size;
  const topNShare = topN.length > 0
    ? topN.reduce((acc, k) => acc + k.frequency, 0) / (allTokens.length || 1)
    : 0;
  return {
    algorithm: options.algorithm,
    language: options.language,
    keywords: topN,
    clusters,
    stats: {
      totalWords: allTokens.length,
      uniqueWords,
      totalSentences: sentences.length,
      topN: topN.length,
      algorithm: options.algorithm,
      language: options.language,
      topShare: Math.round(topNShare * 10000) / 10000,
    },
  };
}

// ---------- Rendering ----------

/** Render keywords as comma-separated text. */
export function renderCommaList(keywords: Keyword[]): string {
  return keywords.map((k) => k.text).join(", ");
}

/** Render keywords as one-per-line. */
export function renderLineList(keywords: Keyword[]): string {
  return keywords.map((k) => k.text).join("\n");
}

/** Render keywords as CSV. */
export function renderCsv(keywords: Keyword[]): string {
  const lines = ["rank,keyword,score,frequency,density,ngram,capitalized,algorithm"];
  keywords.forEach((k, i) => {
    const row = [
      String(i + 1),
      escapeCsv(k.text),
      String(k.score),
      String(k.frequency),
      String(k.density),
      String(k.ngram),
      String(k.capitalized),
      k.algorithm,
    ];
    lines.push(row.join(","));
  });
  return lines.join("\n");
}

/** Render keywords as JSON. */
export function renderJson(keywords: Keyword[], stats: ExtractStats, clusters: Cluster[]): string {
  return JSON.stringify({ keywords, stats, clusters }, null, 2);
}

/** Render as Markdown. */
export function renderMarkdown(keywords: Keyword[], stats: ExtractStats, clusters: Cluster[]): string {
  const lines: string[] = [
    "### Extracted Keywords",
    "",
    `**Algorithm:** ${ALGORITHM_LABELS[stats.algorithm]} · **Language:** ${LANGUAGE_LABELS[stats.language]}`,
    `**Total words:** ${stats.totalWords} · **Unique:** ${stats.uniqueWords} · **Sentences:** ${stats.totalSentences}`,
    "",
    "| Rank | Keyword | Score | Frequency | Density | N-gram |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  keywords.forEach((k, i) => {
    lines.push(
      `| ${i + 1} | ${k.text} | ${k.score} | ${k.frequency} | ${(k.density * 100).toFixed(2)}% | ${k.ngram} |`,
    );
  });
  if (clusters.length > 0) {
    lines.push("", "### Topic Clusters", "");
    clusters.forEach((c, i) => {
      lines.push(`**Cluster ${i + 1} (${c.members.length}):** ${c.members.join(", ")}`);
    });
  }
  return lines.join("\n");
}

/** Render as a tag cloud HTML string (font size scaled by score). */
export function renderTagCloudHtml(keywords: Keyword[]): string {
  if (keywords.length === 0) return "";
  const max = keywords[0].score;
  const min = keywords[keywords.length - 1].score;
  const range = max - min || 1;
  const parts: string[] = [];
  for (const k of keywords) {
    const t = (k.score - min) / range; // 0..1
    const size = 12 + Math.round(t * 22); // 12px..34px
    const weight = t > 0.66 ? "700" : t > 0.33 ? "500" : "400";
    const op = 0.55 + Math.round(t * 0.45 * 100) / 100;
    const tip = `${k.algorithm.toUpperCase()} · score ${k.score} · freq ${k.frequency} · density ${(k.density * 100).toFixed(2)}%`;
    parts.push(
      `<span class="tag" style="font-size:${size}px;font-weight:${weight};opacity:${op}" title="${escapeHtml(tip)}">${escapeHtml(k.text)}</span>`,
    );
  }
  return parts.join(" ");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.text) params.set("text", state.text);
  params.set("algo", state.algorithm);
  params.set("lang", state.language);
  params.set("ngram", String(state.ngram));
  params.set("top", String(state.topN));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", algorithm: "tfidf", language: "en", ngram: 1, topN: 10 };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const algoRaw = params.get("algo") ?? "tfidf";
  const algorithm = (["tfidf", "rake", "yake"].includes(algoRaw) ? algoRaw : "tfidf") as Algorithm;
  const langRaw = params.get("lang") ?? "en";
  const language = (["en", "es", "fr", "de", "pt"].includes(langRaw) ? langRaw : "en") as Language;
  const ngramRaw = parseInt(params.get("ngram") ?? "1", 10);
  const ngram = ([1, 2, 3, 4].includes(ngramRaw) ? ngramRaw : 1) as 1 | 2 | 3 | 4;
  const topRaw = parseInt(params.get("top") ?? "10", 10);
  const topN = Number.isFinite(topRaw) && topRaw > 0 ? topRaw : 10;
  return { text, algorithm, language, ngram, topN };
}

// ---------- LLM helpers ----------

/** Build a prompt for an optional LLM enhancement. */
export function buildLlmPrompt(text: string, algorithm: Algorithm, topN: number): string {
  return [
    `Extract the top ${topN} keywords and keyphrases from the following text.`,
    `Use the spirit of the ${ALGORITHM_LABELS[algorithm]} algorithm: prioritize frequency, position, casing, and co-occurrence.`,
    `Return one keyword per line, ranked from most important to least.`,
    `Do not include stopwords or single letters.`,
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/** Render an LLM response (split on newlines, trim blanks) into a keyword list. */
export function renderLlmResult(raw: string): string[] {
  return (raw || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
