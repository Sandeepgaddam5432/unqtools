/**
 * AI Article Headline Generator — pure logic.
 *
 * Generate scored, A/B-ready article headlines from a topic or draft. Pure
 * functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type HeadlineFormula =
  | "how-to"
  | "list"
  | "question"
  | "bold-statement"
  | "number"
  | "contrarian"
  | "benefit"
  | "curiosity"
  | "how-long"
  | "secret";

export type EmotionalTrigger =
  | "curiosity"
  | "urgency"
  | "surprise"
  | "fear"
  | "joy"
  | "trust";

export type StylePreset =
  | "informative"
  | "provocative"
  | "listicle"
  | "newsy"
  | "evergreen";

export interface HeadlineVariation {
  id: string;
  text: string;
  formula: HeadlineFormula;
  style: StylePreset;
  wordCount: number;
  charCount: number;
  pixelWidth: number;
  powerWords: string[];
  emotionalTrigger: EmotionalTrigger | null;
  scores: {
    length: number;
    power: number;
    emotion: number;
    clickability: number;
    pixel: number;
    total: number;
  };
  clickbait: boolean;
  clickbaitReasons: string[];
  metaDescription: string;
  topic: string;
}

export interface ABPair {
  a: HeadlineVariation;
  b: HeadlineVariation;
  winner: "a" | "b" | "tie";
  reason: string;
}

export interface HeadlineStats {
  total: number;
  avgScore: number;
  avgPixelWidth: number;
  clickbaitCount: number;
  byFormula: Record<HeadlineFormula, number>;
  byTrigger: Record<EmotionalTrigger, number>;
  bestScore: number;
  worstScore: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-headline:history";
export const HISTORY_MAX = 20;

export const FORMULA_LABELS: Record<HeadlineFormula, string> = {
  "how-to": "How-To",
  "list": "Listicle",
  "question": "Question",
  "bold-statement": "Bold Statement",
  "number": "Number",
  "contrarian": "Contrarian",
  "benefit": "Benefit",
  "curiosity": "Curiosity Gap",
  "how-long": "How Long / How Much",
  "secret": "Secret / Insider",
};

export const TRIGGER_LABELS: Record<EmotionalTrigger, string> = {
  curiosity: "Curiosity",
  urgency: "Urgency",
  surprise: "Surprise",
  fear: "Fear / Loss",
  joy: "Joy / Gain",
  trust: "Trust / Authority",
};

export const STYLE_LABELS: Record<StylePreset, string> = {
  informative: "Informative",
  provocative: "Provocative",
  listicle: "Listicle",
  newsy: "Newsy",
  evergreen: "Evergreen",
};

export const TOPIC_PRESETS: string[] = [
  "How to start a podcast in 2025",
  "Best practices for remote team management",
  "Why most startups fail in the first year",
  "The complete guide to personal finance",
  "Beginner's guide to machine learning",
  "How to write a cover letter that gets interviews",
  "Tips for saving money on groceries",
  "The future of remote work",
];

// ---------- Power-word lexicon (200+) ----------

export const POWER_WORDS: string[] = [
  // Strong / impact
  "amazing", "astonishing", "awesome", "brilliant", "epic", "essential",
  "extraordinary", "fantastic", "incredible", "legendary", "mind-blowing",
  "miracle", "outstanding", "phenomenal", "powerful", "remarkable",
  "sensational", "spectacular", "stunning", "ultimate", "unbelievable",
  "unforgettable", "unique", "unmatched", "unrivaled", "wonderful",
  // Action / verbs
  "boost", "build", "create", "deliver", "destroy", "discover", "double",
  "eliminate", "enhance", "escape", "explode", "generate", "hack", "increase",
  "launch", "master", "multiply", "skyrocket", "stop", "transform", "unlock",
  // Curiosity / mystery
  "secret", "hidden", "untold", "revealed", "exposed", "mystery", "banned",
  "forbidden", "forgotten", "overlooked", "underrated", "shocking", "weird",
  "strange", "bizarre", "unexpected", "surprising",
  // Urgency / time
  "now", "today", "instant", "fast", "quick", "immediately", "urgent",
  "last-chance", "limited", "deadline", "before", "after", "finally",
  // Numbers / specificity
  "proven", "guaranteed", "scientific", "data-driven", "exact", "precise",
  "definitive", "complete", "step-by-step", "foolproof",
  // Trust / authority
  "expert", "official", "trusted", "verified", "authoritative",
  "exclusive", "insider", "professional", "vetted", "approved", "certified",
  // Benefit / value
  "free", "easy", "simple", "effortless", "save", "win", "profit",
  "money", "rich", "wealth", "success", "happy", "love", "beautiful",
  // Negative / fear
  "mistake", "fail", "failure", "danger", "warning", "risk", "avoid",
  "never", "worst", "toxic", "deadly", "disaster",
];

export const POWER_WORD_SET: Set<string> = new Set(POWER_WORDS);

// ---------- Emotional trigger lexicons ----------

export const EMOTIONAL_LEXICONS: Record<EmotionalTrigger, string[]> = {
  curiosity: ["secret", "hidden", "untold", "revealed", "exposed", "mystery",
    "banned", "forbidden", "forgotten", "overlooked", "underrated", "shocking",
    "weird", "strange", "bizarre", "unexpected", "surprising", "nobody",
    "everyone", "what", "why"],
  urgency: ["now", "today", "instant", "fast", "quick", "immediately", "urgent",
    "last-chance", "limited", "deadline", "before", "after", "finally",
    "hurry", "ends", "expires"],
  surprise: ["shocking", "unexpected", "surprising", "amazing", "astonishing",
    "unbelievable", "mind-blowing", "sensational", "sudden", "never",
    "actually", "really"],
  fear: ["mistake", "fail", "failure", "danger", "warning", "risk", "avoid",
    "never", "worst", "toxic", "deadly", "disaster", "scam", "trap",
    "warning", "lose", "loss"],
  joy: ["amazing", "awesome", "brilliant", "fantastic", "incredible", "love",
    "happy", "joy", "win", "success", "free", "beautiful", "wonderful",
    "delight", "magic"],
  trust: ["proven", "guaranteed", "scientific", "expert", "official", "trusted",
    "verified", "authoritative", "definitive", "exclusive", "insider",
    "professional", "vetted", "approved", "certified", "complete", "guide"],
};

// ---------- Clickbait lexicon / patterns ----------

const CLICKBAIT_PATTERNS: RegExp[] = [
  /\byou won'?t believe\b/i,
  /\bshocking\b.*\btruth\b/i,
  /\bthis one (simple|weird)\b/i,
  /\bwhat happens next\b/i,
  /\bdoctors hate\b/i,
  /\bthey don'?t want you to\b/i,
  /\bthe (only|real) reason\b/i,
];

const CLICKBAIT_WORDS = new Set([
  "shocking", "unbelievable", "insane", "crazy", "mind-blowing", "jaw-dropping",
  "you-wont-believe", "shock", "amaze",
]);

// ---------- Topic & draft utilities ----------

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "with", "and", "or",
  "is", "are", "be", "by", "as", "from", "that", "this", "it", "its", "into",
  "how", "what", "why", "when", "where", "which", "who", "do", "does", "did",
  "can", "could", "should", "would", "will", "may", "might", "must", "shall",
  "your", "you", "we", "they", "i", "me", "him", "her", "them", "us", "our",
  "their", "his", "hers", "my",
]);

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Extract keywords from a topic or draft (lowercase, no stopwords). */
export function extractKeywords(input: string): string[] {
  const n = normalizeTopic(input);
  if (!n) return [];
  const words = n
    .toLowerCase()
    .split(/[^a-z0-9+-]+/i)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  const out: string[] = [];
  for (const w of words) {
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/** Extract a primary subject from a topic (longest keyword). */
export function extractSubject(input: string): string {
  const kws = extractKeywords(input);
  if (kws.length === 0) return normalizeTopic(input).toLowerCase();
  // Pick the longest keyword (likely the noun phrase)
  return kws.slice().sort((a, b) => b.length - a.length)[0];
}

/** Summarize a draft into a short phrase by taking first sentence's keywords. */
export function summarizeDraft(draft: string, maxWords = 6): string {
  const firstSentence = normalizeTopic(draft).split(/[.!?]/)[0] || "";
  const kws = extractKeywords(firstSentence);
  return kws.slice(0, maxWords).join(" ");
}

// ---------- Pixel width estimator ----------
// Approximates Google's SERP title pixel width using average char widths.
// Uses ~8px per lowercase char, ~10px per uppercase char, ~5px per punctuation.
// No canvas required — pure function.

const CHAR_WIDTHS: Record<string, number> = {
  // Approximate average widths at 16px Arial Bold (Google's title font)
  a: 8, b: 8, c: 8, d: 8, e: 8, f: 5, g: 8, h: 8, i: 4, j: 4, k: 8, l: 4,
  m: 12, n: 8, o: 8, p: 8, q: 8, r: 5, s: 7, t: 5, u: 8, v: 7, w: 11, x: 7,
  y: 7, z: 7,
  " ": 4, ".": 4, ",": 4, "!": 4, "?": 5, "-": 5, ":": 4, ";": 4,
  "'": 3, '"': 6, "/": 4, "\\": 4, "|": 4, "@": 11, "#": 8, "$": 8,
  "%": 9, "&": 10, "*": 6, "(": 5, ")": 5, "[": 4, "]": 4,
};

const SERP_PIXEL_LIMIT = 580; // Google truncates ~580-600px

/** Estimate pixel width of a title at Google's title font size. */
export function estimatePixelWidth(text: string): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch >= "A" && ch <= "Z") {
      w += (CHAR_WIDTHS[ch.toLowerCase()] ?? 8) * 1.15; // uppercase slightly wider
    } else {
      w += CHAR_WIDTHS[ch] ?? 8;
    }
  }
  return Math.round(w);
}

