/**
 * AI Chatbot Emulator — pure logic.
 *
 * Build & test a knowledge-base chatbot. Pure-JS rule-based retrieval
 * engine (TF-IDF + Jaccard + Levenshtein fuzzy matching) with intent
 * detection, persona, tone/guardrails, configurable fallback, citations,
 * KB chunking, multiple saved bots, transcript export.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: the on-device engine is for prototyping & testing, not
 * production customer support. Grounding reduces but does not eliminate
 * hallucination — always verify answers.
 */

// ---------- Types ----------

export type Tone = "formal" | "casual" | "friendly" | "technical";

export type Intent =
  | "greeting"
  | "farewell"
  | "thanks"
  | "help"
  | "question"
  | "unknown";

export interface KbEntry {
  id: number;
  question: string;
  answer: string;
  tokens: string[]; // tokenized question
  tags: string[];   // optional intent/topic tags
}

export interface BotConfig {
  name: string;
  persona: string;          // system prompt
  tone: Tone;
  maxResponseLength: number;
  bannedWords: string[];
  confidenceThreshold: number; // 0–1
  fallbackMessage: string;
  weightTfIdf: number;      // weight for TF-IDF score
  weightJaccard: number;    // weight for Jaccard score
  weightLevenshtein: number; // weight for fuzzy score
  kb: KbEntry[];
}

export interface MatchScore {
  entryId: number;
  tfidf: number;       // 0–1
  jaccard: number;     // 0–1
  levenshtein: number; // 0–1 (1 = perfect match)
  combined: number;    // weighted blend, 0–1
}

export interface BotResponse {
  answer: string;
  intent: Intent;
  confidence: number;        // 0–1, the combined score
  citation: KbEntry | null;  // which KB chunk was used
  isFallback: boolean;
  warnings: string[];
  debug: {
    scores: MatchScore[];
    queryTokens: string[];
    detectedIntent: Intent;
  };
}

export interface ChatMessage {
  id: number;
  role: "user" | "bot";
  text: string;
  ts: number;
  response?: BotResponse; // attached to bot messages
}

export interface KbStats {
  entryCount: number;
  totalWords: number;
  avgWordsPerEntry: number;
  uniqueWords: number;
  intentCoverage: Record<Intent, number>;
}

export interface SavedBot {
  id: string;
  name: string;
  config: BotConfig;
  savedAt: number;
}

export interface HistoryEntry {
  ts: number;
  botName: string;
  query: string;
  answer: string;
  confidence: number;
  isFallback: boolean;
}

export interface LlmEnhancement {
  refinedAnswer: string;
  alternativeAnswers: string[];
  notes: string[];
}

export interface ShareState {
  config?: Partial<BotConfig>;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-chatbot-emulator:history";
export const HISTORY_MAX = 20;
export const BOTS_KEY = "unqtools:ai-chatbot-emulator:bots";
export const BOTS_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-chatbot-emulator:llm-key";

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  casual: "Casual",
  friendly: "Friendly",
  technical: "Technical",
};

export const INTENT_LABELS: Record<Intent, string> = {
  greeting: "Greeting",
  farewell: "Farewell",
  thanks: "Thanks",
  help: "Help",
  question: "Question",
  unknown: "Unknown",
};

export const DEFAULT_PERSONA =
  "You are a helpful, honest assistant. Answer questions using only the provided knowledge base. If you don't know, say so clearly rather than guessing.";

export const DEFAULT_FALLBACK =
  "I'm not sure I understand. Could you rephrase that, or ask one of the questions in my knowledge base?";

export const DEFAULT_CONFIG: BotConfig = {
  name: "My Bot",
  persona: DEFAULT_PERSONA,
  tone: "friendly",
  maxResponseLength: 500,
  bannedWords: [],
  confidenceThreshold: 0.35,
  fallbackMessage: DEFAULT_FALLBACK,
  weightTfIdf: 0.4,
  weightJaccard: 0.3,
  weightLevenshtein: 0.3,
  kb: [],
};

