/**
 * Social Media Content Repurposer — pure logic.
 *
 * Repurpose one piece of source content (blog, YouTube transcript,
 * podcast transcript, email newsletter, or presentation slides) into
 * 7 target formats: Twitter thread, LinkedIn post, Instagram caption,
 * Facebook post, TikTok script, email summary, and Medium article.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type SourceType =
  | "blog-post"
  | "youtube-transcript"
  | "podcast-transcript"
  | "email-newsletter"
  | "presentation-slides";

export type TargetFormat =
  | "twitter-thread"
  | "linkedin-post"
  | "instagram-caption"
  | "facebook-post"
  | "tiktok-script"
  | "email-summary"
  | "medium-article";

export type Tone =
  | "professional"
  | "casual"
  | "educational"
  | "inspirational"
  | "entertaining";

export interface ContentAnalysis {
  title: string;
  hook: string;
  keyPoints: string[];
  quotes: string[];
  stats: string[];
  cta: string;
  wordCount: number;
  sentenceCount: number;
}

export interface GeneratedContent {
  format: TargetFormat;
  content: string;
  charCount: number;
  itemCount: number;
  variation: number;
}

export interface FormatConfig {
  id: TargetFormat;
  label: string;
  maxChars: number;
  optimalChars: number;
  maxItemsDefault: number;
  description: string;
}

export interface GeneratorOptions {
  tone: Tone;
  includeCTA: boolean;
  maxItemsPerFormat: number;
}

export interface RepurposerInput {
  sourceContent: string;
  sourceType: SourceType;
  targetFormats: TargetFormat[];
  tone: Tone;
  includeCTA: boolean;
  maxItemsPerFormat: number;
}

export interface FormatStat {
  format: TargetFormat;
  label: string;
  charCount: number;
  itemCount: number;
  variations: number;
}

export interface SummaryStats {
  totalFormats: number;
  totalItems: number;
  totalChars: number;
  byFormat: FormatStat[];
}

export interface ConsistencyReport {
  consistent: boolean;
  missingFrom: Array<{ format: TargetFormat; missing: string[] }>;
  coveragePercent: number;
}

export interface QualityScore {
  score: number; // 0-100
  rating: "low" | "medium" | "high";
  reasons: string[];
}

// ---- Constants ----

export const SOURCE_TYPES: SourceType[] = [
  "blog-post",
  "youtube-transcript",
  "podcast-transcript",
  "email-newsletter",
  "presentation-slides",
];

export const TARGET_FORMATS: TargetFormat[] = [
  "twitter-thread",
  "linkedin-post",
  "instagram-caption",
  "facebook-post",
  "tiktok-script",
  "email-summary",
  "medium-article",
];

export const TONES: Tone[] = [
  "professional",
  "casual",
  "educational",
  "inspirational",
  "entertaining",
];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  "blog-post": "Blog Post",
  "youtube-transcript": "YouTube Transcript",
  "podcast-transcript": "Podcast Transcript",
  "email-newsletter": "Email Newsletter",
  "presentation-slides": "Presentation Slides",
};

export const TARGET_FORMAT_LABELS: Record<TargetFormat, string> = {
  "twitter-thread": "Twitter Thread",
  "linkedin-post": "LinkedIn Post",
  "instagram-caption": "Instagram Caption",
  "facebook-post": "Facebook Post",
  "tiktok-script": "TikTok Script (60s)",
  "email-summary": "Email Summary",
  "medium-article": "Medium Article",
};

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional",
  casual: "Casual",
  educational: "Educational",
  inspirational: "Inspirational",
  entertaining: "Entertaining",
};

// 5 source-type presets — sample content users can load
export const SOURCE_TYPE_PRESETS: Record<SourceType, string> = {
  "blog-post":
    `10 Ways to Boost Your Productivity This Week

Productivity isn't about working harder — it's about working smarter. In this post, we'll cover 10 proven techniques that took our team's output up by 42% in just one quarter.

- Start with a single priority each morning
- Batch similar tasks together
- Use the 2-minute rule for quick wins
- Take a 5-minute break every hour
- Eliminate notifications during deep work

Try one technique today and see the difference. Subscribe for more productivity tips!`,
  "youtube-transcript":
    `Hey everyone, today we're talking about how to learn any skill faster.

So the first thing is — most people learn backwards. They watch 10 tutorials and never practice. That's why 95% of learners give up within a month.

The secret? Spend 20% of your time on theory and 80% on practice. Studies show active practice is 4x more effective than passive watching.

Also — track your progress daily. Even 15 minutes a day adds up to 90 hours a year.

If you found this helpful, hit subscribe and check out the free guide in the description.`,
  "podcast-transcript":
    `Welcome back to the show. Today's guest is a startup founder who scaled from zero to $2M ARR in 18 months.

"We didn't have a plan. We just kept talking to users every single day."

That's the quote of the episode. The takeaway: customer conversations beat every analytics dashboard.

Three things they did differently:
1. Talked to 5 customers every week
2. Shipped something every Friday
3. Said no to 80% of feature requests

Follow the show and leave a review if you want more conversations like this.`,
  "email-newsletter":
    `Issue #47: The Art of Saying No

Last week I declined 6 meetings. I got more done in 2 days than I usually do in 5.

"No is a complete sentence." — Anne Lamott

Here's the framework I use:
- If it's not a clear yes, it's a no
- Decline within 24 hours
- Offer an alternative when possible

Try it this week. Sign up for next week's issue where we tackle decision fatigue.`,
  "presentation-slides":
    `Quarterly Business Review — Q3 2026

- Revenue up 28% QoQ
- Customer churn down to 3.2%
- New enterprise logos: 14
- NPS score: 67 (up from 54)

Key wins:
- Launched self-serve onboarding
- Reduced CAC by 19%
- Hired 8 new engineers

Next quarter priorities:
- Ship mobile app
- Expand to EMEA
- Hit $10M ARR

Questions? Reach out to the leadership team.`,
};

// 5 tone presets — vocabulary + opening + closing + emojis
interface TonePreset {
  opening: string;
  closing: string;
  emojiSet: string[];
  vocabFlavor: string;
}

export const TONE_PRESETS: Record<Tone, TonePreset> = {
  professional: {
    opening: "Sharing insights from",
    closing: "Thoughts?",
    emojiSet: ["📊", "📈", "💼", "🎯"],
    vocabFlavor: "strategic, actionable, measurable",
  },
  casual: {
    opening: "Quick thought on",
    closing: "What do you think?",
    emojiSet: ["😊", "👍", "✌️", "☕"],
    vocabFlavor: "easy, simple, real",
  },
  educational: {
    opening: "Let's break down",
    closing: "Save this for later.",
    emojiSet: ["📚", "🎓", "💡", "✏️"],
    vocabFlavor: "step-by-step, learn, understand, framework",
  },
  inspirational: {
    opening: "Believe in the power of",
    closing: "You've got this.",
    emojiSet: ["🌟", "💫", "🚀", "🔥"],
    vocabFlavor: "dream, possible, achieve, transform",
  },
  entertaining: {
    opening: "Okay, so",
    closing: "Don't @ me. 😄",
    emojiSet: ["😂", "🎉", "🍿", "✨"],
    vocabFlavor: "wild, hilarious, plot twist, ridiculous",
  },
};

export const TARGET_FORMAT_CONFIGS: Record<TargetFormat, FormatConfig> = {
  "twitter-thread": {
    id: "twitter-thread",
    label: "Twitter Thread",
    maxChars: 2800,
    optimalChars: 1800,
    maxItemsDefault: 7,
    description: "5-10 numbered tweets with hook + CTA",
  },
  "linkedin-post": {
    id: "linkedin-post",
    label: "LinkedIn Post",
    maxChars: 3000,
    optimalChars: 1300,
    maxItemsDefault: 5,
    description: "Professional post with bullet points",
  },
  "instagram-caption": {
    id: "instagram-caption",
    label: "Instagram Caption",
    maxChars: 2200,
    optimalChars: 1500,
    maxItemsDefault: 5,
    description: "Emoji-heavy caption with hashtags",
  },
  "facebook-post": {
    id: "facebook-post",
    label: "Facebook Post",
    maxChars: 5000,
    optimalChars: 477,
    maxItemsDefault: 3,
    description: "Conversational post with question hook",
  },
  "tiktok-script": {
    id: "tiktok-script",
    label: "TikTok Script (60 sec)",
    maxChars: 2000,
    optimalChars: 1000,
    maxItemsDefault: 5,
    description: "Scene-by-scene 60-sec video script",
  },
  "email-summary": {
    id: "email-summary",
    label: "Email Summary",
    maxChars: 5000,
    optimalChars: 1500,
    maxItemsDefault: 5,
    description: "Subject + preview + body",
  },
  "medium-article": {
    id: "medium-article",
    label: "Medium Article",
    maxChars: 12000,
    optimalChars: 8000,
    maxItemsDefault: 5,
    description: "800-1500 word article with headers",
  },
};

// Phrases that signal a call to action
const CTA_PHRASES = [
  "subscribe", "sign up", "follow", "download", "check out",
  "learn more", "get started", "join", "register", "click here",
  "click the link", "visit", "share", "comment", "like", "retweet",
  "swipe up", "link in bio", "hit the button", "reach out",
];

// 2 hook variations per format — different opening styles
export const HOOK_VARIATIONS: Record<TargetFormat, Array<{ variation: number; hook: string }>> = {
  "twitter-thread": [
    { variation: 1, hook: "🧵 Thread:" },
    { variation: 2, hook: "Quick thread on" },
  ],
  "linkedin-post": [
    { variation: 1, hook: "I've been thinking about" },
    { variation: 2, hook: "Here's what nobody tells you about" },
  ],
  "instagram-caption": [
    { variation: 1, hook: "✨ Swipe to learn about" },
    { variation: 2, hook: "📌 Save this post about" },
  ],
  "facebook-post": [
    { variation: 1, hook: "Has this ever happened to you?" },
    { variation: 2, hook: "Hot take:" },
  ],
  "tiktok-script": [
    { variation: 1, hook: "POV: you just discovered" },
    { variation: 2, hook: "Stop scrolling —" },
  ],
  "email-summary": [
    { variation: 1, hook: "Quick update:" },
    { variation: 2, hook: "Today's brief:" },
  ],
  "medium-article": [
    { variation: 1, hook: "A practical guide to" },
    { variation: 2, hook: "Everything I learned about" },
  ],
};

// ---- Helpers ----

/** Normalize source content (collapse whitespace, trim). */
export function normalizeContent(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Split content into sentences. */
export function splitSentences(content: string): string[] {
  const c = (content || "").trim();
  if (!c) return [];
  // First split by newlines, then by sentence punctuation
  const lines = c.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const s of sentences) out.push(s);
  }
  return out;
}

