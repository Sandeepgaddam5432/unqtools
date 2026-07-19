/**
 * AI Bias Checker for Articles — pure logic.
 *
 * Detect framing, loaded language, political lean, and sensationalism in
 * article text. Pure functions only — no DOM, no network. The optional LLM
 * call (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: this tool analyzes *language patterns*. It does NOT fact-check
 * claims or judge whether assertions are true. It rates the text, not the
 * outlet.
 */

// ---------- Types ----------

export type BiasCategory =
  | "left-lean"
  | "right-lean"
  | "loaded-verb"
  | "subjective-adj"
  | "weasel"
  | "hedge"
  | "absolutism"
  | "passive-evasion"
  | "clickbait";

export type LeanLabel =
  | "left"
  | "lean-left"
  | "center"
  | "lean-right"
  | "right";

export type SentenceType = "fact" | "opinion" | "mixed" | "neutral";

export type LlmProvider = "openai" | "anthropic";

export interface Phrase {
  category: BiasCategory;
  text: string;
  start: number;
  end: number;
  sentenceIndex: number;
  suggestion?: string;
}

export interface Sentence {
  index: number;
  text: string;
  start: number;
  end: number;
  phrases: Phrase[];
  type: SentenceType;
  emotionScore: number; // 0-100
  subjectivityScore: number; // 0-100
}

export interface BiasScores {
  politicalLean: number; // -100 (left) to +100 (right)
  leanLabel: LeanLabel;
  politicalConfidence: number; // 0-100
  emotional: number; // 0-100
  factual: number; // 0-100
  oneSidedness: number; // 0-100
  sensationalism: number; // 0-100
  overall: number; // 0-100 (degree of bias detected)
}

export interface Readability {
  fleschScore: number; // 0-100 (higher = easier)
  gradeLevel: number;
  label: string;
}

export interface BiasStats {
  wordCount: number;
  sentenceCount: number;
  phraseCount: number;
  byCategory: Record<BiasCategory, number>;
}

export interface BiasReport {
  input: string;
  sentences: Sentence[];
  phrases: Phrase[];
  scores: BiasScores;
  readability: Readability;
  factCount: number;
  opinionCount: number;
  mixedCount: number;
  neutralCount: number;
  clickbait: boolean;
  clickbaitReasons: string[];
  missingPerspectives: MissingPerspective[];
  neutralRewrite: string;
  reasoning: string[];
}

export interface MissingPerspective {
  label: string;
  cue: string;
  detected: boolean;
}

export interface HistoryEntry {
  ts: number;
  snippet: string;
  overall: number;
  leanLabel: LeanLabel;
}

export interface ShareState {
  text: string;
  sensitivity: Sensitivity;
}

export type Sensitivity = "low" | "medium" | "high";

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-bias-checker:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-bias-checker:llm-key";

export const CATEGORY_LABELS: Record<BiasCategory, string> = {
  "left-lean": "Left-leaning term",
  "right-lean": "Right-leaning term",
  "loaded-verb": "Loaded verb",
  "subjective-adj": "Subjective adjective",
  "weasel": "Weasel word",
  "hedge": "Hedge",
  "absolutism": "Absolutism",
  "passive-evasion": "Passive evasion",
  "clickbait": "Clickbait pattern",
};

export const CATEGORY_COLORS: Record<BiasCategory, string> = {
  "left-lean": "#2563eb",       // blue
  "right-lean": "#dc2626",      // red
  "loaded-verb": "#db2777",     // pink
  "subjective-adj": "#9333ea",  // purple
  "weasel": "#ca8a04",          // yellow
  "hedge": "#0891b2",           // cyan
  "absolutism": "#ea580c",      // orange
  "passive-evasion": "#65a30d", // lime
  "clickbait": "#e11d48",       // rose
};

export const LEAN_LABELS: Record<LeanLabel, string> = {
  "left": "Left",
  "lean-left": "Lean left",
  "center": "Center",
  "lean-right": "Lean right",
  "right": "Right",
};

export const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  "low": "Low (top phrases only)",
  "medium": "Medium (default)",
  "high": "High (every match)",
};

// Loaded verbs — emotionally charged replacements of neutral verbs.
// Map of stem → neutral suggestion. Conjugations are generated below.
const LOADED_VERB_STEMS: Record<string, string> = {
  "slam": "criticize",
  "smash": "defeat",
  "destroy": "defeat",
  "blast": "criticize",
  "rip": "criticize",
  "shred": "criticize",
  "hammer": "criticize",
  "torch": "criticize",
  "scorch": "criticize",
  "lambaste": "criticize",
  "savage": "strongly criticize",
  "demolish": "defeat",
  "annihilate": "defeat",
  "crush": "defeat",
  "obliterate": "defeat",
  "dupe": "mislead",
  "trick": "mislead",
  "brainwash": "persuade",
  "gut": "cut",
  "slash": "cut",
  "plunge": "fall",
  "skyrocket": "rise sharply",
  "plummet": "fall sharply",
  "erupt": "begin",
  "explode": "increase sharply",
  "fume": "express anger",
  "rant": "speak at length",
  "seethe": "be angry",
};

