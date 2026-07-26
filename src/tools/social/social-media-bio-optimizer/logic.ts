/**
 * Social Media Bio Optimizer — pure logic.
 * Per-platform char limits, keyword density, emoji count, line break optimization.
 */

export interface PlatformSpec {
  id: string;
  name: string;
  charLimit: number;
  hashtagLimit: number;
  emojiRecommended: boolean;
  lineBreakFriendly: boolean;
  linkCountsAsChars: boolean;
  notes: string;
}

export const PLATFORMS: PlatformSpec[] = [
  { id: "instagram", name: "Instagram", charLimit: 150, hashtagLimit: 30, emojiRecommended: true, lineBreakFriendly: true, linkCountsAsChars: true, notes: "First line is most visible — hook fast." },
  { id: "twitter", name: "Twitter / X", charLimit: 160, hashtagLimit: 3, emojiRecommended: false, lineBreakFriendly: false, linkCountsAsChars: true, notes: "Links count as 23 chars regardless of length." },
  { id: "linkedin", name: "LinkedIn", charLimit: 2200, hashtagLimit: 5, emojiRecommended: false, lineBreakFriendly: true, linkCountsAsChars: true, notes: "Professional tone. Avoid hashtags in body." },
  { id: "tiktok", name: "TikTok", charLimit: 80, hashtagLimit: 6, emojiRecommended: true, lineBreakFriendly: false, linkCountsAsChars: true, notes: "Short and punchy. Trending hashtags help." },
  { id: "facebook", name: "Facebook", charLimit: 101, hashtagLimit: 2, emojiRecommended: true, lineBreakFriendly: true, linkCountsAsChars: true, notes: "About section. Keep concise." },
  { id: "youtube", name: "YouTube", charLimit: 1000, hashtagLimit: 15, emojiRecommended: false, lineBreakFriendly: true, linkCountsAsChars: true, notes: "Channel description. SEO matters here." },
  { id: "threads", name: "Threads", charLimit: 500, hashtagLimit: 3, emojiRecommended: true, lineBreakFriendly: true, linkCountsAsChars: true, notes: "Conversational tone. Less hashtag-heavy." },
  { id: "mastodon", name: "Mastodon", charLimit: 500, hashtagLimit: 10, emojiRecommended: true, lineBreakFriendly: true, linkCountsAsChars: true, notes: "Bio via profile fields, not main note." },
];

export function getPlatformById(id: string): PlatformSpec | null {
  return PLATFORMS.find((p) => p.id === id) ?? null;
}

export function getAllPlatforms(): PlatformSpec[] {
  return [...PLATFORMS];
}

/** Count characters in bio (optionally counting emoji as 1 char). */
export function countChars(text: string): number {
  // Use Array.from so emoji are counted as 1 character.
  return Array.from(text).length;
}

/** Count words (rough). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Count hashtags (#foo). */
export function countHashtags(text: string): string[] {
  return (text.match(/#[\w]+/g) || []).map((t) => t.toLowerCase());
}

/** Count emoji using a regex matching common emoji ranges. */
export function countEmojis(text: string): number {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;
  return (text.match(emojiRegex) || []).length;
}

/** Count line breaks. */
export function countLineBreaks(text: string): number {
  return (text.match(/\n/g) || []).length;
}

/** Count URLs. */
export function countURLs(text: string): number {
  return (text.match(/https?:\/\/\S+/g) || []).length;
}

/** Extract keywords (most frequent non-stop words). */
const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "but", "of", "to", "in", "for", "on", "with", "is", "are", "am", "i", "you", "we", "they", "he", "she", "it", "at", "by", "from", "as", "be", "this", "that", "these", "those"]);

export function extractKeywords(text: string, topN = 5): Array<{ word: string; count: number }> {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    freq[w] = (freq[w] ?? 0) + 1;
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/** Keyword density (% of total words). */
export function keywordDensity(text: string, keyword: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length === 0) return 0;
  const k = keyword.toLowerCase();
  const hits = words.filter((w) => w === k).length;
  return (hits / words.length) * 100;
}

/** Suggest optimizations for a bio on a given platform. */
export function suggestOptimizations(text: string, platform: PlatformSpec): string[] {
  const tips: string[] = [];
  const chars = countChars(text);
  if (chars > platform.charLimit) tips.push(`Bio is ${chars - platform.charLimit} chars over the ${platform.name} limit.`);
  if (chars < platform.charLimit * 0.5) tips.push(`Bio uses less than 50% of available space — add more value.`);
  const hashtags = countHashtags(text);
  if (hashtags.length > platform.hashtagLimit) tips.push(`${hashtags.length} hashtags — limit is ${platform.hashtagLimit}.`);
  if (platform.emojiRecommended && countEmojis(text) === 0) tips.push("Add 1-2 emoji to increase visual appeal.");
  if (!platform.emojiRecommended && countEmojis(text) > 3) tips.push("Consider reducing emoji — platform prefers text-heavy bios.");
  const keywords = extractKeywords(text, 3);
  if (keywords.length === 0) tips.push("No strong keywords detected — add terms people would search for.");
  if (platform.lineBreakFriendly && countLineBreaks(text) === 0 && chars > 80) tips.push("Add line breaks to make the bio scannable.");
  const urls = countURLs(text);
  if (urls > 1) tips.push("Multiple links may hurt ranking — keep one primary CTA link.");
  return tips;
}

