/**
 * Hashtag Generator — pure logic.
 *
 * Generate platform-specific hashtags with categorization, mix, spam filter,
 * branded and niche generators. Pure functions only — no DOM, no network.
 */

export type Platform =
  | "instagram"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube";

export type HashtagType =
  | "direct"
  | "compound"
  | "variations"
  | "community"
  | "trending";

export type Category = "popular" | "medium" | "niche";

export interface HashtagEntry {
  tag: string; // includes leading #
  type: HashtagType;
  category: Category;
  estReach: number; // estimated reach (synthetic, deterministic)
}

export interface PlatformConfig {
  id: Platform;
  label: string;
  maxCount: number;
  optimalCount: number;
  maxChars: number;
}

export interface GeneratorInput {
  topic: string;
  platform: Platform;
  count: number;
  includeBranded: boolean;
  includeNiche: boolean;
  excludeGeneric: boolean;
  mixPopularNiche: boolean;
}

export interface DensityReport {
  platform: Platform;
  count: number;
  optimal: number;
  max: number;
  totalHashtagChars: number;
  status: "ok" | "over-optimal" | "over-max";
}

export interface HashtagStats {
  total: number;
  byCategory: Record<Category, number>;
  byType: Record<HashtagType, number>;
}

export const PLATFORMS: Platform[] = [
  "instagram",
  "twitter",
  "linkedin",
  "tiktok",
  "youtube",
];

export const HASHTAG_TYPES: HashtagType[] = [
  "direct",
  "compound",
  "variations",
  "community",
  "trending",
];

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    maxCount: 30,
    optimalCount: 15,
    maxChars: 30,
  },
  twitter: {
    id: "twitter",
    label: "Twitter/X",
    maxCount: 10,
    optimalCount: 3,
    maxChars: 50,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    maxCount: 10,
    optimalCount: 4,
    maxChars: 50,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    maxCount: 10,
    optimalCount: 4,
    maxChars: 50,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    maxCount: 15,
    optimalCount: 5,
    maxChars: 50,
  },
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const HASHTAG_TYPE_LABELS: Record<HashtagType, string> = {
  direct: "Direct",
  compound: "Compound",
  variations: "Variations",
  community: "Community",
  trending: "Trending-style",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  popular: "Popular (1M+)",
  medium: "Medium (100K–1M)",
  niche: "Niche (<100K)",
};

// Spam / banned hashtags (generic engagement-bait)
export const SPAM_HASHTAGS: string[] = [
  "#like4like", "#follow4follow", "#followforfollow", "#likeforlike",
  "#followme", "#follow", "#likes4likes", "#followback",
  "#instagood", "#instadaily", "#instamood", "#photooftheday",
  "#tagsforlikes", "#likesforlikes", "#spamforspam",
  "#comment4comment", "#shoutoutforshoutout", "#f4f", "#l4l",
];

// 10+ trending niches with built-in trending hashtags
export const TRENDING_NICHES: Record<string, string[]> = {
  javascript: ["#javascript", "#javascript30", "#javascripttips", "#javascriptdeveloper", "#javascript2026"],
  marketing: ["#marketing", "#digitalmarketing", "#contentmarketing", "#marketingtips", "#marketing2026"],
  fitness: ["#fitness", "#fitnesstips", "#fitnessmotivation", "#fitnessjourney", "#fitnesslife"],
  travel: ["#travel", "#travelphotography", "#traveltips", "#travelgram", "#travelcommunity"],
  food: ["#food", "#foodie", "#foodporn", "#foodphotography", "#foodblogger"],
  fashion: ["#fashion", "#fashionblogger", "#fashionstyle", "#fashionista", "#ootd"],
  tech: ["#tech", "#technology", "#technews", "#techcommunity", "#innovation"],
  business: ["#business", "#entrepreneur", "#smallbusiness", "#businessowner", "#startup"],
  design: ["#design", "#uxdesign", "#uidesign", "#designinspiration", "#designer"],
  photography: ["#photography", "#photographer", "#photooftheday", "#photogram", "#portrait"],
  gaming: ["#gaming", "#gamer", "#gamingcommunity", "#games", "#gaminglife"],
  music: ["#music", "#musician", "#musiclife", "#newmusic", "#musiccommunity"],
};

// Suffix templates for variation type
const VARIATION_SUFFIXES = [
  "dev", "developer", "code", "tips", "tricks",
  "tutorial", "guide", "101", "life", "world",
  "love", "daily", "community", "fan", "pro",
];

// Community suffix templates
const COMMUNITY_SUFFIXES = [
  "community", "lovers", "world", "hub", "club",
  "fans", "network", "group", "tribe", "nation",
];