/** Build the full loaded-verbs map with regular conjugations (-s, -ed, -ing). */
export const LOADED_VERBS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [stem, sugg] of Object.entries(LOADED_VERB_STEMS)) {
    out[stem] = sugg;
    // -s form
    out[stem + "s"] = sugg.endsWith("y") ? sugg.slice(0, -1) + "ies" : sugg + "s";
    // -ed form. CVC doubling: ends in single consonant preceded by single vowel
    // and length > 2 (avoid "cut"→"cutted") → double the consonant.
    const cvc = /^[^aeiou]*[aeiou][^aeiouy]$/.test(stem) && stem.length > 2 && !/(w|x|y)$/.test(stem);
    const edStem = cvc ? stem + stem.slice(-1) + "ed" : stem + "ed";
    const edSugg = sugg.endsWith("e") ? sugg + "d" : (cvc && !sugg.endsWith("e") ? sugg + sugg.slice(-1) + "ed" : sugg + "ed");
    out[edStem] = edSugg;
    // -ing form. Same CVC doubling for short verbs ending in CVC.
    const ingStem = cvc ? stem + stem.slice(-1) + "ing" : (stem.endsWith("e") ? stem.slice(0, -1) + "ing" : stem + "ing");
    const ingSugg = sugg.endsWith("e") ? sugg.slice(0, -1) + "ing" : sugg + "ing";
    out[ingStem] = ingSugg;
  }
  return out;
})();

// Subjective adjectives — value-laden descriptors.
// Suggested replacement is either empty string (delete) or neutral wording.
export const SUBJECTIVE_ADJECTIVES: Record<string, string> = {
  "beautiful": "",
  "gorgeous": "",
  "stunning": "",
  "ugly": "",
  "horrible": "",
  "horrendous": "",
  "terrible": "",
  "awful": "",
  "dreadful": "",
  "atrocious": "",
  "appalling": "",
  "disgusting": "",
  "fabulous": "",
  "wonderful": "",
  "amazing": "",
  "extraordinary": "",
  "remarkable": "",
  "brilliant": "",
  "fantastic": "",
  "magnificent": "",
  "superb": "",
  "lousy": "poor",
  "pathetic": "weak",
  "disastrous": "problematic",
  "catastrophic": "severe",
  "devastating": "severe",
  "glorious": "",
  "shameful": "",
  "disgraceful": "",
  "outrageous": "",
  "scandalous": "",
  "ridiculous": "",
  "absurd": "",
  "ludicrous": "",
  "stupid": "",
  "idiotic": "",
  "genius": "",
  "evil": "",
  "perfect": "",
  "massive": "large",
  "huge": "large",
  "tiny": "small",
  "best": "",
  "worst": "",
  "greatest": "",
};

// Weasel words — attributions that imply support without specifics.
export const WEASEL_WORDS: string[] = [
  "some say", "some say that", "many say", "many believe",
  "many people", "many argue", "many think", "some people",
  "some argue", "some think", "some believe", "experts say",
  "experts believe", "experts agree", "critics say", "critics argue",
  "supporters say", "supporters argue", "opponents say", "opponents argue",
  "observers say", "observers note", "analysts say", "analysts note",
  "commentators say", "commentators note", "insiders say",
  "sources say", "sources say that", "sources told", "reports suggest",
  "reports indicate", "reportedly", "allegedly", "supposedly",
  "presumably", "purportedly", "reputedly", "rumored to",
  "widely believed", "widely considered", "widely regarded",
  "it is said", "it is believed", "it is widely believed",
  "it has been suggested", "people are saying",
];

// Hedges — uncertainty markers that weaken claims.
export const HEDGES: string[] = [
  "might", "could", "may", "perhaps", "possibly", "maybe",
  "potentially", "presumably", "probably", "likely",
  "seemingly", "apparently", "ostensibly", "in theory",
  "in a sense", "in some ways", "to some extent",
  "more or less", "sort of", "kind of", "almost",
  "roughly", "approximately", "around",
  "it seems", "it appears", "it would seem",
  "i think", "i believe", "i guess", "i suppose",
  "arguably", "conceivably", "supposedly",
];

// Absolutisms — universal quantifiers that brook no exception.
export const ABSOLUTISMS: string[] = [
  "always", "never", "everyone", "no one", "nobody",
  "everybody", "everything", "nothing", "all", "none",
  "completely", "totally", "absolutely", "entirely",
  "wholly", "utterly", "perfectly", "impossible",
  "inevitable", "unprecedented", "unique", "solely",
  "exclusively", "forever", "constantly", "perpetually",
];

// Left-leaning loaded terms (US political context).
// These signal progressive framing. The tool rates the text, not the outlet.
export const LEFT_LEAN_TERMS: string[] = [
  "progressive", "progressives", "social justice", "systemic racism",
  "white privilege", "white supremacy", "marginalized", "marginalized communities",
  "oppressed", "oppression", "equity", "inclusive", "inclusivity",
  "diversity", "decolonize", "decolonization", "patriarchy",
  "heteronormative", "cisgender", "binary", "nonbinary",
  "intersectionality", "microaggression", "gaslighting",
  "lived experience", "lived experiences", "restorative justice",
  "living wage", "universal healthcare", "medicare for all",
  "green new deal", "climate justice", "environmental justice",
  "gun control", "gun violence", "assault weapons ban",
  "wealth tax", "billionaire class", "corporate greed",
  "fatphobia", "ableism", "xenophobia", "transphobia",
  "homophobia", "islamophobia", "privilege",
];

// Right-leaning loaded terms (US political context).
// These signal conservative framing. The tool rates the text, not the outlet.
export const RIGHT_LEAN_TERMS: string[] = [
  "woke", "wokeness", "wokeism", "cancel culture", "cancelled",
  "political correctness", "politically correct", "pc culture",
  "virtue signaling", "socialism", "socialist", "marxist", "marxism",
  "communist", "communism", "leftist", "the left",
  "radical left", "far left", "deep state", "globalist", "globalism",
  "elites", "coastal elites", "establishment",
  "second amendment rights", "gun rights", "constitutional carry",
  "pro-life", "unborn", "religious liberty", "religious freedom",
  "traditional values", "family values", "law and order",
  "border crisis", "illegal aliens", "illegal immigrants",
  "open borders", "amnesty", "entitlements", "welfare queens",
  "free market", "free enterprise", "job creators",
  "death tax", "death taxes", "death panels",
  "mandates", "government overreach", "nanny state",
];