/** Returns true if the title fits Google SERP without truncation. */
export function fitsSerp(text: string): boolean {
  return estimatePixelWidth(text) <= SERP_PIXEL_LIMIT;
}

// ---------- Formula templates ----------

interface FormulaTemplate {
  formula: HeadlineFormula;
  templates: string[]; // {subject} {keyword} {number}
  defaultTrigger: EmotionalTrigger;
}

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  {
    formula: "how-to",
    defaultTrigger: "trust",
    templates: [
      "How to {subject} (Step-by-Step Guide)",
      "How to {subject} in {n} Simple Steps",
      "The Complete Guide to {subject}",
      "How to Master {subject} This Year",
    ],
  },
  {
    formula: "list",
    defaultTrigger: "curiosity",
    templates: [
      "{n} {subject} Tips You Need to Know",
      "{n} Proven {subject} Strategies for {year}",
      "{n} {subject} Mistakes to Avoid",
      "Top {n} {subject} Tools for {year}",
    ],
  },
  {
    formula: "question",
    defaultTrigger: "curiosity",
    templates: [
      "Is {subject} Worth It? Here's the Truth",
      "What Is {subject}? A Beginner's Guide",
      "Why Does {subject} Matter?",
      "Should You Try {subject}? Pros and Cons",
    ],
  },
  {
    formula: "bold-statement",
    defaultTrigger: "surprise",
    templates: [
      "{subject} Is Changing Everything",
      "Stop Wasting Time on {subject}",
      "The Truth About {subject} Nobody Tells You",
      "{subject} Is Easier Than You Think",
    ],
  },
  {
    formula: "number",
    defaultTrigger: "trust",
    templates: [
      "{n}% of People Fail at {subject}. Here's Why",
      "{n} Days to Better {subject}",
      "The {n}-Minute {subject} Routine",
      "{n} {subject} Habits That Compound",
    ],
  },
  {
    formula: "contrarian",
    defaultTrigger: "surprise",
    templates: [
      "Why {subject} Is Overrated",
      "Forget Everything You Know About {subject}",
      "{subject}: The Conventional Wisdom Is Wrong",
      "Why You Should Stop Doing {subject}",
    ],
  },
  {
    formula: "benefit",
    defaultTrigger: "joy",
    templates: [
      "Get More From {subject} Today",
      "{subject}: Save Time and Money",
      "The Fastest Way to {subject}",
      "{subject} Made Easy",
    ],
  },
  {
    formula: "curiosity",
    defaultTrigger: "curiosity",
    templates: [
      "The Hidden Side of {subject}",
      "What Nobody Tells You About {subject}",
      "{subject}: The Untold Story",
      "The {subject} Secret Nobody Talks About",
    ],
  },
  {
    formula: "how-long",
    defaultTrigger: "urgency",
    templates: [
      "How Long Does {subject} Take?",
      "How Much Does {subject} Cost in {year}?",
      "How Fast Can You Learn {subject}?",
      "How Often Should You Do {subject}?",
    ],
  },
  {
    formula: "secret",
    defaultTrigger: "curiosity",
    templates: [
      "The {subject} Secret Pros Don't Share",
      "{subject}: An Insider's Guide",
      "What Experts Won't Tell You About {subject}",
      "The {subject} Hack Nobody Saw Coming",
    ],
  },
];

