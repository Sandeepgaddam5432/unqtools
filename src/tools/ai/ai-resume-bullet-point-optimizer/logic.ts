/**
 * AI Resume Bullet Point Optimizer — pure logic.
 *
 * Bullet point formula: Action verb + Task + Result + Metric. Weak-phrase
 * detector, passive-voice flag, strong verb alternatives, JD keyword match,
 * per-bullet strength score (0–100), STAR framing, tense check, 2–3 rewrites
 * per bullet, bulk optimize.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type VerbCategory =
  | "leadership"
  | "technical"
  | "communication"
  | "analytical"
  | "creative"
  | "operational";

export interface ActionVerb {
  verb: string;          // base form, lowercase, no space (e.g. "led", "built")
  category: VerbCategory;
}

export interface WeakPhraseMatch {
  phrase: string;
  start: number;
  end: number;
  alternative: string;   // suggested replacement
}

export interface MetricMatch {
  raw: string;           // "25%", "$1.2M", "3x", "50 users"
  start: number;
  end: number;
  kind: "percent" | "currency" | "multiplier" | "count" | "time" | "raw";
}

export interface VerbMatch {
  verb: string;          // matched verb as it appears (e.g. "Led", "Built")
  base: string;          // canonical base form (e.g. "led")
  position: number;
  category: VerbCategory;
}

export interface JdKeywordResult {
  matched: string[];
  missing: string[];
  density: number;       // matched / total JD keywords
}

export interface StrengthScore {
  score: number;         // 0–100
  signals: {
    startsWithStrongVerb: boolean;
    hasMetric: boolean;
    isActiveVoice: boolean;
    isPastTense: boolean;
    lengthOk: boolean;
  };
  maxPossible: number;   // 100
}

export interface StarAnalysis {
  hasSituation: boolean;
  hasTask: boolean;
  hasAction: boolean;
  hasResult: boolean;
  complete: boolean;
}

export interface BulletAnalysis {
  original: string;
  normalized: string;
  verbs: VerbMatch[];
  weakPhrases: WeakPhraseMatch[];
  metrics: MetricMatch[];
  passive: { detected: boolean; examples: string[] };
  tense: "past" | "present" | "mixed" | "unknown";
  score: StrengthScore;
  star: StarAnalysis;
  jdKeywords: JdKeywordResult;
  diagnostics: string[];
  rewrites: string[];
}

export interface BulkResult {
  bullets: BulletAnalysis[];
  tenseConsistent: boolean;
  averageScore: number;
  weakBullets: number;
  totalJdGaps: string[];
}

export interface HistoryEntry {
  ts: number;
  bulletCount: number;
  averageScore: number;
  preview: string;       // first bullet preview
}

export interface ShareState {
  bullets: string;
  jd: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-resume-bullet-point-optimizer:history";
export const HISTORY_MAX = 20;

export const VERB_CATEGORY_LABELS: Record<VerbCategory, string> = {
  leadership: "Leadership",
  technical: "Technical",
  communication: "Communication",
  analytical: "Analytical",
  creative: "Creative",
  operational: "Operational",
};

/** 200+ action verbs across six categories. */
export const ACTION_VERBS: ActionVerb[] = [
  // Leadership
  { verb: "led", category: "leadership" },
  { verb: "directed", category: "leadership" },
  { verb: "managed", category: "leadership" },
  { verb: "supervised", category: "leadership" },
  { verb: "spearheaded", category: "leadership" },
  { verb: "orchestrated", category: "leadership" },
  { verb: "championed", category: "leadership" },
  { verb: "founded", category: "leadership" },
  { verb: "established", category: "leadership" },
  { verb: "launched", category: "leadership" },
  { verb: "drove", category: "leadership" },
  { verb: "steered", category: "leadership" },
  { verb: "oversaw", category: "leadership" },
  { verb: "headed", category: "leadership" },
  { verb: "mentored", category: "leadership" },
  { verb: "coached", category: "leadership" },
  { verb: "recruited", category: "leadership" },
  { verb: "empowered", category: "leadership" },
  { verb: "unified", category: "leadership" },
  { verb: "galvanized", category: "leadership" },
  { verb: "mobilized", category: "leadership" },
  { verb: "sponsored", category: "leadership" },
  { verb: "negotiated", category: "leadership" },
  { verb: "influenced", category: "leadership" },
  { verb: "persuaded", category: "leadership" },
  { verb: "aligned", category: "leadership" },
  { verb: "mobilised", category: "leadership" },
  // Technical
  { verb: "built", category: "technical" },
  { verb: "developed", category: "technical" },
  { verb: "engineered", category: "technical" },
  { verb: "architected", category: "technical" },
  { verb: "designed", category: "technical" },
  { verb: "implemented", category: "technical" },
  { verb: "deployed", category: "technical" },
  { verb: "programmed", category: "technical" },
  { verb: "coded", category: "technical" },
  { verb: "debugged", category: "technical" },
  { verb: "optimized", category: "technical" },
  { verb: "refactored", category: "technical" },
  { verb: "automated", category: "technical" },
  { verb: "configured", category: "technical" },
  { verb: "integrated", category: "technical" },
  { verb: "migrated", category: "technical" },
  { verb: "tested", category: "technical" },
  { verb: "validated", category: "technical" },
  { verb: "prototyped", category: "technical" },
  { verb: "instrumented", category: "technical" },
  { verb: "scaled", category: "technical" },
  { verb: "shipped", category: "technical" },
  { verb: "released", category: "technical" },
  { verb: "optimized", category: "technical" },
  { verb: "tuned", category: "technical" },
  { verb: "modelled", category: "technical" },
  { verb: "modeled", category: "technical" },
  { verb: "trained", category: "technical" },
  { verb: "parsed", category: "technical" },
  { verb: "extracted", category: "technical" },
  // Communication
  { verb: "presented", category: "communication" },
  { verb: "wrote", category: "communication" },
  { verb: "authored", category: "communication" },
  { verb: "edited", category: "communication" },
  { verb: "published", category: "communication" },
  { verb: "documented", category: "communication" },
  { verb: "pitched", category: "communication" },
  { verb: "facilitated", category: "communication" },
  { verb: "moderated", category: "communication" },
  { verb: "spoke", category: "communication" },
  { verb: "taught", category: "communication" },
  { verb: "trained", category: "communication" },
  { verb: "briefed", category: "communication" },
  { verb: "communicated", category: "communication" },
  { verb: "articulated", category: "communication" },
  { verb: "advocated", category: "communication" },
  { verb: "translated", category: "communication" },
  { verb: "summarized", category: "communication" },
  { verb: "drafted", category: "communication" },
  { verb: "promoted", category: "communication" },
  // Analytical
  { verb: "analyzed", category: "analytical" },
  { verb: "analysed", category: "analytical" },
  { verb: "researched", category: "analytical" },
  { verb: "investigated", category: "analytical" },
  { verb: "evaluated", category: "analytical" },
  { verb: "assessed", category: "analytical" },
  { verb: "measured", category: "analytical" },
  { verb: "quantified", category: "analytical" },
  { verb: "forecast", category: "analytical" },
  { verb: "projected", category: "analytical" },
  { verb: "estimated", category: "analytical" },
  { verb: "modeled", category: "analytical" },
  { verb: "benchmarked", category: "analytical" },
  { verb: "audited", category: "analytical" },
  { verb: "diagnosed", category: "analytical" },
  { verb: "tracked", category: "analytical" },
  { verb: "monitored", category: "analytical" },
  { verb: "identified", category: "analytical" },
  { verb: "discovered", category: "analytical" },
  { verb: "inspected", category: "analytical" },
  { verb: "examined", category: "analytical" },
  { verb: "surveyed", category: "analytical" },
  // Creative
  { verb: "designed", category: "creative" },
  { verb: "created", category: "creative" },
  { verb: "crafted", category: "creative" },
  { verb: "conceptualized", category: "creative" },
  { verb: "ideated", category: "creative" },
  { verb: "illustrated", category: "creative" },
  { verb: "animated", category: "creative" },
  { verb: "composed", category: "creative" },
  { verb: "filmed", category: "creative" },
  { verb: "photographed", category: "creative" },
  { verb: "branded", category: "creative" },
  { verb: "styled", category: "creative" },
  { verb: "rendered", category: "creative" },
  { verb: "animated", category: "creative" },
  { verb: "invented", category: "creative" },
  { verb: "pioneered", category: "creative" },
  { verb: "innovated", category: "creative" },
  { verb: "reimagined", category: "creative" },
  // Operational
  { verb: "streamlined", category: "operational" },
  { verb: "reorganized", category: "operational" },
  { verb: "coordinated", category: "operational" },
  { verb: "organized", category: "operational" },
  { verb: "executed", category: "operational" },
  { verb: "delivered", category: "operational" },
  { verb: "produced", category: "operational" },
  { verb: "maintained", category: "operational" },
  { verb: "improved", category: "operational" },
  { verb: "reduced", category: "operational" },
  { verb: "increased", category: "operational" },
  { verb: "cut", category: "operational" },
  { verb: "saved", category: "operational" },
  { verb: "accelerated", category: "operational" },
  { verb: "eliminated", category: "operational" },
  { verb: "consolidated", category: "operational" },
  { verb: "standardized", category: "operational" },
  { verb: "scheduled", category: "operational" },
  { verb: "procured", category: "operational" },
  { verb: "administered", category: "operational" },
  { verb: "operated", category: "operational" },
  { verb: "supported", category: "operational" },
  { verb: "facilitated", category: "operational" },
];

