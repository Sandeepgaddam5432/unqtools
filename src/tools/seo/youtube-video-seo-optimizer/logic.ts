/**
 * YouTube Video SEO Optimizer — pure logic.
 *
 * Analyzes YouTube video metadata (title, description, tags, hashtags,
 * chapters) and scores SEO quality. Pure functions only — no DOM, no network.
 */

export type VideoCategory =
  | "Education"
  | "Entertainment"
  | "Howto & Style"
  | "Tech"
  | "Gaming"
  | "Music"
  | "Comedy"
  | "Sports"
  | "News"
  | "Travel";

export interface SeoInputs {
  videoTitle: string;
  videoDescription: string;
  tags: string;            // comma-separated raw input
  channelName: string;
  targetKeywords: string;  // comma-separated raw input
  videoCategory: VideoCategory;
}

export interface TitleAnalysis {
  length: number;
  lengthScore: number;       // /10
  keywordPlacement: number;  // 0-100% of target keywords front-loaded
  placementScore: number;    // /10
  clickbaitCount: number;
  clickbaitTriggers: string[];
  clickbaitScore: number;    // /10 (10 = no clickbait)
  total: number;             // /30
}

export interface DescriptionAnalysis {
  length: number;
  lengthScore: number;       // /10
  aboveFold: string;         // first 125 chars
  aboveFoldHasKeyword: boolean;
  aboveFoldScore: number;    // /5
  keywordDensity: { word: string; count: number; density: number }[];
  densityScore: number;      // /5
  links: { affiliate: string[]; social: string[]; website: string[] };
  linksScore: number;        // /5
  chapters: Chapter[];
  chaptersValid: boolean;
  chaptersScore: number;     // /5
  total: number;             // /30
}

export interface Chapter {
  raw: string;       // "0:00"
  seconds: number;
  label: string;
}

export interface TagAnalysis {
  tags: string[];
  totalChars: number;
  countScore: number;     // /10
  titleKeywords: string[];
  matchedKeywords: string[];
  relevanceScore: number; // /10
  longTailCount: number;
  longTailScore: number;  // /5
  total: number;          // /25
}

export interface HashtagAnalysis {
  hashtags: string[];
  suggested: string[];
  countScore: number;     // /5
  varietyScore: number;   // /5
  categoryMatches: string[];
  categoryScore: number;  // /5
  total: number;          // /15
}

export interface ThumbnailSuggestion {
  hook: string;
  words: string[];
}

export interface SummaryStats {
  titleScore: number;
  descriptionScore: number;
  tagsScore: number;
  hashtagsScore: number;
  total: number;
  thumbnail: ThumbnailSuggestion;
}

export interface AnalysisResult {
  inputs: SeoInputs;
  title: TitleAnalysis;
  description: DescriptionAnalysis;
  tags: TagAnalysis;
  hashtags: HashtagAnalysis;
  summary: SummaryStats;
}

// ---- Constants ----

export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_TAGS_CHARS = 500;

export const VIDEO_CATEGORIES: VideoCategory[] = [
  "Education", "Entertainment", "Howto & Style", "Tech", "Gaming",
  "Music", "Comedy", "Sports", "News", "Travel",
];

