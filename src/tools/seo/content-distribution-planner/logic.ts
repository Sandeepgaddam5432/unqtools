/**
 * Content Distribution Planner — pure logic.
 *
 * Generate platform-specific distribution snippets for 11 channels.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type ChannelId =
  | "twitter"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "email"
  | "reddit"
  | "hackernews"
  | "devto"
  | "medium"
  | "youtube"
  | "discord";

export interface ChannelConfig {
  id: ChannelId;
  label: string;
  charLimit: number;
  minHashtags: number;
  maxHashtags: number;
  tone: string;
}

export interface DistributionInput {
  title: string;
  description: string;
  url: string;
  channels: ChannelId[];
  hashtags: string[];
  cta: string;
}

export interface DistributionSnippet {
  channelId: ChannelId;
  channelLabel: string;
  snippet: string;
  charCount: number;
  charLimit: number;
  truncated: boolean;
  hashtagCount: number;
  hashtags: string[];
  warnings: string[];
}

export interface SummaryStats {
  totalChannels: number;
  totalChars: number;
  totalHashtags: number;
  truncatedCount: number;
  warningCount: number;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  channels: ChannelId[];
  totalSnippets: number;
}

// ---- Constants & presets ----

export const CHANNEL_CONFIGS: Record<ChannelId, ChannelConfig> = {
  twitter:    { id: "twitter",    label: "Twitter/X",            charLimit: 280,  minHashtags: 2, maxHashtags: 3,  tone: "Hook + URL + CTA" },
  linkedin:   { id: "linkedin",   label: "LinkedIn",             charLimit: 1300, minHashtags: 3, maxHashtags: 5,  tone: "Professional" },
  facebook:   { id: "facebook",   label: "Facebook",             charLimit: 477,  minHashtags: 0, maxHashtags: 2,  tone: "Casual, story-driven" },
  instagram:  { id: "instagram",  label: "Instagram",            charLimit: 2200, minHashtags: 10, maxHashtags: 30, tone: "Visual-first caption" },
  email:      { id: "email",      label: "Email Newsletter",     charLimit: 1500, minHashtags: 0, maxHashtags: 0,  tone: "3-section (subject + preview + body)" },
  reddit:     { id: "reddit",     label: "Reddit",               charLimit: 40000, minHashtags: 0, maxHashtags: 0,  tone: "Markdown, TL;DR + body + link" },
  hackernews: { id: "hackernews", label: "Hacker News",          charLimit: 80,   minHashtags: 0, maxHashtags: 0,  tone: "No marketing speak" },
  devto:      { id: "devto",      label: "Dev.to",               charLimit: 65535, minHashtags: 0, maxHashtags: 4,  tone: "Markdown, 4 tags max" },
  medium:     { id: "medium",     label: "Medium",               charLimit: 200,  minHashtags: 0, maxHashtags: 5,  tone: "Title + subtitle + hook" },
  youtube:    { id: "youtube",    label: "YouTube Community",    charLimit: 150,  minHashtags: 0, maxHashtags: 3,  tone: "Poll-style text post" },
  discord:    { id: "discord",    label: "Discord",              charLimit: 500,  minHashtags: 0, maxHashtags: 0,  tone: "Short message + channel suggestions" },
};

export const ALL_CHANNEL_IDS = Object.keys(CHANNEL_CONFIGS) as ChannelId[];

export const CHANNEL_PRESETS: Record<string, ChannelId[]> = {
  "All 11 channels": ALL_CHANNEL_IDS,
  "Social only": ["twitter", "linkedin", "facebook", "instagram"],
  "Dev / Tech": ["twitter", "hackernews", "devto", "reddit", "discord"],
  "Newsletter": ["email", "twitter", "linkedin"],
  "Blogging": ["medium", "devto", "twitter", "linkedin"],
  "Community": ["discord", "reddit", "twitter", "youtube"],
};

// Marketing fluff words to strip from HN titles
export const MARKETING_WORDS = [
  "amazing", "revolutionary", "game-changing", "groundbreaking",
  "incredible", "awesome", "best-ever", "ultimate", "epic",
  "mind-blowing", "stunning", "magical",
];

// Suggested hashtag seed list (appended when title lacks enough keywords)
export const HASHTAG_SEEDS = [
  "content", "marketing", "growth", "tips", "strategy",
  "tools", "resources", "ideas", "insights", "news",
];

// ---- Normalizers & parsers ----

export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function normalizeHashtag(s: string): string {
  const cleaned = (s || "")
    .replace(/^#+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
  return cleaned ? `#${cleaned}` : "";
}

export function parseChannels(input: string): ChannelId[] {
  if (!input) return [];
  const out: ChannelId[] = [];
  const seen = new Set<ChannelId>();
  const parts = input.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const p of parts) {
    // Match by canonical id or label
    const id = matchChannelId(p);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function matchChannelId(s: string): ChannelId | null {
  const lc = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (lc === "twitter" || lc === "x" || lc === "twitterx") return "twitter";
  if (lc === "linkedin") return "linkedin";
  if (lc === "facebook" || lc === "fb") return "facebook";
  if (lc === "instagram" || lc === "ig") return "instagram";
  if (lc === "email" || lc === "newsletter" || lc === "emailnewsletter") return "email";
  if (lc === "reddit") return "reddit";
  if (lc === "hackernews" || lc === "hn") return "hackernews";
  if (lc === "devto" || lc === "dev") return "devto";
  if (lc === "medium") return "medium";
  if (lc === "youtube" || lc === "yt" || lc === "youtubecommunity") return "youtube";
  if (lc === "discord") return "discord";
  return null;
}

export function parseHashtags(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;\s]+/)
    .map(normalizeHashtag)
    .filter(Boolean);
}

// ---- Hashtag generator ----

/** Extract candidate keywords from a title (drop stopwords, length>=3). */
export function extractTitleKeywords(title: string): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "you", "your", "this", "that", "from",
    "how", "why", "what", "when", "are", "was", "but", "not", "all",
    "can", "has", "have", "had", "into", "out", "our", "their", "they",
    "should", "would", "could", "will", "just", "than", "then", "also",
  ]);
  const words = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(words));
}