/** Auto-truncate text to fit, keeping whole words. */
export function truncate(text: string, limit: number): string {
  const arr = Array.from(text);
  if (arr.length <= limit) return text;
  // Reserve room for the ellipsis.
  const cap = Math.max(1, limit - 1);
  let cut = arr.slice(0, cap).join("");
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > cap * 0.7) cut = cut.slice(0, lastSpace);
  return cut.trimEnd() + "…";
}

/** Optimize bio: trim, collapse double spaces, normalize line breaks. */
export function optimizeBio(text: string, platform: PlatformSpec): { optimized: string; originalChars: number; optimizedChars: number; saved: number } {
  const originalChars = countChars(text);
  let optimized = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (countChars(optimized) > platform.charLimit) {
    optimized = truncate(optimized, platform.charLimit);
  }
  const optimizedChars = countChars(optimized);
  return { optimized, originalChars, optimizedChars, saved: originalChars - optimizedChars };
}

/** Split bio into lines (for line-by-line preview). */
export function splitLines(text: string): string[] {
  return text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

/** Score the bio 0-100 based on platform fit. */
export function scoreBio(text: string, platform: PlatformSpec): { score: number; breakdown: Array<{ factor: string; points: number }> } {
  const breakdown: Array<{ factor: string; points: number }> = [];
  // Empty / whitespace-only bios get 0 across the board.
  if (!text.trim()) {
    return {
      score: 0,
      breakdown: [
        { factor: "Length fit", points: 0 },
        { factor: "Hashtags", points: 0 },
        { factor: "Keywords", points: 0 },
        { factor: "Emoji fit", points: 0 },
        { factor: "Structure", points: 0 },
      ],
    };
  }
  const chars = countChars(text);
  const hashtags = countHashtags(text);
  const emojis = countEmojis(text);
  const lines = splitLines(text);
  let score = 0;
  // Length fit: max 25 pts
  const lenFit = chars <= platform.charLimit ? Math.min(25, (chars / platform.charLimit) * 25) : 0;
  breakdown.push({ factor: "Length fit", points: Math.round(lenFit) });
  score += lenFit;
  // Hashtag compliance: max 20 pts
  const hashtagFit = hashtags.length <= platform.hashtagLimit ? 20 : Math.max(0, 20 - (hashtags.length - platform.hashtagLimit) * 4);
  breakdown.push({ factor: "Hashtags", points: Math.round(hashtagFit) });
  score += hashtagFit;
  // Keyword richness: max 20 pts
  const keywords = extractKeywords(text, 5);
  const kwScore = Math.min(20, keywords.length * 4);
  breakdown.push({ factor: "Keywords", points: kwScore });
  score += kwScore;
  // Emoji fit: max 15 pts
  const emojiScore = platform.emojiRecommended ? (emojis > 0 ? Math.min(15, emojis * 5) : 0) : (emojis <= 1 ? 15 : Math.max(0, 15 - emojis * 2));
  breakdown.push({ factor: "Emoji fit", points: Math.round(emojiScore) });
  score += emojiScore;
  // Structure: max 20 pts
  const structure = lines.length >= 2 ? Math.min(20, lines.length * 4) : 5;
  breakdown.push({ factor: "Structure", points: Math.round(structure) });
  score += structure;
  return { score: Math.round(Math.min(100, score)), breakdown };
}

/** Export bio analysis as text. */
export function exportAnalysisText(text: string, platform: PlatformSpec): string {
  const chars = countChars(text);
  const keywords = extractKeywords(text, 5);
  const tips = suggestOptimizations(text, platform);
  const score = scoreBio(text, platform);
  return [
    `BIO ANALYSIS — ${platform.name}`,
    `Characters:    ${chars} / ${platform.charLimit}`,
    `Words:         ${countWords(text)}`,
    `Hashtags:      ${countHashtags(text).length} (limit ${platform.hashtagLimit})`,
    `Emojis:        ${countEmojis(text)}`,
    `Line breaks:   ${countLineBreaks(text)}`,
    `URLs:          ${countURLs(text)}`,
    ``,
    `Top keywords:  ${keywords.map((k) => `${k.word} (${k.count})`).join(", ") || "—"}`,
    ``,
    `Score:         ${score.score}/100`,
    ...score.breakdown.map((b) => `  ${b.factor}: ${b.points} pts`),
    ``,
    `Tips:`,
    ...tips.map((t) => `  - ${t}`),
  ].join("\n");
}