/** Weak phrases with strong alternatives. Lowercase. */
export const WEAK_PHRASES: { phrase: string; alternative: string }[] = [
  { phrase: "responsible for", alternative: "owned, led, directed" },
  { phrase: "worked on", alternative: "built, engineered, developed" },
  { phrase: "helped with", alternative: "drove, delivered, contributed to" },
  { phrase: "tasked with", alternative: "led, executed, owned" },
  { phrase: "in charge of", alternative: "led, directed, oversaw" },
  { phrase: "assisted with", alternative: "delivered, contributed to, supported" },
  { phrase: "involved in", alternative: "drove, contributed to, owned" },
  { phrase: "participated in", alternative: "contributed to, collaborated on, drove" },
  { phrase: "handled", alternative: "managed, executed, owned" },
  { phrase: "did", alternative: "executed, delivered, performed" },
  { phrase: "made", alternative: "built, created, designed" },
  { phrase: "got", alternative: "achieved, secured, attained" },
  { phrase: "put together", alternative: "built, assembled, orchestrated" },
  { phrase: "took care of", alternative: "owned, managed, administered" },
  { phrase: "was tasked with", alternative: "led, owned, executed" },
  { phrase: "duties included", alternative: "delivered, executed, owned" },
  { phrase: "responsibilities included", alternative: "owned, led, drove" },
];