/** Limit a string to N chars, breaking on a word boundary if possible. */
export function truncateToLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}

// ---- Content Analyzers ----

/** Extract a title — first short line or first sentence (max 100 chars). */
export function extractTitle(content: string): string {
  const raw = (content || "").trim();
  if (!raw) return "";
  const firstLine = raw.split(/\n+/)[0]?.trim() ?? "";
  if (firstLine && firstLine.length <= 100 && !/[.?!]$/.test(firstLine)) {
    return firstLine;
  }
  const firstSentence = splitSentences(raw)[0] ?? "";
  if (firstSentence.length <= 100) return firstSentence;
  return truncateToLimit(firstSentence, 100);
}

/** Extract numbers, percentages, and dollar amounts from content. */
export function extractStats(content: string): string[] {
  const c = normalizeContent(content);
  if (!c) return [];
  const stats = new Set<string>();
  // Percentages: 25%, 25.5%
  const pct = c.match(/\b\d+(?:\.\d+)?%/g) ?? [];
  pct.forEach((s) => stats.add(s));
  // Dollar amounts: $100, $1,000, $1.5M, $1,500,000
  const dollar = c.match(/\$\d[\d,]*(?:\.\d+)?(?:K|M|B)?\b/g) ?? [];
  dollar.forEach((s) => stats.add(s));
  // Plain numbers ≥ 10 (skip small numbers like "1 hour")
  const nums = c.match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? [];
  for (const n of nums) {
    const cleaned = n.replace(/,/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 10) stats.add(n);
  }
  return Array.from(stats);
}