export const FIELD_HINTS: Record<keyof BotConfig, { hint: string; sample: string }> = {
  name: { hint: "Bot display name.", sample: "Support Bot" },
  persona: { hint: "System prompt — defines the bot's role and constraints.", sample: DEFAULT_PERSONA },
  tone: { hint: "Tone preset shapes the response prefix and suffix.", sample: "friendly" },
  maxResponseLength: { hint: "Max response length (chars). Answers longer than this are truncated.", sample: "500" },
  bannedWords: { hint: "Comma-separated words to redact from bot responses.", sample: "competitor, spam" },
  confidenceThreshold: { hint: "Combined score below this triggers the fallback message (0–1).", sample: "0.35" },
  fallbackMessage: { hint: "Message shown when no KB entry meets the confidence threshold.", sample: DEFAULT_FALLBACK },
  weightTfIdf: { hint: "Weight for TF-IDF score (0–1).", sample: "0.4" },
  weightJaccard: { hint: "Weight for Jaccard similarity (0–1).", sample: "0.3" },
  weightLevenshtein: { hint: "Weight for Levenshtein fuzzy match (0–1).", sample: "0.3" },
  kb: { hint: "Knowledge base entries (Q&A pairs).", sample: "[]" },
};

const STOP_WORDS = new Set<string>([
  "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "to", "of", "in", "on", "at", "by", "for", "with", "about", "as",
  "into", "from", "up", "down", "in", "out", "on", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "each", "few", "more", "most", "other",
  "some", "such", "no", "not", "only", "own", "same", "so", "than",
  "too", "very", "i", "me", "my", "we", "our", "you", "your", "he",
  "him", "his", "she", "her", "it", "its", "they", "them", "their",
  "what", "which", "who", "this", "that", "these", "those",
]);

const GREETING_PATTERNS = ["hi", "hello", "hey", "howdy", "greetings", "yo", "sup", "good morning", "good afternoon", "good evening"];
const FAREWELL_PATTERNS = ["bye", "goodbye", "see you", "later", "cya", "farewell", "good night", "i'm out", "gtg"];
const THANKS_PATTERNS = ["thank", "thanks", "thank you", "thx", "appreciate", "cheers", "grateful"];
const HELP_PATTERNS = ["help", "what can you do", "how do you work", "what do you do", "options", "menu"];

// ---------- KB parsing ----------

/**
 * Parse a pasted KB. Supports flexible delimiters:
 *  - "Q: ... | A: ..." (pipe separated)
 *  - "Q: ...\nA: ..." (newline separated)
 *  - "Question? Answer." (question mark separator)
 *  - "- question\n  answer" (markdown list)
 *  - "question|answer" (simple pipe)
 */
export function parseKb(raw: string): KbEntry[] {
  if (!raw || !raw.trim()) return [];
  const entries: KbEntry[] = [];
  let id = 1;

  // Try "Q: ... | A: ..." or "Q: ...\nA: ..." format first.
  // Note: [\s\S] used instead of '.' with /s flag because /s requires ES2018+
  // and our tsconfig target is ES2017.
  const qaPattern = /Q[:.]\s*([\s\S]*?)\s*(?:\|\s*A[:.]\s*|\n\s*A[:.]\s*)([\s\S]*?)(?=\n\s*Q[:.]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = qaPattern.exec(raw)) !== null) {
    const q = m[1]!.trim();
    const a = m[2]!.trim();
    if (q && a) {
      entries.push({ id: id++, question: q, answer: a, tokens: tokenize(q), tags: extractTags(q) });
    }
  }
  if (entries.length > 0) return entries;

  // Try "question|answer" (simple pipe, one per line).
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Strip leading list markers.
    const cleaned = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    if (cleaned.includes("|")) {
      const [q, a] = cleaned.split("|").map((s) => s.trim());
      if (q && a) {
        entries.push({ id: id++, question: q, answer: a, tokens: tokenize(q), tags: extractTags(q) });
      }
    } else if (cleaned.includes("?")) {
      // Question mark separator.
      const idx = cleaned.indexOf("?");
      const q = cleaned.slice(0, idx + 1).trim();
      const a = cleaned.slice(idx + 1).trim();
      if (q && a) {
        entries.push({ id: id++, question: q, answer: a, tokens: tokenize(q), tags: extractTags(q) });
      }
    }
  }
  return entries;
}