// Trending-style suffix templates
const TRENDING_SUFFIXES = [
  "2026", "2025", "tips", "hacks", "trends",
  "daily", "today", "now", "weekly", "guide",
];

// Branded suffix templates (CamelCase brand-style)
const BRANDED_PREFIXES = ["learn", "ilove", "why", "top", "best"];
const BRANDED_SUFFIXES = ["mastery", "pro", "daily", "tips", "101"];

// Niche subtopic modifiers (suffix indicates deeper niche)
const NICHE_MODIFIERS = [
  "forbeginners", "advanced", "pro", "mastery", "deepdive",
  "essentials", "fundamentals", "playbook", "checklist", "framework",
];

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse a topic into clean word tokens (alphanumeric only). */
export function parseTopic(topic: string): string[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  return t
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/** Build a #hashtag string from a base (no leading #, lowercase alphanumeric). */
export function makeTag(base: string): string {
  const clean = (base || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean ? `#${clean}` : "";
}

/** Capitalize the first letter (used for branded CamelCase). */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Generate direct hashtags — one per word + joined. */
export function generateDirect(topic: string): string[] {
  const words = parseTopic(topic);
  const tags: string[] = [];
  const joined = makeTag(words.join(""));
  if (joined) tags.push(joined);
  for (const w of words) {
    const t = makeTag(w);
    if (t) tags.push(t);
  }
  return dedupe(tags);
}

/** Generate compound hashtags — joined words + 2-word combos. */
export function generateCompound(topic: string): string[] {
  const words = parseTopic(topic);
  const tags: string[] = [];
  if (words.length === 0) return tags;
  // Whole-joined
  const joined = makeTag(words.join(""));
  if (joined) tags.push(joined);
  // Pairwise joins
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      const t = makeTag(words[i] + words[i + 1]);
      if (t) tags.push(t);
    }
  }
  return dedupe(tags);
}

/** Generate variation hashtags — base + suffixes. */
export function generateVariations(topic: string): string[] {
  const words = parseTopic(topic);
  if (words.length === 0) return [];
  const joined = words.join("");
  const tags: string[] = [];
  for (const suffix of VARIATION_SUFFIXES) {
    tags.push(makeTag(joined + suffix));
  }
  for (const w of words) {
    tags.push(makeTag(w + "tips"));
    tags.push(makeTag(w + "dev"));
  }
  return dedupe(tags);
}

/** Generate community hashtags — base + community suffixes. */
export function generateCommunity(topic: string): string[] {
  const words = parseTopic(topic);
  if (words.length === 0) return [];
  const joined = words.join("");
  const tags: string[] = [];
  for (const suffix of COMMUNITY_SUFFIXES) {
    tags.push(makeTag(joined + suffix));
  }
  return dedupe(tags);
}

/** Generate trending-style hashtags — base + trending suffixes. */
export function generateTrending(topic: string): string[] {
  const words = parseTopic(topic);
  if (words.length === 0) return [];
  const joined = words.join("");
  const tags: string[] = [];
  for (const suffix of TRENDING_SUFFIXES) {
    tags.push(makeTag(joined + suffix));
  }
  return dedupe(tags);
}

/** Generate branded hashtags — CamelCase brand style (e.g. #LearnJS). */
export function generateBranded(topic: string): string[] {
  const words = parseTopic(topic);
  if (words.length === 0) return [];
  const initials = words.map((w) => w.charAt(0).toUpperCase()).join("");
  const joined = words.join("");
  const tags: string[] = [];
  for (const prefix of BRANDED_PREFIXES) {
    tags.push(`#${capitalize(prefix)}${initials}`);
  }
  for (const suffix of BRANDED_SUFFIXES) {
    tags.push(`#${capitalize(joined)}${capitalize(suffix)}`);
  }
  return dedupe(tags);
}

/** Generate niche hashtags — base + niche modifiers. */
export function generateNiche(topic: string): string[] {
  const words = parseTopic(topic);
  if (words.length === 0) return [];
  const joined = words.join("");
  const tags: string[] = [];
  for (const modifier of NICHE_MODIFIERS) {
    tags.push(makeTag(joined + modifier));
  }
  return dedupe(tags);
}

/** Categorize a hashtag deterministically (popular/medium/niche). */
export function categorizeHashtag(tag: string): { category: Category; estReach: number } {
  // Strip leading #
  const base = tag.startsWith("#") ? tag.slice(1) : tag;
  // Deterministic pseudo-reach: shorter common tags get higher reach
  const len = base.length;
  // Simple deterministic hash for variation
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) & 0xffffffff;
  }
  const positiveHash = Math.abs(hash);
  if (len <= 10) {
    // Popular: 1M-10M
    const reach = 1_000_000 + (positiveHash % 9_000_000);
    return { category: "popular", estReach: reach };
  } else if (len <= 20) {
    // Medium: 100K-1M
    const reach = 100_000 + (positiveHash % 900_000);
    return { category: "medium", estReach: reach };
  } else {
    // Niche: 10K-100K
    const reach = 10_000 + (positiveHash % 90_000);
    return { category: "niche", estReach: reach };
  }
}