/** Extract quoted text — sentences wrapped in straight or smart quotes. */
export function extractQuotes(content: string): string[] {
  const c = (content || "").trim();
  if (!c) return [];
  const quotes = new Set<string>();
  // Straight quotes
  const straight = c.match(/"([^"\n]{15,250})"/g) ?? [];
  straight.forEach((q) => quotes.add(q));
  // Smart quotes
  const smart = c.match(/\u201C([^\u201D\n]{15,250})\u201D/g) ?? [];
  smart.forEach((q) => quotes.add(q));
  return Array.from(quotes);
}

/** Extract 3-7 key points from content. */
export function extractKeyPoints(content: string, maxItems = 7): string[] {
  const c = (content || "").trim();
  if (!c) return [];
  const lines = c.split(/\n+/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const points: string[] = [];
  // Lines starting with bullet / number markers
  for (const line of lines) {
    if (/^[-*•·\u2022]\s+/.test(line) || /^\d+[.)\]]\s+/.test(line)) {
      const text = line.replace(/^[-*•·\u2022\d.)\]]+\s+/, "").trim();
      if (text.length >= 1 && text.length <= 250) points.push(text);
    }
  }
  // Fallback to sentences
  if (points.length < 3) {
    const sentences = splitSentences(c);
    for (const s of sentences) {
      if (points.includes(s)) continue;
      if (s.length < 15 || s.length > 250) continue;
      if (/[?!]\s*$/.test(s)) continue;
      points.push(s);
      if (points.length >= maxItems) break;
    }
  }
  return points.slice(0, maxItems);
}

