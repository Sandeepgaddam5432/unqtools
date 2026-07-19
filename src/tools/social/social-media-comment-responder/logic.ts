/**
 * Social Media Comment Responder — pure logic.
 *
 * Generate professional responses to social media comments categorized
 * by sentiment and intent. Pure functions only — no DOM, no network.
 */

export type Sentiment = "positive" | "neutral" | "negative" | "mixed";
export type Tone = "professional" | "friendly" | "casual" | "apologetic" | "grateful" | "educational";
export type Platform = "twitter" | "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube";
export type ResponseLength = "short" | "medium" | "long";

export interface ResponseInput {
  originalComment: string;
  commentSentiment: Sentiment | "auto";
  responseTone: Tone;
  platform: Platform;
  responseLength: ResponseLength;
  includeEmoji: boolean;
  includeCTA: boolean;
}

export interface ResponseVariation {
  index: number;
  text: string;
  charCount: number;
  sentiment: Sentiment;
  tone: Tone;
  platform: Platform;
  length: ResponseLength;
  truncated: boolean;
}

export interface SummaryStats {
  totalVariations: number;
  avgCharCount: number;
  bySentiment: Record<Sentiment, number>;
  avgQualityScore: number;
  escalatedCount: number;
}

export interface EscalationResult {
  escalated: boolean;
  reason: "legal" | "threatening" | "angry" | null;
  matchedKeywords: string[];
}

export interface QualityScore {
  total: number;
  lengthMatch: number;
  toneMatch: number;
  empathy: number;
  platformFit: number;
}

export interface HighlightResult {
  highlighted: string;
  found: string[];
}

// ---- Keyword libraries ----

export const POSITIVE_KEYWORDS: string[] = [
  "love", "great", "amazing", "awesome", "excellent", "fantastic",
  "wonderful", "perfect", "best", "good", "happy", "thanks", "thank",
  "appreciate", "brilliant", "outstanding", "superb", "impressed",
  "delighted", "thrilled", "fabulous", "incredible", "stellar",
  "loved", "enjoyed", "favorite", "kudos",
];

export const NEGATIVE_KEYWORDS: string[] = [
  "hate", "terrible", "awful", "worst", "bad", "horrible",
  "disappointed", "frustrated", "angry", "useless", "broken",
  "fail", "scam", "fraud", "ridiculous", "unacceptable", "poor",
  "sucks", "garbage", "waste", "disgusting", "annoying",
  "boring", "confusing", "crash", "bug",
];

export const ESCALATION_KEYWORDS: Record<"angry" | "threatening" | "legal", string[]> = {
  angry: ["furious", "outraged", "disgusting", "ridiculous", "unacceptable", "scam", "fraud", "boycott", "rip-off"],
  threatening: ["sue", "lawsuit", "lawyer", "attorney", "legal action", "report you", "better business bureau", "bbb", "police"],
  legal: ["defamation", "cease and desist", "privacy violation", "gdpr", "copyright infringement", "trademark", "libel", "slander"],
};

// ---- Platform presets ----

export interface PlatformPreset {
  platform: Platform;
  label: string;
  charLimit: number;
  responseTime: string;
  style: string;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  { platform: "twitter", label: "Twitter / X", charLimit: 280, responseTime: "Within 1 hour", style: "Concise, punchy, conversational." },
  { platform: "instagram", label: "Instagram", charLimit: 2200, responseTime: "Within 2 hours", style: "Casual, warm, emoji-friendly." },
  { platform: "facebook", label: "Facebook", charLimit: 8000, responseTime: "Within 4 hours", style: "Friendly, community-focused." },
  { platform: "linkedin", label: "LinkedIn", charLimit: 3000, responseTime: "Within 24 hours", style: "Professional, formal, value-driven." },
  { platform: "tiktok", label: "TikTok", charLimit: 150, responseTime: "Within 2 hours", style: "Very short, casual, playful." },
  { platform: "youtube", label: "YouTube", charLimit: 10000, responseTime: "Within 24 hours", style: "Informative, helpful, detailed." },
];

export const PLATFORM_LABELS: Record<Platform, string> = Object.fromEntries(
  PLATFORM_PRESETS.map((p) => [p.platform, p.label]),
) as Record<Platform, string>;

