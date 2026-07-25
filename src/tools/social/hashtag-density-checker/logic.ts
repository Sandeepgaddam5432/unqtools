/**
 * Hashtag Density Checker — pure logic.
 * Parse + count hashtags, compute density, check banned list.
 */

export interface HashtagAnalysis {
  text: string;
  totalHashtags: number;
  uniqueHashtags: number;
  duplicateHashtags: { tag: string; count: number }[];
  densityPct: number; // hashtags per 100 chars
  recommendedLimit: number;
  overLimit: boolean;
  bannedTags: string[];
  warnings: string[];
}

// A small sample of commonly-shadow-banned or flagged hashtags on social platforms.
export const BANNED_HASHTAGS: string[] = [
  "nude", "nudes", "sex", "sexy", "porn", "boo", "cannabis", "weed",
  "dm", "kik", "shoutout", "like4like", "follow4follow", "f4f",
  "l4l", "followme", "tagsforlikes",
];

export function parseHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F\u4e00-\u9fa5]+/g) ?? [];
  return matches.map((m) => m.toLowerCase());
}

export function analyze(text: string, recommendedLimit: number = 10): HashtagAnalysis {
  const tags = parseHashtags(text);
  const total = tags.length;
  const unique = new Set(tags).size;

  const counts = new Map<string, number>();
  for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const duplicates = Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([tag, c]) => ({ tag, count: c }))
    .sort((a, b) => b.count - a.count);

  const density = text.length > 0 ? Math.round((total / text.length) * 1000) / 10 : 0;

  const bannedTags = Array.from(new Set(tags.filter((t) => BANNED_HASHTAGS.includes(t.slice(1)))));
  const warnings: string[] = [];
  if (total > recommendedLimit) warnings.push(`Too many hashtags: ${total} (recommended ≤ ${recommendedLimit}).`);
  if (duplicates.length > 0) warnings.push(`${duplicates.length} duplicate hashtag(s) detected.`);
  if (bannedTags.length > 0) warnings.push(`Banned/flagged hashtags: ${bannedTags.join(", ")}.`);
  if (density > 5) warnings.push(`Hashtag density ${density}% is high; consider fewer tags.`);

  return {
    text,
    totalHashtags: total,
    uniqueHashtags: unique,
    duplicateHashtags: duplicates,
    densityPct: density,
    recommendedLimit,
    overLimit: total > recommendedLimit,
    bannedTags,
    warnings,
  };
}

export function suggestTags(text: string): string[] {
  // Naive: suggest from words > 4 chars not already in hashtags.
  const existing = new Set(parseHashtags(text));
  const words = text.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  const suggestions = new Set<string>();
  for (const w of words) {
    if (!existing.has(`#${w}`) && !BANNED_HASHTAGS.includes(w)) suggestions.add(`#${w}`);
  }
  return Array.from(suggestions).slice(0, 10);
}