/** Build a sample KB string (for the UI placeholder). */
export function sampleKbString(): string {
  return [
    "Q: How do I reset my password? | A: Click the 'Forgot password' link on the login page and follow the email instructions.",
    "Q: What are your business hours? | A: We're open Monday to Friday, 9am to 5pm Eastern Time.",
    "Q: How do I cancel my subscription? | A: Go to Settings > Billing and click 'Cancel subscription'. You'll keep access until the end of your billing period.",
    "Q: Do you offer refunds? | A: Yes, within 30 days of purchase. Contact support with your order number.",
  ].join("\n");
}

// ---------- Tokenization & normalization ----------

/** Tokenize a string into normalized lowercase word tokens. */
export function tokenize(s: string): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/** Tokenize including stop words (for some scoring variants). */
export function tokenizeAll(s: string): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Normalize a string for fuzzy matching. */
export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract simple tags from a question (e.g., "reset password" -> ["reset", "password"]). */
export function extractTags(q: string): string[] {
  return tokenize(q).slice(0, 5);
}

// ---------- Scoring algorithms ----------

/** Compute term frequencies for a token list. */
export function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Compute inverse-document-frequency for a KB. */
export function computeIdf(kb: KbEntry[]): Map<string, number> {
  const df = new Map<string, number>();
  const N = Math.max(1, kb.length);
  for (const entry of kb) {
    const seen = new Set<string>();
    for (const t of entry.tokens) {
      if (!seen.has(t)) {
        seen.add(t);
        df.set(t, (df.get(t) ?? 0) + 1);
      }
    }
  }
  const idf = new Map<string, number>();
  for (const [t, count] of df) {
    idf.set(t, Math.log(1 + N / count));
  }
  return idf;
}

/**
 * TF-IDF cosine similarity between a query and a KB entry.
 * Returns 0–1 (normalized).
 */
export function scoreTfIdf(
  queryTokens: string[],
  entryTokens: string[],
  idf: Map<string, number>,
): number {
  if (queryTokens.length === 0 || entryTokens.length === 0) return 0;
  const qTf = termFreq(queryTokens);
  const eTf = termFreq(entryTokens);
  let dot = 0;
  let qMag = 0;
  let eMag = 0;
  for (const [t, qf] of qTf) {
    const idfVal = idf.get(t) ?? 0;
    const qWeight = qf * idfVal;
    qMag += qWeight * qWeight;
    const ef = eTf.get(t) ?? 0;
    if (ef > 0) {
      const eWeight = ef * idfVal;
      dot += qWeight * eWeight;
    }
  }
  for (const [t, ef] of eTf) {
    const idfVal = idf.get(t) ?? 0;
    const eWeight = ef * idfVal;
    eMag += eWeight * eWeight;
  }
  if (qMag === 0 || eMag === 0) return 0;
  return dot / (Math.sqrt(qMag) * Math.sqrt(eMag));
}

/** Jaccard similarity between two token sets (0–1). */
export function scoreJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Levenshtein edit distance. Pure DP, no external deps.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/**
 * Levenshtein-based fuzzy similarity (0–1, 1 = identical).
 * Uses the max length to normalize, so partial matches score lower.
 */
export function scoreLevenshtein(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

/**
 * Best Levenshtein match: find the entry question whose tokens best
 * match the query tokens (token-level fuzzy matching for typo tolerance).
 * Returns 0–1.
 */
export function bestTokenLevenshtein(queryTokens: string[], entryTokens: string[]): number {
  if (queryTokens.length === 0 || entryTokens.length === 0) return 0;
  let totalScore = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const et of entryTokens) {
      const s = scoreLevenshtein(qt, et);
      if (s > best) best = s;
    }
    totalScore += best;
  }
  return totalScore / queryTokens.length;
}