/** Extract a CTA phrase (returns the sentence containing a CTA keyword). */
export function extractCTA(content: string): string {
  const c = (content || "").trim();
  if (!c) return "";
  const lower = c.toLowerCase();
  for (const phrase of CTA_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx >= 0) {
      // Find the sentence containing this index
      const sentences = splitSentences(c);
      for (const s of sentences) {
        if (s.toLowerCase().includes(phrase)) return s.trim();
      }
      return capitalize(phrase);
    }
  }
  return "";
}

/** Score a sentence for "hook potential" — longer + power words + punctuation. */
function scoreHook(s: string): number {
  let score = 0;
  if (s.length >= 40 && s.length <= 140) score += 2;
  else if (s.length >= 20) score += 1;
  if (/\d/.test(s)) score += 1;
  if (/\?/.test(s)) score += 1;
  if (/[!]/.test(s)) score += 1;
  const powerWords = [
    "new", "best", "free", "secret", "proven", "ultimate", "easy",
    "now", "you", "your", "how", "why", "what", "first", "only",
  ];
  const lower = s.toLowerCase();
  for (const w of powerWords) {
    if (lower.includes(w)) score += 1;
  }
  return score;
}

/** Extract the most engaging sentence (hook). */
export function extractHook(content: string): string {
  const c = (content || "").trim();
  if (!c) return "";
  const sentences = splitSentences(c);
  if (sentences.length === 0) return "";
  let best = sentences[0];
  let bestScore = scoreHook(best);
  for (const s of sentences) {
    const sc = scoreHook(s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return best;
}

/** Analyze content: extract title, hook, key points, quotes, stats, CTA. */
export function analyzeContent(content: string, maxKeyPoints = 7): ContentAnalysis {
  const c = (content || "").trim();
  const title = extractTitle(c);
  const hook = extractHook(c);
  const keyPoints = extractKeyPoints(c, maxKeyPoints);
  const quotes = extractQuotes(c);
  const stats = extractStats(c);
  const cta = extractCTA(c);
  const sentences = splitSentences(c);
  const wordCount = c ? c.split(/\s+/).filter(Boolean).length : 0;
  return {
    title,
    hook,
    keyPoints,
    quotes,
    stats,
    cta,
    wordCount,
    sentenceCount: sentences.length,
  };
}

/** Apply tone — returns opening + closing + emoji + flavor. */
export function applyTone(tone: Tone): {
  opening: string;
  closing: string;
  emoji: string;
  flavor: string;
} {
  const p = TONE_PRESETS[tone];
  return {
    opening: p.opening,
    closing: p.closing,
    emoji: p.emojiSet[0] ?? "",
    flavor: p.vocabFlavor,
  };
}

/** Generate hashtags from a title/topic. */
export function generateHashtags(title: string, count: number): string[] {
  const t = normalizeContent(title);
  if (!t || count <= 0) return [];
  const base = t.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = base.split(/\s+/).filter(Boolean).slice(0, 4);
  const tags = new Set<string>();
  const joined = words.join("");
  if (joined) tags.add(`#${joined}`);
  for (const w of words) tags.add(`#${w}`);
  const suffixes = ["tips", "guide", "2026", "community", "daily", "love", "101", "pro"];
  for (const s of suffixes) {
    if (tags.size >= count) break;
    if (joined) tags.add(`#${joined}${s}`);
  }
  return Array.from(tags).slice(0, count);
}

/** Generate a CTA string per format. */
export function generateCTA(format: TargetFormat, includeCTA: boolean, detectedCta = ""): string {
  if (!includeCTA) return "";
  if (detectedCta) return detectedCta;
  const defaults: Record<TargetFormat, string> = {
    "twitter-thread": "Follow for more threads like this.",
    "linkedin-post": "What's your take? Comment below.",
    "instagram-caption": "Link in bio for the full guide.",
    "facebook-post": "Like and share if this resonated.",
    "tiktok-script": "Follow for part 2.",
    "email-summary": "Reply with your thoughts.",
    "medium-article": "Clap and follow if you enjoyed this piece.",
  };
  return defaults[format];
}

// ---- Per-Format Generators ----

/** Generate a Twitter thread (5-10 numbered tweets). */
export function generateTwitterThread(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const items: string[] = [];
  const tpl = HOOK_VARIATIONS["twitter-thread"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["twitter-thread"][0];
  const titleLine = a.title
    ? variation === 1 ? `${tpl.hook} ${a.title}` : `${tpl.hook} ${a.title.toLowerCase()}`
    : tpl.hook;
  items.push(titleLine);
  if (a.hook && a.hook !== a.title) items.push(a.hook);
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 8));
  const kps = a.keyPoints.slice(0, limit);
  for (const kp of kps) items.push(kp);
  if (a.stats.length > 0) items.push(`By the numbers: ${a.stats.slice(0, 5).join(" · ")}`);
  if (a.quotes.length > 0) items.push(a.quotes[0]);
  if (opts.includeCTA) items.push(generateCTA("twitter-thread", true, a.cta));
  const total = items.length;
  const content = items
    .map((t, i) => `${i + 1}/${total} ${t}`)
    .join("\n\n");
  return {
    format: "twitter-thread",
    content,
    charCount: content.length,
    itemCount: total,
    variation,
  };
}

/** Generate a LinkedIn post (1300 chars, professional, bullet points). */
export function generateLinkedInPost(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const tpl = HOOK_VARIATIONS["linkedin-post"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["linkedin-post"][0];
  const tone = applyTone(opts.tone);
  const parts: string[] = [];
  parts.push(`${a.title ? `${tpl.hook} ${a.title.toLowerCase()}.` : `${tpl.hook}.`}`);
  if (a.hook && a.hook !== a.title) parts.push(a.hook);
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 6));
  const kps = a.keyPoints.slice(0, limit);
  if (kps.length > 0) {
    parts.push(kps.map((kp) => `• ${kp}`).join("\n"));
  }
  if (a.stats.length > 0) {
    parts.push(`Key stats: ${a.stats.slice(0, 5).join(" · ")}`);
  }
  if (a.quotes.length > 0) parts.push(`"${a.quotes[0]}"`);
  parts.push(tone.closing);
  if (opts.includeCTA) parts.push(generateCTA("linkedin-post", true, a.cta));
  const tags = generateHashtags(a.title, 4);
  if (tags.length > 0) parts.push(tags.join(" "));
  const content = parts.filter((p) => p && p.trim().length > 0).join("\n\n");
  const truncated = truncateToLimit(content, TARGET_FORMAT_CONFIGS["linkedin-post"].maxChars);
  return {
    format: "linkedin-post",
    content: truncated,
    charCount: truncated.length,
    itemCount: limit + (a.stats.length > 0 ? 1 : 0) + 1,
    variation,
  };
}

