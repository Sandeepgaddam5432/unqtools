/**
 * AI Newsletter Subject Line A/B Tester — pure logic.
 *
 * Subject-line variant generation by angle (curiosity, urgency, benefit,
 * personalization, question), heuristic open-rate-potential scoring with
 * transparent per-factor breakdown, inbox truncation preview, spam/clip-risk
 * linter, and an A/B test design + significance engine (power-based sample
 * size, two-proportion z-test).
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type SubjectAngle =
  | "curiosity"
  | "urgency"
  | "benefit"
  | "personalization"
  | "question";

export interface AngleTemplate {
  angle: SubjectAngle;
  /** Template strings use {topic}, {audience}, {name}, {city}, {time} tokens. */
  templates: string[];
  description: string;
}

export interface SubjectVariant {
  id: string;
  angle: SubjectAngle;
  text: string;
  charCount: number;
  emojiCount: number;
  score: SubjectScore;
  preview: InboxPreview;
  lint: SubjectLint;
}

export interface SubjectScore {
  total: number;          // 0-100
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  contribution: number;   // positive or negative points applied to total
  raw: number;            // raw measurement (chars, count, etc.)
  note: string;
}

export type ScoreFactorKey =
  | "length"
  | "spam"
  | "emoji"
  | "personalization"
  | "clarity"
  | "punctuation";

export interface InboxPreview {
  desktop: string;        // truncated to ~60 chars
  mobile: string;         // truncated to ~35 chars
  desktopTruncated: boolean;
  mobileTruncated: boolean;
}

export interface SubjectLint {
  issues: LintIssue[];
  riskLevel: "ok" | "warn" | "danger";
}

export interface LintIssue {
  level: "ok" | "warn" | "danger";
  message: string;
}

export interface AbDesign {
  totalAudience: number;
  numVariants: number;
  baselineOpenRate: number;     // 0-1
  mde: number;                  // minimum detectable effect, 0-1 (e.g. 0.10 = 10%)
  alpha: number;                // significance level (0.05)
  power: number;                // statistical power (0.80)
  samplePerVariant: number;
  holdoutPct: number;           // 0-100, recommended holdout %
  testSplitPct: number;         // 0-100, split among variants
  estimatedDays: number;        // based on daily send volume
  note: string;
}

export interface ZTestResult {
  z: number;
  pValue: number;
  significant: boolean;          // p < alpha
  alpha: number;
  winner: "a" | "b" | "none";
  conversionA: number;           // 0-1
  conversionB: number;           // 0-1
  lift: number;                  // relative lift (b - a) / a
  note: string;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  audience: string;
  variantCount: number;
  topScore: number;
  topVariant: string;
}

