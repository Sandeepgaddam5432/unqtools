/**
 * AI Sentiment Analysis Tool — pure logic.
 *
 * Lexicon-based sentiment analysis with negation handling, booster /
 * dampener modifiers, emotion detection, aspect-based sentiment, and
 * bulk CSV analysis. Pure functions only — no DOM, no network.
 *
 * The optional LLM call (BYO API key) lives in ui.tsx because it touches
 * the network.
 */

// ---------- Types ----------

export type Sentiment = "positive" | "negative" | "neutral";

export type Emotion =
  | "joy"
  | "anger"
  | "sadness"
  | "fear"
  | "surprise"
  | "disgust"
  | "trust"
  | "anticipation";

export interface LexiconEntry {
  word: string;
  score: number;            // -1 to +1
  emotions: Emotion[];      // 0+ emotions
}

export interface Token {
  text: string;
  raw: string;
  lexicon?: LexiconEntry;
  negated: boolean;
  modifier: number;         // 1.0 default; 1.5 = booster; 0.5 = dampener
  effectiveScore: number;   // post-negation + modifier
}

export interface SentenceResult {
  text: string;
  score: number;            // -1 to +1
  sentiment: Sentiment;
  confidence: "low" | "medium" | "high";
  positiveWords: string[];
  negativeWords: string[];
  emotions: Emotion[];
  tokens: Token[];
  aspects: AspectResult[];
}

export interface AspectResult {
  aspect: string;
  text: string;
  score: number;
  sentiment: Sentiment;
}

export interface DocumentResult {
  text: string;
  score: number;            // -1 to +1
  sentiment: Sentiment;
  confidence: "low" | "medium" | "high";
  sentences: SentenceResult[];
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  emotionProfile: { emotion: Emotion; count: number; score: number }[];
  aspects: AspectResult[];
  stats: { wordCount: number; sentenceCount: number; lexiconHits: number };
}

export interface CsvRow {
  rowIndex: number;          // 1-based
  text: string;
  score: number;
  sentiment: Sentiment;
  confidence: "low" | "medium" | "high";
  emotions: Emotion[];
}

export interface CsvSummary {
  totalRows: number;
  positive: number;
  negative: number;
  neutral: number;
  meanScore: number;
  topPositive: CsvRow[];     // top 5
  topNegative: CsvRow[];     // top 5
  emotionCounts: Record<Emotion, number>;
}

export interface HistoryEntry {
  ts: number;
  textLength: number;
  score: number;
  sentiment: Sentiment;
  sentenceCount: number;
  emotionTop: Emotion | null;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-sentiment-analysis-tool:history";
export const HISTORY_MAX = 20;

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

export const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  neutral: "text-amber-600 dark:text-amber-400",
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  joy: "Joy",
  anger: "Anger",
  sadness: "Sadness",
  fear: "Fear",
  surprise: "Surprise",
  disgust: "Disgust",
  trust: "Trust",
  anticipation: "Anticipation",
};

export const EMOTION_EMOJIS: Record<Emotion, string> = {
  joy: "😊",
  anger: "😠",
  sadness: "😢",
  fear: "😨",
  surprise: "😮",
  disgust: "🤢",
  trust: "🤝",
  anticipation: "期待的",
};

/** Default threshold: |score| >= this → positive/negative, else neutral. */
export const DEFAULT_THRESHOLD = 0.15;

/** Words that negate the next sentiment word within a 3-token window. */
export const NEGATION_WORDS = new Set<string>([
  "not", "no", "never", "none", "nobody", "nothing", "neither", "nor",
  "without", "isn't", "wasn't", "aren't", "weren't", "don't", "doesn't",
  "didn't", "won't", "wouldn't", "can't", "cannot", "couldn't", "shouldn't",
  "hardly", "barely", "scarcely", "rarely", "seldom", "lack", "lacks",
  "lacking", "lacked", "fail", "fails", "failed", "failing",
]);

/** Words that amplify the following sentiment word. */
export const BOOSTER_WORDS = new Set<string>([
  "very", "extremely", "incredibly", "really", "so", "too", "absolutely",
  "completely", "totally", "utterly", "highly", "especially", "particularly",
  "remarkably", "exceptionally", "immensely", "enormously", "intensely",
  "deeply", "profoundly", "strongly", "fiercely", "sharply", "dramatically",
]);

/** Words that dampen the following sentiment word. */
export const DAMPENER_WORDS = new Set<string>([
  "slightly", "somewhat", "fairly", "rather", "quite", "pretty", "kind of",
  "kinda", "sort of", "sorta", "mildly", "moderately", "relatively",
  "reasonably", "marginally", "a bit", "a little",
]);

