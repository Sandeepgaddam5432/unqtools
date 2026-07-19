/**
 * Social Media Bio Generator — pure logic.
 *
 * Generate platform-specific bios for Twitter/X, Instagram, LinkedIn,
 * TikTok, and YouTube. Pure functions only — no DOM, no network.
 */

export type Tone =
  | "professional"
  | "casual"
  | "creative"
  | "minimalist"
  | "humorous";

export type Platform =
  | "twitter"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube";

export type NameFormat = "full" | "first" | "initials";

export interface BioInput {
  name: string;
  profession: string;
  interests: string;
  location: string;
  website: string;
  tone: Tone;
  platforms: Platform[];
  includeEmojis: boolean;
  includeCTA: boolean;
  pronouns: string;
}

export interface GeneratedBio {
  platform: Platform;
  variation: number;
  bioText: string;
  charCount: number;
  maxChars: number;
  emojiCount: number;
  hasCTA: boolean;
  withinLimit: boolean;
}

export interface SummaryStats {
  totalPlatforms: number;
  totalBios: number;
  avgCharCount: number;
  totalEmojis: number;
  totalCTAs: number;
  withinLimitCount: number;
}

export const TONES: Tone[] = [
  "professional",
  "casual",
  "creative",
  "minimalist",
  "humorous",
];

export const PLATFORMS: Platform[] = [
  "twitter",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
];

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional",
  casual: "Casual",
  creative: "Creative",
  minimalist: "Minimalist",
  humorous: "Humorous",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter/X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export interface PlatformConfig {
  id: Platform;
  label: string;
  maxChars: number;
  optimalChars: number;
  cta: string;
  separator: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  twitter: {
    id: "twitter",
    label: "Twitter/X",
    maxChars: 160,
    optimalChars: 120,
    cta: "DM for collab",
    separator: " | ",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    maxChars: 150,
    optimalChars: 120,
    cta: "DM for collab",
    separator: " · ",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    maxChars: 220,
    optimalChars: 180,
    cta: "Connect with me",
    separator: " — ",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    maxChars: 80,
    optimalChars: 60,
    cta: "Follow for more",
    separator: " | ",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    maxChars: 1000,
    optimalChars: 500,
    cta: "Subscribe for more",
    separator: " — ",
  },
};

// Tone modifiers — emoji set + adjective + opening/closing flavor
interface TonePreset {
  emoji: string;
  adjective: string;
  opening: string;
  closing: string;
}

export const TONE_PRESETS: Record<Tone, TonePreset> = {
  professional: {
    emoji: "💼",
    adjective: "Experienced",
    opening: "",
    closing: "Let's connect.",
  },
  casual: {
    emoji: "👋",
    adjective: "Friendly",
    opening: "Hey!",
    closing: "Say hi :)",
  },
  creative: {
    emoji: "✨",
    adjective: "Curious",
    opening: "",
    closing: "Stay weird, stay creative.",
  },
  minimalist: {
    emoji: "▪",
    adjective: "",
    opening: "",
    closing: "",
  },
  humorous: {
    emoji: "🙃",
    adjective: "Allegedly",
    opening: "",
    closing: "I promise I'm funnier in person.",
  },
};

/** Normalize a text string. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse interests (comma, semicolon, or newline-separated). */
export function parseInterests(s: string): string[] {
  if (!s) return [];
  return s
    .split(/[\n,;]+/)
    .map((x) => normalizeText(x))
    .filter(Boolean);
}

/** Format interests as a bullet list (for LinkedIn about section). */
export function formatBullets(items: string[]): string {
  return items.map((i) => `• ${i}`).join("\n");
}

/** Format interests as a compact comma-separated string. */
export function formatInterests(interests: string[]): string {
  return interests.join(", ");
}

/** Format a name based on convention. */
export function formatName(name: string, format: NameFormat): string {
  const n = normalizeText(name);
  if (!n) return "";
  const parts = n.split(/\s+/);
  if (parts.length === 0) return n;
  if (format === "full") return n;
  if (format === "first") return parts[0];
  if (format === "initials") {
    const initials = parts.map((p) => p.charAt(0).toUpperCase()).join("");
    return initials;
  }
  return n;
}