export interface ShareState {
  topic: string;
  audience: string;
  angles: SubjectAngle[];
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-newsletter-subject-tester:history";
export const HISTORY_MAX = 20;

export const ANGLE_LABELS: Record<SubjectAngle, string> = {
  curiosity: "Curiosity",
  urgency: "Urgency",
  benefit: "Benefit",
  personalization: "Personalization",
  question: "Question",
};

export const ANGLE_DESCRIPTIONS: Record<SubjectAngle, string> = {
  curiosity: "Tease content without giving it away — drives opens to satisfy curiosity.",
  urgency: "Time-sensitive language that nudges immediate opens.",
  benefit: "Lead with the concrete payoff the reader will get.",
  personalization: "Use the reader's name, city, or past behavior to feel 1:1.",
  question: "Ask a question the reader wants answered.",
};

/** 5 angles × 3 templates = 15 base variants. */
export const TEMPLATES: AngleTemplate[] = [
  {
    angle: "curiosity",
    description: ANGLE_DESCRIPTIONS.curiosity,
    templates: [
      "The one thing about {topic} nobody talks about",
      "We tried {topic} for 30 days. Here's what happened.",
      "Why {audience} are quietly switching to {topic}",
    ],
  },
  {
    angle: "urgency",
    description: ANGLE_DESCRIPTIONS.urgency,
    templates: [
      "Last chance: {topic} ends tonight",
      "{audience}, this {topic} offer closes in 24 hours",
      "48 hours left — your {topic} spot is reserved",
    ],
  },
  {
    angle: "benefit",
    description: ANGLE_DESCRIPTIONS.benefit,
    templates: [
      "How {topic} can save {audience} 5 hours a week",
      "Get more from {topic} with this 5-minute read",
      "{audience}: the {topic} playbook that actually works",
    ],
  },
  {
    angle: "personalization",
    description: ANGLE_DESCRIPTIONS.personalization,
    templates: [
      "[name], your {topic} recap is ready",
      "{audience} in [city] — this {topic} is for you",
      "[name], we picked this {topic} just for you",
    ],
  },
  {
    angle: "question",
    description: ANGLE_DESCRIPTIONS.question,
    templates: [
      "Are you making these {topic} mistakes?",
      "What if {topic} was easier than you think?",
      "Ready to level up your {topic}, {audience}?",
    ],
  },
];

export const TOPIC_PRESETS: string[] = [
  "email marketing", "morning routines", "investing basics",
  "remote work", "productivity", "side hustles",
  "healthy cooking", "indie hacking", "personal finance",
  "deep work",
];

/**
 * Spam trigger words / patterns. Lowercase match.
 * Each entry contributes a penalty when present.
 */
export const SPAM_TRIGGERS: string[] = [
  "free", "guarantee", "act now", "urgent", "winner", "win", "won",
  "congratulations", "best price", "lowest price", "save $", "save up to",
  "make money", "make $", "earn money", "cash", "credit", "loan",
  "buy now", "order now", "limited time", "click here", "click below",
  "subscribe now", "sign up free", "100% free", "no obligation",
  "risk-free", "money back", "$$$", "!!!", "???", "income",
  "viagra", "cialis", "casino", "lottery", "weight loss", "diet",
  "work from home", "get rich", "millionaire",
];

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}]/gu;
const TOKEN_REGEX = /\[(name|city|company)\]/gi;
const ALL_CAPS_WORD_REGEX = /\b[A-Z]{4,}\b/g;

const DESKTOP_TRUNC = 60;
const MOBILE_TRUNC = 35;

// ---------- Helpers ----------

export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function countEmojis(s: string): number {
  const m = s.match(EMOJI_REGEX);
  return m ? m.length : 0;
}

export function hasPersonalizationToken(s: string): boolean {
  return TOKEN_REGEX.test(s);
}

export function countPersonalizationTokens(s: string): number {
  const m = s.match(TOKEN_REGEX);
  return m ? m.length : 0;
}

export function countAllCapsWords(s: string): number {
  const m = s.match(ALL_CAPS_WORD_REGEX);
  return m ? m.length : 0;
}

export function countExclamation(s: string): number {
  return (s.match(/!/g) || []).length;
}

export function countQuestionMarks(s: string): number {
  return (s.match(/\?/g) || []).length;
}