export const PLATFORM_CHAR_LIMITS: Record<Platform, number> = Object.fromEntries(
  PLATFORM_PRESETS.map((p) => [p.platform, p.charLimit]),
) as Record<Platform, number>;

export const PLATFORM_RESPONSE_TIMES: Record<Platform, string> = Object.fromEntries(
  PLATFORM_PRESETS.map((p) => [p.platform, p.responseTime]),
) as Record<Platform, string>;

// ---- Tone presets ----

export interface TonePreset {
  tone: Tone;
  label: string;
  description: string;
}

export const TONE_PRESETS: TonePreset[] = [
  { tone: "professional", label: "Professional", description: "Formal, polite, brand-safe." },
  { tone: "friendly", label: "Friendly", description: "Warm, approachable, personable." },
  { tone: "casual", label: "Casual", description: "Relaxed, conversational, punchy." },
  { tone: "apologetic", label: "Apologetic", description: "Sincere apology, ownership." },
  { tone: "grateful", label: "Grateful", description: "Thanks-first, appreciation-led." },
  { tone: "educational", label: "Educational", description: "Context-providing, explanatory." },
];

export const TONE_LABELS: Record<Tone, string> = Object.fromEntries(
  TONE_PRESETS.map((t) => [t.tone, t.label]),
) as Record<Tone, string>;

// ---- Length presets ----

export interface LengthPreset {
  length: ResponseLength;
  label: string;
  sentenceRange: string;
  targetChars: number;
}

export const LENGTH_PRESETS: LengthPreset[] = [
  { length: "short", label: "Short (1-2 sentences)", sentenceRange: "1-2", targetChars: 120 },
  { length: "medium", label: "Medium (3-4 sentences)", sentenceRange: "3-4", targetChars: 300 },
  { length: "long", label: "Long (5+ sentences)", sentenceRange: "5+", targetChars: 600 },
];

export const LENGTH_LABELS: Record<ResponseLength, string> = Object.fromEntries(
  LENGTH_PRESETS.map((l) => [l.length, l.label]),
) as Record<ResponseLength, string>;

export const LENGTH_TARGET_CHARS: Record<ResponseLength, number> = Object.fromEntries(
  LENGTH_PRESETS.map((l) => [l.length, l.targetChars]),
) as Record<ResponseLength, number>;

// ---- Response template library (50+) ----
// Each sentiment × tone combo has 3 templates → 4 × 6 × 3 = 72 templates.

