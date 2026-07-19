/**
 * LinkedIn Post Formatter — pure logic.
 *
 * Format raw thoughts into LinkedIn-ready posts with hooks, bullets,
 * CTAs, hashtags, and algorithm-friendly line breaks. Pure functions
 * only — no DOM, no network.
 */

export type PostType =
  | "text-post"
  | "article-share"
  | "poll"
  | "celebration"
  | "hiring";

export type Tone =
  | "thought-leader"
  | "educator"
  | "mentor"
  | "storyteller"
  | "analyst";

export interface PostInput {
  rawContent: string;
  postType: PostType;
  includeHeadline: boolean;
  includeBullets: boolean;
  includeCTA: boolean;
  includeHashtags: boolean;
  tone: Tone;
}

export interface FormattedPost {
  postType: PostType;
  tone: Tone;
  headline: string;
  body: string;
  bullets: string[];
  cta: string;
  hashtags: string[];
  formattedText: string;
  htmlText: string;
  markdownText: string;
  charCount: number;
  wordCount: number;
  readingTimeMin: number;
  emojiCount: number;
  withinLimit: boolean;
  withinOptimal: boolean;
  validationIssues: string[];
  hookScore: number;
}

export interface SummaryStats {
  totalVariations: number;
  avgCharCount: number;
  avgWordCount: number;
  avgReadingTime: number;
  totalHashtags: number;
  withinLimitCount: number;
  withinOptimalCount: number;
  avgHookScore: number;
}

export const POST_TYPES: PostType[] = [
  "text-post",
  "article-share",
  "poll",
  "celebration",
  "hiring",
];

export const TONES: Tone[] = [
  "thought-leader",
  "educator",
  "mentor",
  "storyteller",
  "analyst",
];

export const POST_TYPE_LABELS: Record<PostType, string> = {
  "text-post": "Text Post",
  "article-share": "Article Share",
  "poll": "Poll",
  "celebration": "Celebration",
  "hiring": "Hiring",
};

export const TONE_LABELS: Record<Tone, string> = {
  "thought-leader": "Thought Leader",
  "educator": "Educator",
  "mentor": "Mentor",
  "storyteller": "Storyteller",
  "analyst": "Analyst",
};

export interface PostTypeConfig {
  id: PostType;
  label: string;
  cta: string;
  structure: string;
}

export const POST_TYPE_CONFIGS: Record<PostType, PostTypeConfig> = {
  "text-post": {
    id: "text-post",
    label: "Text Post",
    cta: "What's your take on this? Drop a comment below.",
    structure: "Hook → Story → Insight → CTA",
  },
  "article-share": {
    id: "article-share",
    label: "Article Share",
    cta: "Read the full article and let me know what you think.",
    structure: "Hook → Why it matters → Key takeaway → CTA",
  },
  "poll": {
    id: "poll",
    label: "Poll",
    cta: "Vote in the poll and share your reasoning in the comments.",
    structure: "Hook → Question → Options → CTA",
  },
  "celebration": {
    id: "celebration",
    label: "Celebration",
    cta: "Thanks for being part of the journey. Tag someone who deserves recognition.",
    structure: "Hook → Milestone → Gratitude → CTA",
  },
  "hiring": {
    id: "hiring",
    label: "Hiring",
    cta: "DM me or apply via the link in the comments.",
    structure: "Hook → Role → Requirements → CTA",
  },
};

interface TonePreset {
  id: Tone;
  label: string;
  hookPrefix: string;
  signoff: string;
  vocabIntensity: number; // 1-5, higher = more formal/analytical
}