/** Generate all hashtags (5 types) for a topic, with categories. */
export function generateAllHashtags(topic: string): HashtagEntry[] {
  const out: HashtagEntry[] = [];
  const addType = (type: HashtagType, tags: string[]) => {
    for (const tag of tags) {
      if (!tag) continue;
      const { category, estReach } = categorizeHashtag(tag);
      out.push({ tag, type, category, estReach });
    }
  };
  addType("direct", generateDirect(topic));
  addType("compound", generateCompound(topic));
  addType("variations", generateVariations(topic));
  addType("community", generateCommunity(topic));
  addType("trending", generateTrending(topic));
  return dedupeByTag(out);
}

/** Filter out spam (generic engagement-bait) hashtags. */
export function filterSpamHashtags(entries: HashtagEntry[]): HashtagEntry[] {
  const spam = new Set(SPAM_HASHTAGS);
  return entries.filter((e) => !spam.has(e.tag.toLowerCase()));
}

/** Filter out invalid hashtags (per platform char limits). */
export function filterInvalid(entries: HashtagEntry[], platform: Platform): HashtagEntry[] {
  const maxChars = PLATFORM_CONFIGS[platform].maxChars;
  return entries.filter((e) => {
    const base = e.tag.startsWith("#") ? e.tag.slice(1) : e.tag;
    return base.length > 0 && base.length <= maxChars;
  });
}

/** Validate a single hashtag — max chars, alphanumeric + underscore only. */
export function validateHashtag(tag: string, platform: Platform): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const base = tag.startsWith("#") ? tag.slice(1) : tag;
  if (!base) {
    errors.push("Hashtag is empty");
  }
  if (base.length > PLATFORM_CONFIGS[platform].maxChars) {
    errors.push(`Exceeds max ${PLATFORM_CONFIGS[platform].maxChars} chars`);
  }
  if (base.length > 30) {
    errors.push("Exceeds 30-char global limit");
  }
  if (!/^[a-z0-9_]+$/i.test(base)) {
    errors.push("Only letters, digits, and underscores allowed");
  }
  return { valid: errors.length === 0, errors };
}

/** Generate a mix of popular/medium/niche in 30/40/30 ratio. */
export function generateMix(entries: HashtagEntry[], count: number): HashtagEntry[] {
  if (count <= 0) return [];
  const popular = entries.filter((e) => e.category === "popular");
  const medium = entries.filter((e) => e.category === "medium");
  const niche = entries.filter((e) => e.category === "niche");
  let nPop = Math.round(count * 0.30);
  let nMed = Math.round(count * 0.40);
  let nNic = count - nPop - nMed;

  // Take what each category can offer
  const popTake = Math.min(nPop, popular.length);
  const medTake = Math.min(nMed, medium.length);
  const nicTake = Math.min(nNic, niche.length);

  const result: HashtagEntry[] = [
    ...popular.slice(0, popTake),
    ...medium.slice(0, medTake),
    ...niche.slice(0, nicTake),
  ];

  // Backfill remainder from any remaining entries (preserves ratio as much as possible)
  const remainder = count - result.length;
  if (remainder > 0) {
    const used = new Set(result.map((e) => e.tag));
    const extras = entries.filter((e) => !used.has(e.tag)).slice(0, remainder);
    result.push(...extras);
  }

  return dedupeByTag(result);
}

/** Generate the final hashtag list per input options. */
export function generate(input: GeneratorInput): HashtagEntry[] {
  let entries = generateAllHashtags(input.topic);

  // Add branded + niche if requested. Branded tags are categorized as "direct"
  // type for type-counting purposes (they share a similar role).
  if (input.includeBranded) {
    const branded = generateBranded(input.topic).map((tag) => {
      const { category, estReach } = categorizeHashtag(tag);
      return { tag, type: "direct" as HashtagType, category, estReach };
    });
    entries = dedupeByTag([...entries, ...branded]);
  }
  if (input.includeNiche) {
    const nicheTags = generateNiche(input.topic).map((tag) => {
      const { category, estReach } = categorizeHashtag(tag);
      return { tag, type: "variations" as HashtagType, category, estReach };
    });
    entries = dedupeByTag([...entries, ...nicheTags]);
  }

  // Exclude generic spam if requested
  if (input.excludeGeneric) {
    entries = filterSpamHashtags(entries);
  }

  // Filter by platform char limits
  entries = filterInvalid(entries, input.platform);

  // Mix or just take top N
  let result: HashtagEntry[];
  if (input.mixPopularNiche) {
    result = generateMix(entries, input.count);
  } else {
    result = entries.slice(0, input.count);
  }

  // Hard cap at platform max
  const maxCount = PLATFORM_CONFIGS[input.platform].maxCount;
  return result.slice(0, Math.min(input.count, maxCount));
}