// Clickbait patterns — regexes matched case-insensitively.
export const CLICKBAIT_PATTERNS: RegExp[] = [
  /you won['']?t believe/i,
  /this one weird trick/i,
  /\bwhat happens next\b/i,
  /\bis (shocking|amazing|unbelievable|jaw-dropping)\b/i,
  /\bthe (only|real|true) reason\b/i,
  /\bdoctors (hate|hate this|don['']?t want you to know)\b/i,
  /\b(everyone|nobody) (is|is talking about|knows)\b/i,
  /\b\d+ things\b.*\byou\b/i,
  /\bhere['']?s why\b/i,
  /\bthe (truth|secret) about\b/i,
];

// Passive-evasion patterns — agency-removing constructions.
export const PASSIVE_EVASION_PATTERNS: RegExp[] = [
  /\bmistakes were made\b/i,
  /\berrors were (made|committed)\b/i,
  /\bit was decided that\b/i,
  /\bit has been suggested that\b/i,
  /\bit is widely (believed|known|understood) that\b/i,
  /\bregrettable\b/i,
  /\bunfortunate(ly)?\b/i,
  /\bactions were taken\b/i,
];

// Cues for fact classification — numerical, attribution, dates.
export const FACT_CUES: RegExp[] = [
  /\b\d+(\.\d+)?%/,        // percentages
  /\b\d{4}\b/,              // 4-digit years
  /\baccording to\b/i,
  /\bdata (shows|indicates|suggests)\b/i,
  /\bstatistics (show|indicate)\b/i,
  /\bstudy (found|shows|indicates)\b/i,
  /\bresearch (found|shows|indicates)\b/i,
  /\bsurvey (found|shows)\b/i,
  /\bpoll (found|shows)\b/i,
  /\breport (found|shows)\b/i,
  /\b\$?\d[\d,]*\b/,        // numbers
];

// Cues for opinion classification — value judgments, modals, first person.
export const OPINION_CUES: RegExp[] = [
  /\bi (think|believe|feel|reckon|guess)\b/i,
  /\bwe should\b/i,
  /\bgovernment should\b/i,
  /\bthey should\b/i,
  /\bmust\b/i,
  /\bought to\b/i,
  /\bshould\b/i,
  /\bneed to\b/i,
  /\bit is (clear|obvious|evident|apparent)\b/i,
  /\bin my (view|opinion)\b/i,
  /\bthe (best|worst) (way|approach|solution)\b/i,
];

// Attribution cues (presence boosts factual density).
export const ATTRIBUTION_CUES: RegExp[] = [
  /\baccording to\b/i,
  /\bsaid\b/i,
  /\bsays\b/i,
  /\btold\b/i,
  /\breported\b/i,
  /\bstated\b/i,
  /\bnoted\b/i,
  /\bexplained\b/i,
];

// Missing-perspective checklist.
export const MISSING_PERSPECTIVE_DEFS: ReadonlyArray<{ label: string; cue: RegExp }> = [
  { label: "Opposing viewpoint represented", cue: /\b(however|but|on the other hand|critics|opponents|dissent)\b/i },
  { label: "Statistical baseline or comparison", cue: /\b(compared to|up from|down from|prior year|baseline|average)\b/i },
  { label: "Expert dissent mentioned", cue: /\b(dissent|disagree|disputed|questioned|skeptic)\b/i },
  { label: "Affected community voices", cue: /\b(residents|workers|patients|families|community members|victims)\b/i },
  { label: "Historical context provided", cue: /\b(previously|historically|in the past|in 19\d{2}|in 20\d{2}|last (year|decade))\b/i },
  { label: "Methodological caveats noted", cue: /\b(survey|poll|sample|margin of error|sample size|limitation|caveat)\b/i },
];

// Stopwords for subjectivity/emotion scoring.
export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when",
  "at", "by", "for", "with", "about", "against", "between", "into",
  "through", "during", "before", "after", "above", "below", "to", "from",
  "up", "down", "in", "out", "on", "off", "over", "under", "again", "is",
  "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "should", "could", "may", "might",
  "must", "of", "as", "this", "that", "these", "those", "it", "its",
  "he", "she", "they", "we", "you", "i", "me", "him", "her", "us", "them",
  "my", "your", "their", "our", "his", "hers", "theirs", "ours",
]);

// ---------- Lexicon assembly ----------

export interface Lexicon {
  leftLean: string[];
  rightLean: string[];
  loadedVerbs: string[];
  subjectiveAdjectives: string[];
  weasel: string[];
  hedge: string[];
  absolutism: string[];
  clickbaitPatterns: RegExp[];
  passiveEvasionPatterns: RegExp[];
}

export function getLexicon(): Lexicon {
  return {
    leftLean: [...LEFT_LEAN_TERMS],
    rightLean: [...RIGHT_LEAN_TERMS],
    loadedVerbs: Object.keys(LOADED_VERBS),
    subjectiveAdjectives: Object.keys(SUBJECTIVE_ADJECTIVES),
    weasel: [...WEASEL_WORDS],
    hedge: [...HEDGES],
    absolutism: [...ABSOLUTISMS],
    clickbaitPatterns: [...CLICKBAIT_PATTERNS],
    passiveEvasionPatterns: [...PASSIVE_EVASION_PATTERNS],
  };
}

// ---------- Text utilities ----------

/** Split text into sentences with start/end offsets. */
export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  if (!text) return out;
  // Match sentences ending with ., ?, ! (optionally followed by closing quote).
  const re = /[^.!?]*[.!?]+["')\]]?\s*|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!raw) continue;
    const start = m.index;
    const end = start + raw.length;
    const clean = raw.trim();
    if (clean) out.push({ text: clean, start, end });
    if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-length loop
  }
  return out;
}

