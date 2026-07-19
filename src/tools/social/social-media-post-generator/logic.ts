/**
 * Social Media Post Generator — pure logic.
 *
 * Generate platform-specific social media posts for Twitter/X, LinkedIn,
 * Facebook, Instagram, and Mastodon. Pure functions only — no DOM, no network.
 */

export type Tone =
  | "professional"
  | "casual"
  | "friendly"
  | "urgent"
  | "inspirational"
  | "humorous";

export type TargetAudience =
  | "general"
  | "developers"
  | "marketers"
  | "designers"
  | "entrepreneurs"
  | "students";

export type Platform =
  | "twitter"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "mastodon";

export interface PlatformConfig {
  id: Platform;
  label: string;
  maxChars: number;
  optimalChars: number;
  hashtagCount: number;
  cta: string;
  bestTime: string;
}

export interface GeneratedPost {
  platform: Platform;
  text: string;
  charCount: number;
  hashtagCount: number;
  truncated: boolean;
  variation: number;
  hook: string;
}

export interface Variation {
  variation: number;
  hook: string;
  text: string;
}

export interface SummaryStats {
  totalPlatforms: number;
  totalPosts: number;
  totalChars: number;
  avgCharsPerPost: number;
  truncatedCount: number;
}

export interface GeneratorInput {
  topic: string;
  keyPoints: string[];
  tone: Tone;
  audience: TargetAudience;
  platforms: Platform[];
  includeHashtags: boolean;
  includeCTA: boolean;
  includeEmojis: boolean;
}

export const PLATFORMS: Platform[] = [
  "twitter",
  "linkedin",
  "facebook",
  "instagram",
  "mastodon",
];

export const TONES: Tone[] = [
  "professional",
  "casual",
  "friendly",
  "urgent",
  "inspirational",
  "humorous",
];

export const AUDIENCES: TargetAudience[] = [
  "general",
  "developers",
  "marketers",
  "designers",
  "entrepreneurs",
  "students",
];

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  twitter: {
    id: "twitter",
    label: "Twitter/X",
    maxChars: 280,
    optimalChars: 240,
    hashtagCount: 3,
    cta: "Retweet & follow for more.",
    bestTime: "Mon–Fri 9am–11am, 1pm–3pm",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    maxChars: 3000,
    optimalChars: 1300,
    hashtagCount: 4,
    cta: "Read more and connect with me.",
    bestTime: "Tue–Thu 8am–10am, 12pm",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    maxChars: 63206,
    optimalChars: 477,
    hashtagCount: 2,
    cta: "Like, share, and comment below.",
    bestTime: "Wed 11am, 1pm",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    maxChars: 2200,
    optimalChars: 125,
    hashtagCount: 15,
    cta: "Link in bio.",
    bestTime: "Mon/Wed/Thu 11am–1pm, 7pm–9pm",
  },
  mastodon: {
    id: "mastodon",
    label: "Mastodon",
    maxChars: 500,
    optimalChars: 400,
    hashtagCount: 3,
    cta: "Boost & follow for more.",
    bestTime: "Tue–Thu 12pm–2pm",
  },
};

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional",
  casual: "Casual",
  friendly: "Friendly",
  urgent: "Urgent",
  inspirational: "Inspirational",
  humorous: "Humorous",
};

export const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  general: "General",
  developers: "Developers",
  marketers: "Marketers",
  designers: "Designers",
  entrepreneurs: "Entrepreneurs",
  students: "Students",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  mastodon: "Mastodon",
};

// Tone modifiers (greeting / closing / emoji set)
interface TonePreset {
  greeting: string;
  closing: string;
  emojis: string[];
}

export const TONE_PRESETS: Record<Tone, TonePreset> = {
  professional: {
    greeting: "Sharing insights on",
    closing: "Thoughts?",
    emojis: ["📊", "📈", "💼"],
  },
  casual: {
    greeting: "Just thinking about",
    closing: "What do you think?",
    emojis: ["😊", "👍", "✌️"],
  },
  friendly: {
    greeting: "Hey friends! Let's talk about",
    closing: "Would love your thoughts!",
    emojis: ["🤗", "💛", "✨"],
  },
  urgent: {
    greeting: "Important:",
    closing: "Act now.",
    emojis: ["🚨", "⚡", "🔥"],
  },
  inspirational: {
    greeting: "Believe in the power of",
    closing: "You've got this.",
    emojis: ["🌟", "💫", "🚀"],
  },
  humorous: {
    greeting: "Okay so",
    closing: "Don't @ me. 😄",
    emojis: ["😂", "🤣", "😜"],
  },
};

// Audience vocabulary modifiers (prefix words / suffix flavor)
interface AudiencePreset {
  label: string;
  flavor: string; // appended flavor snippet
  vocab: string; // vocabulary hint appended after topic
}