export const TONE_PRESETS: Record<Tone, TonePreset> = {
  "thought-leader": {
    id: "thought-leader",
    label: "Thought Leader",
    hookPrefix: "",
    signoff: "Here's my take.",
    vocabIntensity: 4,
  },
  "educator": {
    id: "educator",
    label: "Educator",
    hookPrefix: "",
    signoff: "Hope this helps.",
    vocabIntensity: 3,
  },
  "mentor": {
    id: "mentor",
    label: "Mentor",
    hookPrefix: "",
    signoff: "Keep going — you've got this.",
    vocabIntensity: 2,
  },
  "storyteller": {
    id: "storyteller",
    label: "Storyteller",
    hookPrefix: "",
    signoff: "That's the story. What's yours?",
    vocabIntensity: 2,
  },
  "analyst": {
    id: "analyst",
    label: "Analyst",
    hookPrefix: "",
    signoff: "Data speaks. Listen.",
    vocabIntensity: 5,
  },
};

// Char limits
export const MAX_CHARS = 3000;
export const OPTIMAL_CHARS = 1300;
export const MAX_EMOJIS = 4;

// Best-time-to-post suggestion (LinkedIn B2B engagement data)
export interface DayHour {
  day: string;
  hour: string;
  engagement: "high" | "medium" | "low";
}

export const BEST_TIMES: DayHour[] = [
  { day: "Tuesday", hour: "8-10 AM", engagement: "high" },
  { day: "Wednesday", hour: "8-10 AM", engagement: "high" },
  { day: "Thursday", hour: "9-11 AM", engagement: "high" },
  { day: "Tuesday", hour: "12 PM", engagement: "medium" },
  { day: "Wednesday", hour: "12 PM", engagement: "medium" },
  { day: "Friday", hour: "8-9 AM", engagement: "medium" },
  { day: "Monday", hour: "8-9 AM", engagement: "medium" },
];

// Professional hashtag pool — used as fallback when content-derived tags are insufficient
export const FALLBACK_HASHTAGS: string[] = [
  "leadership", "growth", "career", "innovation", "strategy",
  "professional", "mindset", "success", "networking", "productivity",
];

// Words flagged by the professional language checker
const UNPROFESSIONAL_WORDS = [
  "stuff", "things", "kinda", "gonna", "wanna", "gotta",
  "lol", "omg", "btw", "af", "fam", "yolo", "rn",
];

// Hook strength patterns
const STRONG_HOOK_PATTERNS = [
  /\$\d/i, // dollar amounts
  /\b\d+\s+(?:percent|%|x|ways|steps|hours|days|weeks|months|years)\b/i, // numbers
  /\bhow i\b/i,
  /\bwhy i\b/i,
  /\bthe truth about\b/i,
  /\bnobody talks about\b/i,
  /\bstop doing\b/i,
  /\bi (?:learned|realized|discovered|failed|built|sold)\b/i,
  /\bmost people\b/i,
  /\bsecret\b/i,
  /\bnever\b/i,
  /\balways\b/i,
  /\blesson\b/i,
  /\bmistake\b/i,
];

// Words to exclude from hashtag generation
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
  "to", "of", "in", "on", "for", "with", "by", "from", "at", "as",
  "i", "you", "we", "they", "he", "she", "it", "this", "that",
  "these", "those", "my", "your", "our", "their", "his", "her", "its",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "should", "could", "can", "may", "might", "must",
  "if", "then", "so", "than", "too", "very", "just", "only", "also",
  "about", "into", "out", "up", "down", "over", "under", "again",
  "what", "which", "who", "whom", "when", "where", "why", "how",
  "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "own", "same", "off", "now",
  "through", "during", "before", "after", "above", "below", "between",
  "here", "there", "once", "because", "while", "since", "until", "without",
]);

/** Normalize whitespace in a string. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Split raw content into sentences. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Split raw content into paragraphs (blank-line separated). */
export function splitParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => normalizeText(p))
    .filter(Boolean);
}

/** Extract a headline (first engaging sentence → bold hook). */
export function extractHeadline(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  // Take the first non-trivial sentence (>= 4 words)
  const first = sentences.find((s) => s.split(/\s+/).length >= 4) ?? sentences[0];
  // Trim to ~140 chars to fit the LinkedIn hook preview
  const trimmed = trimToLength(first, 140);
  return capitalize(trimmed);
}