/** Suggest hashtags based on title keywords, padded with seeds. */
export function suggestHashtags(title: string, maxCount = 10): string[] {
  const fromTitle = extractTitleKeywords(title).map((w) => `#${w}`);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of fromTitle) {
    if (!seen.has(h)) { seen.add(h); out.push(h); }
    if (out.length >= maxCount) return out;
  }
  for (const seed of HASHTAG_SEEDS) {
    const h = `#${seed}`;
    if (!seen.has(h)) { seen.add(h); out.push(h); }
    if (out.length >= maxCount) return out;
  }
  return out;
}

// ---- Truncation & validation ----

export function truncateWithWarning(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  // Truncate at limit-1 and add ellipsis
  return { text: text.slice(0, Math.max(0, limit - 1)) + "…", truncated: true };
}

export function clampHashtags(tags: string[], max: number, min = 0): { tags: string[]; warning: string | null } {
  if (tags.length > max) {
    return { tags: tags.slice(0, max), warning: `Hashtag count ${tags.length} exceeds max ${max}; truncated to ${max}.` };
  }
  if (tags.length < min) {
    return { tags, warning: `Hashtag count ${tags.length} below recommended min ${min}.` };
  }
  return { tags, warning: null };
}

// ---- CTA inserter ----

export function insertCTA(text: string, cta: string): string {
  if (!cta) return text;
  return text.replace(/\{cta\}/g, cta);
}

// ---- Marketing-fluff stripper (HN) ----

export function stripMarketingFluff(title: string): string {
  let out = (title || "").replace(/\s+/g, " ").trim();
  for (const w of MARKETING_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    out = out.replace(re, "").replace(/\s+/g, " ").trim();
  }
  out = out.replace(/[!]{2,}/g, "!");
  out = out.replace(/^[\s,.;:]+|[\s,.;:]+$/g, "");
  return out;
}

// ---- Per-channel snippet generators ----