export const AUDIENCE_PRESETS: Record<TargetAudience, AudiencePreset> = {
  general: { label: "General", flavor: "", vocab: "" },
  developers: {
    label: "Developers",
    flavor: " — practical for builders shipping production code.",
    vocab: "APIs, scale, ship, deploy",
  },
  marketers: {
    label: "Marketers",
    flavor: " — actionable for growth and engagement teams.",
    vocab: "ROI, funnel, engagement, conversion",
  },
  designers: {
    label: "Designers",
    flavor: " — designed with UX, aesthetics, and clarity in mind.",
    vocab: "aesthetic, UX, minimal, system",
  },
  entrepreneurs: {
    label: "Entrepreneurs",
    flavor: " — relevant for founders building MVPs and validating growth.",
    vocab: "MVP, growth, validation, traction",
  },
  students: {
    label: "Students",
    flavor: " — accessible for learners exploring the fundamentals.",
    vocab: "learn, study, explore, practice",
  },
};

// Variation hooks — 3 hooks per generation
export const HOOK_TEMPLATES: Array<{ variation: number; hook: string; template: string }> = [
  {
    variation: 1,
    hook: "question",
    template: "Did you know about {topic}? Here's what stood out:",
  },
  {
    variation: 2,
    hook: "statement",
    template: "{Topic} is reshaping how we work. Key takeaways:",
  },
  {
    variation: 3,
    hook: "story",
    template: "I've been exploring {topic} lately. A few notes worth sharing:",
  },
];

/** Normalize topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Capitalize first letter (used for statement hook). */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse key points (one per line, ignore blanks). */
export function parseKeyPoints(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Format key points as bullet list. */
export function formatKeyPoints(points: string[]): string {
  return points.map((p) => `• ${p}`).join("\n");
}

/** Generate hashtags for a topic, limited to N. */
export function generateHashtags(topic: string, count: number): string[] {
  const t = normalizeTopic(topic);
  if (!t || count <= 0) return [];
  const base = t.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = base.split(/\s+/).filter(Boolean);
  const tags = new Set<string>();
  const joined = words.join("");
  if (joined) tags.add(`#${joined}`);
  for (const w of words) tags.add(`#${w}`);
  // Suffix variations on joined topic
  const joinedSuffixes = [
    "tips", "guide", "2026", "community", "daily", "love",
    "world", "life", "hub", "club", "fan", "pro", "dev",
    "code", "hacks", "tricks", "101", "master", "expert",
  ];
  for (const suffix of joinedSuffixes) {
    if (tags.size >= count) break;
    if (joined) tags.add(`#${joined}${suffix}`);
  }
  // Prefix variations on joined topic
  const joinedPrefixes = ["learn", "ilove", "why", "top", "best", "daily"];
  for (const prefix of joinedPrefixes) {
    if (tags.size >= count) break;
    if (joined) tags.add(`#${prefix}${joined}`);
  }
  // Per-word variations
  for (const w of words) {
    if (tags.size >= count) break;
    tags.add(`#learn${w}`);
  }
  for (const w of words) {
    if (tags.size >= count) break;
    tags.add(`#${w}tips`);
  }
  for (const w of words) {
    if (tags.size >= count) break;
    tags.add(`#${w}dev`);
  }
  for (const w of words) {
    if (tags.size >= count) break;
    tags.add(`#${w}life`);
  }
  for (const w of words) {
    if (tags.size >= count) break;
    tags.add(`#${w}2026`);
  }
  // Community variations
  for (const w of words) {
    if (tags.size >= count) break;
    tags.add(`#${w}community`);
  }
  // Word pairs (if 2+ words)
  if (words.length >= 2) {
    for (let i = 0; i < words.length && tags.size < count; i++) {
      for (let j = 0; j < words.length && tags.size < count; j++) {
        if (i !== j) tags.add(`#${words[i]}${words[j]}`);
      }
    }
  }
  return Array.from(tags).slice(0, count);
}

/** Build CTA string for a platform (respects includeCTA). */
export function generateCTA(platform: Platform, includeCTA: boolean): string {
  if (!includeCTA) return "";
  return PLATFORM_CONFIGS[platform].cta;
}

/** Apply tone — returns opening + closing lines. */
export function applyTone(tone: Tone, topic: string): { opening: string; closing: string } {
  const preset = TONE_PRESETS[tone];
  const t = normalizeTopic(topic);
  return {
    opening: t ? `${preset.greeting} ${t}` : preset.greeting,
    closing: preset.closing,
  };
}

/** Apply audience flavor — appends audience-specific snippet. */
export function applyAudience(audience: TargetAudience): string {
  return AUDIENCE_PRESETS[audience].flavor;
}

/** Apply emojis — tone-aware, returns one emoji (or "" if disabled). */
export function applyEmojis(tone: Tone, includeEmojis: boolean): string {
  if (!includeEmojis) return "";
  const set = TONE_PRESETS[tone].emojis;
  return set[0] ?? "";
}

/** Build hook text for a given variation. */
export function buildHook(variation: number, topic: string): { hook: string; text: string } {
  const tpl = HOOK_TEMPLATES.find((h) => h.variation === variation) ?? HOOK_TEMPLATES[0];
  const t = normalizeTopic(topic);
  const text = tpl.template
    .replace("{topic}", t)
    .replace("{Topic}", capitalize(t));
  return { hook: tpl.hook, text };
}

/** Validate char count against platform limit. Returns truncated flag. */
export function validateCharLimit(platform: Platform, charCount: number): boolean {
  return charCount > PLATFORM_CONFIGS[platform].maxChars;
}

/** Get char limit status color: green / yellow / red. */
export function getCharLimitStatus(
  platform: Platform,
  charCount: number,
): "green" | "yellow" | "red" {
  const cfg = PLATFORM_CONFIGS[platform];
  if (charCount > cfg.maxChars) return "red";
  if (charCount > cfg.optimalChars) return "yellow";
  return "green";
}

/** Truncate text to platform max chars (preserving word boundary when possible). */
export function truncateToLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}