export const CATEGORY_PRESETS: Record<VideoCategory, { tags: string[]; hashtags: string[] }> = {
  Education:   { tags: ["education", "learning", "tutorial", "how to", "explained"], hashtags: ["#education", "#learning", "#tutorial", "#howto"] },
  Entertainment: { tags: ["entertainment", "funny", "viral", "comedy", "vlog"], hashtags: ["#entertainment", "#funny", "#viral", "#vlog"] },
  "Howto & Style": { tags: ["how to", "diy", "tutorial", "style", "guide"], hashtags: ["#howto", "#diy", "#tutorial", "#style"] },
  Tech:        { tags: ["technology", "tech", "review", "gadget", "tutorial"], hashtags: ["#tech", "#technology", "#review", "#gadgets"] },
  Gaming:      { tags: ["gaming", "gameplay", "let's play", "walkthrough", "gamer"], hashtags: ["#gaming", "#gameplay", "#letsplay", "#gamer"] },
  Music:       { tags: ["music", "song", "official", "audio", "lyrics"], hashtags: ["#music", "#song", "#official", "#audio"] },
  Comedy:      { tags: ["comedy", "funny", "sketch", "parody", "humor"], hashtags: ["#comedy", "#funny", "#sketch", "#humor"] },
  Sports:      { tags: ["sports", "highlights", "game", "match", "football"], hashtags: ["#sports", "#highlights", "#game", "#football"] },
  News:        { tags: ["news", "breaking", "update", "report", "current events"], hashtags: ["#news", "#breaking", "#update", "#currentevents"] },
  Travel:      { tags: ["travel", "vlog", "adventure", "destination", "tour"], hashtags: ["#travel", "#vlog", "#adventure", "#travelvlog"] },
};

export const CLICKBAIT_WORDS = ["best", "amazing", "incredible", "shocking", "unbelievable", "ultimate", "epic", "insane"];

export const AFFILIATE_DOMAINS = [
  "amazon.", "amzn.", "shareasale.", "impact.com", "commission-", "awin.",
  "ebay.", "shopstyle.", "rstyle.", "go.skimresources", "target.com",
];

export const SOCIAL_DOMAINS = [
  "instagram.com", "twitter.com", "x.com", "facebook.com", "tiktok.com",
  "youtube.com", "youtu.be", "twitch.tv", "linkedin.com", "reddit.com",
  "pinterest.com", "snapchat.com", "discord.gg", "discord.com",
];

export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "being", "to", "of", "in", "on", "at", "by", "for", "with",
  "about", "as", "into", "through", "during", "before", "after", "above",
  "below", "from", "up", "down", "out", "off", "over", "under", "again",
  "this", "that", "these", "those", "i", "you", "he", "she", "it", "we",
  "they", "them", "their", "what", "which", "who", "whom", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "not", "only", "own", "same", "so", "than",
  "too", "very", "can", "will", "just", "should", "now", "my", "your",
  "our", "his", "her", "its", "me", "him", "us", "have", "has", "had",
  "do", "does", "did", "if", "then", "here", "there", "subscribe", "video",
  "watch", "channel", "thanks", "thank", "please", "like", "comment",
]);

// ---- Normalization ----

export function normalizeInput(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function parseInputs(raw: {
  videoTitle: string;
  videoDescription: string;
  tags: string;
  channelName: string;
  targetKeywords: string;
  videoCategory: VideoCategory;
}): SeoInputs {
  return {
    videoTitle: raw.videoTitle ?? "",
    videoDescription: raw.videoDescription ?? "",
    tags: raw.tags ?? "",
    channelName: raw.channelName ?? "",
    targetKeywords: raw.targetKeywords ?? "",
    videoCategory: raw.videoCategory ?? "Education",
  };
}

/** Parse comma-separated list (lowercased + trimmed, blanks removed). */
export function parseList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
}

/** Tokenize text into lowercase words. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []);
}

/** Check whether a string contains an emoji. */
export function hasEmoji(s: string): boolean {
  // Emoji ranges: pictographs, emoticons, dingbats, transport, supplemental symbols
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}]/u;
  return emojiRegex.test(s);
}

// ---- Title analysis ----

/** Title length score: 60-70 optimal (10pts). */
export function analyzeTitleLength(title: string): { length: number; score: number } {
  const length = title.length;
  let score = 0;
  if (length === 0) score = 0;
  else if (length < 30) score = 3;
  else if (length < 60) score = 6;
  else if (length <= 70) score = 10;
  else if (length <= 100) score = 7;
  else score = 0; // over YouTube limit
  return { length, score };
}