/** Pick the right name format per platform convention. */
export function nameFormatForPlatform(platform: Platform): NameFormat {
  if (platform === "twitter" || platform === "tiktok") return "full";
  if (platform === "instagram" || platform === "youtube") return "full";
  if (platform === "linkedin") return "full";
  return "full";
}

/** Apply tone — wraps/adapts text based on tone preset. */
export function applyTone(tone: Tone, text: string): string {
  if (!text) return "";
  const preset = TONE_PRESETS[tone];
  if (tone === "minimalist") {
    return text; // minimalist = no flavor added
  }
  if (tone === "humorous") {
    return `${preset.adjective} ${text}`.trim();
  }
  if (tone === "professional") {
    return `${preset.adjective} ${text}`.trim();
  }
  if (tone === "casual" && preset.opening) {
    return `${preset.opening} ${text}`.trim();
  }
  if (tone === "creative") {
    return `${preset.adjective} ${text}`.trim();
  }
  return text;
}

/** Generate CTA for a platform. */
export function generateCTA(platform: Platform, includeCTA: boolean): string {
  if (!includeCTA) return "";
  return PLATFORM_CONFIGS[platform].cta;
}

/** Apply tone-aware emoji. */
export function applyEmojis(tone: Tone, includeEmojis: boolean): string {
  if (!includeEmojis) return "";
  return TONE_PRESETS[tone].emoji;
}

/** Insert a website link into text. */
export function insertLink(text: string, website: string): string {
  const url = normalizeText(website);
  if (!url) return text;
  // Normalize if missing scheme
  const fullUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
  return `${text}\n${fullUrl}`.trim();
}

/** Insert keywords/hashtags for discoverability (derived from interests). */
export function insertKeywords(text: string, interests: string[]): string {
  if (interests.length === 0) return text;
  const tags = interests
    .map((i) => i.toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .filter((x) => x.length > 0)
    .map((x) => `#${x}`);
  if (tags.length === 0) return text;
  return `${text}\n${tags.join(" ")}`;
}

/** Insert pronouns (e.g. she/her, he/him, they/them). */
export function insertPronouns(text: string, pronouns: string): string {
  const p = normalizeText(pronouns);
  if (!p) return text;
  return `${text} (${p})`;
}

/** Count emojis in a string. */
export function countEmojis(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu);
  return matches ? matches.length : 0;
}

/** Validate bio length against platform limit. */
export function validateBioLength(platform: Platform, text: string): boolean {
  return text.length <= PLATFORM_CONFIGS[platform].maxChars;
}

/** Get char-limit status color. */
export function getCharLimitStatus(
  platform: Platform,
  charCount: number,
): "green" | "yellow" | "red" {
  const cfg = PLATFORM_CONFIGS[platform];
  if (charCount > cfg.maxChars) return "red";
  if (charCount > cfg.optimalChars) return "yellow";
  return "green";
}

/** Truncate text to max chars (preserving word boundary when possible). */
export function truncateToLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}

