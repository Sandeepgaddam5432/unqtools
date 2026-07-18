/**
 * Review Sentiment Analyzer — pure logic.
 *
 * Pure-JS sentiment analysis using a built-in lexicon. No AI, no
 * network calls. Pure functions only.
 */

export type SentimentLabel = "positive" | "neutral" | "negative";
export type FilterOption = "all" | "positive" | "negative" | "neutral" | "mismatch";

export interface Review {
  /** Original raw line as entered. */
  raw: string;
  /** Review text (star rating prefix stripped). */
  text: string;
  /** Star rating 1-5 if a [N] prefix was provided, else null. */
  stars: number | null;
  /** Sentiment score, range -10 to +10. */
  score: number;
  /** Sentiment label derived from score. */
  label: SentimentLabel;
  /** Positive words matched in the review (after negation flips removed). */
  positiveWords: string[];
  /** Negative words matched in the review (after negation flips removed). */
  negativeWords: string[];
  /** Top topics (keywords) detected in this single review. */
  topics: string[];
  /** True if star rating contradicts sentiment text. */
  mismatch: boolean;
}

export interface SummaryStats {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  avgScore: number;
  avgStars: number | null;
  mismatchCount: number;
  starDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  topTopics: string[];
  topWords: { word: string; count: number }[];
}

export const POSITIVE_WORDS: string[] = [
  "amazing", "excellent", "great", "good", "love", "loved", "perfect",
  "awesome", "fantastic", "recommend", "recommended", "professional",
  "fast", "friendly", "clean", "helpful", "best", "wonderful", "superb",
  "outstanding", "exceptional", "pleasant", "happy", "satisfied", "glad",
  "delightful", "delicious", "fresh", "comfortable", "easy", "reliable",
  "trustworthy", "prompt", "courteous", "knowledgeable", "efficient",
  "polite", "responsive", "attentive", "gorgeous", "beautiful", "brilliant",
  "lovely", "marvelous", "splendid", "stellar", "worth", "enjoy", "enjoyed",
  "smooth", "flawless", "impeccable", "magnificent",
];

export const NEGATIVE_WORDS: string[] = [
  "terrible", "awful", "bad", "hate", "hated", "worst", "slow", "rude",
  "dirty", "broken", "expensive", "disappointed", "disappointing", "waste",
  "horrible", "horrendous", "poor", "mediocre", "subpar", "unacceptable",
  "frustrating", "frustrated", "annoyed", "angry", "upset", "disgusted",
  "gross", "nasty", "filthy", "messy", "unprofessional", "incompetent",
  "overpriced", "undercooked", "cold", "stale", "rotten", "defective",
  "faulty", "useless", "pointless", "worthless", "scam", "fraud", "liar",
  "ignored", "late", "delayed", "sloppy", "dreadful", "miserable",
  "atrocious", "lousy", "pathetic",
];

export const NEGATION_WORDS: string[] = [
  "not", "no", "never", "didn't", "doesn't", "don't", "can't", "won't",
  "isn't", "wasn't", "aren't", "weren't", "couldn't", "shouldn't",
  "wouldn't", "hardly", "barely", "neither", "nor", "without", "lack",
  "lacked", "lacking",
];

export const STOPWORDS: string[] = [
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "in", "on",
  "at", "to", "for", "with", "by", "from", "as", "is", "was", "are",
  "were", "be", "been", "being", "this", "that", "these", "those", "it",
  "its", "my", "your", "his", "her", "our", "their", "we", "you", "they",
  "i", "me", "us", "them", "he", "she", "him", "had", "has", "have", "do",
  "did", "does", "will", "would", "could", "should", "can", "may", "might",
  "very", "so", "just", "too", "also", "only", "more", "most", "much",
  "many", "some", "any", "all", "no", "not", "never", "here", "there",
  "what", "when", "where", "why", "how", "which", "who", "whom", "than",
  "into", "about", "over", "under", "again", "out", "up", "down", "off",
  "because", "while", "during", "before", "after", "between", "through",
];

export const LABEL_COLORS: Record<SentimentLabel, string> = {
  positive: "green",
  neutral: "gray",
  negative: "red",
};

export const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All reviews" },
  { value: "positive", label: "Positive only" },
  { value: "negative", label: "Negative only" },
  { value: "neutral", label: "Neutral only" },
  { value: "mismatch", label: "Mismatched only" },
];

/** Example reviews shown as a one-click sample in the UI. */
export const EXAMPLE_REVIEWS: string = `[5] Amazing service and friendly staff. Highly recommend!
[4] Great food but the wait was a bit long. Overall a good experience.
[2] Disappointing. The food was cold and the waiter was rude.
[1] Worst experience ever. Slow, unprofessional, and overpriced.
[5] Not bad at all — actually pretty good!
[3] It was okay. Nothing special but not terrible either.`;

// ---- Tokenize ----