// ---------- Helpers ----------

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function titleCase(s: string): string {
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Title-case the subject unless it's already mixed-case (preserves acronyms). */
function smartCase(s: string): string {
  if (!s) return s;
  // If it contains uppercase letters already, preserve
  if (/[A-Z]/.test(s)) return s;
  return titleCase(s);
}

function fillTemplate(
  tpl: string,
  ctx: { subject: string; keyword: string; n: number; year: number },
): string {
  return tpl
    .replace(/\{subject\}/g, smartCase(ctx.subject))
    .replace(/\{keyword\}/g, smartCase(ctx.keyword))
    .replace(/\{n\}/g, String(ctx.n))
    .replace(/\{year\}/g, String(ctx.year));
}

function pickNumber(seed: number): number {
  const choices = [3, 5, 7, 9, 10, 12, 15, 21, 25, 50, 99, 100];
  return choices[Math.abs(seed) % choices.length];
}

function currentYear(): number {
  return new Date().getFullYear();
}

// ---------- Power word & emotion detection ----------

export function findPowerWords(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9+-]+/i).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (POWER_WORD_SET.has(w) && !out.includes(w)) out.push(w);
  }
  // Also detect hyphenated variants
  const phrase = lower;
  for (const pw of POWER_WORDS) {
    if (pw.includes("-") && phrase.includes(pw) && !out.includes(pw)) {
      out.push(pw);
    }
  }
  return out;
}