/** Keyword placement: % of target keywords appearing in first half of title. */
export function analyzeTitleKeywordPlacement(
  title: string,
  targetKeywords: string[],
): { placement: number; matched: string[]; score: number } {
  if (targetKeywords.length === 0) return { placement: 0, matched: [], score: 0 };
  const lower = title.toLowerCase();
  const half = Math.max(1, Math.floor(lower.length / 2));
  const firstHalf = lower.slice(0, half);
  const matched: string[] = [];
  for (const kw of targetKeywords) {
    if (firstHalf.includes(kw)) matched.push(kw);
  }
  const placement = Math.round((matched.length / targetKeywords.length) * 100);
  // Score: 10 pts at 100%, scaled
  const score = Math.round((placement / 100) * 10);
  return { placement, matched, score };
}

/** Clickbait detection. Returns triggers and score (10 = clean, 0 = very clickbaity). */
export function computeClickbaitScore(title: string): {
  count: number;
  triggers: string[];
  score: number;
} {
  if (!title) return { count: 0, triggers: [], score: 0 };
  const triggers: string[] = [];
  const lower = title.toLowerCase();

  // Exclamation marks (1 trigger if any, capped)
  const exclaimCount = (title.match(/!/g) ?? []).length;
  if (exclaimCount > 0) triggers.push(`! ×${exclaimCount}`);
  // Question marks
  const questCount = (title.match(/\?/g) ?? []).length;
  if (questCount > 0) triggers.push(`? ×${questCount}`);

  // ALL-CAPS words (3+ letters)
  const capsWords = (title.match(/\b[A-Z]{3,}\b/g) ?? []);
  if (capsWords.length > 0) triggers.push(`CAPS ×${capsWords.length}`);

  // Clickbait words (BEST, AMAZING, etc.) anywhere in lowercased title
  for (const w of CLICKBAIT_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(lower)) triggers.push(w);
  }

  // Emojis
  if (hasEmoji(title)) triggers.push("emoji");

  // Deduplicate trigger categories for count (multiple ! count as 1 trigger type)
  const count = triggers.length;
  // Each trigger deducts 2 points, max 10 deducted (min 0)
  const deduction = Math.min(count * 2, 10);
  const score = Math.max(0, 10 - deduction);
  return { count, triggers, score };
}

export function analyzeTitle(inputs: SeoInputs): TitleAnalysis {
  const title = inputs.videoTitle || "";
  const { length, score: lengthScore } = analyzeTitleLength(title);
  const targets = parseList(inputs.targetKeywords);
  const { placement, matched, score: placementScore } = analyzeTitleKeywordPlacement(title, targets);
  const { count, triggers, score: clickbaitScore } = computeClickbaitScore(title);
  return {
    length,
    lengthScore,
    keywordPlacement: placement,
    placementScore,
    clickbaitCount: count,
    clickbaitTriggers: triggers,
    clickbaitScore,
    total: lengthScore + placementScore + clickbaitScore,
  };
}

// ---- Description analysis ----

/** First 125 chars of description (above the fold on YouTube). */
export function extractAboveFold(description: string): string {
  return (description || "").slice(0, 125);
}