/** Tokenize a chunk of text into lowercase word tokens. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter(Boolean);
}

/** Count words (rough — splits on whitespace). */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Count syllables in a word (heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip silent 'e' at end (but not 'le' after consonant).
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
                    .replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

/** Escape regex special characters. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a case-insensitive word-boundary regex for a phrase. */
export function buildPhraseRegex(phrase: string): RegExp {
  // Phrases with internal spaces match as substrings; single words use \b.
  if (/\s/.test(phrase)) {
    return new RegExp(escapeRegex(phrase), "gi");
  }
  return new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
}

// ---------- Phrase detection ----------

/** Find all phrase matches for a given lexicon list within a text. */
export function findPhrases(
  text: string,
  sentences: { text: string; start: number; end: number }[],
  terms: string[],
  category: BiasCategory,
  suggestions?: Record<string, string>,
  sensitivity: Sensitivity = "medium",
): Phrase[] {
  const out: Phrase[] = [];
  if (!text || terms.length === 0) return out;
  for (const term of terms) {
    const re = buildPhraseRegex(term);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const sentenceIndex = sentenceIndexAt(sentences, start);
      out.push({
        category,
        text: m[0],
        start,
        end,
        sentenceIndex,
        suggestion: suggestions?.[term.toLowerCase()],
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  // In low sensitivity, keep only top N phrases by category counts.
  if (sensitivity === "low") {
    const counts = new Map<string, number>();
    for (const p of out) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    // Keep at most 5 per category.
    const seen = new Map<string, number>();
    return out.filter((p) => {
      const k = p.category;
      const n = (seen.get(k) ?? 0) + 1;
      seen.set(k, n);
      return n <= 5;
    });
  }
  return out;
}

/** Find regex-pattern matches (for clickbait and passive-evasion). */
export function findPatternPhrases(
  text: string,
  sentences: { text: string; start: number; end: number }[],
  patterns: RegExp[],
  category: BiasCategory,
): Phrase[] {
  const out: Phrase[] = [];
  if (!text) return out;
  for (const re of patterns) {
    const globalRe = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const sentenceIndex = sentenceIndexAt(sentences, start);
      out.push({
        category,
        text: m[0],
        start,
        end,
        sentenceIndex,
        suggestion: undefined,
      });
      if (m.index === globalRe.lastIndex) globalRe.lastIndex++;
    }
  }
  return out;
}

/** Determine which sentence a character offset belongs to. */
export function sentenceIndexAt(
  sentences: { start: number; end: number }[],
  offset: number,
): number {
  for (let i = 0; i < sentences.length; i++) {
    if (offset >= sentences[i].start && offset < sentences[i].end) return i;
  }
  // If offset is at the very end, attribute to last sentence.
  return sentences.length > 0 ? sentences.length - 1 : 0;
}

// ---------- Sentence classification ----------

/** Classify a sentence as fact / opinion / mixed / neutral based on cues. */
export function classifySentence(text: string): SentenceType {
  let factHits = 0;
  let opinionHits = 0;
  for (const re of FACT_CUES) if (re.test(text)) factHits++;
  for (const re of OPINION_CUES) if (re.test(text)) opinionHits++;
  if (factHits > 0 && opinionHits > 0) return "mixed";
  if (factHits > 0) return "fact";
  if (opinionHits > 0) return "opinion";
  return "neutral";
}

/** Score emotional charge (0-100) of a sentence. */
export function scoreEmotional(
  text: string,
  phrases: Phrase[],
): number {
  // Each loaded verb / subjective adjective / clickbait hit adds points.
  const intensifiers = phrases.filter(
    (p) =>
      p.category === "loaded-verb" ||
      p.category === "subjective-adj" ||
      p.category === "clickbait",
  ).length;
  const lean = phrases.filter(
    (p) => p.category === "left-lean" || p.category === "right-lean",
  ).length;
  const weasel = phrases.filter((p) => p.category === "weasel").length;
  // Caps ratio also signals emotional charge.
  const words = text.split(/\s+/).filter(Boolean);
  const capsWords = words.filter((w) => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  const capsRatio = words.length > 0 ? capsWords / words.length : 0;
  const exclamationCount = (text.match(/!/g) || []).length;
  let score = intensifiers * 18 + lean * 10 + weasel * 6;
  score += Math.min(20, capsRatio * 100);
  score += Math.min(15, exclamationCount * 8);
  return clamp(Math.round(score), 0, 100);
}

/** Score subjectivity (0-100) of a sentence. */
export function scoreSubjectivity(
  text: string,
  phrases: Phrase[],
): number {
  const subjective = phrases.filter(
    (p) =>
      p.category === "subjective-adj" ||
      p.category === "loaded-verb" ||
      p.category === "weasel" ||
      p.category === "absolutism" ||
      p.category === "passive-evasion",
  ).length;
  const words = tokenize(text).filter((w) => !STOPWORDS.has(w));
  const lean = phrases.filter(
    (p) => p.category === "left-lean" || p.category === "right-lean",
  ).length;
  let score = subjective * 15 + lean * 10;
  // First-person pronouns also boost subjectivity.
  const firstPerson = (text.match(/\b(i|me|my|we|us|our)\b/gi) || []).length;
  score += Math.min(20, firstPerson * 6);
  // Sentence with no factual cues and few content words is more subjective.
  const hasFactCue = FACT_CUES.some((re) => re.test(text));
  if (!hasFactCue) score += 10;
  // Normalize by word count so longer sentences aren't unfairly penalized.
  if (words.length > 0) {
    score = Math.round(score * Math.min(1.4, 6 / Math.sqrt(words.length)));
  }
  return clamp(score, 0, 100);
}

// ---------- Multi-axis scoring ----------

/** Compute political lean from phrases. Returns score + label + confidence. */
export function scorePoliticalLean(phrases: Phrase[]): {
  score: number;
  label: LeanLabel;
  confidence: number;
} {
  const leftHits = phrases.filter((p) => p.category === "left-lean").length;
  const rightHits = phrases.filter((p) => p.category === "right-lean").length;
  const total = leftHits + rightHits;
  if (total === 0) {
    return { score: 0, label: "center", confidence: 5 };
  }
  // Score: -100 (all left) to +100 (all right)
  const raw = ((rightHits - leftHits) / total) * 100;
  const score = Math.round(raw);
  let label: LeanLabel = "center";
  if (score <= -50) label = "left";
  else if (score < -15) label = "lean-left";
  else if (score <= 15) label = "center";
  else if (score < 50) label = "lean-right";
  else label = "right";
  // Confidence: more hits → higher confidence, balanced → lower.
  const balance = 1 - Math.abs(leftHits - rightHits) / Math.max(1, total);
  const volumeFactor = Math.min(1, total / 8);
  const confidence = Math.round((volumeFactor * 70 + (1 - balance) * 30));
  return { score, label, confidence: clamp(confidence, 0, 100) };
}

/** Compute factual density (0-100). Higher = more factual cues. */
export function scoreFactual(
  text: string,
  sentences: { text: string }[],
): number {
  if (sentences.length === 0) return 0;
  let facts = 0;
  let attribution = 0;
  for (const re of FACT_CUES) if (re.test(text)) facts++;
  for (const re of ATTRIBUTION_CUES) if (re.test(text)) attribution++;
  // Density normalized by sentence count.
  const density = (facts + attribution) / sentences.length;
  // Score 0-100: each fact cue per sentence contributes up to ~25 points.
  const score = Math.min(100, density * 50);
  return clamp(Math.round(score), 0, 100);
}

/** Compute one-sidedness (0-100). Higher = more one-sided. */
export function scoreOneSidedness(text: string, sentences: { text: string }[]): number {
  if (sentences.length === 0) return 0;
  const opposingCues = [
    /\b(however|but|on the other hand|although|though|whereas|while|yet)\b/i,
    /\b(critics|opponents|dissenters|skeptics|on the contrary|conversely)\b/i,
    /\b(some (argue|say|believe)|others (argue|say|believe))\b/i,
  ];
  let opposingHits = 0;
  for (const re of opposingCues) {
    const m = text.match(new RegExp(re.source, "gi"));
    if (m) opposingHits += m.length;
  }
  // No opposition at all → very one-sided.
  if (opposingHits === 0) return clamp(Math.min(100, 60 + sentences.length * 2), 0, 100);
  // Opposition density — fewer opposition cues per sentence = more one-sided.
  const ratio = opposingHits / sentences.length;
  const score = Math.max(0, 80 - ratio * 200);
  return clamp(Math.round(score), 0, 100);
}

/** Compute sensationalism (0-100). Higher = more sensational. */
export function scoreSensationalism(
  text: string,
  phrases: Phrase[],
): number {
  const clickbaitHits = phrases.filter((p) => p.category === "clickbait").length;
  const loadedHits = phrases.filter(
    (p) => p.category === "loaded-verb" || p.category === "subjective-adj",
  ).length;
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  const exclaim = (text.match(/!/g) || []).length;
  const ellipsis = (text.match(/\.\.\./g) || []).length;
  let score = clickbaitHits * 30 + loadedHits * 4;
  score += Math.min(20, capsWords * 4);
  score += Math.min(15, exclaim * 5);
  score += Math.min(10, ellipsis * 5);
  return clamp(Math.round(score), 0, 100);
}

/** Compute overall bias score (0-100) — weighted combination. */
export function scoreOverall(scores: Omit<BiasScores, "overall">): number {
  const leanMag = Math.abs(scores.politicalLean) * (scores.politicalConfidence / 100);
  const w = {
    lean: 0.25,
    emotional: 0.20,
    factual: 0.10,           // inverted — less factual = more biased
    oneSidedness: 0.20,
    sensationalism: 0.25,
  };
  const factualPenalty = (100 - scores.factual) / 100; // 0 = fully factual, 1 = no facts
  const raw =
    w.lean * leanMag +
    w.emotional * scores.emotional +
    w.factual * 100 * factualPenalty +
    w.oneSidedness * scores.oneSidedness +
    w.sensationalism * scores.sensationalism;
  return clamp(Math.round(raw), 0, 100);
}

/** Detect clickbait patterns in the text (whole-text level). */
export function detectClickbait(text: string, phrases: Phrase[]): {
  isClickbait: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const re of CLICKBAIT_PATTERNS) {
    if (re.test(text)) {
      reasons.push(`Pattern matched: "${re.source}"`);
    }
  }
  const clickbaitPhrases = phrases.filter((p) => p.category === "clickbait");
  if (clickbaitPhrases.length > 0) {
    reasons.push(`${clickbaitPhrases.length} clickbait phrase(s) detected inline`);
  }
  // ALL CAPS density check (title case for whole text).
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const capsWords = words.filter(
      (w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w),
    ).length;
    const ratio = capsWords / words.length;
    if (ratio > 0.3 && words.length < 30) {
      reasons.push(`${Math.round(ratio * 100)}% ALL CAPS density`);
    }
  }
  // Multiple exclamation marks.
  if (/\!{2,}/.test(text)) reasons.push("Multiple exclamation marks (!!)");
  return { isClickbait: reasons.length > 0, reasons };
}

// ---------- Readability ----------

/** Compute Flesch reading-ease score and grade level. */
export function computeReadability(text: string): Readability {
  const words = tokenize(text);
  const wordCount = words.length;
  const sentences = splitSentences(text);
  const sentenceCount = Math.max(1, sentences.length);
  if (wordCount === 0) {
    return { fleschScore: 0, gradeLevel: 0, label: "No text" };
  }
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const flesch = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount);
  const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllables / wordCount) - 15.59;
  const score = clamp(Math.round(flesch), 0, 100);
  let label: string;
  if (score >= 90) label = "Very easy (5th grade)";
  else if (score >= 80) label = "Easy (6th grade)";
  else if (score >= 70) label = "Fairly easy (7th grade)";
  else if (score >= 60) label = "Standard (8-9th grade)";
  else if (score >= 50) label = "Fairly hard (10-12th grade)";
  else if (score >= 30) label = "Difficult (college)";
  else label = "Very difficult (college graduate)";
  return {
    fleschScore: score,
    gradeLevel: clamp(Math.round(grade), 1, 16),
    label,
  };
}

