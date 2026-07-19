/**
 * Social Media Character Counter — pure logic.
 *
 * Live Unicode-aware character counter for all social platforms.
 * Pure functions only — no DOM, no network.
 */

export type Platform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "mastodon";

export type Mode = "post" | "bio" | "comment" | "dm";

export interface CounterInput {
  text: string;
  platform: Platform;
  mode: Mode;
}

export interface CounterResult {
  text: string;
  platform: Platform;
  mode: Mode;
  /** Unicode-aware char count (emojis count as 2 per Twitter spec). */
  charCount: number;
  /** Grapheme cluster count (true visual character count). */
  graphemeCount: number;
  wordCount: number;
  hashtagCount: number;
  hashtags: string[];
  mentionCount: number;
  mentions: string[];
  urlCount: number;
  urls: string[];
  /** Effective URL chars (23 per URL on Twitter, actual length elsewhere). */
  urlChars: number;
  emojiCount: number;
  lineBreakCount: number;
  limit: number;
  remaining: number;
  overLimit: boolean;
  /** True when charCount falls within optimal range. */
  inOptimalRange: boolean;
  /** Below optimal range, in range, or above (but under limit). */
  lengthStatus: "under" | "optimal" | "over" | "exceeded";
  optimalRange: { min: number; max: number };
  /** Estimated reading time in seconds (200 wpm). */
  readingTimeSec: number;
  /** Truncated text with ellipsis to fit the limit. */
  truncated: string;
  /** Stats organized for display. */
  metrics: { label: string; value: number | string }[];
}

export const PLATFORMS: Platform[] = [
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "mastodon",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  mastodon: "Mastodon",
};

export const MODES: Mode[] = ["post", "bio", "comment", "dm"];

export const MODE_LABELS: Record<Mode, string> = {
  post: "Post",
  bio: "Bio / Profile",
  comment: "Comment",
  dm: "Direct Message",
};

/** Per-platform × mode char limits. */
export const CHAR_LIMITS: Record<Platform, Record<Mode, number>> = {
  twitter: { post: 280, bio: 160, comment: 280, dm: 10000 },
  instagram: { post: 2200, bio: 150, comment: 1000, dm: 500 },
  facebook: { post: 63206, bio: 101, comment: 8000, dm: 20000 },
  linkedin: { post: 3000, bio: 220, comment: 1250, dm: 8000 },
  tiktok: { post: 2200, bio: 80, comment: 150, dm: 1500 },
  mastodon: { post: 500, bio: 500, comment: 500, dm: 500 },
};

/** Optimal length range (per platform post mode). Bio/comment/dm use a fraction of the limit. */
export const OPTIMAL_RANGES: Record<Platform, { min: number; max: number }> = {
  twitter: { min: 71, max: 100 },
  instagram: { min: 138, max: 150 },
  facebook: { min: 40, max: 80 },
  linkedin: { min: 1200, max: 1500 },
  tiktok: { min: 80, max: 150 },
  mastodon: { min: 200, max: 400 },
};

/** Twitter t.co URL shortening length. */
export const TWITTER_URL_LENGTH = 23;

/** Reading speed (words per minute) for reading-time estimator. */
export const READING_WPM = 200;

/**
 * Regex to detect URLs (http/https and bare www). Conservative —
 * matches until whitespace or end of string.
 */
export const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+)/g;

/** Regex to detect hashtags (#word, allowing underscores and digits). */
export const HASHTAG_REGEX = /#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g;

/** Regex to detect mentions (@word). */
export const MENTION_REGEX = /@[\w.\-]+/g;

/**
 * Regex to detect emoji characters. Covers:
 * - Misc symbols & pictographs U+1F300-U+1F5FF
 * - Emoticons U+1F600-U+1F64F
 * - Transport & map U+1F680-U+1F6FF
 * - Supplemental symbols U+1F900-U+1F9FF
 * - Dingbats U+2702-U+27B0
 * - Variation selectors U+FE00-U+FE0F
 * - ZWJ U+200D
 * - Skin tone modifiers U+1F3FB-U+1F3FF
 * - Regional indicators U+1F1E6-U+1F1FF (flags)
 * - Misc Technical U+2310-U+231A (some symbols)
 * - Enclosed alphanumerics like ©️ ®™️ (already in variation selector)
 */