/** Aspect cue phrases — "<aspect> is/has/... <sentiment>" patterns. */
export const ASPECT_PATTERNS: { aspect: string; cues: string[] }[] = [
  { aspect: "battery", cues: ["battery", "charge", "charging", "power life"] },
  { aspect: "screen", cues: ["screen", "display", "monitor"] },
  { aspect: "camera", cues: ["camera", "lens", "photo", "photos", "picture"] },
  { aspect: "performance", cues: ["performance", "speed", "fast", "slow", "laggy", "snappy"] },
  { aspect: "design", cues: ["design", "look", "looks", "appearance", "build quality"] },
  { aspect: "price", cues: ["price", "cost", "value", "expensive", "cheap", "affordable"] },
  { aspect: "service", cues: ["service", "support", "customer service", "staff"] },
  { aspect: "shipping", cues: ["shipping", "delivery", "shipping", "packaging"] },
  { aspect: "software", cues: ["software", "os", "app", "ui", "interface"] },
  { aspect: "sound", cues: ["sound", "audio", "speaker", "speakers", "volume"] },
];

// ---------- Lexicon (200+ entries) ----------

export const LEXICON: LexiconEntry[] = [
  // ---- Positive — joy (20) ----
  { word: "good", score: 0.7, emotions: ["joy"] },
  { word: "great", score: 0.8, emotions: ["joy"] },
  { word: "excellent", score: 0.9, emotions: ["joy", "trust"] },
  { word: "amazing", score: 0.9, emotions: ["joy", "surprise"] },
  { word: "awesome", score: 0.85, emotions: ["joy"] },
  { word: "fantastic", score: 0.85, emotions: ["joy"] },
  { word: "wonderful", score: 0.85, emotions: ["joy"] },
  { word: "fabulous", score: 0.8, emotions: ["joy"] },
  { word: "happy", score: 0.8, emotions: ["joy"] },
  { word: "glad", score: 0.6, emotions: ["joy"] },
  { word: "delighted", score: 0.85, emotions: ["joy"] },
  { word: "thrilled", score: 0.9, emotions: ["joy"] },
  { word: "love", score: 0.85, emotions: ["joy"] },
  { word: "loved", score: 0.85, emotions: ["joy"] },
  { word: "loves", score: 0.85, emotions: ["joy"] },
  { word: "enjoy", score: 0.7, emotions: ["joy"] },
  { word: "enjoyed", score: 0.7, emotions: ["joy"] },
  { word: "enjoyable", score: 0.65, emotions: ["joy"] },
  { word: "fun", score: 0.7, emotions: ["joy"] },
  { word: "pleasant", score: 0.6, emotions: ["joy"] },
  { word: "joyful", score: 0.75, emotions: ["joy"] },
  { word: "joyous", score: 0.75, emotions: ["joy"] },

  // ---- Positive — trust (12) ----
  { word: "reliable", score: 0.7, emotions: ["trust"] },
  { word: "trustworthy", score: 0.8, emotions: ["trust"] },
  { word: "honest", score: 0.7, emotions: ["trust"] },
  { word: "dependable", score: 0.7, emotions: ["trust"] },
  { word: "secure", score: 0.6, emotions: ["trust"] },
  { word: "safe", score: 0.5, emotions: ["trust"] },
  { word: "guaranteed", score: 0.6, emotions: ["trust"] },
  { word: "proven", score: 0.6, emotions: ["trust"] },
  { word: "consistent", score: 0.55, emotions: ["trust"] },
  { word: "stable", score: 0.5, emotions: ["trust"] },
  { word: "transparent", score: 0.6, emotions: ["trust"] },
  { word: "credible", score: 0.6, emotions: ["trust"] },

  // ---- Positive — anticipation (8) ----
  { word: "exciting", score: 0.75, emotions: ["anticipation", "joy"] },
  { word: "excited", score: 0.75, emotions: ["anticipation", "joy"] },
  { word: "promising", score: 0.65, emotions: ["anticipation"] },
  { word: "hopeful", score: 0.55, emotions: ["anticipation"] },
  { word: "innovative", score: 0.7, emotions: ["anticipation"] },
  { word: "breakthrough", score: 0.75, emotions: ["anticipation", "surprise"] },
  { word: "anticipated", score: 0.45, emotions: ["anticipation"] },
  { word: "eager", score: 0.6, emotions: ["anticipation"] },

  // ---- Positive — surprise (6) ----
  { word: "surprising", score: 0.5, emotions: ["surprise"] },
  { word: "surprisingly", score: 0.5, emotions: ["surprise"] },
  { word: "unexpected", score: 0.3, emotions: ["surprise"] },
  { word: "impressive", score: 0.75, emotions: ["surprise", "joy"] },
  { word: "remarkable", score: 0.75, emotions: ["surprise"] },
  { word: "astonishing", score: 0.8, emotions: ["surprise"] },

  // ---- Positive — generic / quality (20) ----
  { word: "best", score: 0.9, emotions: ["joy"] },
  { word: "perfect", score: 0.9, emotions: ["joy"] },
  { word: "perfectly", score: 0.85, emotions: ["joy"] },
  { word: "superb", score: 0.85, emotions: ["joy"] },
  { word: "outstanding", score: 0.85, emotions: ["joy"] },
  { word: "brilliant", score: 0.8, emotions: ["joy"] },
  { word: "exceptional", score: 0.85, emotions: ["joy"] },
  { word: "extraordinary", score: 0.85, emotions: ["joy", "surprise"] },
  { word: "magnificent", score: 0.85, emotions: ["joy"] },
  { word: "marvelous", score: 0.85, emotions: ["joy"] },
  { word: "splendid", score: 0.8, emotions: ["joy"] },
  { word: "stellar", score: 0.8, emotions: ["joy"] },
  { word: "premium", score: 0.65, emotions: ["trust"] },
  { word: "quality", score: 0.55, emotions: ["trust"] },
  { word: "smooth", score: 0.6, emotions: ["joy"] },
  { word: "easy", score: 0.55, emotions: ["joy"] },
  { word: "intuitive", score: 0.6, emotions: ["trust"] },
  { word: "responsive", score: 0.6, emotions: ["trust"] },
  { word: "fast", score: 0.55, emotions: ["joy"] },
  { word: "recommend", score: 0.7, emotions: ["trust"] },

  // ---- Positive — mild (10) ----
  { word: "ok", score: 0.25, emotions: [] },
  { word: "okay", score: 0.25, emotions: [] },
  { word: "fine", score: 0.3, emotions: [] },
  { word: "nice", score: 0.55, emotions: ["joy"] },
  { word: "decent", score: 0.4, emotions: [] },
  { word: "solid", score: 0.55, emotions: ["trust"] },
  { word: "worth", score: 0.5, emotions: [] },
  { word: "worthwhile", score: 0.55, emotions: [] },
  { word: "favorable", score: 0.5, emotions: [] },
  { word: "positive", score: 0.55, emotions: ["joy"] },

  // ---- Negative — anger (12) ----
  { word: "angry", score: -0.8, emotions: ["anger"] },
  { word: "mad", score: -0.7, emotions: ["anger"] },
  { word: "furious", score: -0.9, emotions: ["anger"] },
  { word: "outraged", score: -0.9, emotions: ["anger"] },
  { word: "irritated", score: -0.65, emotions: ["anger"] },
  { word: "annoyed", score: -0.65, emotions: ["anger"] },
  { word: "frustrated", score: -0.7, emotions: ["anger"] },
  { word: "annoying", score: -0.7, emotions: ["anger"] },
  { word: "frustrating", score: -0.75, emotions: ["anger"] },
  { word: "irritating", score: -0.7, emotions: ["anger"] },
  { word: "outrageous", score: -0.85, emotions: ["anger"] },
  { word: "infuriating", score: -0.85, emotions: ["anger"] },

  // ---- Negative — sadness (12) ----
  { word: "sad", score: -0.75, emotions: ["sadness"] },
  { word: "unhappy", score: -0.7, emotions: ["sadness"] },
  { word: "depressed", score: -0.85, emotions: ["sadness"] },
  { word: "miserable", score: -0.85, emotions: ["sadness"] },
  { word: "disappointed", score: -0.75, emotions: ["sadness"] },
  { word: "disappointing", score: -0.75, emotions: ["sadness"] },
  { word: "disappointment", score: -0.75, emotions: ["sadness"] },
  { word: "heartbroken", score: -0.9, emotions: ["sadness"] },
  { word: "grief", score: -0.85, emotions: ["sadness"] },
  { word: "sorrow", score: -0.8, emotions: ["sadness"] },
  { word: "gloomy", score: -0.65, emotions: ["sadness"] },
  { word: "hopeless", score: -0.8, emotions: ["sadness"] },

  // ---- Negative — fear (10) ----
  { word: "afraid", score: -0.7, emotions: ["fear"] },
  { word: "scared", score: -0.75, emotions: ["fear"] },
  { word: "terrified", score: -0.85, emotions: ["fear"] },
  { word: "frightened", score: -0.75, emotions: ["fear"] },
  { word: "anxious", score: -0.65, emotions: ["fear"] },
  { word: "worried", score: -0.6, emotions: ["fear"] },
  { word: "nervous", score: -0.55, emotions: ["fear"] },
  { word: "panic", score: -0.8, emotions: ["fear"] },
  { word: "dread", score: -0.8, emotions: ["fear"] },
  { word: "threatening", score: -0.75, emotions: ["fear"] },

  // ---- Negative — disgust (8) ----
  { word: "disgusting", score: -0.85, emotions: ["disgust"] },
  { word: "gross", score: -0.75, emotions: ["disgust"] },
  { word: "nasty", score: -0.75, emotions: ["disgust"] },
  { word: "revolting", score: -0.85, emotions: ["disgust"] },
  { word: "sickening", score: -0.8, emotions: ["disgust"] },
  { word: "repulsive", score: -0.85, emotions: ["disgust"] },
  { word: "vile", score: -0.8, emotions: ["disgust"] },
  { word: "foul", score: -0.75, emotions: ["disgust"] },

  // ---- Negative — generic / quality (25) ----
  { word: "bad", score: -0.7, emotions: [] },
  { word: "terrible", score: -0.85, emotions: ["anger", "sadness"] },
  { word: "horrible", score: -0.85, emotions: ["anger", "sadness"] },
  { word: "awful", score: -0.8, emotions: ["anger", "sadness"] },
  { word: "dreadful", score: -0.8, emotions: ["fear"] },
  { word: "worst", score: -0.9, emotions: ["anger", "sadness"] },
  { word: "poor", score: -0.65, emotions: [] },
  { word: "inferior", score: -0.65, emotions: [] },
  { word: "weak", score: -0.55, emotions: [] },
  { word: "broken", score: -0.7, emotions: [] },
  { word: "buggy", score: -0.7, emotions: [] },
  { word: "slow", score: -0.55, emotions: [] },
  { word: "sluggish", score: -0.6, emotions: [] },
  { word: "laggy", score: -0.65, emotions: [] },
  { word: "crash", score: -0.7, emotions: [] },
  { word: "crashed", score: -0.75, emotions: [] },
  { word: "crashes", score: -0.75, emotions: [] },
  { word: "fail", score: -0.7, emotions: [] },
  { word: "failed", score: -0.75, emotions: [] },
  { word: "failure", score: -0.75, emotions: [] },
  { word: "useless", score: -0.8, emotions: ["anger"] },
  { word: "worthless", score: -0.8, emotions: ["anger"] },
  { word: "hate", score: -0.85, emotions: ["anger"] },
  { word: "hated", score: -0.85, emotions: ["anger"] },
  { word: "hates", score: -0.85, emotions: ["anger"] },

  // ---- Negative — service / business (12) ----
  { word: "overpriced", score: -0.7, emotions: ["anger"] },
  { word: "expensive", score: -0.4, emotions: [] },
  { word: "pricey", score: -0.4, emotions: [] },
  { word: "rude", score: -0.8, emotions: ["anger"] },
  { word: "unprofessional", score: -0.75, emotions: ["anger"] },
  { word: "unhelpful", score: -0.7, emotions: ["sadness"] },
  { word: "unresponsive", score: -0.7, emotions: ["anger"] },
  { word: "delayed", score: -0.55, emotions: [] },
  { word: "late", score: -0.45, emotions: [] },
  { word: "stale", score: -0.55, emotions: ["disgust"] },
  { word: "defective", score: -0.75, emotions: [] },
  { word: "fake", score: -0.7, emotions: [] },

  // ---- Negative — mild (12) ----
  { word: "mediocre", score: -0.45, emotions: [] },
  { word: "average", score: -0.1, emotions: [] },
  { word: "ordinary", score: -0.15, emotions: [] },
  { word: "boring", score: -0.5, emotions: ["sadness"] },
  { word: "dull", score: -0.45, emotions: ["sadness"] },
  { word: "tedious", score: -0.55, emotions: [] },
  { word: "clunky", score: -0.55, emotions: [] },
  { word: "confusing", score: -0.55, emotions: [] },
  { word: "confused", score: -0.5, emotions: [] },
  { word: "noisy", score: -0.5, emotions: [] },
  { word: "heavy", score: -0.3, emotions: [] },
  { word: "bulky", score: -0.4, emotions: [] },

  // ---- Negative — extra (15) ----
  { word: "problem", score: -0.55, emotions: [] },
  { word: "problems", score: -0.6, emotions: [] },
  { word: "issue", score: -0.45, emotions: [] },
  { word: "issues", score: -0.5, emotions: [] },
  { word: "bug", score: -0.6, emotions: [] },
  { word: "bugs", score: -0.65, emotions: [] },
  { word: "glitch", score: -0.6, emotions: [] },
  { word: "glitchy", score: -0.65, emotions: [] },
  { word: "error", score: -0.55, emotions: [] },
  { word: "errors", score: -0.6, emotions: [] },
  { word: "damage", score: -0.7, emotions: [] },
  { word: "damaged", score: -0.75, emotions: ["anger"] },
  { word: "complaint", score: -0.65, emotions: ["anger"] },
  { word: "complain", score: -0.6, emotions: ["anger"] },
  { word: "negative", score: -0.55, emotions: [] },

  // ---- Positive — extra (10) to round out 200+ ----
  { word: "satisfied", score: 0.7, emotions: ["joy"] },
  { word: "satisfying", score: 0.7, emotions: ["joy"] },
  { word: "satisfaction", score: 0.7, emotions: ["joy"] },
  { word: "impressed", score: 0.75, emotions: ["surprise", "joy"] },
  { word: "flawless", score: 0.85, emotions: ["joy"] },
  { word: "seamless", score: 0.75, emotions: ["joy"] },
  { word: "efficient", score: 0.65, emotions: ["trust"] },
  { word: "effective", score: 0.65, emotions: ["trust"] },
  { word: "convenient", score: 0.6, emotions: ["joy"] },
  { word: "comfortable", score: 0.6, emotions: ["joy"] },

  // ---- Positive — extra round 2 (10) ----
  { word: "polished", score: 0.7, emotions: ["joy"] },
  { word: "gorgeous", score: 0.85, emotions: ["joy"] },
  { word: "sturdy", score: 0.65, emotions: ["trust"] },
  { word: "snappy", score: 0.6, emotions: ["joy"] },
  { word: "affordable", score: 0.55, emotions: ["joy"] },
  { word: "helpful", score: 0.65, emotions: ["trust", "joy"] },
  { word: "friendly", score: 0.6, emotions: ["joy"] },
  { word: "refreshing", score: 0.6, emotions: ["joy"] },
  { word: "engaging", score: 0.6, emotions: ["joy"] },
  { word: "powerful", score: 0.65, emotions: ["trust"] },

  // ---- Negative — extra round 2 (10) ----
  { word: "unreliable", score: -0.7, emotions: ["anger"] },
  { word: "shoddy", score: -0.7, emotions: ["disgust"] },
  { word: "flimsy", score: -0.6, emotions: [] },
  { word: "overrated", score: -0.6, emotions: ["anger"] },
  { word: "underwhelming", score: -0.6, emotions: ["sadness"] },
  { word: "tacky", score: -0.55, emotions: ["disgust"] },
  { word: "dated", score: -0.5, emotions: [] },
  { word: "obsolete", score: -0.65, emotions: [] },
  { word: "scam", score: -0.85, emotions: ["anger"] },
  { word: "ripoff", score: -0.8, emotions: ["anger"] },
];