export function detectEmotionalTrigger(text: string): EmotionalTrigger | null {
  const lower = text.toLowerCase();
  const words = new Set(lower.split(/[^a-z0-9+-]+/i).filter(Boolean));
  const scores: Record<EmotionalTrigger, number> = {
    curiosity: 0, urgency: 0, surprise: 0, fear: 0, joy: 0, trust: 0,
  };
  for (const trigger of Object.keys(EMOTIONAL_LEXICONS) as EmotionalTrigger[]) {
    for (const w of EMOTIONAL_LEXICONS[trigger]) {
      if (words.has(w)) scores[trigger] += 1;
    }
  }
  // Detect formula cues (e.g., "how to" → trust)
  if (/\bhow to\b/i.test(text)) scores.trust += 1;
  if (/\bwhy\b/i.test(text)) scores.curiosity += 1;
  if (/\bsecret\b|\bhidden\b/i.test(text)) scores.curiosity += 2;
  if (/\bnow\b|\btoday\b/i.test(text)) scores.urgency += 1;
  // Pick the highest-scoring trigger
  let best: EmotionalTrigger | null = null;
  let bestScore = 0;
  for (const trigger of Object.keys(scores) as EmotionalTrigger[]) {
    if (scores[trigger] > bestScore) {
      bestScore = scores[trigger];
      best = trigger;
    }
  }
  return best;
}

// ---------- Clickbait detection ----------

export function detectClickbait(text: string): { isClickbait: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lower = text.toLowerCase();
  let patternMatch = false;
  for (const re of CLICKBAIT_PATTERNS) {
    if (re.test(text)) {
      reasons.push(`Pattern: "${re.source}"`);
      patternMatch = true;
    }
  }
  // Excessive power words
  const pws = findPowerWords(text);
  if (pws.length >= 3) {
    reasons.push(`Excessive power words (${pws.length}): ${pws.join(", ")}`);
  }
  // Excessive capitals (more than 40% uppercase letters)
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 0) {
    const upper = (letters.match(/[A-Z]/g) || []).length;
    if (upper / letters.length > 0.4 && text.length > 10) {
      reasons.push(`Excessive capitalization (${Math.round((upper / letters.length) * 100)}%)`);
    }
  }
  // Clickbait word set
  const words = lower.split(/[^a-z0-9+-]+/i).filter(Boolean);
  for (const w of words) {
    if (CLICKBAIT_WORDS.has(w)) {
      reasons.push(`Clickbait word: "${w}"`);
      break;
    }
  }
  // A single clickbait pattern is enough; otherwise require 2+ other reasons
  const isClickbait = patternMatch || reasons.length >= 2;
  return { isClickbait, reasons };
}