export function buildTwitterRaw(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.twitter;
  const hook = firstSentence(input.description) || input.title;
  const tags = clampHashtags(input.hashtags, cfg.maxHashtags).tags.slice(0, cfg.maxHashtags);
  const parts: string[] = [hook];
  if (input.cta) parts.push(input.cta);
  if (input.url) parts.push(input.url);
  const body = parts.join("\n");
  const tagLine = tags.length > 0 ? "\n" + tags.join(" ") : "";
  return body + tagLine;
}

export function generateTwitter(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.twitter;
  return truncateWithWarning(buildTwitterRaw(input), cfg.charLimit).text;
}

export function buildLinkedInRaw(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.linkedin;
  const questionHook = input.title.endsWith("?") ? input.title : `${input.title}?`;
  const tags = clampHashtags(input.hashtags, cfg.maxHashtags, cfg.minHashtags).tags.slice(0, cfg.maxHashtags);
  const lines: string[] = [
    questionHook,
    "",
    input.description,
  ];
  if (input.cta && input.url) lines.push("", `${input.cta}: ${input.url}`);
  else if (input.url) lines.push("", input.url);
  if (tags.length > 0) lines.push("", tags.join(" "));
  return lines.join("\n");
}

export function generateLinkedIn(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.linkedin;
  return truncateWithWarning(buildLinkedInRaw(input), cfg.charLimit).text;
}

export function buildFacebookRaw(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.facebook;
  const tags = clampHashtags(input.hashtags, cfg.maxHashtags).tags;
  const desc = firstParagraph(input.description) || "";
  const lines: string[] = [
    `📘 ${input.title}`,
    "",
    desc,
  ];
  if (input.cta && input.url) lines.push("", `${input.cta} → ${input.url}`);
  if (tags.length > 0) lines.push("", tags.join(" ") + " 📘");
  return lines.join("\n");
}

export function generateFacebook(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.facebook;
  return truncateWithWarning(buildFacebookRaw(input), cfg.charLimit).text;
}

export function buildInstagramRaw(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.instagram;
  const tags = clampHashtags(input.hashtags, cfg.maxHashtags, cfg.minHashtags).tags;
  const lines: string[] = [
    input.title,
    "",
    input.description,
    ".",
    ".",
    ".",
  ];
  if (input.cta && input.url) lines.push(`${input.cta} ${urlShort(input.url)}`);
  lines.push(".", ".", ".");
  if (tags.length > 0) lines.push(tags.join(" "));
  return lines.join("\n");
}

export function generateInstagram(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.instagram;
  return truncateWithWarning(buildInstagramRaw(input), cfg.charLimit).text;
}

export function buildEmailRaw(input: DistributionInput): string {
  const subject = truncateWithWarning(input.title, 60).text;
  const preview = truncateWithWarning(firstSentence(input.description) || input.title, 140).text;
  const body = [
    `=== HOOK ===`,
    preview,
    "",
    `=== VALUE ===`,
    input.description,
    "",
    `=== CTA ===`,
    input.cta ? input.cta : "Read more",
    input.url || "",
  ].join("\n");
  return `Subject: ${subject}\nPreview: ${preview}\n\n${body}`;
}

export function generateEmail(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.email;
  return truncateWithWarning(buildEmailRaw(input), cfg.charLimit).text;
}

export function buildRedditRaw(input: DistributionInput): string {
  const tldr = truncateWithWarning(firstSentence(input.description) || input.title, 200).text;
  return [
    `**TL;DR:** ${tldr}`,
    "",
    input.description,
    "",
    `**Link:** ${input.url}`,
  ].join("\n");
}

export function generateReddit(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.reddit;
  return truncateWithWarning(buildRedditRaw(input), cfg.charLimit).text;
}

export function buildHackerNewsRaw(input: DistributionInput): string {
  // Title is generated separately (stored as comment body here)
  const title = stripMarketingFluff(input.title);
  const lines = [title, "", input.description];
  if (input.url) lines.push("", input.url);
  return lines.join("\n");
}

export function generateHackerNews(input: DistributionInput): string {
  // HN title is separate (≤80); comment body is up to 4000 chars
  return truncateWithWarning(buildHackerNewsRaw(input), 4000).text;
}