/** Compute the combined match score for a query against a single KB entry. */
export function scoreMatch(
  queryTokens: string[],
  entry: KbEntry,
  idf: Map<string, number>,
  weights: { tfIdf: number; jaccard: number; levenshtein: number },
): MatchScore {
  const tf = scoreTfIdf(queryTokens, entry.tokens, idf);
  const jac = scoreJaccard(queryTokens, entry.tokens);
  // Use the full question strings for fuzzy, plus token-level fuzzy.
  const fullStringScore = scoreLevenshtein(queryTokens.join(" "), entry.question.toLowerCase());
  const tokenScore = bestTokenLevenshtein(queryTokens, entry.tokens);
  const lev = (fullStringScore + tokenScore) / 2;
  const totalWeight = weights.tfIdf + weights.jaccard + weights.levenshtein;
  const safeTotal = totalWeight > 0 ? totalWeight : 1;
  const combined =
    (tf * weights.tfIdf + jac * weights.jaccard + lev * weights.levenshtein) / safeTotal;
  return {
    entryId: entry.id,
    tfidf: tf,
    jaccard: jac,
    levenshtein: lev,
    combined,
  };
}

/** Find the best KB match for a query. Returns null if KB is empty. */
export function findBestMatch(
  query: string,
  config: BotConfig,
): { scores: MatchScore[]; best: MatchScore | null; queryTokens: string[] } {
  if (config.kb.length === 0) {
    return { scores: [], best: null, queryTokens: tokenize(query) };
  }
  const queryTokens = tokenize(query);
  const idf = computeIdf(config.kb);
  const scores = config.kb.map((e) =>
    scoreMatch(queryTokens, e, idf, {
      tfIdf: config.weightTfIdf,
      jaccard: config.weightJaccard,
      levenshtein: config.weightLevenshtein,
    }),
  );
  scores.sort((a, b) => b.combined - a.combined);
  const best = scores[0] ?? null;
  return { scores, best, queryTokens };
}

// ---------- Intent detection ----------

export function detectIntent(query: string): Intent {
  const q = normalizeText(query);
  if (!q) return "unknown";
  if (GREETING_PATTERNS.some((p) => q === p || q.startsWith(p + " ") || q.startsWith(p))) return "greeting";
  if (FAREWELL_PATTERNS.some((p) => q === p || q.startsWith(p + " ") || q.startsWith(p))) return "farewell";
  if (THANKS_PATTERNS.some((p) => q === p || q.includes(p))) return "thanks";
  if (HELP_PATTERNS.some((p) => q === p || q.includes(p))) return "help";
  if (q.includes("?") || q.startsWith("what") || q.startsWith("how") || q.startsWith("why") || q.startsWith("when") || q.startsWith("where") || q.startsWith("who") || q.startsWith("can") || q.startsWith("do") || q.startsWith("is") || q.startsWith("are")) {
    return "question";
  }
  return "unknown";
}

export function intentResponse(intent: Intent, config: BotConfig): string {
  const botName = config.name || "Bot";
  switch (intent) {
    case "greeting":
      return toneWrap(config.tone, `Hi there! I'm ${botName}. How can I help you today?`);
    case "farewell":
      return toneWrap(config.tone, `Goodbye! Feel free to come back any time.`);
    case "thanks":
      return toneWrap(config.tone, `You're welcome! Anything else I can help with?`);
    case "help":
      return toneWrap(
        config.tone,
        `I can answer questions from my knowledge base. Try asking things like: ${(config.kb.slice(0, 3).map((e) => `"${e.question}"`).join(", ")) || "anything in your KB"}.`,
      );
    default:
      return "";
  }
}

// ---------- Tone & guardrails ----------

export function toneWrap(tone: Tone, text: string): string {
  switch (tone) {
    case "formal":
      return text;
    case "casual":
      return text;
    case "friendly":
      return text;
    case "technical":
      return text;
    default:
      return text;
  }
}

/** Apply guardrails: truncate, redact banned words. */
export function applyGuardrails(text: string, config: BotConfig): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  let out = text;
  if (config.maxResponseLength > 0 && out.length > config.maxResponseLength) {
    out = out.slice(0, config.maxResponseLength - 3) + "...";
    warnings.push(`Response truncated to ${config.maxResponseLength} chars.`);
  }
  for (const w of config.bannedWords) {
    if (!w) continue;
    const re = new RegExp(escapeRegex(w), "gi");
    if (re.test(out)) {
      out = out.replace(re, "[redacted]");
      warnings.push(`Banned word "${w}" was redacted.`);
    }
  }
  return { text: out, warnings };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- KB validation & stats ----------