/** Generate an Instagram caption (2200 chars, emoji-heavy, hashtags). */
export function generateInstagramCaption(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const tpl = HOOK_VARIATIONS["instagram-caption"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["instagram-caption"][0];
  const tone = applyTone(opts.tone);
  const parts: string[] = [];
  parts.push(`${tone.emoji} ${tpl.hook} ${a.title || "this"} ${tone.emoji}`);
  if (a.hook && a.hook !== a.title) parts.push(a.hook);
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 6));
  const kps = a.keyPoints.slice(0, limit);
  if (kps.length > 0) {
    parts.push(kps.map((kp) => `✨ ${kp}`).join("\n"));
  }
  if (a.stats.length > 0) {
    parts.push(`📊 Stats: ${a.stats.slice(0, 5).join("  ·  ")}`);
  }
  if (a.quotes.length > 0) parts.push(`💬 ${a.quotes[0]}`);
  parts.push(tone.closing);
  if (opts.includeCTA) parts.push(generateCTA("instagram-caption", true, a.cta));
  const tags = generateHashtags(a.title, 15);
  if (tags.length > 0) parts.push(tags.join(" "));
  const content = parts.filter((p) => p && p.trim().length > 0).join("\n\n");
  const truncated = truncateToLimit(content, TARGET_FORMAT_CONFIGS["instagram-caption"].maxChars);
  return {
    format: "instagram-caption",
    content: truncated,
    charCount: truncated.length,
    itemCount: limit + (a.stats.length > 0 ? 1 : 0) + 1,
    variation,
  };
}

/** Generate a Facebook post (477 chars, conversational, question hook). */
export function generateFacebookPost(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const tpl = HOOK_VARIATIONS["facebook-post"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["facebook-post"][0];
  const parts: string[] = [];
  parts.push(`${tpl.hook}`);
  if (a.hook && a.hook !== a.title) parts.push(a.hook);
  else if (a.title) parts.push(a.title);
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 3));
  const kps = a.keyPoints.slice(0, limit);
  if (kps.length > 0) {
    parts.push(kps.map((kp) => `→ ${kp}`).join("\n"));
  }
  if (a.stats.length > 0) parts.push(`(${a.stats.slice(0, 3).join(", ")})`);
  if (opts.includeCTA) parts.push(generateCTA("facebook-post", true, a.cta));
  const content = parts.filter((p) => p && p.trim().length > 0).join("\n\n");
  const truncated = truncateToLimit(content, TARGET_FORMAT_CONFIGS["facebook-post"].maxChars);
  return {
    format: "facebook-post",
    content: truncated,
    charCount: truncated.length,
    itemCount: limit + 1,
    variation,
  };
}