export const EMOJI_REGEX = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;

/** Non-global emoji test regex (no stateful lastIndex). */
export const EMOJI_TEST_REGEX = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/u;

/** Skin tone modifier range U+1F3FB..U+1F3FF. */
export const SKIN_TONE_REGEX = /[\u{1F3FB}-\u{1F3FF}]/gu;

/** Count characters in a Unicode-aware way (UTF-16 code units — emojis = 2). */
export function countChars(text: string): number {
  return (text || "").length;
}

/**
 * Count grapheme clusters (true visual character count) using
 * Intl.Segmenter when available, else fall back to code-point count.
 */
export function countGraphemes(text: string): number {
  const s = text || "";
  if (typeof Intl !== "undefined" && (Intl as { Segmenter?: unknown }).Segmenter) {
    try {
      const Seg = (Intl as { Segmenter: new (locale?: string, opts?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
      const seg = new Seg(undefined, { granularity: "grapheme" });
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of seg.segment(s)) count += 1;
      return count;
    } catch {
      // fall through
    }
  }
  // Fallback: count code points
  return Array.from(s).length;
}

/** Count words (split on whitespace). */
export function countWords(text: string): number {
  const s = (text || "").trim();
  if (!s) return 0;
  return s.split(/\s+/).length;
}

/** Find all hashtags. */
export function findHashtags(text: string): string[] {
  return (text || "").match(HASHTAG_REGEX) ?? [];
}

/** Find all mentions. */
export function findMentions(text: string): string[] {
  return (text || "").match(MENTION_REGEX) ?? [];
}

/** Find all URLs. */
export function findUrls(text: string): string[] {
  return (text || "").match(URL_REGEX) ?? [];
}

/**
 * Count emoji characters in the text. Uses grapheme segmentation to
 * handle ZWJ sequences (e.g., family emoji counts as 1) and skin tone
 * modifiers (which don't add to the count because they're part of the
 * previous grapheme). Falls back to regex matching if Intl.Segmenter
 * is unavailable.
 */
export function countEmojis(text: string): number {
  const s = text || "";
  if (!s) return 0;
  if (typeof Intl !== "undefined" && (Intl as { Segmenter?: unknown }).Segmenter) {
    try {
      const Seg = (Intl as { Segmenter: new (locale?: string, opts?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
      const seg = new Seg(undefined, { granularity: "grapheme" });
      let count = 0;
      for (const { segment } of seg.segment(s)) {
        if (EMOJI_TEST_REGEX.test(segment)) count += 1;
      }
      return count;
    } catch {
      // fall through
    }
  }
  // Fallback: count emoji regex matches (approximate; counts ZWJ parts separately)
  return (s.match(new RegExp(EMOJI_REGEX.source, "gu")) ?? []).length;
}

/** Count line breaks (newlines). */
export function countLineBreaks(text: string): number {
  const s = text || "";
  if (!s) return 0;
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") count += 1;
  }
  return count;
}

/** Get the char limit for platform + mode. */
export function getLimit(platform: Platform, mode: Mode): number {
  return CHAR_LIMITS[platform][mode];
}

/** Get the optimal range for platform + mode. */
export function getOptimalRange(platform: Platform, mode: Mode): { min: number; max: number } {
  if (mode === "post") return OPTIMAL_RANGES[platform];
  // For non-post modes, optimal = 50-90% of limit
  const limit = getLimit(platform, mode);
  return {
    min: Math.floor(limit * 0.5),
    max: Math.floor(limit * 0.9),
  };
}

/**
 * Compute the effective URL chars for a given platform. Twitter counts
 * every URL as 23 chars (t.co shortening); other platforms count the
 * actual URL length.
 */
export function computeUrlChars(urls: string[], platform: Platform): number {
  if (platform === "twitter") return urls.length * TWITTER_URL_LENGTH;
  return urls.reduce((sum, u) => sum + u.length, 0);
}

/**
 * Compute the weighted character count for the platform. On Twitter,
 * URLs are replaced by their t.co length (23) when calculating the
 * displayed char count.
 */
export function computeWeightedChars(text: string, platform: Platform): number {
  const s = text || "";
  if (platform === "twitter") {
    const urls = findUrls(s);
    // Replace each URL with a placeholder of length 23
    let out = s;
    for (const u of urls) {
      out = out.replace(u, "x".repeat(TWITTER_URL_LENGTH));
    }
    return out.length;
  }
  return s.length;
}

/** Determine length status given current count, limit, and optimal range. */
export function getLengthStatus(
  count: number,
  limit: number,
  optimal: { min: number; max: number },
): "under" | "optimal" | "over" | "exceeded" {
  if (count > limit) return "exceeded";
  if (count >= optimal.min && count <= optimal.max) return "optimal";
  if (count < optimal.min) return "under";
  return "over";
}

/** Compute remaining characters (limit - count). Can be negative. */
export function computeRemaining(count: number, limit: number): number {
  return limit - count;
}

/** Estimate reading time in seconds (200 wpm). */
export function estimateReadingTimeSec(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.round((wordCount / READING_WPM) * 60));
}

/**
 * Truncate text to fit within the limit. If platform is Twitter,
 * URLs are counted as 23 chars during truncation. Adds "…" if truncated.
 */
export function truncateToFit(text: string, limit: number, platform: Platform): string {
  const s = text || "";
  if (computeWeightedChars(s, platform) <= limit) return s;
  // Reserve 1 char for ellipsis
  const target = limit - 1;
  if (platform === "twitter") {
    // Find URLs and treat them as 23-char tokens
    const urls = findUrls(s);
    // Build a token list: alternating non-URL text and URL tokens
    const tokens: { text: string; isUrl: boolean; len: number }[] = [];
    let lastIdx = 0;
    const re = new RegExp(URL_REGEX.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m.index > lastIdx) {
        const t = s.slice(lastIdx, m.index);
        tokens.push({ text: t, isUrl: false, len: t.length });
      }
      tokens.push({ text: m[0], isUrl: true, len: TWITTER_URL_LENGTH });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < s.length) {
      const t = s.slice(lastIdx);
      tokens.push({ text: t, isUrl: false, len: t.length });
    }
    let out = "";
    let used = 0;
    for (const tok of tokens) {
      if (used + tok.len <= target) {
        out += tok.text;
        used += tok.len;
      } else if (tok.isUrl) {
        // Drop the URL entirely if it doesn't fit
        break;
      } else {
        // Truncate the text token to remaining
        const remaining = target - used;
        if (remaining > 0) out += tok.text.slice(0, remaining);
        break;
      }
    }
    return out + "…";
  }
  return s.slice(0, target) + "…";
}

/** Render the text as it would appear (preserve line breaks). */
export function renderPreview(text: string): string {
  return text || "";
}

/** Build the full counter result. */
export function buildResult(input: CounterInput): CounterResult {
  const text = input.text ?? "";
  const platform = input.platform;
  const mode = input.mode;
  const charCount = computeWeightedChars(text, platform);
  const graphemeCount = countGraphemes(text);
  const wordCount = countWords(text);
  const hashtags = findHashtags(text);
  const mentions = findMentions(text);
  const urls = findUrls(text);
  const urlChars = computeUrlChars(urls, platform);
  const emojiCount = countEmojis(text);
  const lineBreakCount = countLineBreaks(text);
  const limit = getLimit(platform, mode);
  const optimal = getOptimalRange(platform, mode);
  const remaining = computeRemaining(charCount, limit);
  const overLimit = charCount > limit;
  const inOptimalRange = charCount >= optimal.min && charCount <= optimal.max;
  const lengthStatus = getLengthStatus(charCount, limit, optimal);
  const readingTimeSec = estimateReadingTimeSec(wordCount);
  const truncated = truncateToFit(text, limit, platform);
  const metrics: { label: string; value: number | string }[] = [
    { label: "Characters (weighted)", value: charCount },
    { label: "Grapheme clusters", value: graphemeCount },
    { label: "Words", value: wordCount },
    { label: "Hashtags", value: hashtags.length },
    { label: "Mentions", value: mentions.length },
    { label: "URLs", value: urls.length },
    { label: "URL chars", value: urlChars },
    { label: "Emojis", value: emojiCount },
    { label: "Line breaks", value: lineBreakCount },
    { label: "Limit", value: limit },
    { label: "Remaining", value: remaining },
    { label: "Reading time (sec)", value: readingTimeSec },
  ];
  return {
    text,
    platform,
    mode,
    charCount,
    graphemeCount,
    wordCount,
    hashtagCount: hashtags.length,
    hashtags,
    mentionCount: mentions.length,
    mentions,
    urlCount: urls.length,
    urls,
    urlChars,
    emojiCount,
    lineBreakCount,
    limit,
    remaining,
    overLimit,
    inOptimalRange,
    lengthStatus,
    optimalRange: optimal,
    readingTimeSec,
    truncated,
    metrics,
  };
}

// ---- Renderers ----

/** Render result as plain text stats report. */
export function renderText(result: CounterResult): string {
  const lines: string[] = [];
  lines.push(`Social Media Character Counter — ${PLATFORM_LABELS[result.platform]} (${MODE_LABELS[result.mode]})`);
  lines.push("");
  for (const m of result.metrics) {
    lines.push(`${m.label}: ${m.value}`);
  }
  lines.push("");
  lines.push(`Length status: ${result.lengthStatus.toUpperCase()}`);
  if (result.overLimit) {
    lines.push(`⚠ Over limit by ${-result.remaining} characters`);
  }
  if (result.inOptimalRange) {
    lines.push(`✓ In optimal range (${result.optimalRange.min}-${result.optimalRange.max})`);
  }
  if (result.hashtags.length > 0) {
    lines.push("");
    lines.push(`Hashtags: ${result.hashtags.join(", ")}`);
  }
  if (result.mentions.length > 0) {
    lines.push(`Mentions: ${result.mentions.join(", ")}`);
  }
  if (result.urls.length > 0) {
    lines.push(`URLs:`);
    for (const u of result.urls) lines.push(`  - ${u}`);
  }
  return lines.join("\n").trim();
}

/** Render result as CSV (metric, value). */
export function renderCsv(result: CounterResult): string {
  const lines = ["metric,value"];
  for (const m of result.metrics) {
    lines.push(`${escapeCsv(m.label)},${typeof m.value === "string" ? escapeCsv(m.value) : m.value}`);
  }
  lines.push(`platform,${result.platform}`);
  lines.push(`mode,${result.mode}`);
  lines.push(`length_status,${result.lengthStatus}`);
  lines.push(`over_limit,${result.overLimit}`);
  lines.push(`in_optimal_range,${result.inOptimalRange}`);
  return lines.join("\n");
}

/** Escape a value for CSV output. */
export function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-character-counter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  text: string;
  platform: Platform;
  mode: Mode;
  charCount: number;
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

export function buildShareUrl(input: CounterInput): string {
  const params = new URLSearchParams();
  if (input.text) params.set("text", input.text);
  params.set("platform", input.platform);
  params.set("mode", input.mode);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): CounterInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultOut: CounterInput = {
    text: "",
    platform: "twitter",
    mode: "post",
  };
  if (!clean) return defaultOut;
  const params = new URLSearchParams(clean);
  const p = params.get("platform");
  const m = params.get("mode");
  return {
    text: params.get("text") ?? "",
    platform: PLATFORMS.includes(p as Platform) ? (p as Platform) : defaultOut.platform,
    mode: MODES.includes(m as Mode) ? (m as Mode) : defaultOut.mode,
  };
}