export function validateKb(config: BotConfig): string[] {
  const warnings: string[] = [];
  if (config.kb.length === 0) {
    warnings.push("Knowledge base is empty — bot will only respond with intent messages and fallback.");
  }
  if (config.kb.length > 0 && config.kb.length < 3) {
    warnings.push("KB has fewer than 3 entries — retrieval quality will be limited.");
  }
  // Check for duplicate questions.
  const seenQ = new Set<string>();
  for (const e of config.kb) {
    const key = e.question.toLowerCase().trim();
    if (seenQ.has(key)) warnings.push(`Duplicate question: "${e.question}".`);
    seenQ.add(key);
  }
  // Check for very short answers.
  for (const e of config.kb) {
    if (e.answer.trim().length < 10) {
      warnings.push(`Answer for "${e.question}" is very short (<10 chars).`);
    }
  }
  // Check weights.
  const totalW = config.weightTfIdf + config.weightJaccard + config.weightLevenshtein;
  if (totalW === 0) warnings.push("All score weights are zero — no matching will occur.");
  if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
    warnings.push("Confidence threshold must be between 0 and 1.");
  }
  if (config.maxResponseLength > 0 && config.maxResponseLength < 50) {
    warnings.push("Max response length is very low (<50 chars) — answers will be truncated.");
  }
  return warnings;
}

export function computeStats(config: BotConfig): KbStats {
  const entryCount = config.kb.length;
  let totalWords = 0;
  const allWords = new Set<string>();
  for (const e of config.kb) {
    const tokens = tokenizeAll(e.answer);
    totalWords += tokens.length;
    for (const t of tokens) allWords.add(t);
  }
  const intentCoverage: Record<Intent, number> = {
    greeting: 0, farewell: 0, thanks: 0, help: 0, question: 0, unknown: 0,
  };
  for (const e of config.kb) {
    const i = detectIntent(e.question);
    intentCoverage[i] += 1;
  }
  return {
    entryCount,
    totalWords,
    avgWordsPerEntry: entryCount > 0 ? Math.round(totalWords / entryCount) : 0,
    uniqueWords: allWords.size,
    intentCoverage,
  };
}

// ---------- Chunking ----------

/**
 * Chunk a long KB entry into smaller pieces (for retrieval over long
 * documents). Returns the original entry plus any chunks.
 */
export function chunkEntry(entry: KbEntry, maxWords: number = 50): KbEntry[] {
  if (maxWords <= 0) return [entry];
  const words = entry.answer.split(/\s+/);
  if (words.length <= maxWords) return [entry];
  const chunks: KbEntry[] = [];
  let id = entry.id * 1000;
  for (let i = 0; i < words.length; i += maxWords) {
    const slice = words.slice(i, i + maxWords).join(" ");
    chunks.push({
      id: id++,
      question: entry.question + (i > 0 ? ` (part ${Math.floor(i / maxWords) + 1})` : ""),
      answer: slice,
      tokens: tokenize(entry.question + " " + slice),
      tags: entry.tags,
    });
  }
  return chunks;
}

// ---------- Response generation ----------

export function generateResponse(query: string, config: BotConfig): BotResponse {
  const queryTokens = tokenize(query);
  const detectedIntent = detectIntent(query);
  const warnings: string[] = [];

  // 1. Intent-based short-circuit (greetings/farewells/etc).
  if (detectedIntent !== "question" && detectedIntent !== "unknown") {
    const intentText = intentResponse(detectedIntent, config);
    if (intentText) {
      const guarded = applyGuardrails(intentText, config);
      return {
        answer: guarded.text,
        intent: detectedIntent,
        confidence: 1.0,
        citation: null,
        isFallback: false,
        warnings: guarded.warnings,
        debug: {
          scores: [],
          queryTokens,
          detectedIntent,
        },
      };
    }
  }

  // 2. KB retrieval.
  const { scores, best } = findBestMatch(query, config);
  if (!best || best.combined < config.confidenceThreshold) {
    // 3. Fallback.
    const guarded = applyGuardrails(config.fallbackMessage, config);
    if (config.kb.length === 0) {
      warnings.push("KB is empty — bot has no knowledge to retrieve from.");
    }
    return {
      answer: guarded.text,
      intent: detectedIntent,
      confidence: best?.combined ?? 0,
      citation: null,
      isFallback: true,
      warnings: [...warnings, ...guarded.warnings],
      debug: {
        scores,
        queryTokens,
        detectedIntent,
      },
    };
  }

  // 4. KB-grounded answer with citation.
  const entry = config.kb.find((e) => e.id === best.entryId) ?? null;
  const guarded = applyGuardrails(entry?.answer ?? "", config);
  return {
    answer: guarded.text,
    intent: detectedIntent,
    confidence: best.combined,
    citation: entry,
    isFallback: false,
    warnings: guarded.warnings,
    debug: {
      scores,
      queryTokens,
      detectedIntent,
    },
  };
}