/** Lowercase + strip punctuation for spam-word matching. */
function normalizeForSpam(s: string): string {
  return s.toLowerCase().replace(/[.,;:]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Find all spam triggers present in the subject. */
export function findSpamTriggers(s: string): string[] {
  if (!s) return [];
  const norm = normalizeForSpam(s);
  const out: string[] = [];
  for (const t of SPAM_TRIGGERS) {
    if (norm.includes(t)) out.push(t);
  }
  return out;
}

// ---------- Scoring ----------

export interface LengthPenalty {
  chars: number;
  penalty: number;
  note: string;
}

/** Length scoring: 30-60 chars is optimal; penalize outside that range. */
export function scoreLength(chars: number): LengthPenalty {
  if (chars === 0) return { chars: 0, penalty: -40, note: "Empty subject." };
  if (chars >= 30 && chars <= 60) {
    return { chars, penalty: 12, note: "Optimal length (30-60 chars) — full visibility on mobile + desktop." };
  }
  if (chars < 30) {
    const under = 30 - chars;
    return {
      chars,
      penalty: Math.max(-8, 12 - under * 0.7),
      note: `Short (${chars} chars) — readable but may be too vague.`,
    };
  }
  // > 60 chars
  const over = chars - 60;
  if (chars <= 80) {
    return {
      chars,
      penalty: Math.max(-6, 12 - over * 0.6),
      note: `Long-ish (${chars} chars) — truncates on mobile, full on desktop.`,
    };
  }
  return {
    chars,
    penalty: Math.max(-20, -6 - (chars - 80) * 0.5),
    note: `Too long (${chars} chars) — truncates on both desktop and mobile.`,
  };
}

/** Spam scoring: each spam trigger = -8, capped at -32. */
export function scoreSpam(s: string): { triggers: string[]; penalty: number; note: string } {
  const triggers = findSpamTriggers(s);
  const penalty = triggers.length === 0 ? 0 : Math.max(-32, triggers.length * -8);
  const note = triggers.length === 0
    ? "No spam triggers detected."
    : `${triggers.length} spam trigger(s) detected: ${triggers.slice(0, 5).join(", ")}${triggers.length > 5 ? "…" : ""}`;
  return { triggers, penalty, note };
}

/** Emoji scoring: 1 emoji = +4, 0 = 0, 2+ = penalty. */
export function scoreEmoji(count: number): { bonus: number; note: string } {
  if (count === 0) return { bonus: 0, note: "No emoji — safe and professional." };
  if (count === 1) return { bonus: 4, note: "One emoji — small boost, stands out in inbox." };
  if (count === 2) return { bonus: -4, note: "Two emoji — borderline; can look spammy." };
  return { bonus: -10, note: `${count} emoji — too many; flagged as spammy.` };
}

/** Personalization scoring: each token = +5, capped at +10. */
export function scorePersonalization(tokens: number): { bonus: number; note: string } {
  if (tokens === 0) return { bonus: 0, note: "No personalization tokens." };
  const bonus = Math.min(10, tokens * 5);
  return { bonus, note: `${tokens} personalization token(s) — feels 1:1.` };
}

/** Clarity scoring: penalize vague hype words, reward concrete nouns/numbers. */
export function scoreClarity(s: string): { bonus: number; note: string } {
  if (!s) return { bonus: -10, note: "Empty subject — no clarity signal." };
  let bonus = 0;
  // Numbers add concreteness.
  const numbers = (s.match(/\b\d+\b/g) || []).length;
  bonus += Math.min(4, numbers * 2);
  // Vague hype words subtract.
  const hypeWords = ["amazing", "incredible", "mind-blowing", "insane", "epic", "unbelievable"];
  const lower = s.toLowerCase();
  let hypeCount = 0;
  for (const w of hypeWords) if (lower.includes(w)) hypeCount += 1;
  bonus -= hypeCount * 3;
  // Very short single-word subjects get penalized for clarity.
  const wordCount = s.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 1) bonus -= 4;
  bonus = Math.max(-12, Math.min(6, bonus));
  const note = hypeCount > 0
    ? `${hypeCount} hype word(s) — replace with concrete language.`
    : numbers > 0
      ? `${numbers} concrete number(s) — good specificity.`
      : "Neutral clarity signal.";
  return { bonus, note };
}

/** Punctuation/capitalization: penalize ALL CAPS words, !!!, ???. */
export function scorePunctuation(s: string): { penalty: number; note: string } {
  let penalty = 0;
  const caps = countAllCapsWords(s);
  if (caps > 0) penalty -= Math.min(12, caps * 4);
  const exclaims = countExclamation(s);
  if (exclaims > 1) penalty -= Math.min(8, (exclaims - 1) * 4);
  const questions = countQuestionMarks(s);
  if (questions > 1) penalty -= Math.min(4, (questions - 1) * 2);
  const noteParts: string[] = [];
  if (caps > 0) noteParts.push(`${caps} ALL-CAPS word(s)`);
  if (exclaims > 1) noteParts.push(`${exclaims} exclamation marks`);
  if (questions > 1) noteParts.push(`${questions} question marks`);
  const note = noteParts.length === 0
    ? "Clean punctuation/capitalization."
    : `Excessive: ${noteParts.join(", ")} — looks spammy.`;
  return { penalty, note };
}

/** Full subject line score. Returns total 0-100 with factor breakdown. */
export function scoreSubject(subject: string): SubjectScore {
  const chars = subject.length;
  const emojis = countEmojis(subject);
  const tokens = countPersonalizationTokens(subject);

  const length = scoreLength(chars);
  const spam = scoreSpam(subject);
  const emoji = scoreEmoji(emojis);
  const pers = scorePersonalization(tokens);
  const clarity = scoreClarity(subject);
  const punct = scorePunctuation(subject);

  const factors: ScoreFactor[] = [
    { key: "length", label: "Length", contribution: length.penalty, raw: chars, note: length.note },
    { key: "spam", label: "Spam triggers", contribution: spam.penalty, raw: spam.triggers.length, note: spam.note },
    { key: "emoji", label: "Emoji", contribution: emoji.bonus, raw: emojis, note: emoji.note },
    { key: "personalization", label: "Personalization", contribution: pers.bonus, raw: tokens, note: pers.note },
    { key: "clarity", label: "Clarity", contribution: clarity.bonus, raw: chars, note: clarity.note },
    { key: "punctuation", label: "Punctuation/Caps", contribution: punct.penalty, raw: caps_count(subject), note: punct.note },
  ];

  // Base 70 + sum of contributions, clamped 0-100.
  const base = 70;
  const total = Math.max(0, Math.min(100, base + factors.reduce((s, f) => s + f.contribution, 0)));

  return { total, factors };
}

function caps_count(s: string): number {
  return countAllCapsWords(s) + countExclamation(s) + countQuestionMarks(s);
}

// ---------- Inbox preview ----------

export function truncatePreview(
  subject: string,
  preheader: string = "",
  desktopLimit = DESKTOP_TRUNC,
  mobileLimit = MOBILE_TRUNC,
): InboxPreview {
  const subjectStr = subject || "";
  const desktop = subjectStr.length > desktopLimit
    ? subjectStr.slice(0, desktopLimit - 1) + "…"
    : subjectStr;
  const mobile = subjectStr.length > mobileLimit
    ? subjectStr.slice(0, mobileLimit - 1) + "…"
    : subjectStr;
  void preheader; // reserved for future combined preview
  return {
    desktop,
    mobile,
    desktopTruncated: subjectStr.length > desktopLimit,
    mobileTruncated: subjectStr.length > mobileLimit,
  };
}

// ---------- Linter ----------

export function lintSubject(subject: string): SubjectLint {
  const issues: LintIssue[] = [];
  if (!subject) {
    return { issues: [{ level: "danger", message: "Subject is empty." }], riskLevel: "danger" };
  }
  // Spam triggers
  const triggers = findSpamTriggers(subject);
  for (const t of triggers.slice(0, 3)) {
    issues.push({ level: "danger", message: `Spam trigger word: "${t}"` });
  }
  // All-caps words
  const caps = countAllCapsWords(subject);
  if (caps > 0) {
    issues.push({ level: caps > 1 ? "danger" : "warn", message: `${caps} ALL-CAPS word(s) — looks shouty/spammy.` });
  }
  // Exclamation marks
  const excl = countExclamation(subject);
  if (excl > 1) {
    issues.push({ level: excl > 2 ? "danger" : "warn", message: `${excl} exclamation marks — dial it back.` });
  }
  // Multiple question marks
  const qs = countQuestionMarks(subject);
  if (qs > 1) {
    issues.push({ level: "warn", message: `${qs} question marks — one is enough.` });
  }
  // Length
  if (subject.length > 80) {
    issues.push({ level: "warn", message: `Subject is ${subject.length} chars — truncates on most inboxes.` });
  }
  if (issues.length === 0) {
    issues.push({ level: "ok", message: "No spam or formatting risks detected." });
  }
  const dangerCount = issues.filter((i) => i.level === "danger").length;
  const warnCount = issues.filter((i) => i.level === "warn").length;
  const riskLevel: SubjectLint["riskLevel"] = dangerCount > 0 ? "danger" : warnCount > 0 ? "warn" : "ok";
  return { issues, riskLevel };
}

// ---------- Variant generation ----------

/** Fill in a template with topic/audience and standard tokens. */
export function fillTemplate(
  template: string,
  topic: string,
  audience: string,
): string {
  const t = topic || "{topic}";
  const a = audience || "readers";
  return template
    .replace(/\{topic\}/g, t)
    .replace(/\{audience\}/g, a);
}

let variantCounter = 0;
function makeVariantId(): string {
  variantCounter += 1;
  return `v${variantCounter}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export interface GenerateOptions {
  topic: string;
  audience?: string;
  angles?: SubjectAngle[];
  maxPerAngle?: number;
}

/** Generate variants for the given topic. At least 5 variants across angles. */
export function generateVariants(opts: GenerateOptions): SubjectVariant[] {
  const topic = normalizeText(opts.topic);
  if (!topic) return [];
  const audience = normalizeText(opts.audience || "");
  const angles = opts.angles && opts.angles.length > 0 ? opts.angles : TEMPLATES.map((t) => t.angle);
  const maxPerAngle = opts.maxPerAngle && opts.maxPerAngle > 0 ? opts.maxPerAngle : 99;

  const out: SubjectVariant[] = [];
  for (const angle of angles) {
    const tpl = TEMPLATES.find((t) => t.angle === angle);
    if (!tpl) continue;
    const used = new Set<string>();
    for (const t of tpl.templates) {
      if (used.size >= maxPerAngle) break;
      const filled = fillTemplate(t, topic, audience);
      if (used.has(filled)) continue;
      used.add(filled);
      out.push(buildVariant(angle, filled));
    }
  }
  // Guarantee at least 5 variants: if user requested < 5 angles, top up from other angles.
  if (out.length < 5) {
    for (const tpl of TEMPLATES) {
      if (out.length >= 5) break;
      for (const t of tpl.templates) {
        const filled = fillTemplate(t, topic, audience);
        if (out.some((v) => v.text === filled)) continue;
        out.push(buildVariant(tpl.angle, filled));
        if (out.length >= 5) break;
      }
    }
  }
  return out;
}

export function buildVariant(angle: SubjectAngle, text: string): SubjectVariant {
  return {
    id: makeVariantId(),
    angle,
    text,
    charCount: text.length,
    emojiCount: countEmojis(text),
    score: scoreSubject(text),
    preview: truncatePreview(text),
    lint: lintSubject(text),
  };
}

/** Sort variants by score descending. */
export function sortVariants(variants: SubjectVariant[]): SubjectVariant[] {
  return [...variants].sort((a, b) => b.score.total - a.score.total);
}

/** Pick the highest-scoring variant. */
export function pickWinner(variants: SubjectVariant[]): SubjectVariant | null {
  if (variants.length === 0) return null;
  return sortVariants(variants)[0];
}

// ---------- A/B test design ----------

/**
 * Compute required sample size per variant for a two-proportion A/B test.
 * Uses the standard formula:
 *   n = ((z_alpha/2 + z_beta)² × (p1(1-p1) + p2(1-p2))) / (p2 - p1)²
 * where p2 = p1 + mde.
 */
export function computeSampleSize(
  baselineRate: number,
  mde: number,
  alpha: number = 0.05,
  power: number = 0.80,
): number {
  if (baselineRate <= 0 || baselineRate >= 1) return 0;
  if (mde <= 0) return 0;
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zBeta = inverseNormalCdf(power);
  const p1 = baselineRate;
  const p2 = baselineRate + mde > 1 ? 1 - 0.001 : baselineRate + mde;
  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p2 - p1, 2);
  if (denominator === 0) return 0;
  return Math.ceil(numerator / denominator);
}

/** Approximate inverse normal CDF (z-score for given cumulative probability). */
export function inverseNormalCdf(p: number): number {
  // Acklam's algorithm — good to ~1e-9.
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    r = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    r = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    r = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return r;
}

/** Standard normal CDF — used for p-value computation. */
export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

/** Build a full A/B test design (sample size, split, runtime). */
export function computeAbDesign(
  totalAudience: number,
  numVariants: number,
  baselineOpenRate: number,
  mde: number,
  power: number = 0.80,
  alpha: number = 0.05,
  dailySendVolume: number = 0,
): AbDesign {
  const n = Math.max(2, Math.min(5, Math.floor(numVariants)));
  const samplePerVariant = computeSampleSize(baselineOpenRate, mde, alpha, power);
  const totalNeeded = samplePerVariant * n;

  // Recommend a 10% holdout if audience is large enough; otherwise equal splits.
  let holdoutPct = 0;
  let testSplitPct = 100;
  if (totalAudience >= totalNeeded * 1.2) {
    holdoutPct = 10;
    testSplitPct = 90;
  }

  const daily = dailySendVolume > 0 ? dailySendVolume : Math.ceil(totalNeeded / 7);
  const estimatedDays = daily > 0 ? Math.ceil(totalNeeded / daily) : 0;

  const note = totalAudience < totalNeeded
    ? `Warning: total audience (${totalAudience.toLocaleString()}) is below the required ${totalNeeded.toLocaleString()} sends. Reduce variants or accept lower sensitivity.`
    : `Recommended: ${holdoutPct}% holdout + ${(100 - holdoutPct).toFixed(0)}% split across ${n} variants. Apple MPP may inflate opens; consider click-based winner selection.`;

  return {
    totalAudience,
    numVariants: n,
    baselineOpenRate,
    mde,
    alpha,
    power,
    samplePerVariant,
    holdoutPct,
    testSplitPct,
    estimatedDays,
    note,
  };
}

/** Two-proportion z-test for A/B significance. */
export function zTestTwoProportion(
  sendsA: number,
  opensA: number,
  sendsB: number,
  opensB: number,
  alpha: number = 0.05,
): ZTestResult {
  const conversionA = sendsA > 0 ? opensA / sendsA : 0;
  const conversionB = sendsB > 0 ? opensB / sendsB : 0;
  if (sendsA === 0 || sendsB === 0) {
    return {
      z: 0, pValue: 1, significant: false, alpha,
      winner: "none", conversionA, conversionB, lift: 0,
      note: "Need at least one send per variant.",
    };
  }
  const pPool = (opensA + opensB) / (sendsA + sendsB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / sendsA + 1 / sendsB));
  const z = se > 0 ? (conversionB - conversionA) / se : 0;
  // Two-tailed p-value.
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const significant = pValue < alpha;
  const winner = !significant ? "none" : conversionB > conversionA ? "b" : "a";
  const lift = conversionA > 0 ? (conversionB - conversionA) / conversionA : 0;
  const note = significant
    ? `Statistically significant (p=${pValue.toFixed(4)} < α=${alpha}). Variant ${winner.toUpperCase()} wins with ${(lift * 100).toFixed(1)}% lift.`
    : `Not statistically significant (p=${pValue.toFixed(4)} ≥ α=${alpha}). Need more data or larger effect.`;
  return { z, pValue, significant, alpha, winner, conversionA, conversionB, lift, note };
}

// ---------- Rendering ----------

export function renderText(variants: SubjectVariant[]): string {
  return variants.map((v) => `${v.angle}\t${v.score.total}\t${v.text}`).join("\n");
}

export function renderCsv(variants: SubjectVariant[]): string {
  const lines = ["angle,score,char_count,emoji_count,subject"];
  for (const v of variants) {
    lines.push([
      v.angle,
      String(v.score.total),
      String(v.charCount),
      String(v.emojiCount),
      escapeCsv(v.text),
    ].join(","));
  }
  return lines.join("\n");
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

export function buildShareUrl(topic: string, audience: string, angles: SubjectAngle[]): string {
  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  if (audience) params.set("audience", audience);
  if (angles.length > 0) params.set("angles", angles.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { topic: "", audience: "", angles: [] };
  const params = new URLSearchParams(clean);
  const topic = params.get("topic") ?? "";
  const audience = params.get("audience") ?? "";
  const anglesStr = params.get("angles") ?? "";
  const validAngles = Object.keys(ANGLE_LABELS) as SubjectAngle[];
  const angles = anglesStr
    ? anglesStr.split(",").filter((a) => validAngles.includes(a as SubjectAngle)) as SubjectAngle[]
    : [];
  return { topic, audience, angles };
}

// ---------- LLM prompt (BYO key) ----------

export function buildLlmPrompt(topic: string, audience: string, angles: SubjectAngle[]): LlmPrompt {
  const angleList = angles.length > 0 ? angles.join(", ") : "curiosity, urgency, benefit, personalization, question";
  return {
    system: "You are an expert email-marketing copywriter. Generate newsletter subject lines that maximize open rates while remaining non-spammy, brand-safe, and 30-60 characters. Always respond with one subject line per line, no numbering, no quotes.",
    user: `Topic: ${topic}\nAudience: ${audience || "general subscribers"}\nAngles to cover: ${angleList}\n\nGenerate 10 subject-line variants (2 per angle). Each must be 30-60 characters, lowercase-friendly (no ALL CAPS), at most 1 emoji per line, and avoid these spam triggers: free, guarantee, act now, urgent, winner, $$$, !!!. Return one per line.`,
  };
}

export function renderLlmResult(raw: string): SubjectVariant[] {
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // Rotate through angles for variety.
  const angleOrder: SubjectAngle[] = ["curiosity", "urgency", "benefit", "personalization", "question"];
  return lines.slice(0, 20).map((line, i) => {
    const angle = angleListForLine(line, i, angleOrder);
    return buildVariant(angle, line);
  });
}

function angleListForLine(_line: string, i: number, order: SubjectAngle[]): SubjectAngle {
  return order[i % order.length];
}