/** Generate a single post for a platform + variation. */
export function generateForPlatform(
  input: GeneratorInput,
  platform: Platform,
  variation: number,
): GeneratedPost {
  const cfg = PLATFORM_CONFIGS[platform];
  const { hook, text: hookText } = buildHook(variation, input.topic);
  const tone = applyTone(input.tone, input.topic);
  const audienceFlavor = applyAudience(input.audience);
  const emoji = applyEmojis(input.tone, input.includeEmojis);

  // Body parts
  const parts: string[] = [];
  // Instagram: caption hook is the most important (first 125 chars above fold)
  if (platform === "instagram") {
    parts.push(`${emoji ? emoji + " " : ""}${hookText}`);
    if (input.keyPoints.length > 0) {
      parts.push(formatKeyPoints(input.keyPoints));
    }
    parts.push(audienceFlavor.trim());
    parts.push(tone.closing);
    if (input.includeCTA) parts.push(cfg.cta);
    if (input.includeHashtags) {
      const tags = generateHashtags(input.topic, cfg.hashtagCount);
      if (tags.length > 0) parts.push(tags.join(" "));
    }
  } else if (platform === "twitter" || platform === "mastodon") {
    // Short-form: hook + first key point + closing + CTA + hashtags
    parts.push(`${emoji ? emoji + " " : ""}${hookText}`);
    if (input.keyPoints[0]) parts.push(`• ${input.keyPoints[0]}`);
    if (input.keyPoints[1]) parts.push(`• ${input.keyPoints[1]}`);
    parts.push(audienceFlavor.trim());
    parts.push(tone.closing);
    if (input.includeCTA) parts.push(cfg.cta);
    if (input.includeHashtags) {
      const tags = generateHashtags(input.topic, cfg.hashtagCount);
      if (tags.length > 0) parts.push(tags.join(" "));
    }
  } else {
    // LinkedIn / Facebook: longer-form, all key points
    parts.push(`${emoji ? emoji + " " : ""}${tone.opening}.`);
    parts.push(hookText);
    if (input.keyPoints.length > 0) {
      parts.push(formatKeyPoints(input.keyPoints));
    }
    if (audienceFlavor.trim()) parts.push(audienceFlavor.trim());
    parts.push(tone.closing);
    if (input.includeCTA) parts.push(cfg.cta);
    if (input.includeHashtags) {
      const tags = generateHashtags(input.topic, cfg.hashtagCount);
      if (tags.length > 0) parts.push(tags.join(" "));
    }
  }

  // Join non-empty parts
  const joined = parts.filter((p) => p && p.trim().length > 0).join("\n\n");
  const truncated = validateCharLimit(platform, joined.length);
  const text = truncateToLimit(joined, cfg.maxChars);

  const hashtagCount = input.includeHashtags
    ? generateHashtags(input.topic, cfg.hashtagCount).length
    : 0;

  return {
    platform,
    text,
    charCount: text.length,
    hashtagCount,
    truncated,
    variation,
    hook,
  };
}

/** Generate 3 variations for a single platform. */
export function generateVariations(
  input: GeneratorInput,
  platform: Platform,
): GeneratedPost[] {
  return HOOK_TEMPLATES.map((h) => generateForPlatform(input, platform, h.variation));
}

/** Generate posts for all selected platforms (variation 1 only, used for stats / summary). */
export function generateForPlatforms(input: GeneratorInput): GeneratedPost[] {
  const out: GeneratedPost[] = [];
  for (const p of input.platforms) {
    out.push(generateForPlatform(input, p, 1));
  }
  return out;
}