// ---------- Test mode ----------

export interface TestResult {
  query: string;
  response: BotResponse;
}

/** Run a batch of test queries against the bot and return per-query responses. */
export function runTestQueries(queries: string[], config: BotConfig): TestResult[] {
  return queries.map((q) => ({ query: q, response: generateResponse(q, config) }));
}

/** Compute test summary stats. */
export function testSummary(results: TestResult[]): {
  total: number;
  fallbacks: number;
  avgConfidence: number;
  intentCounts: Record<Intent, number>;
} {
  let fallbacks = 0;
  let totalConf = 0;
  const intentCounts: Record<Intent, number> = {
    greeting: 0, farewell: 0, thanks: 0, help: 0, question: 0, unknown: 0,
  };
  for (const r of results) {
    if (r.response.isFallback) fallbacks += 1;
    totalConf += r.response.confidence;
    intentCounts[r.response.intent] += 1;
  }
  return {
    total: results.length,
    fallbacks,
    avgConfidence: results.length > 0 ? totalConf / results.length : 0,
    intentCounts,
  };
}

// ---------- Render ----------

export function renderTranscriptText(messages: ChatMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const ts = new Date(m.ts).toLocaleTimeString();
    lines.push(`[${ts}] ${m.role === "user" ? "USER" : "BOT"}: ${m.text}`);
    if (m.response?.citation) {
      lines.push(`  (cited: "${m.response.citation.question}")`);
    }
    if (m.response?.isFallback) {
      lines.push(`  (fallback)`);
    }
  }
  return lines.join("\n");
}