/** Passive voice indicators — past participle after a 'be' verb. */
export const BE_VERBS = ["is", "are", "was", "were", "be", "been", "being", "am"];
/** Past-participle patterns often misused in passive bullets. */
export const PASSIVE_PATTERNS = [
  "was responsible for", "were responsible for",
  "was tasked with", "were tasked with",
  "was involved in", "were involved in",
  "was assigned to", "were assigned to",
  "was asked to", "were asked to",
  "was given", "were given",
  "was asked", "were asked",
];

/** Past tense verb endings (regular). */
const PAST_ENDINGS = /^(?:\w+)(?:ed|ied|pped|nned|tted|lled|rred|ssed)$/i;

/** Strong verb alternatives keyed by category for rewrite generation. */
export const STRONG_VERB_POOL: Record<VerbCategory, string[]> = {
  leadership: ["Led", "Spearheaded", "Orchestrated", "Drove", "Directed", "Championed"],
  technical: ["Built", "Engineered", "Architected", "Deployed", "Implemented", "Scaled"],
  communication: ["Presented", "Authored", "Pitched", "Facilitated", "Articulated", "Drafted"],
  analytical: ["Analyzed", "Evaluated", "Modeled", "Benchmarked", "Forecast", "Quantified"],
  creative: ["Designed", "Crafted", "Conceptualized", "Innovated", "Reimagined", "Pioneered"],
  operational: ["Streamlined", "Delivered", "Accelerated", "Reduced", "Consolidated", "Optimized"],
};

export const SAMPLE_BULLETS: string[] = [
  "Responsible for managing a team of 5 engineers and delivering the product roadmap.",
  "Worked on the migration of the legacy monolith to microservices, resulting in faster deploys.",
  "Helped with onboarding new customers and reduced churn by 15%.",
  "Led a cross-functional initiative that cut deployment time by 60% and saved $120K annually.",
  "Was tasked with redesigning the checkout flow which increased conversion by 22%.",
];

export const SAMPLE_JD: string =
  "We are looking for a Senior Product Manager with experience in roadmapping, stakeholder management, A/B testing, user research, and SQL. You will own the product roadmap, drive cross-functional initiatives, and partner with engineering, design, and marketing teams.";

// ---------- Normalization & parsing ----------