/** Keyword density — top 5 most frequent non-stopword tokens. */
export function computeKeywordDensity(
  description: string,
  limit = 5,
): { word: string; count: number; density: number }[] {
  const tokens = tokenize(description);
  if (tokens.length === 0) return [];
  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (STOPWORDS.has(t) || t.length < 2) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const total = tokens.length;
  const arr = Array.from(counts.entries())
    .map(([word, count]) => ({ word, count, density: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return arr.slice(0, limit);
}

/** Detect links in description, categorized. */
export function detectLinks(description: string): {
  affiliate: string[];
  social: string[];
  website: string[];
} {
  if (!description) return { affiliate: [], social: [], website: [] };
  const urls = description.match(/https?:\/\/[^\s)]+/gi) ?? [];
  const affiliate: string[] = [];
  const social: string[] = [];
  const website: string[] = [];
  for (const u of urls) {
    const lower = u.toLowerCase();
    let matched = false;
    for (const d of AFFILIATE_DOMAINS) {
      if (lower.includes(d)) { affiliate.push(u); matched = true; break; }
    }
    if (matched) continue;
    for (const d of SOCIAL_DOMAINS) {
      if (lower.includes(d)) { social.push(u); matched = true; break; }
    }
    if (matched) continue;
    website.push(u);
  }
  return { affiliate, social, website };
}

/** Parse `0:00 Intro` style chapters from description. */
export function parseChapters(description: string): Chapter[] {
  if (!description) return [];
  const lines = description.split(/\n+/);
  const chapters: Chapter[] = [];
  const re = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  for (const line of lines) {
    const m = line.trim().match(re);
    if (!m) continue;
    const raw = m[1];
    const label = m[2].trim();
    const seconds = timestampToSeconds(raw);
    if (seconds < 0) continue;
    chapters.push({ raw, seconds, label });
  }
  return chapters;
}

export function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return -1;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return -1;
}

/** Validate chapters are monotonically increasing. */
export function validateChapters(chapters: Chapter[]): boolean {
  if (chapters.length === 0) return true;
  let prev = -1;
  for (const c of chapters) {
    if (c.seconds <= prev) return false;
    prev = c.seconds;
  }
  return true;
}

/** Suggest chapters based on description headings (lines starting with capital, ending with :). */
export function suggestChapters(description: string): Chapter[] {
  const existing = parseChapters(description);
  if (existing.length > 0) return existing;
  // Fallback: look for section-like markers (lines ending with ":")
  const lines = (description || "").split(/\n+/);
  const suggestions: Chapter[] = [];
  let t = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.endsWith(":") && !trimmed.includes("http")) {
      suggestions.push({
        raw: formatTimestamp(t),
        seconds: t,
        label: trimmed.replace(/:$/, ""),
      });
      t += 60; // arbitrary 1-min increments
    }
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function analyzeDescription(inputs: SeoInputs): DescriptionAnalysis {
  const desc = inputs.videoDescription || "";
  const { length: lengthVal, score: lengthScore } = ((): { length: number; score: number } => {
    const length = desc.length;
    let score = 0;
    if (length === 0) score = 0;
    else if (length < 100) score = 3;
    else if (length < 250) score = 6;
    else if (length <= 5000) score = 10;
    else score = 0;
    return { length, score };
  })();

  const aboveFold = extractAboveFold(desc);
  const targets = parseList(inputs.targetKeywords);
  const lowerFold = aboveFold.toLowerCase();
  const matchedKw = targets.filter((k) => lowerFold.includes(k));
  const aboveFoldHasKeyword = matchedKw.length > 0;
  const aboveFoldScore = aboveFoldHasKeyword ? 5 : (desc.length > 0 ? 2 : 0);

  const keywordDensity = computeKeywordDensity(desc);
  const topDensity = keywordDensity[0]?.density ?? 0;
  let densityScore = 0;
  if (desc.length > 0) {
    if (topDensity >= 1 && topDensity <= 3) densityScore = 5;
    else if (topDensity > 3 && topDensity <= 5) densityScore = 3;
    else if (topDensity > 0) densityScore = 2;
  }

  const links = detectLinks(desc);
  let linksScore = 0;
  if (links.affiliate.length > 0) linksScore += 2;
  if (links.social.length > 0) linksScore += 2;
  if (links.website.length > 0) linksScore += 1;

  const chapters = parseChapters(desc);
  const chaptersValid = validateChapters(chapters);
  let chaptersScore = 0;
  if (chapters.length >= 2) chaptersScore = 5;
  else if (chapters.length === 1) chaptersScore = 3;

  return {
    length: desc.length,
    lengthScore,
    aboveFold,
    aboveFoldHasKeyword,
    aboveFoldScore,
    keywordDensity,
    densityScore,
    links,
    linksScore,
    chapters,
    chaptersValid,
    chaptersScore,
    total: lengthScore + aboveFoldScore + densityScore + linksScore + chaptersScore,
  };
}

// ---- Tag analysis ----

export function analyzeTags(inputs: SeoInputs): TagAnalysis {
  const tags = parseList(inputs.tags);
  const totalChars = tags.join(",").length;
  let countScore = 0;
  if (tags.length === 0) countScore = 0;
  else if (tags.length <= 5) countScore = 3;
  else if (tags.length <= 10) countScore = 7;
  else if (tags.length <= 15) countScore = 10;
  else if (tags.length <= 25) countScore = 8;
  else countScore = 5;
  if (totalChars > MAX_TAGS_CHARS) countScore = 0;

  const titleKeywords = parseList(inputs.targetKeywords);
  if (titleKeywords.length === 0 && inputs.videoTitle) {
    // Fallback: derive keywords from title
    titleKeywords.push(...tokenize(inputs.videoTitle).filter((w) => !STOPWORDS.has(w) && w.length > 2).slice(0, 5));
  }
  const matchedKeywords: string[] = [];
  for (const kw of titleKeywords) {
    if (tags.some((t) => t.includes(kw) || kw.includes(t))) matchedKeywords.push(kw);
  }
  const relevanceScore = Math.min(matchedKeywords.length * 2, 10);

  const longTailCount = tags.filter((t) => t.split(/\s+/).length >= 2).length;
  let longTailScore = 0;
  if (longTailCount === 0) longTailScore = 0;
  else if (longTailCount <= 2) longTailScore = 2;
  else if (longTailCount <= 5) longTailScore = 5;
  else longTailScore = 4;

  return {
    tags,
    totalChars,
    countScore,
    titleKeywords,
    matchedKeywords,
    relevanceScore,
    longTailCount,
    longTailScore,
    total: countScore + relevanceScore + longTailScore,
  };
}

// ---- Hashtag analysis ----

export function extractHashtags(description: string): string[] {
  if (!description) return [];
  const matches = description.match(/#[a-zA-Z0-9_]+/g) ?? [];
  // Dedupe case-insensitively, keep first occurrence form
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of matches) {
    const key = h.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(h); }
  }
  return out;
}