export function renderTranscriptMarkdown(messages: ChatMessage[], config: BotConfig): string {
  const lines: string[] = [];
  lines.push(`# Chatbot transcript — ${config.name}`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Chatbot Emulator. ${messages.length} messages._`);
  lines.push("");
  lines.push("## Persona");
  lines.push("");
  lines.push(`> ${config.persona}`);
  lines.push("");
  lines.push("## Conversation");
  lines.push("");
  for (const m of messages) {
    const ts = new Date(m.ts).toLocaleTimeString();
    lines.push(`**${m.role === "user" ? "User" : config.name}** _(${ts})_:`);
    lines.push("");
    lines.push(m.text);
    lines.push("");
    if (m.response?.citation) {
      lines.push(`> 📎 Cited KB entry: "${m.response.citation.question}"`);
      lines.push(`> 🎯 Confidence: ${(m.response.confidence * 100).toFixed(1)}%`);
      lines.push("");
    }
    if (m.response?.isFallback) {
      lines.push(`> ⚠️ Fallback response (below confidence threshold)`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function renderConfigJson(config: BotConfig): string {
  return JSON.stringify(config, null, 2);
}

export function parseConfigJson(raw: string): { ok: true; config: BotConfig } | { ok: false; error: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be an object." };
  }
  const o = obj as Record<string, unknown>;
  const config: BotConfig = {
    ...DEFAULT_CONFIG,
    name: typeof o.name === "string" ? o.name : DEFAULT_CONFIG.name,
    persona: typeof o.persona === "string" ? o.persona : DEFAULT_CONFIG.persona,
    tone: (typeof o.tone === "string" && o.tone in TONE_LABELS) ? (o.tone as Tone) : DEFAULT_CONFIG.tone,
    maxResponseLength: typeof o.maxResponseLength === "number" ? o.maxResponseLength : DEFAULT_CONFIG.maxResponseLength,
    bannedWords: Array.isArray(o.bannedWords) ? (o.bannedWords as unknown[]).filter((x) => typeof x === "string") as string[] : [],
    confidenceThreshold: typeof o.confidenceThreshold === "number" ? o.confidenceThreshold : DEFAULT_CONFIG.confidenceThreshold,
    fallbackMessage: typeof o.fallbackMessage === "string" ? o.fallbackMessage : DEFAULT_CONFIG.fallbackMessage,
    weightTfIdf: typeof o.weightTfIdf === "number" ? o.weightTfIdf : DEFAULT_CONFIG.weightTfIdf,
    weightJaccard: typeof o.weightJaccard === "number" ? o.weightJaccard : DEFAULT_CONFIG.weightJaccard,
    weightLevenshtein: typeof o.weightLevenshtein === "number" ? o.weightLevenshtein : DEFAULT_CONFIG.weightLevenshtein,
    kb: Array.isArray(o.kb)
      ? (o.kb as unknown[])
          .filter((x) => typeof x === "object" && x !== null)
          .map((x, i) => {
            const r = x as Record<string, unknown>;
            return {
              id: typeof r.id === "number" ? r.id : i + 1,
              question: typeof r.question === "string" ? r.question : "",
              answer: typeof r.answer === "string" ? r.answer : "",
              tokens: typeof r.question === "string" ? tokenize(r.question) : [],
              tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t) => typeof t === "string") as string[] : [],
            } as KbEntry;
          })
          .filter((e) => e.question && e.answer)
      : [],
  };
  return { ok: true, config };
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

// ---------- Saved bots (localStorage) ----------

export function loadBots(): SavedBot[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedBot[];
    return Array.isArray(arr) ? arr.slice(0, BOTS_MAX) : [];
  } catch {
    return [];
  }
}

export function saveBot(config: BotConfig): SavedBot[] {
  const bots = loadBots();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newBot: SavedBot = { id, name: config.name, config, savedAt: Date.now() };
  const next = [newBot, ...bots].slice(0, BOTS_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(BOTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function deleteBot(id: string): SavedBot[] {
  const next = loadBots().filter((b) => b.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(BOTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearBots(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(BOTS_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(config: BotConfig): string {
  const params = new URLSearchParams();
  // Encode the full config as compressed JSON in the hash.
  params.set("cfg", JSON.stringify(config));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { config: {} };
  const params = new URLSearchParams(clean);
  const cfgStr = params.get("cfg");
  if (!cfgStr) return { config: {} };
  const parsed = parseConfigJson(cfgStr);
  if (!parsed.ok) return { config: {} };
  return { config: parsed.config };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(query: string, config: BotConfig, citation: KbEntry | null): string {
  return [
    "You are an expert chatbot response writer. Refine the chatbot's response using the persona and KB citation below.",
    "",
    "Persona / system prompt:",
    config.persona,
    "",
    "Tone:",
    TONE_LABELS[config.tone],
    "",
    "User query:",
    query,
    "",
    citation
      ? `KB citation (ground your answer in this):\nQ: ${citation.question}\nA: ${citation.answer}`
      : "No KB citation — the rule-based engine fell back. Propose a graceful response that doesn't fabricate facts.",
    "",
    "Output a JSON object with:",
    '- "refinedAnswer": string (1–3 sentences, grounded in the citation, matching the persona and tone, no fabricated facts)',
    '- "alternativeAnswers": array of 2–3 strings (alternative phrasings)',
    '- "notes": array of strings (advice for improving the KB or persona)',
    "",
    "Do not invent facts not in the citation. If the citation is empty, suggest a graceful fallback that doesn't hallucinate.",
  ].join("\n");
}

export function renderLlmResult(
  rawText: string,
): { ok: true; result: LlmEnhancement } | { ok: false; error: string } {
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
  const refinedAnswer = typeof o.refinedAnswer === "string" ? o.refinedAnswer : "";
  const alternativeAnswers = Array.isArray(o.alternativeAnswers)
    ? (o.alternativeAnswers as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { refinedAnswer, alternativeAnswers, notes } };
}

// ---------- Honesty ----------

export function honestyNote(): string {
  return "The on-device rule-based engine is for prototyping and testing, not production customer support. Grounding in your KB reduces but does not eliminate hallucination — always verify answers. For production, deploy your exported config (persona + KB + settings) to an LLM-backed backend, and use the optional 'Polish with LLM' (BYO key) to compare the rule-based answer against an LLM-grounded one.";
}