/** Build a single variation for a platform. */
export function generateBio(
  input: BioInput,
  platform: Platform,
  variation: number,
): GeneratedBio {
  const cfg = PLATFORM_CONFIGS[platform];
  const name = formatName(input.name, nameFormatForPlatform(platform));
  const profession = normalizeText(input.profession);
  const interests = parseInterests(input.interests);
  const interestsStr = formatInterests(interests);
  const location = normalizeText(input.location);
  const emoji = applyEmojis(input.tone, input.includeEmojis);
  const cta = generateCTA(platform, input.includeCTA);

  // Build base bio depending on platform + variation
  let bio = "";
  const sep = cfg.separator;

  if (variation === 1) {
    // Terse
    if (platform === "linkedin") {
      const headline = [name, profession].filter(Boolean).join(sep);
      bio = headline;
      if (interestsStr) bio += `\n${interestsStr}`;
    } else if (platform === "youtube") {
      bio = [name, profession].filter(Boolean).join(sep);
      if (interestsStr) bio += `\n${interestsStr}`;
    } else {
      bio = [name, profession, interestsStr].filter(Boolean).join(sep);
    }
  } else if (variation === 2) {
    // Conversational
    const toneText = applyTone(input.tone, profession || "creator");
    if (platform === "linkedin") {
      bio = name ? `${name}` : "";
      if (toneText) bio += `\n${toneText}`;
      if (interestsStr) bio += `\nLoves: ${interestsStr}`;
    } else {
      const parts: string[] = [];
      if (name) parts.push(name);
      if (toneText) parts.push(toneText);
      if (interestsStr) parts.push(interestsStr);
      bio = parts.join("\n");
    }
  } else {
    // Story-style (longer)
    if (platform === "linkedin") {
      const lines: string[] = [];
      if (name) lines.push(name);
      if (profession) lines.push(`${TONE_PRESETS[input.tone].adjective} ${profession}`.trim());
      if (interestsStr) lines.push(`\nFocus areas:`);
      if (interests.length > 0) lines.push(formatBullets(interests));
      bio = lines.join("\n");
    } else if (platform === "youtube") {
      const lines: string[] = [];
      if (name) lines.push(`Hi, I'm ${name}.`);
      if (profession) lines.push(`${profession}.`);
      if (interestsStr) lines.push(`On this channel: ${interestsStr}.`);
      bio = lines.join("\n");
    } else {
      const lines: string[] = [];
      if (name) lines.push(name);
      if (profession) lines.push(`${profession}`);
      if (interestsStr) lines.push(`Loves: ${interestsStr}`);
      bio = lines.join("\n");
    }
  }

  // Apply extras
  if (emoji) {
    bio = `${emoji} ${bio}`;
  }
  if (location && (platform === "instagram" || platform === "twitter" || platform === "tiktok")) {
    const prefix = input.includeEmojis ? "📍 " : "Location: ";
    bio = `${bio}\n${prefix}${location}`;
  }
  if (input.pronouns) {
    bio = insertPronouns(bio, input.pronouns);
  }
  if (cta) {
    if (platform === "twitter" || platform === "tiktok") {
      bio = `${bio}${sep}${cta}`;
    } else {
      bio = `${bio}\n${cta}`;
    }
  }
  if (input.website) {
    bio = insertLink(bio, input.website);
  }
  // Add hashtags for discoverability on IG/TikTok/Twitter
  if ((platform === "instagram" || platform === "tiktok" || platform === "twitter") && interests.length > 0) {
    bio = insertKeywords(bio, interests);
  }

  bio = bio.trim();
  const withinLimit = validateBioLength(platform, bio);
  const text = truncateToLimit(bio, cfg.maxChars);

  return {
    platform,
    variation,
    bioText: text,
    charCount: text.length,
    maxChars: cfg.maxChars,
    emojiCount: countEmojis(text),
    hasCTA: cta.length > 0,
    withinLimit,
  };
}

/** Generate 3 variations for a single platform. */
export function generateVariations(input: BioInput, platform: Platform): GeneratedBio[] {
  return [1, 2, 3].map((v) => generateBio(input, platform, v));
}

/** Generate variation 1 for all selected platforms. */
export function generateAll(input: BioInput): GeneratedBio[] {
  const out: GeneratedBio[] = [];
  for (const p of input.platforms) {
    out.push(...generateVariations(input, p));
  }
  return out;
}

/** Compute summary stats across bios. */
export function computeStats(bios: GeneratedBio[]): SummaryStats {
  if (bios.length === 0) {
    return {
      totalPlatforms: 0,
      totalBios: 0,
      avgCharCount: 0,
      totalEmojis: 0,
      totalCTAs: 0,
      withinLimitCount: 0,
    };
  }
  const platforms = new Set(bios.map((b) => b.platform));
  const totalChars = bios.reduce((s, b) => s + b.charCount, 0);
  const totalEmojis = bios.reduce((s, b) => s + b.emojiCount, 0);
  const totalCTAs = bios.filter((b) => b.hasCTA).length;
  const withinLimitCount = bios.filter((b) => b.withinLimit).length;
  return {
    totalPlatforms: platforms.size,
    totalBios: bios.length,
    avgCharCount: Math.round(totalChars / bios.length),
    totalEmojis,
    totalCTAs,
    withinLimitCount,
  };
}