export function suggestHashtags(inputs: SeoInputs): string[] {
  const preset = CATEGORY_PRESETS[inputs.videoCategory] ?? CATEGORY_PRESETS.Education;
  const out: string[] = [...preset.hashtags];
  // Add hashtags from title keywords
  const titleTokens = tokenize(inputs.videoTitle).filter((w) => !STOPWORDS.has(w) && w.length > 3);
  for (const t of titleTokens.slice(0, 3)) {
    const h = `#${t}`;
    if (!out.some((x) => x.toLowerCase() === h.toLowerCase())) out.push(h);
  }
  return out.slice(0, 8);
}

export function analyzeHashtags(inputs: SeoInputs, description: string): HashtagAnalysis {
  const hashtags = extractHashtags(description);
  let countScore = 0;
  if (hashtags.length === 0) countScore = 0;
  else if (hashtags.length <= 2) countScore = 2;
  else if (hashtags.length <= 5) countScore = 5;
  else countScore = 3;

  // Variety: ratio of unique roots (first 4 chars)
  const roots = new Set(hashtags.map((h) => h.toLowerCase().slice(1, 5)));
  const variety = hashtags.length > 0 ? roots.size / hashtags.length : 0;
  const varietyScore = Math.round(variety * 5);

  const preset = CATEGORY_PRESETS[inputs.videoCategory] ?? CATEGORY_PRESETS.Education;
  const presetLower = preset.hashtags.map((h) => h.toLowerCase());
  const categoryMatches: string[] = [];
  for (const h of hashtags) {
    if (presetLower.includes(h.toLowerCase())) categoryMatches.push(h);
  }
  const categoryScore = Math.min(categoryMatches.length, 5);

  const suggested = suggestHashtags(inputs);

  return {
    hashtags,
    suggested,
    countScore,
    varietyScore,
    categoryMatches,
    categoryScore,
    total: countScore + varietyScore + categoryScore,
  };
}

// ---- Thumbnail suggestion ----