/** Generate all variations for all selected platforms. */
export function generateAllVariations(input: GeneratorInput): GeneratedPost[] {
  const out: GeneratedPost[] = [];
  for (const p of input.platforms) {
    out.push(...generateVariations(input, p));
  }
  return out;
}

/** Compute summary stats across generated posts. */
export function computeSummaryStats(posts: GeneratedPost[]): SummaryStats {
  if (posts.length === 0) {
    return { totalPlatforms: 0, totalPosts: 0, totalChars: 0, avgCharsPerPost: 0, truncatedCount: 0 };
  }
  const platforms = new Set(posts.map((p) => p.platform));
  const totalChars = posts.reduce((sum, p) => sum + p.charCount, 0);
  const truncatedCount = posts.filter((p) => p.truncated).length;
  return {
    totalPlatforms: platforms.size,
    totalPosts: posts.length,
    totalChars,
    avgCharsPerPost: Math.round(totalChars / posts.length),
    truncatedCount,
  };
}

/** Get best time to post for a platform. */
export function getBestTimeToPost(platform: Platform): string {
  return PLATFORM_CONFIGS[platform].bestTime;
}

/** Render posts as plain text report (per platform block). */
export function renderText(posts: GeneratedPost[]): string {
  if (posts.length === 0) return "";
  const byPlatform = new Map<Platform, GeneratedPost[]>();
  for (const p of posts) {
    if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, []);
    byPlatform.get(p.platform)!.push(p);
  }
  const blocks: string[] = [];
  for (const [platform, list] of byPlatform) {
    const cfg = PLATFORM_CONFIGS[platform];
    blocks.push(`=== ${cfg.label} ===`);
    blocks.push(`Best time to post: ${cfg.bestTime}`);
    blocks.push(`Max chars: ${cfg.maxChars} | Optimal: ${cfg.optimalChars}`);
    blocks.push("");
    list.forEach((p, i) => {
      blocks.push(`--- Variation ${p.variation} (${p.hook} hook) ---`);
      blocks.push(`Chars: ${p.charCount}/${cfg.maxChars}${p.truncated ? " [TRUNCATED]" : ""}`);
      blocks.push(`Hashtags: ${p.hashtagCount}`);
      blocks.push("");
      blocks.push(p.text);
      blocks.push("");
      if (i < list.length - 1) blocks.push("");
    });
    blocks.push("");
  }
  return blocks.join("\n").trim() + "\n";
}

/** Render posts as CSV. */
export function renderCsv(posts: GeneratedPost[]): string {
  const lines = ["platform,variation,hook,char_count,hashtag_count,truncated,post_text"];
  for (const p of posts) {
    lines.push([
      p.platform,
      String(p.variation),
      p.hook,
      String(p.charCount),
      String(p.hashtagCount),
      p.truncated ? "yes" : "no",
      escapeCsv(p.text),
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

const HISTORY_KEY = "unqtools:social-media-post-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  topic: string;
  platforms: Platform[];
  tone: Tone;
  audience: TargetAudience;
  totalPosts: number;
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

export function buildShareUrl(input: GeneratorInput): string {
  const params = new URLSearchParams();
  if (input.topic) params.set("topic", input.topic);
  if (input.keyPoints.length > 0) params.set("points", input.keyPoints.join("\n"));
  if (input.tone) params.set("tone", input.tone);
  if (input.audience) params.set("aud", input.audience);
  if (input.platforms.length > 0) params.set("plat", input.platforms.join(","));
  if (!input.includeHashtags) params.set("htags", "0");
  if (!input.includeCTA) params.set("cta", "0");
  if (input.includeEmojis) params.set("emoji", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): GeneratorInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      topic: "",
      keyPoints: [],
      tone: "professional",
      audience: "general",
      platforms: [],
      includeHashtags: true,
      includeCTA: true,
      includeEmojis: false,
    };
  }
  const params = new URLSearchParams(clean);
  const topic = params.get("topic") ?? "";
  const pointsStr = params.get("points") ?? "";
  const keyPoints = parseKeyPoints(pointsStr);
  const tone = (TONES.includes(params.get("tone") as Tone)
    ? (params.get("tone") as Tone)
    : "professional");
  const audience = (AUDIENCES.includes(params.get("aud") as TargetAudience)
    ? (params.get("aud") as TargetAudience)
    : "general");
  const platStr = params.get("plat") ?? "";
  const platforms = platStr
    ? (platStr.split(",").filter((p) => PLATFORMS.includes(p as Platform)) as Platform[])
    : [];
  const includeHashtags = params.get("htags") !== "0";
  const includeCTA = params.get("cta") !== "0";
  const includeEmojis = params.get("emoji") === "1";
  return {
    topic, keyPoints, tone, audience, platforms, includeHashtags, includeCTA, includeEmojis,
  };
}