/** Render bios as plain text report (per platform). */
export function renderText(bios: GeneratedBio[]): string {
  if (bios.length === 0) return "";
  const byPlatform = new Map<Platform, GeneratedBio[]>();
  for (const b of bios) {
    if (!byPlatform.has(b.platform)) byPlatform.set(b.platform, []);
    byPlatform.get(b.platform)!.push(b);
  }
  const blocks: string[] = [];
  for (const [platform, list] of byPlatform) {
    const cfg = PLATFORM_CONFIGS[platform];
    blocks.push(`=== ${cfg.label} ===`);
    blocks.push(`Max chars: ${cfg.maxChars} | Optimal: ${cfg.optimalChars}`);
    blocks.push("");
    list.forEach((b) => {
      blocks.push(`--- Variation ${b.variation} ---`);
      blocks.push(`Chars: ${b.charCount}/${b.maxChars}${b.withinLimit ? "" : " [OVER LIMIT]"} | Emojis: ${b.emojiCount} | CTA: ${b.hasCTA ? "yes" : "no"}`);
      blocks.push("");
      blocks.push(b.bioText);
      blocks.push("");
    });
    blocks.push("");
  }
  return blocks.join("\n").trim() + "\n";
}

/** Render bios as CSV. */
export function renderCsv(bios: GeneratedBio[]): string {
  const lines = ["platform,variation,bio_text,char_count,max_chars,emoji_count,has_cta,within_limit"];
  for (const b of bios) {
    lines.push([
      b.platform,
      String(b.variation),
      escapeCsv(b.bioText),
      String(b.charCount),
      String(b.maxChars),
      String(b.emojiCount),
      b.hasCTA ? "yes" : "no",
      b.withinLimit ? "yes" : "no",
    ].join(","));
  }
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

const HISTORY_KEY = "unqtools:social-media-bio-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  name: string;
  profession: string;
  platforms: Platform[];
  tone: Tone;
  totalBios: number;
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

export function buildShareUrl(input: BioInput): string {
  const params = new URLSearchParams();
  if (input.name) params.set("name", input.name);
  if (input.profession) params.set("prof", input.profession);
  if (input.interests) params.set("int", input.interests);
  if (input.location) params.set("loc", input.location);
  if (input.website) params.set("url", input.website);
  if (input.tone) params.set("tone", input.tone);
  if (input.platforms.length > 0) params.set("plat", input.platforms.join(","));
  if (input.pronouns) params.set("pron", input.pronouns);
  if (input.includeEmojis) params.set("emoji", "1");
  if (input.includeCTA) params.set("cta", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): BioInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: BioInput = {
    name: "",
    profession: "",
    interests: "",
    location: "",
    website: "",
    tone: "professional",
    platforms: [],
    includeEmojis: false,
    includeCTA: true,
    pronouns: "",
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const tone = (TONES.includes(params.get("tone") as Tone)
    ? (params.get("tone") as Tone)
    : "professional");
  const platStr = params.get("plat") ?? "";
  const platforms = platStr
    ? (platStr.split(",").filter((p) => PLATFORMS.includes(p as Platform)) as Platform[])
    : [];
  return {
    name: params.get("name") ?? "",
    profession: params.get("prof") ?? "",
    interests: params.get("int") ?? "",
    location: params.get("loc") ?? "",
    website: params.get("url") ?? "",
    tone,
    platforms,
    pronouns: params.get("pron") ?? "",
    includeEmojis: params.get("emoji") === "1",
    includeCTA: params.get("cta") !== "0",
  };
}