export function suggestThumbnailText(inputs: SeoInputs): ThumbnailSuggestion {
  const title = inputs.videoTitle || "";
  if (!title) return { hook: "", words: [] };
  const tokens = title.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { hook: "", words: [] };
  // Pick top 3-5 high-signal words (non-stopwords, prefer longer)
  const significant = tokens.filter((t) => {
    const lower = t.toLowerCase().replace(/[^a-z0-9']/g, "");
    return lower.length > 2 && !STOPWORDS.has(lower);
  });
  const picked = (significant.length >= 3 ? significant : tokens).slice(0, 5);
  return { hook: picked.join(" ").toUpperCase(), words: picked };
}

// ---- Summary / orchestrator ----

export function analyzeAll(inputs: SeoInputs): AnalysisResult {
  const title = analyzeTitle(inputs);
  const description = analyzeDescription(inputs);
  const tags = analyzeTags(inputs);
  const hashtags = analyzeHashtags(inputs, inputs.videoDescription);
  const thumbnail = suggestThumbnailText(inputs);
  const summary: SummaryStats = {
    titleScore: title.total,
    descriptionScore: description.total,
    tagsScore: tags.total,
    hashtagsScore: hashtags.total,
    total: title.total + description.total + tags.total + hashtags.total,
    thumbnail,
  };
  return { inputs, title, description, tags, hashtags, summary };
}

export function computeSummaryStats(result: AnalysisResult): SummaryStats {
  return result.summary;
}

// ---- Rendering ----

export function renderText(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("YouTube Video SEO Report");
  lines.push("=".repeat(60));
  lines.push(`Video: ${result.inputs.videoTitle || "(untitled)"}`);
  lines.push(`Channel: ${result.inputs.channelName || "(not set)"}`);
  lines.push(`Category: ${result.inputs.videoCategory}`);
  lines.push("");
  lines.push("SCORE BREAKDOWN");
  lines.push("-".repeat(60));
  lines.push(`Total score:    ${result.summary.total}/100`);
  lines.push(`  Title:        ${result.title.total}/30`);
  lines.push(`    Length:     ${result.title.lengthScore}/10 (length: ${result.title.length})`);
  lines.push(`    Placement:  ${result.title.placementScore}/10 (${result.title.keywordPlacement}% front-loaded)`);
  lines.push(`    Clickbait:  ${result.title.clickbaitScore}/10 (triggers: ${result.title.clickbaitTriggers.join(", ") || "none"})`);
  lines.push(`  Description:  ${result.description.total}/30`);
  lines.push(`    Length:     ${result.description.lengthScore}/10 (length: ${result.description.length})`);
  lines.push(`    Above fold: ${result.description.aboveFoldScore}/5 (keyword: ${result.description.aboveFoldHasKeyword ? "yes" : "no"})`);
  lines.push(`    Density:    ${result.description.densityScore}/5`);
  lines.push(`    Links:      ${result.description.linksScore}/5 (affiliate: ${result.description.links.affiliate.length}, social: ${result.description.links.social.length}, website: ${result.description.links.website.length})`);
  lines.push(`    Chapters:   ${result.description.chaptersScore}/5 (count: ${result.description.chapters.length}, valid: ${result.description.chaptersValid})`);
  lines.push(`  Tags:         ${result.tags.total}/25`);
  lines.push(`    Count:      ${result.tags.countScore}/10 (${result.tags.tags.length} tags, ${result.tags.totalChars} chars)`);
  lines.push(`    Relevance:  ${result.tags.relevanceScore}/10 (matched: ${result.tags.matchedKeywords.join(", ") || "none"})`);
  lines.push(`    Long-tail:  ${result.tags.longTailScore}/5 (${result.tags.longTailCount} tags)`);
  lines.push(`  Hashtags:     ${result.hashtags.total}/15`);
  lines.push(`    Count:      ${result.hashtags.countScore}/5 (${result.hashtags.hashtags.length})`);
  lines.push(`    Variety:    ${result.hashtags.varietyScore}/5`);
  lines.push(`    Category:   ${result.hashtags.categoryScore}/5 (matches: ${result.hashtags.categoryMatches.join(", ") || "none"})`);
  lines.push("");
  lines.push("THUMBNAIL HOOK: " + (result.summary.thumbnail.hook || "(n/a)"));
  lines.push("");
  if (result.description.chapters.length > 0) {
    lines.push("CHAPTERS");
    lines.push("-".repeat(60));
    for (const c of result.description.chapters) {
      lines.push(`  ${c.raw}  ${c.label}`);
    }
    lines.push("");
  }
  if (result.hashtags.suggested.length > 0) {
    lines.push("SUGGESTED HASHTAGS");
    lines.push("-".repeat(60));
    lines.push("  " + result.hashtags.suggested.join(" "));
    lines.push("");
  }
  if (result.description.keywordDensity.length > 0) {
    lines.push("TOP KEYWORDS (density)");
    lines.push("-".repeat(60));
    for (const k of result.description.keywordDensity) {
      lines.push(`  ${k.word}: ${k.count} (${k.density}%)`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderCsv(result: AnalysisResult): string {
  const rows: string[][] = [
    ["field", "value", "score"],
    ["title_length", String(result.title.length), String(result.title.lengthScore)],
    ["title_keyword_placement_pct", String(result.title.keywordPlacement), String(result.title.placementScore)],
    ["title_clickbait_count", String(result.title.clickbaitCount), String(result.title.clickbaitScore)],
    ["title_total", "", String(result.title.total)],
    ["description_length", String(result.description.length), String(result.description.lengthScore)],
    ["description_above_fold_keyword", String(result.description.aboveFoldHasKeyword), String(result.description.aboveFoldScore)],
    ["description_density_score", "", String(result.description.densityScore)],
    ["description_links", String(result.description.links.affiliate.length + result.description.links.social.length + result.description.links.website.length), String(result.description.linksScore)],
    ["description_chapters", String(result.description.chapters.length), String(result.description.chaptersScore)],
    ["description_total", "", String(result.description.total)],
    ["tags_count", String(result.tags.tags.length), String(result.tags.countScore)],
    ["tags_relevance", String(result.tags.matchedKeywords.length), String(result.tags.relevanceScore)],
    ["tags_long_tail", String(result.tags.longTailCount), String(result.tags.longTailScore)],
    ["tags_total", "", String(result.tags.total)],
    ["hashtags_count", String(result.hashtags.hashtags.length), String(result.hashtags.countScore)],
    ["hashtags_variety", "", String(result.hashtags.varietyScore)],
    ["hashtags_category_match", String(result.hashtags.categoryMatches.length), String(result.hashtags.categoryScore)],
    ["hashtags_total", "", String(result.hashtags.total)],
    ["total_score", "", String(result.summary.total)],
    ["thumbnail_hook", escapeCsv(result.summary.thumbnail.hook), ""],
  ];
  return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
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

function escapeCsv(s: string): string {
  if (s == null) return "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:youtube-video-seo-optimizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  videoTitle: string;
  category: VideoCategory;
  totalScore: number;
  titleScore: number;
  descriptionScore: number;
  tagsScore: number;
  hashtagsScore: number;
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
    } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---- Shareable URL ----

export function buildShareUrl(inputs: SeoInputs): string {
  const params = new URLSearchParams();
  if (inputs.videoTitle) params.set("title", inputs.videoTitle);
  if (inputs.videoDescription) params.set("desc", inputs.videoDescription);
  if (inputs.tags) params.set("tags", inputs.tags);
  if (inputs.channelName) params.set("channel", inputs.channelName);
  if (inputs.targetKeywords) params.set("kw", inputs.targetKeywords);
  if (inputs.videoCategory) params.set("cat", inputs.videoCategory);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<SeoInputs> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<SeoInputs> = {};
  const title = params.get("title");
  if (title) out.videoTitle = title;
  const desc = params.get("desc");
  if (desc) out.videoDescription = desc;
  const tags = params.get("tags");
  if (tags) out.tags = tags;
  const channel = params.get("channel");
  if (channel) out.channelName = channel;
  const kw = params.get("kw");
  if (kw) out.targetKeywords = kw;
  const cat = params.get("cat");
  if (cat && VIDEO_CATEGORIES.includes(cat as VideoCategory)) {
    out.videoCategory = cat as VideoCategory;
  }
  return out;
}