/** Generate a TikTok 60-sec script (scene-by-scene). */
export function generateTiktokScript(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const tpl = HOOK_VARIATIONS["tiktok-script"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["tiktok-script"][0];
  const scenes: Array<{ time: string; text: string }> = [];
  scenes.push({ time: "0-3s", text: `${tpl.hook} ${a.title || ""}`.trim() });
  scenes.push({ time: "3-10s", text: a.hook && a.hook !== a.title ? a.hook : (a.title || "Here's the setup.") });
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 5));
  const kps = a.keyPoints.slice(0, limit);
  let t = 10;
  for (const kp of kps) {
    const end = Math.min(t + 10, 55);
    scenes.push({ time: `${t}-${end}s`, text: kp });
    t = end;
    if (t >= 55) break;
  }
  if (a.stats.length > 0 && t < 55) {
    scenes.push({ time: `${t}-55s`, text: `Numbers to remember: ${a.stats.slice(0, 4).join(", ")}` });
    t = 55;
  }
  if (opts.includeCTA) {
    scenes.push({ time: "55-60s", text: generateCTA("tiktok-script", true, a.cta) });
  }
  const content = scenes.map((s) => `[${s.time}] ${s.text}`).join("\n");
  return {
    format: "tiktok-script",
    content,
    charCount: content.length,
    itemCount: scenes.length,
    variation,
  };
}

/** Generate an email summary (subject + preview + body). */
export function generateEmailSummary(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const tpl = HOOK_VARIATIONS["email-summary"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["email-summary"][0];
  const subject = a.title ? truncateToLimit(a.title, 60) : tpl.hook;
  const preview = a.hook && a.hook !== a.title
    ? truncateToLimit(a.hook, 100)
    : truncateToLimit(a.title || "", 100);
  const parts: string[] = [];
  parts.push(`Subject: ${subject}`);
  parts.push(`Preview: ${preview}`);
  parts.push("");
  parts.push(`Hi there,`);
  parts.push(`${tpl.hook} ${a.title || "this week's update"}.`);
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 5));
  const kps = a.keyPoints.slice(0, limit);
  if (kps.length > 0) {
    parts.push(kps.map((kp) => `• ${kp}`).join("\n"));
  }
  if (a.stats.length > 0) {
    parts.push(`By the numbers: ${a.stats.slice(0, 5).join(" · ")}`);
  }
  if (a.quotes.length > 0) parts.push(`Quote: ${a.quotes[0]}`);
  if (opts.includeCTA) parts.push(generateCTA("email-summary", true, a.cta));
  parts.push(`— The Team`);
  const content = parts.filter((p) => p !== null).join("\n");
  return {
    format: "email-summary",
    content,
    charCount: content.length,
    itemCount: limit + 4,
    variation,
  };
}

/** Generate a Medium article (800-1500 words with headers). */
export function generateMediumArticle(
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  const tpl = HOOK_VARIATIONS["medium-article"].find((h) => h.variation === variation)
    ?? HOOK_VARIATIONS["medium-article"][0];
  const parts: string[] = [];
  parts.push(`# ${a.title || "Untitled"}`);
  parts.push("");
  parts.push(`*${tpl.hook} ${a.title || "this topic"}. This article breaks it down step by step.*`);
  parts.push("");
  if (a.hook && a.hook !== a.title) {
    parts.push(`## Introduction`);
    parts.push("");
    parts.push(a.hook);
    parts.push("");
  }
  const limit = Math.max(1, Math.min(opts.maxItemsPerFormat, 5));
  const kps = a.keyPoints.slice(0, limit);
  for (let i = 0; i < kps.length; i++) {
    parts.push(`## ${capitalize(kps[i].split(/\s+/).slice(0, 5).join(" "))}`);
    parts.push("");
    parts.push(kps[i]);
    if (a.stats[i]) parts.push(`For context, consider this number: ${a.stats[i]}.`);
    parts.push("");
  }
  if (a.quotes.length > 0) {
    parts.push(`## A Memorable Quote`);
    parts.push("");
    parts.push(`> ${a.quotes[0]}`);
    parts.push("");
  }
  if (a.stats.length > kps.length) {
    parts.push(`## By the Numbers`);
    parts.push("");
    parts.push(a.stats.join(" · "));
    parts.push("");
  }
  parts.push(`## Conclusion`);
  parts.push("");
  parts.push(`To recap: ${kps.slice(0, 3).join("; ")}.`);
  if (opts.includeCTA) parts.push(generateCTA("medium-article", true, a.cta));
  const content = parts.join("\n");
  return {
    format: "medium-article",
    content,
    charCount: content.length,
    itemCount: limit + 3,
    variation,
  };
}