/** Tokenize text into lowercase word tokens (letters + apostrophes). */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return (text.toLowerCase().match(/[a-z']+/g) ?? []).filter(Boolean);
}

/** Strip a leading [N] star-rating prefix from a line and return (text, stars). */
export function parseStarRating(line: string): { text: string; stars: number | null } {
  const trimmed = (line || "").trim();
  const m = trimmed.match(/^\[(\d)\]\s*(.*)$/);
  if (!m) return { text: trimmed, stars: null };
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 5) return { text: trimmed, stars: null };
  return { text: m[2].trim(), stars: n };
}

/** Normalize review text — collapse whitespace, trim. */
export function normalizeReviewText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse a multi-line textarea into Review objects (sentiment-analyzed). */
export function parseReviews(input: string): Review[] {
  if (!input) return [];
  const lines = input.split(/\r?\n/);
  const out: Review[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const { text, stars } = parseStarRating(line);
    const normalized = normalizeReviewText(text);
    if (!normalized) continue;
    const analysis = analyzeSentiment(normalized);
    const label = scoreToLabel(analysis.score);
    const topics = extractTopicsFromText(normalized, 3);
    const mismatch = detectMismatch(stars, label);
    out.push({
      raw: line,
      text: normalized,
      stars,
      score: analysis.score,
      label,
      positiveWords: analysis.positiveWords,
      negativeWords: analysis.negativeWords,
      topics,
      mismatch,
    });
  }
  return out;
}

// ---- Sentiment analysis ----

/**
 * Analyze sentiment of a single piece of text. Returns a score
 * (positive count - negative count, clamped to [-10, +10]) and the
 * matched positive/negative words.
 *
 * Negation handling: scan tokens left-to-right. When a negation word
 * is seen, mark "negation active". The NEXT sentiment word (if any)
 * has its polarity flipped, then the negation is consumed (reset).
 * Stopwords and non-lexicon words between the negation and the
 * sentiment word do not consume the negation, so "not very good"
 * correctly evaluates as negative.
 */
export function analyzeSentiment(text: string): {
  score: number;
  positiveWords: string[];
  negativeWords: string[];
} {
  const tokens = tokenize(text);
  const positive = new Set(POSITIVE_WORDS);
  const negative = new Set(NEGATIVE_WORDS);
  const negation = new Set(NEGATION_WORDS);

  let positiveCount = 0;
  let negativeCount = 0;
  const positiveWords: string[] = [];
  const negativeWords: string[] = [];
  let negationActive = false;

  for (const tok of tokens) {
    if (negation.has(tok)) {
      negationActive = true;
      continue;
    }
    if (positive.has(tok)) {
      if (negationActive) {
        negativeCount += 1;
        negativeWords.push(tok);
        negationActive = false;
      } else {
        positiveCount += 1;
        positiveWords.push(tok);
      }
    } else if (negative.has(tok)) {
      if (negationActive) {
        positiveCount += 1;
        positiveWords.push(tok);
        negationActive = false;
      } else {
        negativeCount += 1;
        negativeWords.push(tok);
      }
    }
    // Non-lexicon, non-negation tokens are skipped and do not consume the negation.
  }

  const raw = positiveCount - negativeCount;
  const score = Math.max(-10, Math.min(10, raw));
  return { score, positiveWords, negativeWords };
}

/** Map a sentiment score to a label. */
export function scoreToLabel(score: number): SentimentLabel {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

// ---- Topic extraction ----

/** Extract the top-N most-frequent content words from a single text. */
export function extractTopicsFromText(text: string, n = 5): string[] {
  const tokens = tokenize(text);
  const stopword = new Set(STOPWORDS);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (stopword.has(t)) continue;
    if (t.length < 3) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, n).map((e) => e[0]);
}

/** Extract the top-N most-frequent content words across all reviews. */
export function extractTopTopics(reviews: Review[], n = 5): string[] {
  const stopword = new Set(STOPWORDS);
  const freq = new Map<string, number>();
  for (const r of reviews) {
    for (const t of tokenize(r.text)) {
      if (stopword.has(t)) continue;
      if (t.length < 3) continue;
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, n).map((e) => e[0]);
}

/** Compute word frequency across all reviews — returns top N sorted desc. */
export function computeWordFrequency(reviews: Review[], n = 20): { word: string; count: number }[] {
  const stopword = new Set(STOPWORDS);
  const freq = new Map<string, number>();
  for (const r of reviews) {
    for (const t of tokenize(r.text)) {
      if (stopword.has(t)) continue;
      if (t.length < 3) continue;
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, n).map(([word, count]) => ({ word, count }));
}

// ---- Star ratings ----

/** Compute the star distribution (count per rating 1-5). */
export function computeStarDistribution(reviews: Review[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    if (r.stars !== null && r.stars >= 1 && r.stars <= 5) {
      dist[r.stars as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }
  return dist;
}

/** Compute the average star rating across reviews that have stars. */
export function computeAverageStars(reviews: Review[]): number | null {
  const rated = reviews.filter((r) => r.stars !== null);
  if (rated.length === 0) return null;
  const sum = rated.reduce((s, r) => s + (r.stars as number), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

// ---- Mismatch detection ----

/** Detect a mismatch between star rating and text sentiment. */
export function detectMismatch(stars: number | null, label: SentimentLabel): boolean {
  if (stars === null) return false;
  if (stars === 5 && label === "negative") return true;
  if (stars === 1 && label === "positive") return true;
  return false;
}

// ---- Summary stats ----

export function computeSummaryStats(reviews: Review[]): SummaryStats {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let mismatchCount = 0;
  let scoreSum = 0;
  for (const r of reviews) {
    if (r.label === "positive") positive += 1;
    else if (r.label === "neutral") neutral += 1;
    else negative += 1;
    if (r.mismatch) mismatchCount += 1;
    scoreSum += r.score;
  }
  const avgScore = reviews.length > 0 ? Math.round((scoreSum / reviews.length) * 100) / 100 : 0;
  return {
    total: reviews.length,
    positive,
    neutral,
    negative,
    avgScore,
    avgStars: computeAverageStars(reviews),
    mismatchCount,
    starDistribution: computeStarDistribution(reviews),
    topTopics: extractTopTopics(reviews, 5),
    topWords: computeWordFrequency(reviews, 20),
  };
}

// ---- Filtering ----

export function filterReviews(reviews: Review[], filter: FilterOption): Review[] {
  switch (filter) {
    case "positive": return reviews.filter((r) => r.label === "positive");
    case "negative": return reviews.filter((r) => r.label === "negative");
    case "neutral": return reviews.filter((r) => r.label === "neutral");
    case "mismatch": return reviews.filter((r) => r.mismatch);
    case "all":
    default: return reviews;
  }
}

// ---- Rendering ----

/** Render the reviews and summary as a plain-text report. */
export function renderText(reviews: Review[], stats: SummaryStats): string {
  const lines: string[] = [];
  lines.push("=== REVIEW SENTIMENT ANALYSIS ===");
  lines.push("");
  lines.push("--- SUMMARY ---");
  lines.push(`Total reviews: ${stats.total}`);
  lines.push(`Positive: ${stats.positive} | Neutral: ${stats.neutral} | Negative: ${stats.negative}`);
  lines.push(`Average sentiment score: ${stats.avgScore}`);
  lines.push(`Average star rating: ${stats.avgStars ?? "n/a"}`);
  lines.push(`Mismatches detected: ${stats.mismatchCount}`);
  lines.push(`Star distribution: 5★=${stats.starDistribution[5]} 4★=${stats.starDistribution[4]} 3★=${stats.starDistribution[3]} 2★=${stats.starDistribution[2]} 1★=${stats.starDistribution[1]}`);
  lines.push(`Top topics: ${stats.topTopics.join(", ") || "(none)"}`);
  lines.push("");
  lines.push("--- TOP WORDS (FREQUENCY) ---");
  if (stats.topWords.length === 0) {
    lines.push("(none)");
  } else {
    for (const w of stats.topWords) {
      lines.push(`${w.word}: ${w.count}`);
    }
  }
  lines.push("");
  lines.push("--- REVIEW-BY-REVIEW ---");
  for (const r of reviews) {
    const starStr = r.stars !== null ? `[${r.stars}★] ` : "";
    lines.push(`${starStr}(${r.label}, score ${r.score})${r.mismatch ? " [MISMATCH]" : ""} ${r.text}`);
    if (r.positiveWords.length > 0) lines.push(`  + ${r.positiveWords.join(", ")}`);
    if (r.negativeWords.length > 0) lines.push(`  - ${r.negativeWords.join(", ")}`);
    if (r.topics.length > 0) lines.push(`  topics: ${r.topics.join(", ")}`);
  }
  return lines.join("\n");
}

/** Render reviews as CSV. */
export function renderCsv(reviews: Review[]): string {
  const lines = ["review,stars,sentiment_score,label,topics,mismatch"];
  for (const r of reviews) {
    lines.push([
      escapeCsv(r.text),
      r.stars !== null ? String(r.stars) : "",
      String(r.score),
      r.label,
      escapeCsv(r.topics.join("; ")),
      r.mismatch ? "yes" : "no",
    ].join(","));
  }
  return lines.join("\n");
}

/** Split a CSV row that may contain quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:review-sentiment-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  reviewCount: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
  mismatchCount: number;
  preview: string;
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

export function buildShareUrl(reviewsText: string): string {
  const params = new URLSearchParams();
  if (reviewsText) params.set("reviews", reviewsText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { reviews: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { reviews: "" };
  const params = new URLSearchParams(clean);
  return { reviews: params.get("reviews") ?? "" };
}