// ---------- Lexicon lookup ----------

const LEXICON_MAP: Map<string, LexiconEntry> = (() => {
  const m = new Map<string, LexiconEntry>();
  for (const e of LEXICON) m.set(e.word.toLowerCase(), e);
  return m;
})();

export function lookupWord(word: string): LexiconEntry | undefined {
  return LEXICON_MAP.get(word.toLowerCase());
}

// ---------- Tokenization ----------

/** Split a sentence into word tokens, preserving non-word characters as their own tokens. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .match(/[a-z']+|\d+|[^\sa-z\d']+/gi) ?? [];
}

/** Split text into sentences on . ! ? followed by whitespace, preserving the delimiter. */
export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

// ---------- Negation + modifiers ----------

/** Check whether a token is a negation word. */
export function isNegation(token: string): boolean {
  return NEGATION_WORDS.has(token.toLowerCase());
}

/** Check whether a token is a booster word. */
export function isBooster(token: string): boolean {
  return BOOSTER_WORDS.has(token.toLowerCase());
}

/** Check whether a token is a dampener word. */
export function isDampener(token: string): boolean {
  return DAMPENER_WORDS.has(token.toLowerCase());
}

// ---------- Per-token analysis ----------

/**
 * Build Token[] from a sentence's tokens, applying negation (3-word window)
 * and booster / dampener modifiers.
 */
