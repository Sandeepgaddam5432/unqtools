/**
 * Social Hashtag Generator — pure logic.
 * Generate hashtags from keywords with platform-specific limits and rules.
 */

export type Platform = "instagram" | "twitter" | "linkedin" | "tiktok" | "facebook";

export interface PlatformLimits {
  platform: Platform;
  maxHashtags: number;
  recommended: number;
  maxLength: number; // per hashtag
}

export const PLATFORM_LIMITS: Record<Platform, PlatformLimits> = {
  instagram: { platform: "instagram", maxHashtags: 30, recommended: 11, maxLength: 50 },
  twitter: { platform: "twitter", maxHashtags: 10, recommended: 2, maxLength: 50 },
  linkedin: { platform: "linkedin", maxHashtags: 10, recommended: 3, maxLength: 50 },
  tiktok: { platform: "tiktok", maxHashtags: 30, recommended: 5, maxLength: 50 },
  facebook: { platform: "facebook", maxHashtags: 10, recommended: 2, maxLength: 50 },
};

export interface HashtagOptions {
  platform: Platform;
  includeTrending: boolean;
  includeNiche: boolean;
  camelCase: boolean;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "is", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "or", "but", "if", "not", "this", "that", "as", "it",
]);

/** Normalize a keyword into a hashtag (letters/numbers only, no spaces). */
export function normalizeHashtag(keyword: string, camelCase = false): string {
  const cleaned = (keyword || "").trim().replace(/[^\w\s]/g, "");
  if (!cleaned) return "";
  if (camelCase) {
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  }
  return cleaned.replace(/\s+/g, "").toLowerCase();
}

/** Split a comma/space/newline-separated keyword string into individual keywords. */
export function parseKeywords(input: string): string[] {
  if (!input || !input.trim()) return [];
  return input
    .split(/[,\n;]|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const TRENDING = ["explore", "viral", "trending", "fyp", "foryou", "instagood", "love", "photooftheday"];

const NICHE_PREFIXES = ["best", "top", "howto", "tips", "guide", "ideas"];

/** Generate hashtags from keyword list. */
export function generateHashtags(keywords: string[], options: HashtagOptions): string[] {
  const limit = PLATFORM_LIMITS[options.platform];
  const baseTags = new Set<string>();

  for (const kw of keywords) {
    const normalized = normalizeHashtag(kw, options.camelCase);
    if (normalized && !STOP_WORDS.has(normalized.toLowerCase())) {
      baseTags.add(normalized);
    }
  }

  if (options.includeNiche) {
    for (const kw of keywords) {
      const n = normalizeHashtag(kw, options.camelCase);
      if (!n) continue;
      for (const prefix of NICHE_PREFIXES) {
        const tag = options.camelCase
          ? prefix + n.charAt(0).toUpperCase() + n.slice(1)
          : `${prefix}${n}`;
        baseTags.add(tag);
      }
    }
  }

  if (options.includeTrending) {
    for (const t of TRENDING) baseTags.add(t);
  }

  // Filter by max length and dedupe
  const filtered = Array.from(baseTags)
    .filter((t) => t.length > 0 && t.length <= limit.maxLength);

  // Limit to recommended count (or all up to max)
  return filtered.slice(0, limit.maxHashtags);
}

/** Format hashtags as a single string for copy/paste. */
export function formatHashtags(tags: string[], separator = " "): string {
  return tags.map((t) => `#${t}`).join(separator);
}

/** Score hashtag relevance to keywords (heuristic). */
export function scoreRelevance(tag: string, keywords: string[]): number {
  const t = tag.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const k = normalizeHashtag(kw, false);
    if (!k) continue;
    if (t === k) score += 5;
    else if (t.includes(k)) score += 3;
    else if (k.includes(t)) score += 1;
  }
  return score;
}

/** Sort hashtags by relevance score (desc). */
export function sortByRelevance(tags: string[], keywords: string[]): string[] {
  return [...tags].sort((a, b) => scoreRelevance(b, keywords) - scoreRelevance(a, keywords));
}

export function defaultOptions(): HashtagOptions {
  return { platform: "instagram", includeTrending: false, includeNiche: true, camelCase: false };
}