/** Generate content for a single target format (dispatch). */
export function generateForFormat(
  format: TargetFormat,
  a: ContentAnalysis,
  opts: GeneratorOptions,
  variation = 1,
): GeneratedContent {
  switch (format) {
    case "twitter-thread": return generateTwitterThread(a, opts, variation);
    case "linkedin-post": return generateLinkedInPost(a, opts, variation);
    case "instagram-caption": return generateInstagramCaption(a, opts, variation);
    case "facebook-post": return generateFacebookPost(a, opts, variation);
    case "tiktok-script": return generateTiktokScript(a, opts, variation);
    case "email-summary": return generateEmailSummary(a, opts, variation);
    case "medium-article": return generateMediumArticle(a, opts, variation);
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unknown format: ${String(_exhaustive)}`);
    }
  }
}

/** Generate variation 1 for all selected formats. */
export function generateForFormats(
  formats: TargetFormat[],
  a: ContentAnalysis,
  opts: GeneratorOptions,
): GeneratedContent[] {
  return formats.map((f) => generateForFormat(f, a, opts, 1));
}

/** Generate 2 variations for a single format. */
export function generateVariations(
  format: TargetFormat,
  a: ContentAnalysis,
  opts: GeneratorOptions,
): GeneratedContent[] {
  return [1, 2].map((v) => generateForFormat(format, a, opts, v));
}

// ---- Quality, Consistency, Recommendations ----

/** Score content quality 0-100 based on length, structure, hooks. */
export function scoreContentQuality(a: ContentAnalysis): QualityScore {
  const reasons: string[] = [];
  let score = 0;
  // Length (max 30 pts)
  if (a.wordCount >= 400) { score += 30; }
  else if (a.wordCount >= 200) { score += 20; reasons.push("Content could be longer (200-400 words)."); }
  else if (a.wordCount >= 50) { score += 10; reasons.push("Content is short (<200 words)."); }
  else { reasons.push("Content is very short (<50 words)."); }
  // Structure (max 30 pts)
  if (a.keyPoints.length >= 5) score += 30;
  else if (a.keyPoints.length >= 3) { score += 20; reasons.push("Add more key points (have 3-4)."); }
  else if (a.keyPoints.length >= 1) { score += 10; reasons.push("Few key points detected (<3)."); }
  else { reasons.push("No key points detected."); }
  // Hook (max 20 pts)
  if (a.hook) {
    if (a.hook.length >= 40 && a.hook.length <= 140) score += 20;
    else score += 10;
  } else reasons.push("No clear hook detected.");
  // Stats (max 10 pts)
  if (a.stats.length >= 3) score += 10;
  else if (a.stats.length >= 1) { score += 5; reasons.push("Add more concrete stats/numbers."); }
  else reasons.push("No stats/numbers detected.");
  // Quotes (max 5 pts)
  if (a.quotes.length >= 1) score += 5;
  else reasons.push("No quotes detected.");
  // CTA (max 5 pts)
  if (a.cta) score += 5;
  else reasons.push("No CTA detected.");
  const rating: QualityScore["rating"] = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
  return { score, rating, reasons };
}

/** Check that every key point is referenced in every format's output. */
export function checkCrossFormatConsistency(
  results: GeneratedContent[],
  keyPoints: string[],
): ConsistencyReport {
  if (results.length === 0 || keyPoints.length === 0) {
    return { consistent: true, missingFrom: [], coveragePercent: 100 };
  }
  const missingFrom: Array<{ format: TargetFormat; missing: string[] }> = [];
  let totalChecks = 0;
  let missingCount = 0;
  for (const r of results) {
    const lower = r.content.toLowerCase();
    const missing: string[] = [];
    for (const kp of keyPoints) {
      totalChecks += 1;
      // Use first 4 words of the key point as a fingerprint
      const fingerprint = kp.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      if (fingerprint && !lower.includes(fingerprint)) {
        missing.push(kp);
        missingCount += 1;
      }
    }
    if (missing.length > 0) missingFrom.push({ format: r.format, missing });
  }
  const coveragePercent = totalChecks === 0
    ? 100
    : Math.round(((totalChecks - missingCount) / totalChecks) * 100);
  return {
    consistent: missingFrom.length === 0,
    missingFrom,
    coveragePercent,
  };
}

/** Recommend best format(s) for a given source type. */
export function recommendBestFormat(sourceType: SourceType): TargetFormat[] {
  const map: Record<SourceType, TargetFormat[]> = {
    "blog-post": ["twitter-thread", "linkedin-post", "medium-article"],
    "youtube-transcript": ["tiktok-script", "instagram-caption", "twitter-thread"],
    "podcast-transcript": ["twitter-thread", "email-summary", "linkedin-post"],
    "email-newsletter": ["linkedin-post", "facebook-post", "medium-article"],
    "presentation-slides": ["medium-article", "linkedin-post", "email-summary"],
  };
  return map[sourceType];
}

// ---- Stats & Render ----

/** Compute summary stats across generated content. */
export function computeSummaryStats(results: GeneratedContent[]): SummaryStats {
  const byFormatMap = new Map<TargetFormat, GeneratedContent[]>();
  for (const r of results) {
    if (!byFormatMap.has(r.format)) byFormatMap.set(r.format, []);
    byFormatMap.get(r.format)!.push(r);
  }
  const byFormat: FormatStat[] = [];
  for (const [format, list] of byFormatMap) {
    byFormat.push({
      format,
      label: TARGET_FORMAT_LABELS[format],
      charCount: list.reduce((s, r) => s + r.charCount, 0),
      itemCount: list.reduce((s, r) => s + r.itemCount, 0),
      variations: list.length,
    });
  }
  byFormat.sort((a, b) => a.format.localeCompare(b.format));
  return {
    totalFormats: byFormat.length,
    totalItems: results.reduce((s, r) => s + r.itemCount, 0),
    totalChars: results.reduce((s, r) => s + r.charCount, 0),
    byFormat,
  };
}

/** Render generated content as plain text (per format block). */
export function renderText(results: GeneratedContent[]): string {
  if (results.length === 0) return "";
  const byFormat = new Map<TargetFormat, GeneratedContent[]>();
  for (const r of results) {
    if (!byFormat.has(r.format)) byFormat.set(r.format, []);
    byFormat.get(r.format)!.push(r);
  }
  const blocks: string[] = [];
  for (const [format, list] of byFormat) {
    const cfg = TARGET_FORMAT_CONFIGS[format];
    blocks.push(`=== ${cfg.label} ===`);
    blocks.push(`Max chars: ${cfg.maxChars} | Optimal: ${cfg.optimalChars}`);
    blocks.push("");
    list.forEach((r) => {
      blocks.push(`--- Variation ${r.variation} ---`);
      blocks.push(`Chars: ${r.charCount} | Items: ${r.itemCount}`);
      blocks.push("");
      blocks.push(r.content);
      blocks.push("");
    });
    blocks.push("");
  }
  return blocks.join("\n").trim() + "\n";
}

/** Render generated content as CSV (format, content, char_count, item_count). */
export function renderCsv(results: GeneratedContent[]): string {
  const lines = ["format,content,char_count,item_count,variation"];
  for (const r of results) {
    lines.push([
      r.format,
      escapeCsv(r.content),
      String(r.charCount),
      String(r.itemCount),
      String(r.variation),
    ].join(","));
  }
  return lines.join("\n");
}

/** Split a CSV row, honoring quoted values with embedded commas/newlines. */
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

const HISTORY_KEY = "unqtools:social-media-content-repurposer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  sourceType: SourceType;
  targetFormats: TargetFormat[];
  tone: Tone;
  wordCount: number;
  totalFormats: number;
  totalChars: number;
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

export function buildShareUrl(input: RepurposerInput): string {
  const params = new URLSearchParams();
  if (input.sourceContent) {
    // Cap to avoid exceeding URL length limits in some browsers
    const cap = input.sourceContent.slice(0, 4000);
    params.set("content", cap);
  }
  if (input.sourceType) params.set("src", input.sourceType);
  if (input.targetFormats.length > 0) params.set("fmt", input.targetFormats.join(","));
  if (input.tone) params.set("tone", input.tone);
  if (!input.includeCTA) params.set("cta", "0");
  if (input.maxItemsPerFormat !== 5) params.set("max", String(input.maxItemsPerFormat));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): RepurposerInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      sourceContent: "",
      sourceType: "blog-post",
      targetFormats: [],
      tone: "professional",
      includeCTA: true,
      maxItemsPerFormat: 5,
    };
  }
  const params = new URLSearchParams(clean);
  const sourceContent = params.get("content") ?? "";
  const src = params.get("src") ?? "blog-post";
  const sourceType: SourceType = (SOURCE_TYPES.includes(src as SourceType)
    ? (src as SourceType)
    : "blog-post");
  const fmtStr = params.get("fmt") ?? "";
  const targetFormats: TargetFormat[] = fmtStr
    ? (fmtStr.split(",").filter((f) => TARGET_FORMATS.includes(f as TargetFormat)) as TargetFormat[])
    : [];
  const t = params.get("tone") ?? "professional";
  const tone: Tone = (TONES.includes(t as Tone) ? (t as Tone) : "professional");
  const includeCTA = params.get("cta") !== "0";
  const maxRaw = params.get("max");
  const maxItemsPerFormat = maxRaw ? Math.max(1, Math.min(20, parseInt(maxRaw, 10) || 5)) : 5;
  return {
    sourceContent,
    sourceType,
    targetFormats,
    tone,
    includeCTA,
    maxItemsPerFormat,
  };
}