export function analyzeTokens(rawTokens: string[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const raw = rawTokens[i];
    const text = raw.toLowerCase();
    const entry = lookupWord(text);

    // Look back up to 3 tokens for a negation.
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (isNegation(rawTokens[j])) { negated = true; break; }
    }

    // Look back 1 token for a modifier.
    let modifier = 1.0;
    if (i > 0) {
      const prev = rawTokens[i - 1].toLowerCase();
      if (isBooster(prev)) modifier = 1.5;
      else if (isDampener(prev)) modifier = 0.5;
    }

    let effectiveScore = 0;
    if (entry) {
      effectiveScore = entry.score * modifier;
      if (negated) effectiveScore = -effectiveScore * 0.75; // negation flips + softens
    }

    out.push({ text, raw, lexicon: entry, negated, modifier, effectiveScore });
  }
  return out;
}

// ---------- Sentence scoring ----------

export function computeSentenceScore(tokens: Token[]): number {
  const hits = tokens.filter((t) => t.lexicon && t.effectiveScore !== 0);
  if (hits.length === 0) return 0;
  const sum = hits.reduce((acc, t) => acc + t.effectiveScore, 0);
  // tanh normalizes to [-1, +1] — preserves polarity, dampens extremes.
  return Math.tanh(sum);
}