// ---------- Missing perspectives ----------

/** Build the missing-perspective checklist with detection. */
export function findMissingPerspectives(text: string): MissingPerspective[] {
  return MISSING_PERSPECTIVE_DEFS.map((d) => ({
    label: d.label,
    cue: d.cue.source,
    detected: d.cue.test(text),
  }));
}

// ---------- Neutral rewrite ----------

/** Suggest a neutral replacement for a phrase. */
export function suggestNeutral(category: BiasCategory, text: string): string | undefined {
  const t = text.toLowerCase();
  if (category === "loaded-verb") return LOADED_VERBS[t];
  if (category === "subjective-adj") return SUBJECTIVE_ADJECTIVES[t] ?? "";
  if (category === "weasel") return "[who?]";
  if (category === "hedge") return "";
  if (category === "absolutism") return "often";
  if (category === "passive-evasion") return "[by whom?]";
  return undefined;
}

/** Apply neutral rewrite to a single sentence (returns rewritten sentence). */
export function neutralizeSentence(
  sentenceText: string,
  phrases: Phrase[],
): string {
  let result = sentenceText;
  // Sort phrases by start descending so replacements don't shift offsets.
  const sorted = [...phrases].sort((a, b) => b.start - a.start);
  for (const p of sorted) {
    const suggestion = p.suggestion ?? suggestNeutral(p.category, p.text);
    if (suggestion === undefined) continue;
    // Compute offset within this sentence (phrase.start is global).
    // We're operating on sentenceText alone, so search for the phrase text.
    const localIdx = result.toLowerCase().indexOf(p.text.toLowerCase());
    if (localIdx < 0) continue;
    const before = result.slice(0, localIdx);
    const after = result.slice(localIdx + p.text.length);
    if (suggestion === "") {
      // Remove the phrase + collapse surrounding whitespace.
      result = (before + " " + after).replace(/\s+/g, " ").trim();
    } else {
      result = before + suggestion + after;
    }
  }
  // Tidy: collapse double spaces, fix spacing before punctuation.
  return result
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Apply neutral rewrite to the full text. */
export function neutralizeText(
  sentences: Sentence[],
): string {
  return sentences
    .map((s) => (s.phrases.length > 0 ? neutralizeSentence(s.text, s.phrases) : s.text))
    .join(" ");
}

// ---------- Reasoning ----------

/** Build human-readable reasoning for the lean estimate. */
export function buildLeanReasoning(
  phrases: Phrase[],
  lean: { score: number; label: LeanLabel; confidence: number },
): string[] {
  const out: string[] = [];
  const leftHits = phrases.filter((p) => p.category === "left-lean");
  const rightHits = phrases.filter((p) => p.category === "right-lean");
  out.push(
    `Lean estimate: ${LEAN_LABELS[lean.label]} (${lean.score > 0 ? "+" : ""}${lean.score} on a −100 to +100 scale, confidence ${lean.confidence}%).`,
  );
  out.push(
    `Left-leaning terms found: ${leftHits.length}${leftHits.length ? " — " + unique(leftHits.map((p) => p.text.toLowerCase())).slice(0, 8).join(", ") : ""}.`,
  );
  out.push(
    `Right-leaning terms found: ${rightHits.length}${rightHits.length ? " — " + unique(rightHits.map((p) => p.text.toLowerCase())).slice(0, 8).join(", ") : ""}.`,
  );
  if (leftHits.length + rightHits.length === 0) {
    out.push("No strong political-vocabulary signals detected in this text.");
  }
  out.push(
    "Note: lean reflects loaded political vocabulary only — it does not rate the outlet, the topic, or the factual accuracy of the claims.",
  );
  return out;
}

// ---------- Main analysis ----------

/** Analyze an article for bias signals. Pure function — no side effects. */
export function analyze(text: string, sensitivity: Sensitivity = "medium"): BiasReport {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return emptyReport("");
  }
  const sentenceSpans = splitSentences(trimmed);
  const lex = getLexicon();

  // Collect phrase matches across all lexicons.
  const phrases: Phrase[] = [];
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.leftLean, "left-lean", undefined, sensitivity));
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.rightLean, "right-lean", undefined, sensitivity));
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.loadedVerbs, "loaded-verb", LOADED_VERBS, sensitivity));
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.subjectiveAdjectives, "subjective-adj", SUBJECTIVE_ADJECTIVES, sensitivity));
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.weasel, "weasel", undefined, sensitivity));
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.hedge, "hedge", undefined, sensitivity));
  phrases.push(...findPhrases(trimmed, sentenceSpans, lex.absolutism, "absolutism", undefined, sensitivity));
  phrases.push(...findPatternPhrases(trimmed, sentenceSpans, lex.passiveEvasionPatterns, "passive-evasion"));
  phrases.push(...findPatternPhrases(trimmed, sentenceSpans, lex.clickbaitPatterns, "clickbait"));

  // Sort phrases by start offset.
  phrases.sort((a, b) => a.start - b.start);

  // Build sentence objects.
  const sentences: Sentence[] = sentenceSpans.map((s, i) => {
    const sPhrases = phrases.filter((p) => p.sentenceIndex === i);
    const type = classifySentence(s.text);
    const emotionScore = scoreEmotional(s.text, sPhrases);
    const subjectivityScore = scoreSubjectivity(s.text, sPhrases);
    return {
      index: i,
      text: s.text,
      start: s.start,
      end: s.end,
      phrases: sPhrases,
      type,
      emotionScore,
      subjectivityScore,
    };
  });

  // Scores.
  const lean = scorePoliticalLean(phrases);
  const emotional = sentences.length > 0
    ? clamp(Math.round(sentences.reduce((s, x) => s + x.emotionScore, 0) / sentences.length), 0, 100)
    : 0;
  const factual = scoreFactual(trimmed, sentences);
  const oneSidedness = scoreOneSidedness(trimmed, sentences);
  const sensationalism = scoreSensationalism(trimmed, phrases);
  const overall = scoreOverall({
    politicalLean: lean.score,
    leanLabel: lean.label,
    politicalConfidence: lean.confidence,
    emotional,
    factual,
    oneSidedness,
    sensationalism,
  });

  const scores: BiasScores = {
    politicalLean: lean.score,
    leanLabel: lean.label,
    politicalConfidence: lean.confidence,
    emotional,
    factual,
    oneSidedness,
    sensationalism,
    overall,
  };

  // Sentence type counts.
  const factCount = sentences.filter((s) => s.type === "fact").length;
  const opinionCount = sentences.filter((s) => s.type === "opinion").length;
  const mixedCount = sentences.filter((s) => s.type === "mixed").length;
  const neutralCount = sentences.filter((s) => s.type === "neutral").length;

  // Clickbait.
  const cb = detectClickbait(trimmed, phrases);

  // Missing perspectives.
  const missingPerspectives = findMissingPerspectives(trimmed);

  // Readability.
  const readability = computeReadability(trimmed);

  // Neutral rewrite.
  const neutralRewrite = neutralizeText(sentences);

  // Reasoning.
  const reasoning = buildLeanReasoning(phrases, lean);

  return {
    input: trimmed,
    sentences,
    phrases,
    scores,
    readability,
    factCount,
    opinionCount,
    mixedCount,
    neutralCount,
    clickbait: cb.isClickbait,
    clickbaitReasons: cb.reasons,
    missingPerspectives,
    neutralRewrite,
    reasoning,
  };
}

