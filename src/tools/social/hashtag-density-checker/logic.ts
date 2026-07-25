/**
 * Hashtag Density Checker — pure logic. No DOM/canvas access.
 *
 * Supports:
 *  - Hashtag extraction (Latin + accented + CJK + emoji-free)
 *  - Total / unique / duplicate counts
 *  - Density (hashtags per 100 chars + chars-per-tag)
 *  - Banned/flagged hashtag list (16 shadow-banned terms)
 *  - Platform-specific limits (Instagram/Twitter/X/TikTok/LinkedIn/Facebook)
 *  - Per-platform limit checker (which platforms accept the post)
 *  - Smart tag suggestions (from words >4 chars, excluding existing/banned)
 *  - Tag normalization (lowercase, strip non-alnum)
 *  - Hashtag positioning analysis (in-caption vs trailing block)
 *  - Batch analysis (multiple captions) with CSV export
 *  - CSV export of full analysis
 *  - Warnings aggregator
 *  - Character-count budget (how many more tags can fit)
 */
export type Platform = "instagram" | "twitter" | "tiktok" | "linkedin" | "facebook";

export interface PlatformLimit {
  platform: Platform;
  label: string;
  maxHashtags: number;
  maxChars: number;
  recommended: number;
}

export const PLATFORM_LIMITS: PlatformLimit[] = [
  { platform: "instagram", label: "Instagram", maxHashtags: 30, maxChars: 2200, recommended: 8 },
  { platform: "twitter", label: "X / Twitter", maxHashtags: 10, maxChars: 280, recommended: 2 },
  { platform: "tiktok", label: "TikTok", maxHashtags: 30, maxChars: 2200, recommended: 5 },
  { platform: "linkedin", label: "LinkedIn", maxHashtags: 5, maxChars: 3000, recommended: 3 },
  { platform: "facebook", label: "Facebook", maxHashtags: 10, maxChars: 63206, recommended: 2 },
];

export interface HashtagAnalysis {
  text: string;
  totalHashtags: number;
  uniqueHashtags: number;
  duplicateHashtags: { tag: string; count: number }[];
  densityPct: number;        // hashtags per 100 chars
  charsPerTag: number;       // chars per hashtag (inverse of density)
  recommendedLimit: number;
  overLimit: boolean;
  bannedTags: string[];
  trailingBlockCount: number; // hashtags in the trailing block
  inlineCount: number;        // hashtags inside caption text
  platformStatus: { platform: Platform; label: string; accepted: boolean; reason: string }[];
  warnings: string[];
}

/** A small sample of commonly-shadow-banned or flagged hashtags on social platforms. */
export const BANNED_HASHTAGS: string[] = [
  "nude", "nudes", "sex", "sexy", "porn", "boo", "cannabis", "weed",
  "dm", "kik", "shoutout", "like4like", "follow4follow", "f4f",
  "l4l", "followme", "tagsforlikes",
];

export function parseHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F\u4e00-\u9fa5]+/g) ?? [];
  return matches.map((m) => m.toLowerCase());
}

/** Normalize a hashtag: lowercase, strip non-alphanumeric. */
export function normalizeTag(tag: string): string {
  return `#${tag.replace(/^#/, "").toLowerCase().replace(/[^\w\u00C0-\u024F\u4e00-\u9fa5]/g, "")}`;
}