export function labelFromScore(score: number, threshold: number = DEFAULT_THRESHOLD): Sentiment {
  if (score >= threshold) return "positive";
  if (score <= -threshold) return "negative";
  return "neutral";
}

export function computeConfidence(hits: number, total: number): "low" | "medium" | "high" {
  if (total === 0) return "low";
  const ratio = hits / total;
  if (hits >= 3 && ratio >= 0.15) return "high";
  if (hits >= 1) return "medium";
  return "low";
}

// ---------- Aspect extraction ----------

/** Extract aspect-based sentiment from a sentence. */
export function extractAspects(text: string, tokens: Token[]): AspectResult[] {
  const lower = text.toLowerCase();
  const aspects: AspectResult[] = [];
  for (const def of ASPECT_PATTERNS) {
    for (const cue of def.cues) {
      const idx = lower.indexOf(cue);
      if (idx === -1) continue;
      // Take a window of ~10 tokens around the cue.
      const windowStart = Math.max(0, idx - 30);
      const windowEnd = Math.min(lower.length, idx + cue.length + 60);
      const window = lower.slice(windowStart, windowEnd);
      const windowTokens = analyzeTokens(tokenize(window));
      const score = computeSentenceScore(windowTokens);
      if (Math.abs(score) > 0.05) {
        aspects.push({
          aspect: def.aspect,
          text: window.trim(),
          score,
          sentiment: labelFromScore(score),
        });
      }
      break; // one cue per aspect definition is enough
    }
  }
  return aspects;
}