/** Trim to a max length on a word boundary. */
export function trimToLength(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.5) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}

/** Extract bullet point candidates from content (sentences with colons, dashes, or short lines). */
export function extractBullets(text: string): string[] {
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    // Already bulleted lines
    const stripped = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (stripped) bullets.push(stripped);
  }
  // If no bullets found from formatting, try sentences with colons
  if (bullets.length < 2) {
    const sentences = splitSentences(text);
    const candidates = sentences.filter((s) => {
      const wordCount = s.split(/\s+/).length;
      return wordCount >= 3 && wordCount <= 25;
    });
    if (candidates.length >= 2) return candidates.slice(0, 5);
  }
  return bullets.slice(0, 5);
}

/** Format bullet points with bullet character. */
export function formatBullets(items: string[], numbered = false): string[] {
  if (numbered) {
    return items.map((it, i) => `${i + 1}. ${normalizeText(it)}`);
  }
  return items.map((it) => `• ${normalizeText(it)}`);
}

/** Format content with LinkedIn-friendly line breaks (single newlines, no triple+ breaks). */
export function formatLineBreaks(text: string): string {
  if (!text) return "";
  return text
    // Replace 3+ newlines with 2
    .replace(/\n{3,}/g, "\n\n")
    // Strip trailing whitespace on each line
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

/** Generate CTA per post type. */
export function generateCTA(postType: PostType, includeCTA: boolean): string {
  if (!includeCTA) return "";
  return POST_TYPE_CONFIGS[postType].cta;
}

/** Extract words from content for hashtag generation (excluding stopwords). */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  // Count frequency
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  // Sort by frequency desc, then alphabetically
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([w]) => w);
}

/** Generate 3-5 professional hashtags from content. */
export function generateHashtags(text: string, includeHashtags: boolean): string[] {
  if (!includeHashtags) return [];
  const keywords = extractKeywords(text);
  const tags: string[] = [];
  for (const k of keywords) {
    if (tags.length >= 5) break;
    if (k.length >= 4 && !tags.includes(k)) tags.push(k);
  }
  // Pad with fallback hashtags if fewer than 3
  for (const f of FALLBACK_HASHTAGS) {
    if (tags.length >= 3) break;
    if (!tags.includes(f)) tags.push(f);
  }
  return tags.slice(0, 5);
}

/** Apply tone modifiers to a paragraph. */
export function applyTone(tone: Tone, paragraph: string): string {
  if (!paragraph) return "";
  const preset = TONE_PRESETS[tone];
  // Tone shapes sentence structure subtly
  if (tone === "analyst") {
    // Analyst: append a clause suggesting evidence
    if (!/[.!?]$/.test(paragraph)) paragraph += ".";
    if (!/\b(data|research|study|evidence|metric|number)\b/i.test(paragraph)) {
      return `${paragraph} The data backs this up.`;
    }
    return paragraph;
  }
  if (tone === "storyteller") {
    // Storyteller: ensure vividness
    if (!/\b(when|after|before|once|one day|years ago|last week|today)\b/i.test(paragraph)) {
      return `A few years back, ${paragraph.charAt(0).toLowerCase()}${paragraph.slice(1)}`;
    }
    return paragraph;
  }
  if (tone === "mentor") {
    // Mentor: add supportive framing
    if (!/[.!?]$/.test(paragraph)) paragraph += ".";
    return `${paragraph} You can do this too.`;
  }
  if (tone === "educator") {
    // Educator: explicit teaching framing
    if (!/[.!?]$/.test(paragraph)) paragraph += ".";
    if (!/\b(here's|let me|the key|tip|lesson|insight|first)\b/i.test(paragraph)) {
      return `Here's the key: ${paragraph.charAt(0).toLowerCase()}${paragraph.slice(1)}`;
    }
    return paragraph;
  }
  // thought-leader: leave as-is (voice-driven)
  return paragraph;
}

/** Count emojis in a string. */
export function countEmojis(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu);
  return matches ? matches.length : 0;
}