// ---------- Stats helper ----------

export function computeStats(report: BiasReport): BiasStats {
  const byCategory = emptyCategoryRecord();
  for (const p of report.phrases) byCategory[p.category]++;
  return {
    wordCount: countWords(report.input),
    sentenceCount: report.sentences.length,
    phraseCount: report.phrases.length,
    byCategory,
  };
}

// ---------- Renderers ----------

/** Render report as Markdown. */
export function renderMarkdown(report: BiasReport): string {
  const stats = computeStats(report);
  const lines: string[] = [];
  lines.push("# Bias Report");
  lines.push("");
  lines.push(`**Overall bias score:** ${report.scores.overall}/100`);
  lines.push(`**Political lean:** ${LEAN_LABELS[report.scores.leanLabel]} (${report.scores.politicalLean > 0 ? "+" : ""}${report.scores.politicalLean}, confidence ${report.scores.politicalConfidence}%)`);
  lines.push(`**Emotional tone:** ${report.scores.emotional}/100`);
  lines.push(`**Factual density:** ${report.scores.factual}/100`);
  lines.push(`**One-sidedness:** ${report.scores.oneSidedness}/100`);
  lines.push(`**Sensationalism:** ${report.scores.sensationalism}/100`);
  lines.push("");
  lines.push(`**Readability:** ${report.readability.label} (Flesch ${report.readability.fleschScore}, grade ${report.readability.gradeLevel})`);
  lines.push("");
  lines.push(`**Sentences:** ${stats.sentenceCount} (${report.factCount} fact, ${report.opinionCount} opinion, ${report.mixedCount} mixed, ${report.neutralCount} neutral)`);
  lines.push(`**Words:** ${stats.wordCount}`);
  lines.push(`**Flagged phrases:** ${stats.phraseCount}`);
  lines.push("");
  if (report.clickbait) {
    lines.push("## Clickbait signals");
    for (const r of report.clickbaitReasons) lines.push(`- ${r}`);
    lines.push("");
  }
  lines.push("## Phrase counts by category");
  for (const cat of Object.keys(CATEGORY_LABELS) as BiasCategory[]) {
    lines.push(`- ${CATEGORY_LABELS[cat]}: ${stats.byCategory[cat]}`);
  }
  lines.push("");
  lines.push("## Missing-perspective checklist");
  for (const m of report.missingPerspectives) {
    lines.push(`- [${m.detected ? "x" : " "}] ${m.label}`);
  }
  lines.push("");
  lines.push("## Reasoning");
  for (const r of report.reasoning) lines.push(`- ${r}`);
  lines.push("");
  lines.push("## Flagged sentences");
  for (const s of report.sentences) {
    if (s.phrases.length === 0) continue;
    lines.push(`- _[${s.type}]_ ${s.text}`);
    for (const p of s.phrases) {
      lines.push(`  - **${CATEGORY_LABELS[p.category]}:** "${p.text}"${p.suggestion !== undefined ? ` → _${p.suggestion || "(remove)"}_` : ""}`);
    }
  }
  lines.push("");
  lines.push("## Neutral rewrite");
  lines.push(report.neutralRewrite || "_(no phrases to neutralize)_");
  return lines.join("\n");
}