export function buildDevtoRaw(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.devto;
  const tags = clampHashtags(input.hashtags, cfg.maxHashtags).tags.slice(0, cfg.maxHashtags);
  const tagLine = tags.length > 0 ? "\n\n" + tags.map((t) => t.replace(/^#/, "")).join(" #") : "";
  const lines = [
    `# ${input.title}`,
    "",
    input.description,
  ];
  if (input.cta && input.url) lines.push("", `${input.cta}: ${input.url}`);
  return lines.join("\n") + tagLine;
}

export function generateDevto(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.devto;
  return truncateWithWarning(buildDevtoRaw(input), cfg.charLimit).text;
}

export function buildMediumRaw(input: DistributionInput): string {
  const subtitle = firstSentence(input.description) || input.title;
  const hook = firstParagraph(input.description) || "";
  const lines = [
    `Title: ${input.title}`,
    `Subtitle: ${subtitle}`,
    "",
    `Hook: ${hook}`,
  ];
  if (input.url) lines.push("", `Read full: ${input.url}`);
  return lines.join("\n");
}

export function generateMedium(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.medium;
  return truncateWithWarning(buildMediumRaw(input), cfg.charLimit).text;
}

export function buildYouTubeRaw(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.youtube;
  const tags = clampHashtags(input.hashtags, cfg.maxHashtags).tags;
  const parts: string[] = [input.title];
  if (input.cta) parts.push(`— ${input.cta}`);
  if (input.url) parts.push(urlShort(input.url));
  let full = parts.join(" ");
  if (tags.length > 0) full += " " + tags.join(" ");
  return full;
}

export function generateYouTube(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.youtube;
  return truncateWithWarning(buildYouTubeRaw(input), cfg.charLimit).text;
}

export function buildDiscordRaw(input: DistributionInput): string {
  const lines = [
    `📢 ${input.title}`,
  ];
  if (input.cta && input.url) lines.push(`${input.cta}: ${input.url}`);
  lines.push("_Suggested channels: #general #announcements #resources_");
  return lines.join("\n");
}

export function generateDiscord(input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS.discord;
  return truncateWithWarning(buildDiscordRaw(input), cfg.charLimit).text;
}

// ---- Master generator ----

export function buildRaw(channelId: ChannelId, input: DistributionInput): string {
  switch (channelId) {
    case "twitter":    return buildTwitterRaw(input);
    case "linkedin":   return buildLinkedInRaw(input);
    case "facebook":   return buildFacebookRaw(input);
    case "instagram":  return buildInstagramRaw(input);
    case "email":      return buildEmailRaw(input);
    case "reddit":     return buildRedditRaw(input);
    case "hackernews": return buildHackerNewsRaw(input);
    case "devto":      return buildDevtoRaw(input);
    case "medium":     return buildMediumRaw(input);
    case "youtube":    return buildYouTubeRaw(input);
    case "discord":    return buildDiscordRaw(input);
  }
}

export function generateForChannel(channelId: ChannelId, input: DistributionInput): string {
  const cfg = CHANNEL_CONFIGS[channelId];
  const limit = channelId === "hackernews" ? 4000 : cfg.charLimit;
  return truncateWithWarning(buildRaw(channelId, input), limit).text;
}

export function generateAll(input: DistributionInput): DistributionSnippet[] {
  const out: DistributionSnippet[] = [];
  for (const ch of input.channels) {
    const cfg = CHANNEL_CONFIGS[ch];
    const effectiveLimit = ch === "hackernews" ? 4000 : cfg.charLimit;
    const rawText = buildRaw(ch, input);
    const snippetText = truncateWithWarning(rawText, effectiveLimit).text;
    const truncated = rawText.length > effectiveLimit;
    const tagsUsed = extractHashtagsFromSnippet(snippetText);
    const warnings: string[] = [];
    if (truncated) warnings.push(`Exceeds ${effectiveLimit}-char limit (truncated).`);
    if (tagsUsed.length > cfg.maxHashtags) warnings.push(`Too many hashtags: ${tagsUsed.length} > ${cfg.maxHashtags}.`);
    if (tagsUsed.length < cfg.minHashtags) warnings.push(`Too few hashtags: ${tagsUsed.length} < ${cfg.minHashtags}.`);
    if (cfg.maxHashtags === 0 && tagsUsed.length > 0) warnings.push(`Hashtags not recommended for this channel.`);
    out.push({
      channelId: ch,
      channelLabel: cfg.label,
      snippet: snippetText,
      charCount: snippetText.length,
      charLimit: cfg.charLimit,
      truncated,
      hashtagCount: tagsUsed.length,
      hashtags: tagsUsed,
      warnings,
    });
  }
  return out;
}

// ---- Helpers ----

export function firstSentence(text: string): string {
  if (!text) return "";
  const m = text.match(/^[^.!?\n]*[.!?]?/);
  return m ? m[0].trim() : text.trim();
}

export function firstParagraph(text: string): string {
  if (!text) return "";
  return text.split(/\n\n/)[0].trim();
}

export function urlShort(url: string): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function extractHashtagsFromSnippet(text: string): string[] {
  const matches = (text || "").match(/#[a-zA-Z0-9_]+/g) || [];
  return Array.from(new Set(matches));
}

// ---- Filtering & stats ----

export function filterByChannel(snippets: DistributionSnippet[], channelId: ChannelId | ""): DistributionSnippet[] {
  if (!channelId) return snippets;
  return snippets.filter((s) => s.channelId === channelId);
}

export function computeSummaryStats(snippets: DistributionSnippet[]): SummaryStats {
  let totalChars = 0;
  let totalHashtags = 0;
  let truncatedCount = 0;
  let warningCount = 0;
  for (const s of snippets) {
    totalChars += s.charCount;
    totalHashtags += s.hashtagCount;
    if (s.truncated) truncatedCount += 1;
    warningCount += s.warnings.length;
  }
  return {
    totalChannels: snippets.length,
    totalChars,
    totalHashtags,
    truncatedCount,
    warningCount,
  };
}

// ---- Rendering ----

export function renderText(snippets: DistributionSnippet[]): string {
  return snippets.map((s) => {
    const header = `=== ${s.channelLabel} (${s.charCount}/${s.charLimit} chars) ===`;
    const tags = s.hashtags.length > 0 ? `\nHashtags: ${s.hashtags.join(" ")}` : "";
    const warns = s.warnings.length > 0 ? `\nWarnings: ${s.warnings.join("; ")}` : "";
    return `${header}${tags}${warns}\n${s.snippet}`;
  }).join("\n\n");
}

export function renderCsv(snippets: DistributionSnippet[]): string {
  const lines = ["channel,snippet,char_count,char_limit,hashtag_count,warnings"];
  for (const s of snippets) {
    lines.push([
      s.channelLabel,
      escapeCsv(s.snippet),
      String(s.charCount),
      String(s.charLimit),
      String(s.hashtagCount),
      escapeCsv(s.warnings.join("; ")),
    ].join(","));
  }
  return lines.join("\n");
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
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:content-distribution-planner:history";
const HISTORY_MAX = 20;

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

export function buildShareUrl(input: Partial<DistributionInput>): string {
  const params = new URLSearchParams();
  if (input.title) params.set("title", input.title);
  if (input.description) params.set("desc", input.description);
  if (input.url) params.set("url", input.url);
  if (input.channels && input.channels.length > 0) params.set("ch", input.channels.join(","));
  if (input.hashtags && input.hashtags.length > 0) params.set("tags", input.hashtags.join(" "));
  if (input.cta) params.set("cta", input.cta);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<DistributionInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const channelsStr = params.get("ch") ?? "";
  const channels: ChannelId[] = channelsStr
    ? channelsStr.split(",").filter((c) => ALL_CHANNEL_IDS.includes(c as ChannelId)) as ChannelId[]
    : [];
  const tagsStr = params.get("tags") ?? "";
  const hashtags = tagsStr ? tagsStr.split(/\s+/).map(normalizeHashtag).filter(Boolean) : [];
  return {
    title: params.get("title") ?? "",
    description: params.get("desc") ?? "",
    url: params.get("url") ?? "",
    channels,
    hashtags,
    cta: params.get("cta") ?? "",
  };
}