/** Validate LinkedIn format — emoji limit and professional language. */
export function validateFormat(text: string): string[] {
  const issues: string[] = [];
  if (!text) return issues;
  const emojiCount = countEmojis(text);
  if (emojiCount > MAX_EMOJIS) {
    issues.push(`Too many emojis (${emojiCount} > ${MAX_EMOJIS}). LinkedIn favors text-focused posts.`);
  }
  const lower = text.toLowerCase();
  const found = UNPROFESSIONAL_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (found.length > 0) {
    issues.push(`Informal language detected: ${found.join(", ")}. Consider more professional wording.`);
  }
  if (/\s{4,}/.test(text)) {
    issues.push("Excessive spaces detected. LinkedIn may collapse them.");
  }
  if (/\n{3,}/.test(text)) {
    issues.push("Excessive blank lines (>2). LinkedIn collapses these to a single break.");
  }
  // All-caps shouting
  const upper = text.replace(/[^A-Z]/g, "").length;
  const letters = text.replace(/[^A-Za-z]/g, "").length;
  if (letters > 50 && upper / letters > 0.4) {
    issues.push("High percentage of uppercase letters — reads as shouting. Consider mixing case.");
  }
  return issues;
}

/** Score hook strength (0-100) based on first-sentence patterns. */
export function scoreHook(headline: string): number {
  if (!headline) return 0;
  let score = 30; // baseline
  for (const pattern of STRONG_HOOK_PATTERNS) {
    if (pattern.test(headline)) score += 12;
  }
  // Optimal length 60-120 chars
  if (headline.length >= 60 && headline.length <= 120) score += 10;
  else if (headline.length > 120) score -= 5;
  else if (headline.length < 30) score -= 10;
  // Question in hook
  if (/\?$/.test(headline)) score += 8;
  // Strong punctuation
  if (/[!]/.test(headline)) score += 5;
  return Math.max(0, Math.min(100, score));
}