export const RESPONSE_TEMPLATES: Record<Sentiment, Record<Tone, [string, string, string]>> = {
  positive: {
    professional: [
      "Thank you for your kind words about our product.",
      "We appreciate you taking the time to share this positive feedback.",
      "Your feedback means a great deal to our team.",
    ],
    friendly: [
      "Thanks so much for the love!",
      "We're so glad you're enjoying it!",
      "You just made our day with this comment.",
    ],
    casual: [
      "Wow, thanks!",
      "Appreciate you!",
      "Love hearing this from you.",
    ],
    apologetic: [
      "Thank you for the positive note, even though we know we can always do better.",
      "We appreciate your kind words and will keep striving to improve.",
      "Thanks for the encouragement as we continue to grow.",
    ],
    grateful: [
      "We're truly grateful for your support!",
      "Thank you for being such an amazing part of our community.",
      "Your words of encouragement keep us going.",
    ],
    educational: [
      "Glad you liked it! Here's why we built it this way.",
      "Thanks! The feature you mentioned was designed with input from users like you.",
      "Appreciate the feedback — it helps us prioritize what to build next.",
    ],
  },
  neutral: {
    professional: [
      "Thank you for sharing your perspective.",
      "We appreciate you taking the time to comment.",
      "Your input helps us improve our offerings.",
    ],
    friendly: [
      "Thanks for sharing!",
      "Got it, thanks for letting us know.",
      "Appreciate you chiming in here.",
    ],
    casual: [
      "Noted, thanks!",
      "Gotcha!",
      "Cool, thanks for the heads up.",
    ],
    apologetic: [
      "Apologies if we missed the mark here.",
      "Sorry for any confusion — happy to clarify.",
      "We're sorry if this didn't fully address your needs.",
    ],
    grateful: [
      "Thank you for taking the time to share your thoughts!",
      "Grateful for your input as we refine our approach.",
      "We appreciate your engagement with our content.",
    ],
    educational: [
      "Here's some context that might help.",
      "Let me explain how this works.",
      "Good question — here's the answer.",
    ],
  },
  negative: {
    professional: [
      "We're sorry to hear about your experience and would like to make it right.",
      "Thank you for bringing this to our attention.",
      "We take your feedback seriously and are looking into this.",
    ],
    friendly: [
      "Oh no, we're so sorry to hear that!",
      "That's not the experience we want for you — let's fix it.",
      "Bummer! Let's get this sorted out.",
    ],
    casual: [
      "Yikes, sorry about that.",
      "That sucks, let's fix it.",
      "Our bad — DM us so we can help.",
    ],
    apologetic: [
      "We sincerely apologize for the inconvenience this has caused.",
      "We're truly sorry you had this experience.",
      "Please accept our apologies — this isn't the standard we hold ourselves to.",
    ],
    grateful: [
      "Thank you for flagging this issue — feedback like yours helps us improve.",
      "We appreciate you sharing this, even when it's tough to hear.",
      "Grateful you took the time to point this out so we can address it.",
    ],
    educational: [
      "Here's what happened and how we're addressing it.",
      "Let me walk you through the steps to resolve this.",
      "This issue usually occurs because of a known bug — here's the workaround.",
    ],
  },
  mixed: {
    professional: [
      "Thank you for both the praise and the constructive feedback.",
      "We appreciate your balanced perspective and take your suggestions seriously.",
      "Your feedback highlights both what's working and where we can improve.",
    ],
    friendly: [
      "Thanks for the kind words and the honest feedback!",
      "Glad you liked some of it — we'll work on the rest!",
      "Appreciate the mix of love and suggestions!",
    ],
    casual: [
      "Got the good and the not-so-good — thanks!",
      "Cheers for the honest feedback!",
      "Noted the good, will fix the bad!",
    ],
    apologetic: [
      "Sorry for the parts that didn't hit the mark, and thanks for the parts that did.",
      "We apologize for the issues and appreciate your kind words about the rest.",
      "Apologies for the rough spots, and thank you for recognizing what worked.",
    ],
    grateful: [
      "We're grateful for both your praise and your honest critique.",
      "Thank you for taking the time to share what worked and what didn't.",
      "We appreciate the thoughtful feedback, both positive and negative.",
    ],
    educational: [
      "Let me address both the positives and the concerns you raised.",
      "Here's more context on both fronts.",
      "I'll explain what's working well and what we're doing to fix the rest.",
    ],
  },
};

// ---- Emoji presets (sentiment-aware) ----

export const EMOJI_MAP: Record<Sentiment, string[]> = {
  positive: ["😄", "🎉", "👏", "💯", "🙌"],
  neutral: ["👍", "✨", "💡"],
  negative: ["🙏", "😔", "🤝"],
  mixed: ["🙌", "💡", "🤝"],
};

// ---- CTA presets per platform ----

export const CTA_PRESETS: Record<Platform, string[]> = {
  twitter: ["DM us to continue the conversation.", "Follow for more updates!"],
  instagram: ["Link in bio for more info!", "DM us if you need anything!"],
  facebook: ["Send us a message and we'll help.", "Visit our page for more!"],
  linkedin: ["Connect with us to learn more.", "Visit our company page for insights."],
  tiktok: ["Follow for more!", "Check our bio!"],
  youtube: ["Check the description for links.", "Subscribe for more videos!"],
};

// ---- Best practice tips per sentiment ----

export const BEST_PRACTICE_TIPS: Record<Sentiment, string[]> = {
  positive: [
    "Acknowledge their support by name when possible.",
    "Invite them to share more or refer a friend.",
    "Re-share or feature their comment to amplify goodwill.",
  ],
  neutral: [
    "Provide a clear, concise answer to keep the conversation moving.",
    "Offer a next step (link, DM, resource) to deepen engagement.",
    "Thank them for taking the time to comment.",
  ],
  negative: [
    "Acknowledge their frustration before defending or explaining.",
    "Apologize sincerely — even if it wasn't your fault.",
    "Move the conversation to a private channel (DM, email) to resolve.",
    "Offer a concrete next step with a timeline.",
  ],
  mixed: [
    "Address the positive and the concern separately to show you read carefully.",
    "Thank them for what they liked before tackling the issue.",
    "Be transparent about what you can and cannot fix.",
  ],
};