// ---------- Sentence analysis ----------

export function analyzeSentence(text: string, threshold: number = DEFAULT_THRESHOLD): SentenceResult {
  const rawTokens = tokenize(text);
  const tokens = analyzeTokens(rawTokens);
  const score = computeSentenceScore(tokens);
  const sentiment = labelFromScore(score, threshold);
  const hits = tokens.filter((t) => t.lexicon);
  const positiveWords = hits.filter((t) => t.effectiveScore > 0).map((t) => t.raw);
  const negativeWords = hits.filter((t) => t.effectiveScore < 0).map((t) => t.raw);
  const emotions = Array.from(new Set(hits.flatMap((t) => t.lexicon?.emotions ?? [])));
  const confidence = computeConfidence(hits.length, tokens.length);
  const aspects = extractAspects(text, tokens);
  return { text, score, sentiment, confidence, positiveWords, negativeWords, emotions, tokens, aspects };
}

// ---------- Document analysis ----------

export function analyzeDocument(text: string, threshold: number = DEFAULT_THRESHOLD): DocumentResult {
  const sentences = splitSentences(text).map((s) => analyzeSentence(s, threshold));
  const score = sentences.length === 0 ? 0 : sentences.reduce((a, s) => a + s.score, 0) / sentences.length;
  const sentiment = labelFromScore(score, threshold);
  const positiveCount = sentences.filter((s) => s.sentiment === "positive").length;
  const negativeCount = sentences.filter((s) => s.sentiment === "negative").length;
  const neutralCount = sentences.filter((s) => s.sentiment === "neutral").length;

  // Emotion profile aggregated across all sentences.
  const emotionMap = new Map<Emotion, { count: number; score: number }>();
  for (const e of ["joy", "anger", "sadness", "fear", "surprise", "disgust", "trust", "anticipation"] as Emotion[]) {
    emotionMap.set(e, { count: 0, score: 0 });
  }
  for (const s of sentences) {
    for (const e of s.emotions) {
      const cur = emotionMap.get(e)!;
      cur.count += 1;
      cur.score += s.score;
    }
  }
  const emotionProfile = Array.from(emotionMap.entries())
    .map(([emotion, v]) => ({ emotion, count: v.count, score: v.score }))
    .sort((a, b) => b.count - a.count);

  // Aggregate aspects.
  const aspectMap = new Map<string, { text: string; score: number; sentiment: Sentiment }>();
  for (const s of sentences) {
    for (const a of s.aspects) {
      const cur = aspectMap.get(a.aspect);
      if (!cur) aspectMap.set(a.aspect, { text: a.text, score: a.score, sentiment: a.sentiment });
      else {
        const newScore = (cur.score + a.score) / 2;
        cur.score = newScore;
        cur.sentiment = labelFromScore(newScore, threshold);
      }
    }
  }
  const aspects = Array.from(aspectMap.entries()).map(([aspect, v]) => ({
    aspect,
    text: v.text,
    score: v.score,
    sentiment: v.sentiment,
  }));

  const lexiconHits = sentences.reduce((a, s) => a + s.tokens.filter((t) => t.lexicon).length, 0);
  const wordCount = sentences.reduce((a, s) => a + s.tokens.filter((t) => /[a-z']+/i.test(t.text)).length, 0);
  const confidence = computeConfidence(lexiconHits, wordCount);

  return {
    text,
    score,
    sentiment,
    confidence,
    sentences,
    positiveCount,
    negativeCount,
    neutralCount,
    emotionProfile,
    aspects,
    stats: { wordCount, sentenceCount: sentences.length, lexiconHits },
  };
}

// ---------- CSV parsing + analysis ----------

/** Parse a CSV string into rows. Handles quoted fields with embedded commas + newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((c) => c.trim() !== "")) rows.push(row);
        row = []; field = "";
      } else field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

/** Build a CSV string from rows (escapes commas, quotes, newlines). */
export function buildCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(",")).join("\n");
}

/** Analyze every row of a CSV's text column. Skips the header row by default. */
export function analyzeCsv(
  text: string,
  textColumnIndex: number,
  threshold: number = DEFAULT_THRESHOLD,
  skipHeader: boolean = true,
): CsvRow[] {
  const rows = parseCsv(text);
  const startRow = skipHeader ? 1 : 0;
  const out: CsvRow[] = [];
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (textColumnIndex < 0 || textColumnIndex >= r.length) continue;
    const t = r[textColumnIndex];
    if (!t || !t.trim()) continue;
    const doc = analyzeDocument(t, threshold);
    out.push({
      rowIndex: i + 1,
      text: t,
      score: doc.score,
      sentiment: doc.sentiment,
      confidence: doc.confidence,
      emotions: doc.emotionProfile.filter((e) => e.count > 0).map((e) => e.emotion),
    });
  }
  return out;
}