/** Normalize a bullet: collapse whitespace, trim, preserve case. */
export function normalizeBullet(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse a multi-line textarea into individual bullets. Splits on newlines, bullets (•, -, *), or semicolons. */
export function parseBullets(text: string): string[] {
  if (!text) return [];
  const lines = text
    .split(/(?:\r?\n|;|•|\u2022|(?<=\S)\s*[-*]\s+)/)
    .map((s) => normalizeBullet(s))
    .filter((s) => s.length > 0);
  return lines;
}

// ---------- Weak-phrase detection ----------

/** Find all weak-phrase occurrences in a bullet (case-insensitive). */
export function detectWeakPhrases(bullet: string): WeakPhraseMatch[] {
  const lower = (bullet || "").toLowerCase();
  const out: WeakPhraseMatch[] = [];
  for (const wp of WEAK_PHRASES) {
    let idx = 0;
    while ((idx = lower.indexOf(wp.phrase, idx)) !== -1) {
      out.push({
        phrase: wp.phrase,
        start: idx,
        end: idx + wp.phrase.length,
        alternative: wp.alternative,
      });
      idx += wp.phrase.length;
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

// ---------- Action verb detection ----------

/** Detect action verbs in the bullet. Matches first-token verb and any others in the verb library. */
export function detectActionVerbs(bullet: string): VerbMatch[] {
  const text = bullet || "";
  if (!text) return [];
  // Build a map of base verb → category for quick lookup.
  const baseMap = new Map<string, VerbCategory>();
  for (const v of ACTION_VERBS) baseMap.set(v.verb, v.category);
  // Tokenize into words (preserve positions).
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /\b([a-zA-Z']+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ word: m[1], start: m.index, end: m.index + m[1].length });
  }
  const out: VerbMatch[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const lower = t.word.toLowerCase();
    if (baseMap.has(lower)) {
      const key = `${lower}@${t.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        verb: t.word,
        base: lower,
        position: t.start,
        category: baseMap.get(lower)!,
      });
    }
  }
  return out;
}

// ---------- Metric detection ----------

/** Detect quantified metrics: %, $, multipliers (3x), counts, time. */
export function extractMetrics(bullet: string): MetricMatch[] {
  const text = bullet || "";
  const out: MetricMatch[] = [];
  // Percent: 25%, 25 percent, 25 pct
  const pctRe = /(\d+(?:\.\d+)?\s*(?:%|percent|pct))/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(text)) !== null) {
    out.push({ raw: m[1].trim(), start: m.index, end: m.index + m[1].length, kind: "percent" });
  }
  // Currency: $1.2M, $500K, $1,200, USD 500
  const curRe = /(?:\$|USD\s?|EUR\s?|GBP\s?)(\d[\d,.]*\s?[KMB]?)/gi;
  while ((m = curRe.exec(text)) !== null) {
    out.push({ raw: m[0].trim(), start: m.index, end: m.index + m[0].length, kind: "currency" });
  }
  // Multiplier: 3x, 5x, 2.5x
  const multRe = /\b(\d+(?:\.\d+)?x)\b/gi;
  while ((m = multRe.exec(text)) !== null) {
    out.push({ raw: m[1], start: m.index, end: m.index + m[1].length, kind: "multiplier" });
  }
  // Time: 3 months, 2 weeks, 10 hours, 5 days, 1 year
  const timeRe = /\b(\d+\s+(?:second|minute|hour|day|week|month|quarter|year)s?)\b/gi;
  while ((m = timeRe.exec(text)) !== null) {
    out.push({ raw: m[1], start: m.index, end: m.index + m[1].length, kind: "time" });
  }
  // Plain count: 5 engineers, 25 users, 12 projects (number + noun)
  const countRe = /\b(\d+)\s+(engineers?|users?|customers?|projects?|teams?|people|reports?|pipelines?|applications?|apps?|systems?|features?|tests?|bugs?|tickets?|clients?|accounts?|campaigns?|launches?|releases?|sprints?|stories?)\b/gi;
  while ((m = countRe.exec(text)) !== null) {
    out.push({ raw: m[1] + " " + m[2], start: m.index, end: m.index + m[0].length, kind: "count" });
  }
  // Raw standalone number (last resort)
  const numRe = /\b(\d{2,})\b/g;
  while ((m = numRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[1].length;
    // Skip if already inside another match
    if (out.some((o) => start >= o.start && end <= o.end)) continue;
    out.push({ raw: m[1], start, end, kind: "raw" });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

// ---------- Passive voice detection ----------

/** Detect passive voice constructions. Returns true and example snippets. */
export function detectPassiveVoice(bullet: string): { detected: boolean; examples: string[] } {
  const lower = (bullet || "").toLowerCase();
  const examples: string[] = [];
  for (const p of PASSIVE_PATTERNS) {
    let idx = 0;
    while ((idx = lower.indexOf(p, idx)) !== -1) {
      // Extract a window of ~50 chars around the match
      const start = Math.max(0, idx);
      const end = Math.min(bullet.length, idx + p.length + 30);
      examples.push(bullet.slice(start, end).trim() + (end < bullet.length ? "…" : ""));
      idx += p.length;
    }
  }
  // Generic: be-verb + past participle ending in 'ed'
  const re = /\b(is|are|was|were|been|being|am)\s+(\w+ed)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const snippet = bullet.slice(m.index, Math.min(bullet.length, m.index + m[0].length + 20));
    if (!examples.some((e) => e.startsWith(snippet.slice(0, 10)))) {
      examples.push(snippet.trim() + "…");
    }
  }
  return { detected: examples.length > 0, examples: examples.slice(0, 3) };
}

// ---------- Tense detection ----------

/** Detect tense: past, present, mixed, or unknown. */
export function detectTense(bullet: string): "past" | "present" | "mixed" | "unknown" {
  const text = (bullet || "").trim();
  if (!text) return "unknown";
  const firstWord = (text.match(/^\s*(\w+)/) || [])[1] || "";
  const lower = firstWord.toLowerCase();
  // Strong past-tense action verb
  if (ACTION_VERBS.some((v) => v.verb === lower)) {
    return lower.endsWith("ed") || lower === "led" || lower === "built" || lower === "drove"
      || lower === "spoke" || lower === "wrote" || lower === "cut" || lower === "made"
      || lower === "got" || lower === "founded" || lower === "ran"
      ? "past"
      : "present";
  }
  if (PAST_ENDINGS.test(lower)) return "past";
  if (/\b(ing|s)\b/i.test(lower) && lower.endsWith("s")) return "present";
  if (lower.endsWith("ing")) return "present";
  // Heuristic: look for past-tense verb anywhere
  const tokens = text.toLowerCase().split(/\s+/);
  const hasPast = tokens.some((t) => PAST_ENDINGS.test(t) || ["led", "built", "drove", "spoke", "wrote", "cut", "ran", "founded"].includes(t));
  const hasIng = tokens.some((t) => t.endsWith("ing"));
  if (hasPast && hasIng) return "mixed";
  if (hasPast) return "past";
  if (hasIng) return "present";
  return "unknown";
}

/** Check tense consistency across multiple bullets. */
export function checkTenseConsistency(bullets: string[]): { consistent: boolean; tenses: ("past" | "present" | "mixed" | "unknown")[] } {
  const tenses = bullets.map((b) => detectTense(b));
  const realTenses = tenses.filter((t) => t !== "unknown" && t !== "mixed");
  if (realTenses.length === 0) return { consistent: true, tenses };
  const first = realTenses[0];
  const consistent = realTenses.every((t) => t === first);
  return { consistent, tenses };
}

// ---------- JD keyword matching ----------

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "for", "to", "in", "of", "on",
  "at", "by", "from", "as", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "we", "you", "they", "their",
  "our", "your", "i", "me", "my", "will", "would", "should", "could", "can",
  "have", "has", "had", "do", "does", "did", "not", "no", "yes", "so", "if",
  "then", "than", "also", "about", "into", "over", "under", "more", "less",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "looking", "experience", "year", "years", "work", "team", "teams", "must",
  "good", "strong", "able", "including", "etc", "across", "within",
]);

/** Extract keywords from a JD (length 3+, non-stop-words, lowercased). */
export function extractJdKeywords(jd: string): string[] {
  if (!jd) return [];
  const lower = jd.toLowerCase();
  const tokens = lower.match(/\b[a-z][a-z0-9+#.\-]{2,}\b/g) || [];
  const filtered = tokens.filter((t) => !STOP_WORDS.has(t));
  // Dedupe, keep order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of filtered) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Match a bullet against JD keywords. */
export function matchJdKeywords(bullet: string, jd: string): JdKeywordResult {
  const keywords = extractJdKeywords(jd);
  if (keywords.length === 0) return { matched: [], missing: [], density: 0 };
  const lower = " " + bullet.toLowerCase() + " ";
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    // Word-boundary match
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) matched.push(k);
    else missing.push(k);
  }
  return {
    matched,
    missing,
    density: matched.length / keywords.length,
  };
}

// ---------- Strength score ----------

/** Compute a 0–100 strength score with signal breakdown. */
export function scoreBullet(bullet: string): StrengthScore {
  const text = (bullet || "").trim();
  const verbs = detectActionVerbs(text);
  const metrics = extractMetrics(text);
  const passive = detectPassiveVoice(text);
  const tense = detectTense(text);
  const weakPhrases = detectWeakPhrases(text);
  const startsWithStrongVerb = verbs.length > 0 && verbs[0].position === 0;
  const hasMetric = metrics.length > 0;
  const isActiveVoice = !passive.detected && weakPhrases.length === 0;
  const isPastTense = tense === "past";
  const lengthOk = text.length >= 60 && text.length <= 220;
  // Weighted signals (sum to 100)
  let score = 0;
  score += startsWithStrongVerb ? 25 : 0;
  score += hasMetric ? 30 : 0;
  score += isActiveVoice ? 20 : 0;
  score += isPastTense ? 15 : 0;
  score += lengthOk ? 10 : 0;
  return {
    score,
    signals: { startsWithStrongVerb, hasMetric, isActiveVoice, isPastTense, lengthOk },
    maxPossible: 100,
  };
}

// ---------- STAR analysis ----------

/** Check whether the bullet contains Situation/Task/Action/Result signals. */
export function analyzeStar(bullet: string): StarAnalysis {
  const lower = (bullet || "").toLowerCase();
  const hasSituation = /\b(when|while|during|in|at|for)\b/.test(lower) && lower.length > 20;
  const hasTask = /\b(to|in order to|so that|goal|aim|target|needed)\b/.test(lower);
  const hasAction = detectActionVerbs(lower).length > 0;
  const hasResult = /(\d|\bresult|\boutcome|\bimpact|\b(saved|increased|reduced|improved|achieved|grew|cut|accelerated)\b|%|\$)/.test(lower);
  return {
    hasSituation,
    hasTask,
    hasAction,
    hasResult,
    complete: hasSituation && hasTask && hasAction && hasResult,
  };
}

// ---------- Verb alternatives ----------

/** Suggest strong verb alternatives based on the bullet's first action verb or weak phrase. */
export function suggestVerbAlternatives(bullet: string): string[] {
  const verbs = detectActionVerbs(bullet);
  const weakPhrases = detectWeakPhrases(bullet);
  const suggestions = new Set<string>();
  if (verbs.length > 0) {
    // Pull alternatives from the same category as the first verb.
    const cat = verbs[0].category;
    for (const v of STRONG_VERB_POOL[cat]) {
      if (v.toLowerCase() !== verbs[0].base) suggestions.add(v);
    }
  }
  if (weakPhrases.length > 0) {
    // Add alternatives from the weak phrase dictionary.
    for (const wp of weakPhrases) {
      for (const alt of wp.alternative.split(/,\s*/)) {
        const cap = alt.charAt(0).toUpperCase() + alt.slice(1);
        suggestions.add(cap);
      }
    }
  }
  // Fallback: leadership pool
  if (suggestions.size === 0) {
    for (const v of STRONG_VERB_POOL.leadership) suggestions.add(v);
  }
  return Array.from(suggestions).slice(0, 6);
}

// ---------- Rewrite generation ----------

/**
 * Generate 2–3 stronger rewrites for a bullet.
 *
 * Strategy:
 * 1. If the bullet starts with a weak phrase, replace it with a strong verb
 *    from the alternative list.
 * 2. If the bullet has no metric, append a placeholder prompt like
 *    "([add % or number])" so the user knows what to fill in.
 * 3. If the bullet is in passive voice, flip the subject and verb.
 * 4. Always provide a "concise" variant under 160 chars.
 *
 * Honesty: rewrites NEVER invent metrics. Placeholders are wrapped in [brackets]
 * so the user must supply their real numbers.
 */
export function generateRewrites(bullet: string, opts?: { jd?: string }): string[] {
  const original = normalizeBullet(bullet);
  if (!original) return [];
  const weakPhrases = detectWeakPhrases(original);
  const verbs = detectActionVerbs(original);
  const metrics = extractMetrics(original);
  const passive = detectPassiveVoice(original);
  const suggestions = suggestVerbAlternatives(original);
  const rewrites: string[] = [];
  const hasMetric = metrics.length > 0;
  const placeholder = " ([add a real metric — %, $, count, or time])";

  // Rewrite 1: Replace weak opening with a strong verb.
  if (weakPhrases.length > 0 && weakPhrases[0].start === 0) {
    const alt = suggestions[0] || "Led";
    const rest = original.slice(weakPhrases[0].end).trim().replace(/^[a-z]/, (c) => c.toLowerCase());
    let rw = `${alt} ${rest}`.replace(/\s+/g, " ").trim();
    if (!hasMetric) rw = rw.replace(/\.?$/, "") + placeholder + ".";
    rewrites.push(rw);
  } else if (verbs.length === 0) {
    // No verb at all — prepend one
    const alt = suggestions[0] || "Drove";
    let rw = `${alt} ${original.charAt(0).toLowerCase()}${original.slice(1)}`.replace(/\.?$/, "");
    if (!hasMetric) rw += placeholder;
    rw += ".";
    rewrites.push(rw);
  } else if (passive.detected) {
    // Flip passive: "Was tasked with X" → "X" + strong verb
    const alt = suggestions[0] || "Delivered";
    let body = original;
    // Strip leading "was/were tasked with", "was responsible for", etc.
    for (const p of PASSIVE_PATTERNS) {
      const re = new RegExp("^\\s*" + p.replace(/\s+/g, "\\s+") + "\\s+", "i");
      if (re.test(body)) {
        body = body.replace(re, "");
        break;
      }
    }
    body = body.replace(/\.?$/, "").trim();
    let rw = `${alt} ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
    if (!hasMetric) rw += placeholder;
    rw += ".";
    rewrites.push(rw);
  } else {
    // Already strong — produce a tightened variant.
    let rw = original.replace(/\.?$/, "");
    if (!hasMetric) rw += placeholder;
    rw += ".";
    rewrites.push(rw);
  }

  // Rewrite 2: Add a result clause if missing.
  const hasResultClause = /\b(saving|saving|to (?:save|increase|reduce|grow|improve|cut)|which (?:saved|increased|reduced|improved|cut)|resulting in)\b/i.test(original);
  if (!hasResultClause) {
    const alt = suggestions[1] || suggestions[0] || "Delivered";
    const body = original.replace(/^responsible for\s+/i, "")
      .replace(/^worked on\s+/i, "")
      .replace(/^helped with\s+/i, "")
      .replace(/^was tasked with\s+/i, "")
      .replace(/^tasked with\s+/i, "")
      .replace(/\.?$/, "")
      .trim();
    let rw = `${alt} ${body.charAt(0).toLowerCase()}${body.slice(1)}, [quantify the impact — e.g. cutting X by Y%]`;
    if (!hasMetric) rw = rw;
    rw += ".";
    rewrites.push(rw);
  }

  // Rewrite 3: Concise (≤ 160 chars) variant.
  if (rewrites.length < 3) {
    let concise = rewrites[0] || original;
    if (concise.length > 160) {
      concise = concise.slice(0, 157).replace(/[\s,;:.-]+$/, "") + "...";
    }
    if (concise !== rewrites[0]) rewrites.push(concise);
  }

  // JD-aware injection: if a missing JD keyword is highly relevant, suggest an insertion variant.
  if (opts?.jd) {
    const jdMatch = matchJdKeywords(original, opts.jd);
    const topMissing = jdMatch.missing[0];
    if (topMissing && rewrites.length < 4) {
      const base = rewrites[0] || original;
      const inserted = base.replace(/\.?$/, `, leveraging ${topMissing}.`);
      rewrites.push(inserted);
    }
  }

  // Dedupe and cap at 3.
  const unique: string[] = [];
  for (const r of rewrites) {
    if (!unique.includes(r)) unique.push(r);
    if (unique.length >= 3) break;
  }
  return unique;
}

// ---------- Full bullet analysis ----------

/** Run the full analysis pipeline on a single bullet. */
export function analyzeBullet(bullet: string, jd?: string): BulletAnalysis {
  const normalized = normalizeBullet(bullet);
  const verbs = detectActionVerbs(normalized);
  const weakPhrases = detectWeakPhrases(normalized);
  const metrics = extractMetrics(normalized);
  const passive = detectPassiveVoice(normalized);
  const tense = detectTense(normalized);
  const score = scoreBullet(normalized);
  const star = analyzeStar(normalized);
  const jdKeywords = matchJdKeywords(normalized, jd || "");
  const rewrites = generateRewrites(normalized, { jd });
  const diagnostics: string[] = [];
  if (weakPhrases.length > 0) {
    diagnostics.push(`Replace weak phrase(s): ${weakPhrases.map((w) => `"${w.phrase}"`).join(", ")}. Alternatives: ${weakPhrases[0].alternative}.`);
  }
  if (passive.detected) {
    diagnostics.push(`Switch from passive to active voice. Examples: ${passive.examples.slice(0, 2).join(" · ")}`);
  }
  if (metrics.length === 0) {
    diagnostics.push("Add a quantified metric (% , $, count, or time) — never fabricate one. Use your real number.");
  }
  if (verbs.length === 0) {
    diagnostics.push("Start with a strong action verb (e.g. Led, Built, Drove, Shipped).");
  } else if (verbs[0].position !== 0) {
    diagnostics.push(`Move the action verb "${verbs[0].verb}" to the start of the bullet.`);
  }
  if (normalized.length > 0 && (normalized.length < 60 || normalized.length > 220)) {
    diagnostics.push(`Bullet length ${normalized.length} chars — aim for 60–220 for ATS readability.`);
  }
  if (!star.hasResult) {
    diagnostics.push("Add a result/outcome clause (what changed because of your action?).");
  }
  if (jd && jdKeywords.missing.length > 0) {
    const top3 = jdKeywords.missing.slice(0, 3);
    diagnostics.push(`Consider weaving in relevant JD keywords honestly: ${top3.join(", ")} (don't stuff).`);
  }
  return {
    original: bullet,
    normalized,
    verbs,
    weakPhrases,
    metrics,
    passive,
    tense,
    score,
    star,
    jdKeywords,
    diagnostics,
    rewrites,
  };
}

/** Optimize multiple bullets at once. */
export function bulkOptimize(bullets: string[], jd?: string): BulkResult {
  const analyses = bullets.map((b) => analyzeBullet(b, jd));
  const tenseCheck = checkTenseConsistency(bullets);
  const scores = analyses.map((a) => a.score.score);
  const averageScore = scores.length === 0 ? 0 : Math.round(scores.reduce((x, y) => x + y, 0) / scores.length);
  const weakBullets = analyses.filter((a) => a.score.score < 60).length;
  const gapSet = new Set<string>();
  for (const a of analyses) for (const k of a.jdKeywords.missing) gapSet.add(k);
  return {
    bullets: analyses,
    tenseConsistent: tenseCheck.consistent,
    averageScore,
    weakBullets,
    totalJdGaps: Array.from(gapSet).sort(),
  };
}

// ---------- Rendering ----------

/** Render an analysis as a plain-text report. */
export function renderText(a: BulletAnalysis): string {
  const lines: string[] = [];
  lines.push(`Original: ${a.original}`);
  lines.push(`Strength score: ${a.score.score}/100`);
  lines.push(`Signals: verb=${a.score.signals.startsWithStrongVerb ? "Y" : "N"}, metric=${a.score.signals.hasMetric ? "Y" : "N"}, active=${a.score.signals.isActiveVoice ? "Y" : "N"}, past=${a.score.signals.isPastTense ? "Y" : "N"}, len=${a.score.signals.lengthOk ? "Y" : "N"}`);
  lines.push(`Tense: ${a.tense}`);
  if (a.weakPhrases.length > 0) {
    lines.push(`Weak phrases: ${a.weakPhrases.map((w) => w.phrase).join(", ")}`);
  }
  if (a.passive.detected) {
    lines.push(`Passive voice: ${a.passive.examples.join(" | ")}`);
  }
  if (a.metrics.length > 0) {
    lines.push(`Metrics: ${a.metrics.map((m) => m.raw).join(", ")}`);
  }
  if (a.diagnostics.length > 0) {
    lines.push("Diagnostics:");
    for (const d of a.diagnostics) lines.push(`  - ${d}`);
  }
  if (a.rewrites.length > 0) {
    lines.push("Suggested rewrites:");
    a.rewrites.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  return lines.join("\n");
}

/** Render an analysis as markdown. */
export function renderMarkdown(a: BulletAnalysis): string {
  const lines: string[] = [];
  lines.push(`### Bullet analysis — score ${a.score.score}/100`);
  lines.push("");
  lines.push(`> ${a.original}`);
  lines.push("");
  lines.push(`**Signals:** verb ${a.score.signals.startsWithStrongVerb ? "✓" : "✗"} · metric ${a.score.signals.hasMetric ? "✓" : "✗"} · active ${a.score.signals.isActiveVoice ? "✓" : "✗"} · past ${a.score.signals.isPastTense ? "✓" : "✗"} · length ${a.score.signals.lengthOk ? "✓" : "✗"}`);
  if (a.diagnostics.length > 0) {
    lines.push("");
    lines.push("**Diagnostics:**");
    for (const d of a.diagnostics) lines.push(`- ${d}`);
  }
  if (a.rewrites.length > 0) {
    lines.push("");
    lines.push("**Suggested rewrites:**");
    a.rewrites.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }
  return lines.join("\n");
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

export function buildShareUrl(bullets: string, jd: string): string {
  const params = new URLSearchParams();
  if (bullets) params.set("bullets", bullets);
  if (jd) params.set("jd", jd);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { bullets: "", jd: "" };
  const params = new URLSearchParams(clean);
  return {
    bullets: params.get("bullets") ?? "",
    jd: params.get("jd") ?? "",
  };
}

// ---------- LLM helpers (UI-only — pure prompt builder) ----------

/** Build the prompt to send to an LLM for a richer rewrite (BYO key). */
export function buildLlmPrompt(bullet: string, jd?: string): string {
  return [
    "You are an expert resume writer.",
    "Rewrite the following resume bullet using the Action verb + Task + Result + Metric formula.",
    "NEVER fabricate metrics — if a number is missing, use a [placeholder] the user must fill in.",
    jd ? `Tailor it to this job description: ${jd}` : "No specific job description provided.",
    `Bullet: ${bullet}`,
    'Return ONLY JSON: {"rewrites":["...","..."],"explanation":"..."}.',
    "No commentary, no markdown fences.",
  ].join("\n");
}

/** Parse an LLM-returned JSON object. */
export function parseLlmResult(llmText: string): { rewrites: string[]; explanation: string } | null {
  try {
    const obj = JSON.parse(llmText);
    if (typeof obj !== "object" || obj === null) return null;
    const rewrites = Array.isArray(obj.rewrites) ? obj.rewrites.filter((r: unknown) => typeof r === "string") : [];
    const explanation = typeof obj.explanation === "string" ? obj.explanation : "";
    if (rewrites.length === 0) return null;
    return { rewrites, explanation };
  } catch {
    return null;
  }
}