/** Render report as JSON string. */
export function renderJson(report: BiasReport): string {
  return JSON.stringify(report, null, 2);
}

/** Render report as inline-highlighted HTML. */
export function renderHtml(report: BiasReport): string {
  if (!report.input) return "<p><em>No text</em></p>";
  // Walk the text and emit spans for each phrase.
  const parts: string[] = [];
  let cursor = 0;
  const sorted = [...report.phrases].sort((a, b) => a.start - b.start);
  for (const p of sorted) {
    if (p.start < cursor) continue; // overlap
    parts.push(escapeHtml(report.input.slice(cursor, p.start)));
    const color = CATEGORY_COLORS[p.category];
    const title = `${CATEGORY_LABELS[p.category]}${p.suggestion !== undefined ? ` → ${p.suggestion || "(remove)"}` : ""}`;
    parts.push(
      `<mark style="background:${color}33;color:${color};border-bottom:2px solid ${color};padding:0 2px;border-radius:2px" title="${escapeAttr(title)}">${escapeHtml(p.text)}</mark>`,
    );
    cursor = p.end;
  }
  parts.push(escapeHtml(report.input.slice(cursor)));
  return parts.join("");
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

export function buildShareUrl(text: string, sensitivity: Sensitivity): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (sensitivity !== "medium") params.set("sens", sensitivity);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", sensitivity: "medium" };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const sens = params.get("sens");
  const sensitivity: Sensitivity =
    sens === "low" || sens === "high" ? sens : "medium";
  return { text, sensitivity };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(text: string): string {
  return [
    "You are an expert media-literacy analyst. Analyze the article below for linguistic bias signals.",
    "Identify:",
    "- Loaded or emotive language (verbs, adjectives) — quote the exact phrase.",
    "- Weasel words, hedges, and absolutisms.",
    "- Framing and one-sided sourcing.",
    "- Passive-evasion ('mistakes were made').",
    "",
    "Output a JSON object with:",
    '- "lean": one of [left, lean-left, center, lean-right, right]',
    '- "leanConfidence": 0-100 integer',
    '- "emotionScore": 0-100 integer',
    '- "factualScore": 0-100 integer',
    '- "oneSidednessScore": 0-100 integer',
    '- "sensationalismScore": 0-100 integer',
    '- "flaggedPhrases": array of { "phrase": string, "category": string, "suggestion": string }',
    '- "missingPerspectives": array of strings (perspectives not represented)',
    '- "neutralRewrite": string (neutralized version of the article)',
    '- "reasoning": array of strings explaining the lean call',
    "",
    "Be honest about confidence. Do not judge whether the claims are true — only how they are phrased.",
    "",
    "ARTICLE:",
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
  const validLeans = new Set<LeanLabel>(["left", "lean-left", "center", "lean-right", "right"]);
  const lean = typeof o.lean === "string" && validLeans.has(o.lean as LeanLabel)
    ? (o.lean as LeanLabel)
    : "center";
  const num = (v: unknown, dflt: number) =>
    typeof v === "number" && !Number.isNaN(v) ? clamp(Math.round(v), 0, 100) : dflt;
  const flaggedPhrases = Array.isArray(o.flaggedPhrases)
    ? (o.flaggedPhrases as unknown[])
        .filter((x) => typeof x === "object" && x !== null)
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            phrase: typeof r.phrase === "string" ? r.phrase : "",
            category: typeof r.category === "string" ? r.category : "",
            suggestion: typeof r.suggestion === "string" ? r.suggestion : "",
          };
        })
    : [];
  const missingPerspectives = Array.isArray(o.missingPerspectives)
    ? (o.missingPerspectives as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const reasoning = Array.isArray(o.reasoning)
    ? (o.reasoning as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const result: LlmEnhancement = {
    lean,
    leanConfidence: num(o.leanConfidence, 50),
    emotionScore: num(o.emotionScore, 50),
    factualScore: num(o.factualScore, 50),
    oneSidednessScore: num(o.oneSidednessScore, 50),
    sensationalismScore: num(o.sensationalismScore, 50),
    flaggedPhrases,
    missingPerspectives,
    neutralRewrite: typeof o.neutralRewrite === "string" ? o.neutralRewrite : "",
    reasoning,
  };
  return { ok: true, result };
}

export interface LlmEnhancement {
  lean: LeanLabel;
  leanConfidence: number;
  emotionScore: number;
  factualScore: number;
  oneSidednessScore: number;
  sensationalismScore: number;
  flaggedPhrases: Array<{ phrase: string; category: string; suggestion: string }>;
  missingPerspectives: string[];
  neutralRewrite: string;
  reasoning: string[];
}

// ---------- Helpers ----------

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function emptyCategoryRecord(): Record<BiasCategory, number> {
  return {
    "left-lean": 0,
    "right-lean": 0,
    "loaded-verb": 0,
    "subjective-adj": 0,
    "weasel": 0,
    "hedge": 0,
    "absolutism": 0,
    "passive-evasion": 0,
    "clickbait": 0,
  };
}

function emptyReport(input: string): BiasReport {
  return {
    input,
    sentences: [],
    phrases: [],
    scores: {
      politicalLean: 0,
      leanLabel: "center",
      politicalConfidence: 0,
      emotional: 0,
      factual: 0,
      oneSidedness: 0,
      sensationalism: 0,
      overall: 0,
    },
    readability: { fleschScore: 0, gradeLevel: 0, label: "No text" },
    factCount: 0,
    opinionCount: 0,
    mixedCount: 0,
    neutralCount: 0,
    clickbait: false,
    clickbaitReasons: [],
    missingPerspectives: [],
    neutralRewrite: "",
    reasoning: [],
  };
}