/** Summarize CSV analysis: counts, mean score, top positive/negative, emotion counts. */
export function summarizeCsv(rows: CsvRow[]): CsvSummary {
  const total = rows.length;
  let positive = 0, negative = 0, neutral = 0, sum = 0;
  const emotionCounts: Record<Emotion, number> = {
    joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, disgust: 0, trust: 0, anticipation: 0,
  };
  for (const r of rows) {
    if (r.sentiment === "positive") positive++;
    else if (r.sentiment === "negative") negative++;
    else neutral++;
    sum += r.score;
    for (const e of r.emotions) emotionCounts[e]++;
  }
  const sortedByScore = [...rows].sort((a, b) => b.score - a.score);
  return {
    totalRows: total,
    positive, negative, neutral,
    meanScore: total === 0 ? 0 : sum / total,
    topPositive: sortedByScore.slice(0, 5),
    topNegative: sortedByScore.slice(-5).reverse(),
    emotionCounts,
  };
}

// ---------- Rendering ----------

/** Render analysis results as CSV (one row per sentence). */
export function renderDocumentCsv(doc: DocumentResult): string {
  const rows: (string | number)[][] = [
    ["section", "item", "detail"],
    ["summary", "score", doc.score.toFixed(3)],
    ["summary", "sentiment", doc.sentiment],
    ["summary", "confidence", doc.confidence],
    ["summary", "positive_sentences", doc.positiveCount],
    ["summary", "negative_sentences", doc.negativeCount],
    ["summary", "neutral_sentences", doc.neutralCount],
    ["summary", "word_count", doc.stats.wordCount],
    ["summary", "lexicon_hits", doc.stats.lexiconHits],
  ];
  for (const e of doc.emotionProfile) {
    if (e.count > 0) rows.push(["emotion", e.emotion, `${e.count} (${e.score.toFixed(2)})`]);
  }
  for (const a of doc.aspects) {
    rows.push(["aspect", a.aspect, `${a.sentiment} (${a.score.toFixed(2)})`]);
  }
  doc.sentences.forEach((s, i) => {
    rows.push(["sentence", i + 1, `${s.sentiment} (${s.score.toFixed(2)}) || ${s.text}`]);
  });
  return buildCsv(rows);
}