/** Compute reading time in minutes (~200 wpm). */
export function readingTime(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

/** Format a single variation. */
export function formatPost(input: PostInput, variation: number): FormattedPost {
  const raw = (input.rawContent || "").trim();
  if (!raw) {
    return emptyPost(input.postType, input.tone);
  }

  const paragraphs = splitParagraphs(raw);
  const firstParagraph = paragraphs[0] ?? normalizeText(raw);
  const headline = input.includeHeadline ? extractHeadline(raw) : "";
  const bodyParagraphs = paragraphs.slice(1);
  const bulletItems = input.includeBullets ? extractBullets(raw) : [];
  const cta = generateCTA(input.postType, input.includeCTA);
  const hashtags = generateHashtags(raw, input.includeHashtags);
  const tone = input.tone;
  const preset = TONE_PRESETS[tone];

  // Build sections
  const sections: string[] = [];

  // Variation-specific headline tweaks
  let hookLine = headline;
  if (variation === 2) {
    // Variation 2: question-framed hook
    if (!/\?$/.test(hookLine)) {
      hookLine = `${trimToLength(hookLine.replace(/[.!?]+$/, ""), 120)} — here's what I learned. What's your experience?`;
    }
  } else if (variation === 3) {
    // Variation 3: number-anchored hook
    const nums = hookLine.match(/\d+/);
    if (nums) {
      hookLine = `${nums[0]} reasons this matters: ${trimToLength(hookLine, 100)}`;
    } else {
      hookLine = `Three takeaways from this: ${trimToLength(hookLine, 100)}`;
    }
  }
  hookLine = capitalize(hookLine);

  if (input.includeHeadline && hookLine) {
    sections.push(hookLine);
    sections.push(""); // blank line between hook and body
  }

  // Body — apply tone per paragraph
  if (bodyParagraphs.length > 0) {
    for (const p of bodyParagraphs) {
      sections.push(applyTone(tone, p));
      sections.push("");
    }
  } else if (firstParagraph && !input.includeHeadline) {
    sections.push(applyTone(tone, firstParagraph));
    sections.push("");
  }

  // Bullets
  if (input.includeBullets && bulletItems.length > 0) {
    const formatted = formatBullets(bulletItems, variation === 3);
    sections.push(formatted.join("\n"));
    sections.push("");
  }

  // Signoff
  if (preset.signoff) {
    sections.push(preset.signoff);
    sections.push("");
  }

  // CTA
  if (cta) {
    sections.push(cta);
    sections.push("");
  }

  // Hashtags
  if (hashtags.length > 0) {
    sections.push(hashtags.map((h) => `#${h}`).join(" "));
  }

  let formattedText = sections.join("\n").trim();
  formattedText = formatLineBreaks(formattedText);

  const charCount = formattedText.length;
  const wordCount = formattedText.split(/\s+/).filter(Boolean).length;
  const emojiCount = countEmojis(formattedText);
  const withinLimit = charCount <= MAX_CHARS;
  const withinOptimal = charCount <= OPTIMAL_CHARS;
  const validationIssues = validateFormat(formattedText);
  const hookScore = scoreHook(hookLine || headline);

  // HTML version — bold hook
  const htmlParts: string[] = [];
  if (input.includeHeadline && hookLine) {
    htmlParts.push(`<p><strong>${escapeHtml(hookLine)}</strong></p>`);
  }
  if (bodyParagraphs.length > 0) {
    for (const p of bodyParagraphs) {
      htmlParts.push(`<p>${escapeHtml(applyTone(tone, p))}</p>`);
    }
  }
  if (input.includeBullets && bulletItems.length > 0) {
    const items = bulletItems.map((b) => `  <li>${escapeHtml(normalizeText(b))}</li>`).join("\n");
    htmlParts.push(`<ul>\n${items}\n</ul>`);
  }
  if (preset.signoff) {
    htmlParts.push(`<p><em>${escapeHtml(preset.signoff)}</em></p>`);
  }
  if (cta) {
    htmlParts.push(`<p>${escapeHtml(cta)}</p>`);
  }
  if (hashtags.length > 0) {
    htmlParts.push(`<p>${hashtags.map((h) => `#${escapeHtml(h)}`).join(" ")}</p>`);
  }
  const htmlText = htmlParts.join("\n");

  // Markdown version
  const mdParts: string[] = [];
  if (input.includeHeadline && hookLine) {
    mdParts.push(`**${hookLine}**`);
    mdParts.push("");
  }
  if (bodyParagraphs.length > 0) {
    for (const p of bodyParagraphs) {
      mdParts.push(applyTone(tone, p));
      mdParts.push("");
    }
  }
  if (input.includeBullets && bulletItems.length > 0) {
    for (const b of bulletItems) {
      mdParts.push(`- ${normalizeText(b)}`);
    }
    mdParts.push("");
  }
  if (preset.signoff) {
    mdParts.push(`*${preset.signoff}*`);
    mdParts.push("");
  }
  if (cta) {
    mdParts.push(cta);
    mdParts.push("");
  }
  if (hashtags.length > 0) {
    mdParts.push(hashtags.map((h) => `#${h}`).join(" "));
  }
  const markdownText = mdParts.join("\n").trim();

  return {
    postType: input.postType,
    tone: input.tone,
    headline: hookLine || headline,
    body: bodyParagraphs.join("\n\n"),
    bullets: bulletItems,
    cta,
    hashtags,
    formattedText,
    htmlText,
    markdownText,
    charCount,
    wordCount,
    readingTimeMin: readingTime(wordCount),
    emojiCount,
    withinLimit,
    withinOptimal,
    validationIssues,
    hookScore,
  };
}

function emptyPost(postType: PostType, tone: Tone): FormattedPost {
  return {
    postType,
    tone,
    headline: "",
    body: "",
    bullets: [],
    cta: "",
    hashtags: [],
    formattedText: "",
    htmlText: "",
    markdownText: "",
    charCount: 0,
    wordCount: 0,
    readingTimeMin: 0,
    emojiCount: 0,
    withinLimit: true,
    withinOptimal: true,
    validationIssues: [],
    hookScore: 0,
  };
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Generate 3 variations with different headlines. */
export function generateVariations(input: PostInput): FormattedPost[] {
  return [1, 2, 3].map((v) => formatPost(input, v));
}

/** Compute summary stats across variations. */
export function computeStats(posts: FormattedPost[]): SummaryStats {
  if (posts.length === 0) {
    return {
      totalVariations: 0,
      avgCharCount: 0,
      avgWordCount: 0,
      avgReadingTime: 0,
      totalHashtags: 0,
      withinLimitCount: 0,
      withinOptimalCount: 0,
      avgHookScore: 0,
    };
  }
  const totalChars = posts.reduce((s, p) => s + p.charCount, 0);
  const totalWords = posts.reduce((s, p) => s + p.wordCount, 0);
  const totalRead = posts.reduce((s, p) => s + p.readingTimeMin, 0);
  const totalHashtags = posts.reduce((s, p) => s + p.hashtags.length, 0);
  const withinLimitCount = posts.filter((p) => p.withinLimit).length;
  const withinOptimalCount = posts.filter((p) => p.withinOptimal).length;
  const totalHook = posts.reduce((s, p) => s + p.hookScore, 0);
  return {
    totalVariations: posts.length,
    avgCharCount: Math.round(totalChars / posts.length),
    avgWordCount: Math.round(totalWords / posts.length),
    avgReadingTime: Math.round((totalRead / posts.length) * 10) / 10,
    totalHashtags,
    withinLimitCount,
    withinOptimalCount,
    avgHookScore: Math.round(totalHook / posts.length),
  };
}

/** Recommend best times to post. */
export function recommendBestTimes(): DayHour[] {
  return BEST_TIMES;
}

/** Top 3 best times. */
export function topBestTimes(): DayHour[] {
  return BEST_TIMES.filter((t) => t.engagement === "high").slice(0, 3);
}

/** Render a post as plain text report. */
export function renderText(posts: FormattedPost[]): string {
  if (posts.length === 0) return "";
  const blocks: string[] = [];
  posts.forEach((p, i) => {
    blocks.push(`=== Variation ${i + 1} (${POST_TYPE_LABELS[p.postType]} / ${TONE_LABELS[p.tone]}) ===`);
    blocks.push(`Chars: ${p.charCount}/${MAX_CHARS}${p.withinLimit ? "" : " [OVER LIMIT]"}${p.withinOptimal ? " [optimal]" : ""}`);
    blocks.push(`Words: ${p.wordCount} | Reading time: ${p.readingTimeMin} min | Emojis: ${p.emojiCount} | Hook score: ${p.hookScore}/100`);
    if (p.validationIssues.length > 0) {
      blocks.push(`Issues: ${p.validationIssues.join("; ")}`);
    }
    blocks.push("");
    blocks.push(p.formattedText);
    blocks.push("");
    blocks.push("");
  });
  // Best time suggestion
  const best = topBestTimes();
  if (best.length > 0) {
    blocks.push("=== Best Time to Post (LinkedIn B2B) ===");
    for (const t of best) {
      blocks.push(`${t.day} ${t.hour} — ${t.engagement} engagement`);
    }
    blocks.push("");
  }
  return blocks.join("\n").trim() + "\n";
}

/** Render posts as HTML. */
export function renderHtml(posts: FormattedPost[]): string {
  if (posts.length === 0) return "";
  const blocks: string[] = [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"UTF-8\">",
    "<title>LinkedIn Posts</title>",
    "</head>",
    "<body>",
  ];
  posts.forEach((p, i) => {
    blocks.push(`<h2>Variation ${i + 1} — ${escapeHtml(POST_TYPE_LABELS[p.postType])} (${escapeHtml(TONE_LABELS[p.tone])})</h2>`);
    blocks.push(`<p><em>${p.charCount} chars · ${p.wordCount} words · ${p.readingTimeMin} min read · Hook score ${p.hookScore}/100</em></p>`);
    blocks.push(p.htmlText);
    blocks.push("<hr>");
  });
  blocks.push("</body>");
  blocks.push("</html>");
  return blocks.join("\n");
}

/** Render posts as Markdown. */
export function renderMarkdown(posts: FormattedPost[]): string {
  if (posts.length === 0) return "";
  const blocks: string[] = [];
  posts.forEach((p, i) => {
    blocks.push(`## Variation ${i + 1} — ${POST_TYPE_LABELS[p.postType]} (${TONE_LABELS[p.tone]})`);
    blocks.push("");
    blocks.push(`*${p.charCount} chars · ${p.wordCount} words · ${p.readingTimeMin} min read · Hook score ${p.hookScore}/100*`);
    blocks.push("");
    blocks.push(p.markdownText);
    blocks.push("");
    blocks.push("---");
    blocks.push("");
  });
  return blocks.join("\n").trim() + "\n";
}

/** Render posts as CSV (component, value). */
export function renderCsv(posts: FormattedPost[]): string {
  const lines = ["variation,post_type,tone,component,value"];
  posts.forEach((p, i) => {
    const v = String(i + 1);
    const pt = p.postType;
    const tn = p.tone;
    lines.push([v, pt, tn, "headline", escapeCsv(p.headline)].join(","));
    lines.push([v, pt, tn, "char_count", String(p.charCount)].join(","));
    lines.push([v, pt, tn, "word_count", String(p.wordCount)].join(","));
    lines.push([v, pt, tn, "reading_time_min", String(p.readingTimeMin)].join(","));
    lines.push([v, pt, tn, "emoji_count", String(p.emojiCount)].join(","));
    lines.push([v, pt, tn, "within_limit", p.withinLimit ? "yes" : "no"].join(","));
    lines.push([v, pt, tn, "within_optimal", p.withinOptimal ? "yes" : "no"].join(","));
    lines.push([v, pt, tn, "hook_score", String(p.hookScore)].join(","));
    lines.push([v, pt, tn, "cta", escapeCsv(p.cta)].join(","));
    lines.push([v, pt, tn, "hashtags", escapeCsv(p.hashtags.join(" "))].join(","));
    lines.push([v, pt, tn, "formatted_text", escapeCsv(p.formattedText)].join(","));
  });
  return lines.join("\n");
}

/** Split a CSV row with quoted values. */
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

const HISTORY_KEY = "unqtools:linkedin-post-formatter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  postType: PostType;
  tone: Tone;
  charCount: number;
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

export function buildShareUrl(input: PostInput): string {
  const params = new URLSearchParams();
  if (input.rawContent) params.set("content", input.rawContent);
  if (input.postType) params.set("type", input.postType);
  if (input.tone) params.set("tone", input.tone);
  if (input.includeHeadline) params.set("hook", "1");
  if (input.includeBullets) params.set("bullets", "1");
  if (input.includeCTA) params.set("cta", "1");
  if (input.includeHashtags) params.set("tags", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): PostInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: PostInput = {
    rawContent: "",
    postType: "text-post",
    includeHeadline: true,
    includeBullets: true,
    includeCTA: true,
    includeHashtags: true,
    tone: "thought-leader",
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const pt = params.get("type") as PostType | null;
  const tone = params.get("tone") as Tone | null;
  return {
    rawContent: params.get("content") ?? "",
    postType: pt && POST_TYPES.includes(pt) ? pt : "text-post",
    includeHeadline: params.get("hook") === "1",
    includeBullets: params.get("bullets") === "1",
    includeCTA: params.get("cta") !== "0",
    includeHashtags: params.get("tags") !== "0",
    tone: tone && TONES.includes(tone) ? tone : "thought-leader",
  };
}