// ---------- Scoring ----------

export interface SubScores {
  length: number;
  power: number;
  emotion: number;
  clickability: number;
  pixel: number;
  total: number;
}

export function scoreLength(text: string): number {
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  let s = 50;
  // Char sweet spot: 50-60 (Google SERP display)
  if (chars >= 50 && chars <= 60) s = 100;
  else if (chars >= 40 && chars <= 70) s = 80;
  else if (chars < 30) s = 40;
  else if (chars > 80) s = 30;
  // Word sweet spot: 6-9
  if (words >= 6 && words <= 9) s = Math.max(s, 90);
  else if (words < 4) s = Math.min(s, 60);
  else if (words > 14) s = Math.min(s, 50);
  return s;
}

export function scorePower(text: string): number {
  const pws = findPowerWords(text);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const ratio = pws.length / words.length;
  // Sweet spot: 1-2 power words (10-25% density)
  if (pws.length === 0) return 40;
  if (pws.length === 1) return 80;
  if (pws.length === 2) return 100;
  if (pws.length === 3) return 70;
  return 40; // too many power words feels spammy
}

export function scoreEmotion(text: string): number {
  const trigger = detectEmotionalTrigger(text);
  if (!trigger) return 40;
  return 90;
}

export function scoreClickability(formula: HeadlineFormula, text: string): number {
  let s = 50;
  // Formula bonuses
  const formulaBonus: Record<HeadlineFormula, number> = {
    "how-to": 20,
    "list": 25,
    "question": 15,
    "bold-statement": 18,
    "number": 22,
    "contrarian": 25,
    "benefit": 18,
    "curiosity": 28,
    "how-long": 12,
    "secret": 24,
  };
  s += formulaBonus[formula];
  // Number in title adds clickability
  if (/\b\d+\b/.test(text)) s += 8;
  // "You" or "Your" adds personal clickability
  if (/\byou(r)?\b/i.test(text)) s += 8;
  // Brackets or parentheses add visual interest
  if (/[\[\(]/.test(text)) s += 5;
  return Math.max(0, Math.min(100, s));
}

export function scorePixel(text: string): number {
  const w = estimatePixelWidth(text);
  if (w <= SERP_PIXEL_LIMIT) return 100;
  if (w <= SERP_PIXEL_LIMIT + 60) return 70; // truncated slightly
  if (w <= SERP_PIXEL_LIMIT + 150) return 40; // truncated a lot
  return 20; // badly truncated
}

export function scoreHeadline(
  text: string,
  formula: HeadlineFormula,
): SubScores {
  const length = scoreLength(text);
  const power = scorePower(text);
  const emotion = scoreEmotion(text);
  const clickability = scoreClickability(formula, text);
  const pixel = scorePixel(text);
  // Weighted total: length × 0.25, power × 0.2, emotion × 0.2, clickability × 0.25, pixel × 0.1
  const total = Math.round(
    length * 0.25 + power * 0.2 + emotion * 0.2 + clickability * 0.25 + pixel * 0.1,
  );
  return { length, power, emotion, clickability, pixel, total };
}

// ---------- Meta description pairing ----------

const META_TARGET_LENGTH = 155;

export function generateMetaDescription(topic: string, formula: HeadlineFormula, keywords: string[]): string {
  const subject = smartCase(extractSubject(topic));
  const kw = keywords.slice(0, 3).map(smartCase).join(", ");
  const templates: Record<HeadlineFormula, string[]> = {
    "how-to": [
      `Learn how to ${subject.toLowerCase()} with our step-by-step guide. Practical tips and real examples.`,
      `A complete guide to ${subject.toLowerCase()}. Everything you need to know, in plain English.`,
    ],
    "list": [
      `Discover ${kw} tips and strategies that work. Save time and get better results.`,
      `The top ${kw} recommendations, tested and ranked. Find what fits your needs.`,
    ],
    "question": [
      `Is ${subject.toLowerCase()} right for you? We break down the pros, cons, and key questions to ask.`,
      `What you should know about ${subject.toLowerCase()}. A clear, no-hype overview.`,
    ],
    "bold-statement": [
      `Why ${subject.toLowerCase()} matters more than you think — and what to do about it.`,
      `The truth about ${subject.toLowerCase()}, minus the marketing spin.`,
    ],
    "number": [
      `The numbers behind ${subject.toLowerCase()} — what they mean and how to use them.`,
      `A data-driven look at ${subject.toLowerCase()}. Real figures, real takeaways.`,
    ],
    "contrarian": [
      `The conventional wisdom on ${subject.toLowerCase()} is wrong. Here's the evidence.`,
      `Why the popular take on ${subject.toLowerCase()} misses the point.`,
    ],
    "benefit": [
      `Get more from ${subject.toLowerCase()} with less effort. Practical, no-fluff advice.`,
      `Save time and money on ${subject.toLowerCase()}. Tips you can use today.`,
    ],
    "curiosity": [
      `The side of ${subject.toLowerCase()} nobody talks about — and why it matters.`,
      `What's really going on with ${subject.toLowerCase()}? We dug in so you don't have to.`,
    ],
    "how-long": [
      `How long ${subject.toLowerCase()} takes, how much it costs, and what to expect.`,
      `A practical look at the time and cost of ${subject.toLowerCase()}.`,
    ],
    "secret": [
      `The ${subject.toLowerCase()} approach insiders use — and how you can apply it.`,
      `What experts know about ${subject.toLowerCase()} that most people don't.`,
    ],
  };
  const options = templates[formula];
  let meta = options[0];
  // Truncate to ~155 chars at a word boundary
  if (meta.length > META_TARGET_LENGTH) {
    meta = meta.slice(0, META_TARGET_LENGTH);
    const lastSpace = meta.lastIndexOf(" ");
    if (lastSpace > 80) meta = meta.slice(0, lastSpace);
    meta = meta.replace(/[,;:\s]+$/, "") + "…";
  }
  return meta;
}

// ---------- Headline generation ----------

export interface GenerateOptions {
  topic: string;
  draft?: string;
  formulas?: HeadlineFormula[];
  style: StylePreset;
  max?: number;
  seed?: number;
}

export function generateHeadlines(opts: GenerateOptions): HeadlineVariation[] {
  const topic = normalizeTopic(opts.topic);
  if (!topic) return [];
  const formulas = opts.formulas && opts.formulas.length > 0
    ? opts.formulas
    : (Object.keys(FORMULA_LABELS) as HeadlineFormula[]);
  const subject = extractSubject(opts.draft && opts.draft.length > 20 ? opts.draft : topic);
  const keywords = extractKeywords(opts.draft && opts.draft.length > 20 ? opts.draft : topic);
  const keyword = keywords[0] ?? subject;
  const max = opts.max ?? 12;
  const year = currentYear();
  const seed = opts.seed ?? simpleHash(topic);
  const out: HeadlineVariation[] = [];
  let idx = 0;
  for (const formula of formulas) {
    const tplEntry = FORMULA_TEMPLATES.find((t) => t.formula === formula);
    if (!tplEntry) continue;
    for (const tpl of tplEntry.templates) {
      if (out.length >= max) break;
      const n = pickNumber(seed + idx);
      const text = fillTemplate(tpl, { subject, keyword, n, year });
      const powerWords = findPowerWords(text);
      const emotionalTrigger = detectEmotionalTrigger(text);
      const scores = scoreHeadline(text, formula);
      const clickbait = detectClickbait(text);
      const meta = generateMetaDescription(topic, formula, keywords);
      out.push({
        id: `h-${simpleHash(`${topic}|${formula}|${idx}`).toString(36)}`,
        text,
        formula,
        style: opts.style,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
        pixelWidth: estimatePixelWidth(text),
        powerWords,
        emotionalTrigger,
        scores,
        clickbait: clickbait.isClickbait,
        clickbaitReasons: clickbait.reasons,
        metaDescription: meta,
        topic,
      });
      idx++;
    }
    if (out.length >= max) break;
  }
  // Sort by total score descending
  out.sort((a, b) => b.scores.total - a.scores.total);
  return out;
}

// ---------- A/B pair picker ----------

export function pickABPair(variations: HeadlineVariation[]): ABPair | null {
  if (variations.length < 2) return null;
  // Pick the top-scoring headline and a contrasting one (different formula, lower score)
  const a = variations[0];
  let b: HeadlineVariation | null = null;
  for (const v of variations.slice(1)) {
    if (v.formula !== a.formula) {
      b = v;
      break;
    }
  }
  if (!b) b = variations[1];
  let winner: "a" | "b" | "tie" = "tie";
  let reason = "Both score equally — A/B test in the wild.";
  if (a.scores.total > b.scores.total) {
    winner = "a";
    reason = `A scores ${a.scores.total} vs B's ${b.scores.total}. Higher clickability and power-word balance.`;
  } else if (b.scores.total > a.scores.total) {
    winner = "b";
    reason = `B scores ${b.scores.total} vs A's ${a.scores.total}. Better emotional trigger or length fit.`;
  }
  return { a, b, winner, reason };
}

// ---------- Stats ----------

export function computeStats(variations: HeadlineVariation[]): HeadlineStats {
  const byFormula = {} as Record<HeadlineFormula, number>;
  const byTrigger = {} as Record<EmotionalTrigger, number>;
  for (const f of Object.keys(FORMULA_LABELS) as HeadlineFormula[]) byFormula[f] = 0;
  for (const t of Object.keys(TRIGGER_LABELS) as EmotionalTrigger[]) byTrigger[t] = 0;

  let totalScore = 0;
  let totalPixel = 0;
  let clickbaitCount = 0;
  let best = 0;
  let worst = 100;

  for (const v of variations) {
    byFormula[v.formula] += 1;
    if (v.emotionalTrigger) byTrigger[v.emotionalTrigger] += 1;
    totalScore += v.scores.total;
    totalPixel += v.pixelWidth;
    if (v.clickbait) clickbaitCount += 1;
    if (v.scores.total > best) best = v.scores.total;
    if (v.scores.total < worst) worst = v.scores.total;
  }

  return {
    total: variations.length,
    avgScore: variations.length > 0 ? Math.round(totalScore / variations.length) : 0,
    avgPixelWidth: variations.length > 0 ? Math.round(totalPixel / variations.length) : 0,
    clickbaitCount,
    byFormula,
    byTrigger,
    bestScore: best,
    worstScore: variations.length > 0 ? worst : 0,
  };
}

// ---------- Renderers ----------

export function renderText(variations: HeadlineVariation[]): string {
  return variations.map((v) => {
    const lines = [
      `[${v.scores.total}/100] ${v.text}`,
      `  formula: ${FORMULA_LABELS[v.formula]} | trigger: ${v.emotionalTrigger ? TRIGGER_LABELS[v.emotionalTrigger] : "none"} | ${v.charCount} chars | ${v.pixelWidth}px | ${v.wordCount} words`,
      v.clickbait ? `  ⚠ clickbait: ${v.clickbaitReasons.join("; ")}` : "",
      `  meta: ${v.metaDescription}`,
      "",
    ];
    return lines.filter(Boolean).join("\n");
  }).join("\n");
}

export function renderMarkdown(variations: HeadlineVariation[]): string {
  return variations.map((v, i) => {
    const lines = [
      `### ${i + 1}. ${v.text}`,
      "",
      `- **Score:** ${v.scores.total}/100 (length ${v.scores.length}, power ${v.scores.power}, emotion ${v.scores.emotion}, clickability ${v.scores.clickability}, pixel ${v.scores.pixel})`,
      `- **Formula:** ${FORMULA_LABELS[v.formula]}`,
      `- **Emotional trigger:** ${v.emotionalTrigger ? TRIGGER_LABELS[v.emotionalTrigger] : "none"}`,
      `- **Length:** ${v.charCount} chars / ${v.wordCount} words / ${v.pixelWidth}px`,
      `- **Power words:** ${v.powerWords.length > 0 ? v.powerWords.join(", ") : "none"}`,
      v.clickbait ? `- ⚠ **Clickbait warning:** ${v.clickbaitReasons.join("; ")}` : "",
      `- **Meta description:** ${v.metaDescription}`,
      "",
    ];
    return lines.filter((l) => l !== "").join("\n");
  }).join("\n---\n\n");
}

export function renderJson(variations: HeadlineVariation[]): string {
  return JSON.stringify(variations, null, 2);
}

export function renderCsv(variations: HeadlineVariation[]): string {
  const lines = ["text,formula,style,trigger,score,length_score,power_score,emotion_score,clickability_score,pixel_score,char_count,word_count,pixel_width,clickbait,power_words,meta_description"];
  for (const v of variations) {
    lines.push([
      escapeCsv(v.text),
      v.formula,
      v.style,
      v.emotionalTrigger ?? "",
      String(v.scores.total),
      String(v.scores.length),
      String(v.scores.power),
      String(v.scores.emotion),
      String(v.scores.clickability),
      String(v.scores.pixel),
      String(v.charCount),
      String(v.wordCount),
      String(v.pixelWidth),
      v.clickbait ? "yes" : "no",
      escapeCsv(v.powerWords.join("; ")),
      escapeCsv(v.metaDescription),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  topic: string;
  count: number;
  avgScore: number;
  bestScore: number;
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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  topic: string;
  draft?: string;
  formulas: HeadlineFormula[];
  style: StylePreset;
  max?: number;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.topic) params.set("t", state.topic);
  if (state.draft) params.set("d", state.draft);
  if (state.formulas.length > 0) params.set("f", state.formulas.join(","));
  if (state.style) params.set("s", state.style);
  if (state.max) params.set("m", String(state.max));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const t = params.get("t");
  if (t) out.topic = t;
  const d = params.get("d");
  if (d) out.draft = d;
  const f = params.get("f");
  if (f) {
    const valid = Object.keys(FORMULA_LABELS) as HeadlineFormula[];
    out.formulas = f.split(",").filter((x) => valid.includes(x as HeadlineFormula)) as HeadlineFormula[];
  }
  const s = params.get("s") as StylePreset | null;
  if (s && s in STYLE_LABELS) out.style = s;
  const m = params.get("m");
  if (m) {
    const n = parseInt(m, 10);
    if (!isNaN(n) && n > 0) out.max = n;
  }
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  topic: string,
  draft: string,
  formulas: HeadlineFormula[],
  style: StylePreset,
): string {
  const formulaList = formulas.map((f) => FORMULA_LABELS[f]).join(", ") || "(any)";
  const powerWordsSample = POWER_WORDS.slice(0, 20).join(", ");
  return [
    "You are an expert copywriter who writes high-converting article headlines.",
    `Topic: ${topic}.`,
    draft ? `Draft excerpt (for context):\n${draft.slice(0, 500)}` : "",
    `Style: ${STYLE_LABELS[style]}.`,
    `Headline formulas to use: ${formulaList}.`,
    "",
    "Generate 10 distinct headlines. For each, output a JSON object with:",
    '- "text": the headline (50-60 chars target)',
    '- "formula": one of [how-to, list, question, bold-statement, number, contrarian, benefit, curiosity, how-long, secret]',
    '- "metaDescription": 140-155 char meta description',
    "",
    "Reference power words (use sparingly):",
    powerWordsSample,
    "",
    "Rules:",
    "- Avoid clickbait patterns like 'you won't believe', 'this one weird trick'.",
    "- Each headline must be specific (include a number, name, or concrete noun).",
    "- Vary the formula across the 10 headlines.",
    "- Output ONLY a JSON array of objects — no markdown fences, no commentary.",
  ].filter(Boolean).join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; headlines: Array<{ text: string; formula: HeadlineFormula; metaDescription: string }> }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let arr: unknown;
  try {
    arr = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (!Array.isArray(arr)) {
    return { ok: false, error: "LLM output was not a JSON array." };
  }
  const validFormulas = new Set(Object.keys(FORMULA_LABELS));
  const out: Array<{ text: string; formula: HeadlineFormula; metaDescription: string }> = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    const formula = typeof o.formula === "string" && validFormulas.has(o.formula)
      ? (o.formula as HeadlineFormula)
      : "bold-statement";
    const metaDescription = typeof o.metaDescription === "string" ? o.metaDescription : "";
    if (!text) continue;
    out.push({ text, formula, metaDescription });
  }
  if (out.length === 0) {
    return { ok: false, error: "LLM output contained no valid headline objects." };
  }
  return { ok: true, headlines: out };
}