// ---- Normalize / parse ----

/** Normalize a comment string. */
export function normalizeComment(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Analyze sentiment using keyword matching. */
export function analyzeSentiment(comment: string): Sentiment {
  const text = (comment || "").toLowerCase();
  if (!text.trim()) return "neutral";
  let pos = 0;
  let neg = 0;
  for (const k of POSITIVE_KEYWORDS) {
    const re = new RegExp(`\\b${escapeRegExp(k)}\\b`, "g");
    const m = text.match(re);
    if (m) pos += m.length;
  }
  for (const k of NEGATIVE_KEYWORDS) {
    const re = new RegExp(`\\b${escapeRegExp(k)}\\b`, "g");
    const m = text.match(re);
    if (m) neg += m.length;
  }
  if (pos > 0 && neg > 0) return "mixed";
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

// ---- Escalation detection ----

/** Detect if a comment needs human escalation (angry / threatening / legal). */
export function detectEscalation(comment: string): EscalationResult {
  const text = (comment || "").toLowerCase();
  const matched: string[] = [];
  let reason: EscalationResult["reason"] = null;
  for (const r of ["legal", "threatening", "angry"] as const) {
    for (const k of ESCALATION_KEYWORDS[r]) {
      if (text.includes(k.toLowerCase())) {
        matched.push(k);
        if (!reason) reason = r;
      }
    }
  }
  return { escalated: matched.length > 0, reason, matchedKeywords: matched };
}

// ---- Keyword highlighter ----

/** Wrap sensitive keywords in [[...]] markers for UI highlighting. */
export function highlightKeywords(comment: string): HighlightResult {
  const text = comment || "";
  const found: string[] = [];
  let highlighted = text;
  for (const r of Object.keys(ESCALATION_KEYWORDS) as Array<keyof typeof ESCALATION_KEYWORDS>) {
    for (const k of ESCALATION_KEYWORDS[r]) {
      const re = new RegExp(`(${escapeRegExp(k)})`, "gi");
      if (re.test(highlighted)) {
        found.push(k);
        highlighted = highlighted.replace(re, "[[$1]]");
      }
    }
  }
  return { highlighted, found: Array.from(new Set(found)) };
}

// ---- Response time suggestion ----

export function getResponseTimeSuggestion(platform: Platform): string {
  return PLATFORM_RESPONSE_TIMES[platform];
}

// ---- Best practice tips ----

export function getBestPracticeTips(sentiment: Sentiment): string[] {
  return BEST_PRACTICE_TIPS[sentiment];
}

// ---- Tone modifier ----

const CONTRACTION_MAP: Record<string, string> = {
  "We're": "We are",
  "we're": "we are",
  "Don't": "Do not",
  "don't": "do not",
  "Can't": "Cannot",
  "can't": "cannot",
  "Won't": "Will not",
  "won't": "will not",
  "It's": "It is",
  "it's": "it is",
  "That's": "That is",
  "that's": "that is",
  "We've": "We have",
  "we've": "we have",
  "I'm": "I am",
  "I've": "I have",
};

function expandContractions(text: string): string {
  let out = text;
  for (const [from, to] of Object.entries(CONTRACTION_MAP)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
  }
  return out;
}

/** Apply tone-specific style tweaks. */
export function applyToneModifier(text: string, tone: Tone): string {
  if (!text) return text;
  let out = text;
  if (tone === "professional") {
    out = expandContractions(out);
    if (!/[.!?]$/.test(out)) out += ".";
  } else if (tone === "casual") {
    out = out.replace(/^(["']?)([A-Z])/, (_m, q, c) => `${q}${c.toLowerCase()}`);
  } else if (tone === "friendly") {
    if (!/[.!?]$/.test(out)) out += "!";
  } else if (tone === "apologetic") {
    if (!/^sorry|^we apologize|^apologies/i.test(out)) {
      out = `We're sorry — ${out}`;
    }
    if (!/[.!?]$/.test(out)) out += ".";
  } else if (tone === "grateful") {
    if (!/^thank|^we appreciate|^grateful/i.test(out)) {
      out = `Thank you — ${out}`;
    }
    if (!/[.!?]$/.test(out)) out += "!";
  } else if (tone === "educational") {
    if (!/[.!?]$/.test(out)) out += ".";
  }
  return out;
}

// ---- Platform formatting ----

export function applyPlatformFormatting(text: string, platform: Platform): { text: string; truncated: boolean } {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  if (text.length <= limit) return { text, truncated: false };
  const slice = text.slice(0, limit - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return { text: `${cut}…`, truncated: true };
}

// ---- Length control ----

/** Combine templates to reach the target length, rotating by variation. */
export function applyLengthControl(
  templates: string[],
  length: ResponseLength,
  variationIndex: number,
): string {
  if (templates.length === 0) return "";
  const count = length === "short" ? 1 : length === "medium" ? 2 : 3;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(templates[(variationIndex + i) % templates.length]);
  }
  return parts.join(" ");
}

// ---- Emoji appender ----

/** Append a sentiment-aware emoji. */
export function appendEmoji(text: string, sentiment: Sentiment, variationIndex: number): string {
  const emojis = EMOJI_MAP[sentiment];
  if (emojis.length === 0) return text;
  const emoji = emojis[variationIndex % emojis.length];
  if (!text) return emoji;
  return `${text} ${emoji}`;
}

// ---- CTA appender ----

/** Append a platform-specific CTA. */
export function appendCTA(text: string, platform: Platform, variationIndex: number): string {
  const ctas = CTA_PRESETS[platform];
  if (ctas.length === 0) return text;
  const cta = ctas[variationIndex % ctas.length];
  if (!text) return cta;
  return `${text} ${cta}`;
}

// ---- Quality scorer ----

export function scoreResponseQuality(
  response: ResponseVariation,
  input: ResponseInput,
): QualityScore {
  // length match (0-30)
  const target = LENGTH_TARGET_CHARS[input.responseLength];
  const actual = response.charCount;
  const ratio = target > 0 ? Math.min(actual, target) / target : 1;
  const lengthMatch = Math.round(30 * ratio);

  // tone match (0-30)
  const text = response.text.toLowerCase();
  let toneMatch = 0;
  if (input.responseTone === "professional") {
    toneMatch = /thank you|appreciate|sincerely|please|regret/i.test(text) ? 30 : 15;
  } else if (input.responseTone === "friendly") {
    toneMatch = /!|so |love|glad|happy/i.test(text) ? 30 : 15;
  } else if (input.responseTone === "casual") {
    toneMatch = /!|thanks|gotcha|cool|yikes/i.test(text) ? 30 : 15;
  } else if (input.responseTone === "apologetic") {
    toneMatch = /sorry|apolog|regret|inconvenience/i.test(text) ? 30 : 10;
  } else if (input.responseTone === "grateful") {
    toneMatch = /thank|appreciate|grateful/i.test(text) ? 30 : 10;
  } else if (input.responseTone === "educational") {
    toneMatch = /here's|explain|because|context|how to|steps/i.test(text) ? 30 : 15;
  }

  // empathy (0-20)
  let empathy = 0;
  if (/thank|appreciate|grateful/i.test(text)) empathy += 7;
  if (/sorry|apolog|regret/i.test(text)) empathy += 7;
  if (/\bwe\b|\bour\b|\byou\b|\byour\b/i.test(text)) empathy += 6;
  empathy = Math.min(empathy, 20);

  // platform fit (0-20)
  const platformFit = response.truncated ? 10 : 20;

  const total = lengthMatch + toneMatch + empathy + platformFit;
  return { total, lengthMatch, toneMatch, empathy, platformFit };
}

// ---- Generate responses ----

export function generateResponseVariation(
  input: ResponseInput,
  variationIndex: number,
): ResponseVariation {
  const sentiment: Sentiment =
    input.commentSentiment === "auto"
      ? analyzeSentiment(input.originalComment)
      : input.commentSentiment;
  const templates = RESPONSE_TEMPLATES[sentiment][input.responseTone];
  let text = applyLengthControl(templates, input.responseLength, variationIndex);
  text = applyToneModifier(text, input.responseTone);
  if (input.includeEmoji) {
    text = appendEmoji(text, sentiment, variationIndex);
  }
  if (input.includeCTA) {
    text = appendCTA(text, input.platform, variationIndex);
  }
  const formatted = applyPlatformFormatting(text, input.platform);
  return {
    index: variationIndex,
    text: formatted.text,
    charCount: formatted.text.length,
    sentiment,
    tone: input.responseTone,
    platform: input.platform,
    length: input.responseLength,
    truncated: formatted.truncated,
  };
}

export function generateResponses(input: ResponseInput): ResponseVariation[] {
  if (!normalizeComment(input.originalComment)) return [];
  return [0, 1, 2].map((i) => generateResponseVariation(input, i));
}

// ---- Renderers ----

export function renderText(variations: ResponseVariation[]): string {
  return variations.map((v) => v.text).join("\n\n---\n\n");
}

export function renderCsv(variations: ResponseVariation[]): string {
  const lines = ["variation,response,char_count,sentiment,tone,platform,length,truncated"];
  for (const v of variations) {
    lines.push([
      String(v.index),
      escapeCsv(v.text),
      String(v.charCount),
      v.sentiment,
      v.tone,
      v.platform,
      v.length,
      String(v.truncated),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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

// ---- Summary stats ----

export function computeSummaryStats(
  variations: ResponseVariation[],
  scores: QualityScore[] = [],
  escalations: number = 0,
): SummaryStats {
  const total = variations.length;
  const avgChar = total > 0 ? Math.round(variations.reduce((s, v) => s + v.charCount, 0) / total) : 0;
  const bySentiment: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  for (const v of variations) bySentiment[v.sentiment] += 1;
  const avgQuality = scores.length > 0
    ? Math.round(scores.reduce((s, q) => s + q.total, 0) / scores.length)
    : 0;
  return {
    totalVariations: total,
    avgCharCount: avgChar,
    bySentiment,
    avgQualityScore: avgQuality,
    escalatedCount: escalations,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-comment-responder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  comment: string;
  sentiment: Sentiment;
  tone: Tone;
  platform: Platform;
  length: ResponseLength;
  variationCount: number;
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

const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative", "mixed"];
const VALID_TONES: Tone[] = ["professional", "friendly", "casual", "apologetic", "grateful", "educational"];
const VALID_PLATFORMS: Platform[] = ["twitter", "instagram", "facebook", "linkedin", "tiktok", "youtube"];
const VALID_LENGTHS: ResponseLength[] = ["short", "medium", "long"];

export function buildShareUrl(input: ResponseInput): string {
  const params = new URLSearchParams();
  if (input.originalComment) params.set("comment", input.originalComment);
  params.set("sentiment", input.commentSentiment);
  params.set("tone", input.responseTone);
  params.set("platform", input.platform);
  params.set("length", input.responseLength);
  params.set("emoji", input.includeEmoji ? "1" : "0");
  params.set("cta", input.includeCTA ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ResponseInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ResponseInput> = {};
  const comment = params.get("comment");
  if (comment) out.originalComment = comment;
  const sentiment = params.get("sentiment");
  if (sentiment && (VALID_SENTIMENTS.includes(sentiment as Sentiment) || sentiment === "auto")) {
    out.commentSentiment = sentiment as Sentiment | "auto";
  }
  const tone = params.get("tone");
  if (tone && VALID_TONES.includes(tone as Tone)) out.responseTone = tone as Tone;
  const platform = params.get("platform");
  if (platform && VALID_PLATFORMS.includes(platform as Platform)) out.platform = platform as Platform;
  const length = params.get("length");
  if (length && VALID_LENGTHS.includes(length as ResponseLength)) out.responseLength = length as ResponseLength;
  out.includeEmoji = params.get("emoji") === "1";
  out.includeCTA = params.get("cta") === "1";
  return out;
}

// ---- Count templates ----

export function countTemplates(): number {
  let n = 0;
  for (const s of VALID_SENTIMENTS) {
    for (const t of VALID_TONES) {
      n += RESPONSE_TEMPLATES[s][t].length;
    }
  }
  return n;
}