/** Render document result as JSON. */
export function renderDocumentJson(doc: DocumentResult): string {
  return JSON.stringify(doc, null, 2);
}

/** Render an inline-highlighted HTML view of the document. */
export function renderHighlightedHtml(doc: DocumentResult): string {
  const parts: string[] = [];
  for (const s of doc.sentences) {
    for (const t of s.tokens) {
      const esc = escapeHtml(t.raw);
      if (!t.lexicon) { parts.push(esc); continue; }
      const cls = t.effectiveScore > 0 ? "sa-pos" : "sa-neg";
      const title = `${t.lexicon.score > 0 ? "+" : ""}${t.lexicon.score.toFixed(2)}${t.negated ? " (negated)" : ""}${t.modifier !== 1 ? ` (×${t.modifier})` : ""}`;
      parts.push(`<mark class="sa-hit ${cls}" title="${escapeHtml(title)}">${esc}</mark>`);
    }
  }
  return parts.join("");
}

/** Render CSV analysis results as a downloadable CSV. */
export function renderCsvResultsCsv(rows: CsvRow[]): string {
  const out: (string | number)[][] = [
    ["row", "sentiment", "score", "confidence", "emotions", "text"],
  ];
  for (const r of rows) {
    out.push([r.rowIndex, r.sentiment, r.score.toFixed(3), r.confidence, r.emotions.join("|"), r.text]);
  }
  return buildCsv(out);
}

/** Render CSV analysis results as JSON. */
export function renderCsvResultsJson(rows: CsvRow[]): string {
  return JSON.stringify(rows, null, 2);
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build an LLM prompt for optional BYO-key enhancement. */
export function buildLlmPrompt(text: string, doc: DocumentResult): string {
  const topEmotions = doc.emotionProfile.filter((e) => e.count > 0).slice(0, 3);
  return [
    `You are a sentiment-analysis assistant. Analyze the text below and produce:`,
    `(1) a single-word sentiment label (positive / negative / neutral),`,
    `(2) a -1 to +1 score,`,
    `(3) a confidence level (low / medium / high),`,
    `(4) the top 3 emotions with brief justification,`,
    `(5) any aspect-based sentiment ("aspect: positive/negative"),`,
    `(6) notes on sarcasm, mixed sentiment, or slang that the on-device classifier might miss.`,
    ``,
    `On-device engine output for reference:`,
    `Score: ${doc.score.toFixed(2)}, Sentiment: ${doc.sentiment}, Confidence: ${doc.confidence}`,
    `Top emotions: ${topEmotions.map((e) => `${e.emotion} (${e.count})`).join(", ") || "none"}`,
    `Aspects: ${doc.aspects.map((a) => `${a.aspect}:${a.sentiment}`).join(", ") || "none"}`,
    ``,
    `Text:`,
    `---`,
    `${text}`,
    `---`,
    ``,
    `Keep your response under 250 words.`,
  ].join("\n");
}

/** Trim + normalize LLM output before display. */
export function renderLlmResult(s: string): string {
  return (s || "").trim();
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

export function buildShareUrl(text: string, threshold: number): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (threshold && threshold !== DEFAULT_THRESHOLD) params.set("th", threshold.toFixed(2));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { text: string; threshold: number } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", threshold: DEFAULT_THRESHOLD };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const thStr = params.get("th");
  let threshold = DEFAULT_THRESHOLD;
  if (thStr) {
    const n = Number(thStr);
    if (isFinite(n) && n > 0 && n <= 1) threshold = n;
  }
  return { text, threshold };
}