/** Get the trailing block of hashtags (last line of hashtags at end of caption). */
export function parseTrailingBlock(text: string): string[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const last = lines[lines.length - 1]!;
  // If the last line is mostly hashtags, treat as trailing block.
  const tagsInLast = parseHashtags(last);
  const nonTagChars = last.replace(/#[\w\u00C0-\u024F\u4e00-\u9fa5]+/g, "").replace(/\s+/g, "");
  if (tagsInLast.length > 0 && nonTagChars.length < 5) return tagsInLast;
  return [];
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
  const charsPerTag = total > 0 ? Math.round((text.length / total) * 10) / 10 : 0;
  const bannedTags = Array.from(new Set(tags.filter((t) => BANNED_HASHTAGS.includes(t.slice(1)))));
  const trailingBlock = parseTrailingBlock(text);
  const trailingBlockCount = trailingBlock.length;
  const inlineCount = total - trailingBlockCount;

  const platformStatus = PLATFORM_LIMITS.map((p) => {
    if (total > p.maxHashtags) return { platform: p.platform, label: p.label, accepted: false, reason: `Exceeds ${p.maxHashtags} hashtag limit` };
    if (text.length > p.maxChars) return { platform: p.platform, label: p.label, accepted: false, reason: `Exceeds ${p.maxChars} character limit` };
    if (total > p.recommended) return { platform: p.platform, label: p.label, accepted: true, reason: `Above recommended ${p.recommended} tags` };
    return { platform: p.platform, label: p.label, accepted: true, reason: "Within limits" };
  });

  const warnings: string[] = [];
  if (total > recommendedLimit) warnings.push(`Too many hashtags: ${total} (recommended ≤ ${recommendedLimit}).`);
  if (duplicates.length > 0) warnings.push(`${duplicates.length} duplicate hashtag(s) detected.`);
  if (bannedTags.length > 0) warnings.push(`Banned/flagged hashtags: ${bannedTags.join(", ")}.`);
  if (density > 5) warnings.push(`Hashtag density ${density}% is high; consider fewer tags.`);
  if (inlineCount > total * 0.5 && total > 3) warnings.push(`${inlineCount} hashtags are inline; consider grouping them in a trailing block.`);

  return {
    text, totalHashtags: total, uniqueHashtags: unique, duplicateHashtags: duplicates,
    densityPct: density, charsPerTag, recommendedLimit, overLimit: total > recommendedLimit,
    bannedTags, trailingBlockCount, inlineCount, platformStatus, warnings,
  };
}

/** Suggest tags from words >4 chars not already in hashtags. */
export function suggestTags(text: string): string[] {
  const existing = new Set(parseHashtags(text));
  const words = text.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  const suggestions = new Set<string>();
  for (const w of words) {
    if (!existing.has(`#${w}`) && !BANNED_HASHTAGS.includes(w)) suggestions.add(`#${w}`);
  }
  return Array.from(suggestions).slice(0, 10);
}

/** How many more tags can be added before hitting the platform limit? */
export function remainingBudget(text: string, platform: Platform): number {
  const used = parseHashtags(text).length;
  const limit = PLATFORM_LIMITS.find((p) => p.platform === platform)?.maxHashtags ?? 0;
  return Math.max(0, limit - used);
}

/** Batch: analyze each line. */
export function analyzeBatch(lines: string[], recommendedLimit: number = 10): HashtagAnalysis[] {
  return lines.map((l) => analyze(l, recommendedLimit));
}

/** Convert a batch to CSV. */
export function batchToCsv(results: HashtagAnalysis[], lines: string[]): string {
  const header = "Input,Total,Unique,Duplicates,DensityPct,Banned,Warnings";
  const rows = results.map((r, i) => {
    const ein = `"${lines[i]!.replace(/"/g, '""').slice(0, 80)}"`;
    return `${ein},${r.totalHashtags},${r.uniqueHashtags},${r.duplicateHashtags.length},${r.densityPct},${r.bannedTags.length},${r.warnings.length}`;
  });
  return [header, ...rows].join("\n");
}

/** Convert a single analysis to a summary string. */
export function formatSummary(a: HashtagAnalysis): string {
  return [
    "Hashtag Analysis",
    "================",
    `Total hashtags: ${a.totalHashtags}`,
    `Unique hashtags: ${a.uniqueHashtags}`,
    `Duplicates: ${a.duplicateHashtags.length}`,
    `Density: ${a.densityPct}% (${a.charsPerTag} chars/tag)`,
    `Inline: ${a.inlineCount} · Trailing: ${a.trailingBlockCount}`,
    `Banned: ${a.bannedTags.length > 0 ? a.bannedTags.join(", ") : "none"}`,
    "",
    "Platform status:",
    ...a.platformStatus.map((p) => `  ${p.label}: ${p.accepted ? "OK" : "REJECTED"} — ${p.reason}`),
    "",
    ...(a.warnings.length > 0 ? ["Warnings:", ...a.warnings.map((w) => `  - ${w}`)] : ["No warnings"]),
  ].join("\n");
}

/** Validate a hashtag (alphanumeric + underscores, 1+ chars after #). */
export function isValidHashtag(tag: string): boolean {
  return /^#[\w\u00C0-\u024F\u4e00-\u9fa5]+$/.test(tag);
}

/** Count total entries in the banned-hashtags list. */
export function bannedHashtagCount(): number {
  return BANNED_HASHTAGS.length;
}

/** List of all platforms. */
export const ALL_PLATFORMS = PLATFORM_LIMITS.map((p) => p.platform);