/** Analyze hashtag density vs platform limits. */
export function analyzeDensity(input: GeneratorInput, count: number): DensityReport {
  const cfg = PLATFORM_CONFIGS[input.platform];
  const sample = generate(input);
  const totalChars = sample.reduce((sum, e) => sum + e.tag.length, 0);
  let status: "ok" | "over-optimal" | "over-max";
  if (count > cfg.maxCount) status = "over-max";
  else if (count > cfg.optimalCount) status = "over-optimal";
  else status = "ok";
  return {
    platform: input.platform,
    count,
    optimal: cfg.optimalCount,
    max: cfg.maxCount,
    totalHashtagChars: totalChars,
    status,
  };
}

/** Compute summary stats. */
export function computeStats(entries: HashtagEntry[]): HashtagStats {
  const byCategory: Record<Category, number> = { popular: 0, medium: 0, niche: 0 };
  const byType: Record<HashtagType, number> = {
    direct: 0, compound: 0, variations: 0, community: 0, trending: 0,
  };
  for (const e of entries) {
    if (e.category in byCategory) byCategory[e.category] += 1;
    if (e.type in byType) byType[e.type] += 1;
  }
  return {
    total: entries.length,
    byCategory,
    byType,
  };
}

/** Get trending hashtag suggestions for a niche. */
export function getTrendingForNiche(niche: string): string[] {
  const n = normalizeTopic(niche).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "");
  if (n && TRENDING_NICHES[n]) return TRENDING_NICHES[n];
  return [];
}

/** List all available trending niches. */
export function listTrendingNiches(): string[] {
  return Object.keys(TRENDING_NICHES).sort();
}

/** Render hashtags as plain text grouped by category. */
export function renderText(entries: HashtagEntry[]): string {
  if (entries.length === 0) return "";
  const groups: Record<Category, HashtagEntry[]> = {
    popular: [], medium: [], niche: [],
  };
  for (const e of entries) groups[e.category].push(e);
  const lines: string[] = [];
  (["popular", "medium", "niche"] as Category[]).forEach((cat) => {
    const list = groups[cat];
    if (list.length === 0) return;
    lines.push(`=== ${CATEGORY_LABELS[cat]} (${list.length}) ===`);
    list.forEach((e) => {
      lines.push(`${e.tag}  [${e.type}, ~${formatReach(e.estReach)}]`);
    });
    lines.push("");
  });
  return lines.join("\n").trim() + "\n";
}

/** Render hashtags as CSV. */
export function renderCsv(entries: HashtagEntry[], platform: Platform): string {
  const lines = ["hashtag,type,category,platform,est_reach"];
  for (const e of entries) {
    lines.push([
      escapeCsv(e.tag),
      e.type,
      e.category,
      platform,
      String(e.estReach),
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

// ---- helpers ----

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    if (!t) continue;
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function dedupeByTag(entries: HashtagEntry[]): HashtagEntry[] {
  const seen = new Set<string>();
  const out: HashtagEntry[] = [];
  for (const e of entries) {
    const key = e.tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}

function formatReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:hashtag-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  topic: string;
  platform: Platform;
  count: number;
  totalHashtags: number;
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
  if (input.platform) params.set("plat", input.platform);
  if (input.count) params.set("count", String(input.count));
  if (!input.includeBranded) params.set("branded", "0");
  if (!input.includeNiche) params.set("niche", "0");
  if (input.excludeGeneric) params.set("nogen", "1");
  if (!input.mixPopularNiche) params.set("mix", "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): GeneratorInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: GeneratorInput = {
    topic: "",
    platform: "instagram",
    count: 20,
    includeBranded: true,
    includeNiche: true,
    excludeGeneric: false,
    mixPopularNiche: true,
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const topic = params.get("topic") ?? "";
  const platform = (PLATFORMS.includes(params.get("plat") as Platform)
    ? (params.get("plat") as Platform)
    : "instagram");
  const countStr = params.get("count") ?? "20";
  const count = Math.max(1, Math.min(50, parseInt(countStr, 10) || 20));
  const includeBranded = params.get("branded") !== "0";
  const includeNiche = params.get("niche") !== "0";
  const excludeGeneric = params.get("nogen") === "1";
  const mixPopularNiche = params.get("mix") !== "0";
  return { topic, platform, count, includeBranded, includeNiche, excludeGeneric, mixPopularNiche };
}
