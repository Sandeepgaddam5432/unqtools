/**
 * Pinterest Pin Description Generator — pure logic.
 *
 * Generate SEO-optimized Pinterest pin descriptions.
 * Pure functions only — no DOM, no network.
 */

export type PinCategory =
  | "diy"
  | "food"
  | "fashion"
  | "home-decor"
  | "beauty"
  | "travel"
  | "fitness"
  | "education"
  | "business"
  | "tech";

export type DescriptionLength = "short" | "medium" | "long";

export type CTAType = "click" | "save" | "follow" | "comment";

export interface PinterestInput {
  pinTopic: string;
  pinCategory: PinCategory;
  targetKeywords: string; // comma-separated
  includeCTA: boolean;
  includeHashtags: boolean;
  descriptionLength: DescriptionLength;
  ctaType: CTAType;
}

export interface PinterestComponent {
  key: string;
  value: string;
}

export interface KeywordDensityInfo {
  keyword: string;
  count: number;
  density: number; // percent
  optimal: boolean;
}

export interface GeneratedPin {
  variation: number;
  pinTitle: string;
  opener: string;
  body: string;
  cta: string;
  hashtags: string[];
  boardName: string;
  fullDescription: string;
  keywords: string[];
  longTailKeywords: string[];
  keywordDensities: KeywordDensityInfo[];
  charCount: number;
  wordCount: number;
  keywordCount: number;
  hashtagCount: number;
  withinLimit: boolean;
  mainKeywordInFirst100: boolean;
  seoScore: number;
}

export interface SummaryStats {
  totalVariations: number;
  avgChars: number;
  avgWords: number;
  avgKeywords: number;
  avgHashtags: number;
  withinLimitCount: number;
  avgSeoScore: number;
}

export const PIN_CATEGORIES: PinCategory[] = [
  "diy",
  "food",
  "fashion",
  "home-decor",
  "beauty",
  "travel",
  "fitness",
  "education",
  "business",
  "tech",
];

export const DESCRIPTION_LENGTHS: DescriptionLength[] = ["short", "medium", "long"];

export const CTA_TYPES: CTAType[] = ["click", "save", "follow", "comment"];

export const CATEGORY_LABELS: Record<PinCategory, string> = {
  "diy": "DIY & Crafts",
  "food": "Food & Recipes",
  "fashion": "Fashion & Style",
  "home-decor": "Home Decor",
  "beauty": "Beauty & Makeup",
  "travel": "Travel & Places",
  "fitness": "Fitness & Health",
  "education": "Education & Learning",
  "business": "Business & Marketing",
  "tech": "Technology & Gadgets",
};

export const LENGTH_LABELS: Record<DescriptionLength, string> = {
  "short": "Short (100-200 chars)",
  "medium": "Medium (200-400 chars)",
  "long": "Long (400-500 chars)",
};

export const CTA_LABELS: Record<CTAType, string> = {
  "click": "Click to learn more",
  "save": "Save for later",
  "follow": "Follow for more",
  "comment": "Comment your thoughts",
};

// Char limits
export const MAX_CHARS = 500;
export const MAX_TITLE_CHARS = 100;

export const LENGTH_RANGES: Record<DescriptionLength, { min: number; max: number }> = {
  "short": { min: 100, max: 200 },
  "medium": { min: 200, max: 400 },
  "long": { min: 400, max: 500 },
};

// Category-specific openers
export const CATEGORY_OPENERS: Record<PinCategory, string[]> = {
  "diy": [
    "Easy DIY project you can make this weekend!",
    "DIY idea you'll love — save this for later!",
    "Quick craft anyone can do at home.",
  ],
  "food": [
    "Quick recipe you'll love — pin it for later!",
    "Easy recipe that's perfect for busy weeknights.",
    "Delicious recipe you'll want to make again and again.",
  ],
  "fashion": [
    "Outfit idea you'll want to save!",
    "Style inspiration for every season.",
    "Fashion look you can recreate today.",
  ],
  "home-decor": [
    "Home decor idea that transforms any space!",
    "Decorating tip you'll want to save.",
    "Cozy home upgrade you can do this weekend.",
  ],
  "beauty": [
    "Beauty hack you'll wish you knew sooner!",
    "Skincare routine tip that actually works.",
    "Makeup look you can recreate at home.",
  ],
  "travel": [
    "Travel destination to add to your bucket list!",
    "Travel tip every wanderluster should save.",
    "Hidden gem you'll want to visit next year.",
  ],
  "fitness": [
    "Fitness tip you can start today!",
    "Workout plan you'll actually stick with.",
    "Health hack worth pinning for later.",
  ],
  "education": [
    "Learning resource every student should save!",
    "Educational tip that makes studying easier.",
    "Skill-building idea you can start today.",
  ],
  "business": [
    "Business tip you'll want to save for later!",
    "Marketing idea that drives real results.",
    "Entrepreneur hack worth pinning.",
  ],
  "tech": [
    "Tech tip you'll wish you knew sooner!",
    "Gadget review you'll want to save.",
    "Productivity tool that actually works.",
  ],
};

// Category-specific body templates
export const CATEGORY_BODIES: Record<PinCategory, string[]> = {
  "diy": [
    "This step-by-step guide walks you through everything you need — supplies, timing, and pro tips for a perfect finish.",
    "With just a few affordable supplies and a free afternoon, you can create something beautiful and useful.",
  ],
  "food": [
    "Made with simple ingredients you probably already have, this recipe is family-friendly and freezer-friendly too.",
    "Ready in under 30 minutes, this dish is perfect for meal prep or a quick weeknight dinner.",
  ],
  "fashion": [
    "Mix and match these pieces for a look that works for work, weekend, or a night out.",
    "These outfit ideas work with what's already in your closet — no shopping required.",
  ],
  "home-decor": [
    "These styling ideas work in any room and any budget, from rentals to forever homes.",
    "Get that designer look for less with these smart decor swaps you can make today.",
  ],
  "beauty": [
    "Suitable for every skin type, these tips are backed by dermatologists and beauty experts alike.",
    "Build your routine around these hero products for glowing, healthy skin in any season.",
  ],
  "travel": [
    "Includes everything you need to plan: best time to visit, what to pack, and where to stay.",
    "Save this travel guide for your next trip — it covers the best spots, food, and hidden gems.",
  ],
  "fitness": [
    "Modifiable for every fitness level, this routine requires no equipment and fits any schedule.",
    "Build a sustainable routine around these science-backed moves you can do anywhere.",
  ],
  "education": [
    "Designed for self-paced learning, these resources work for students, teachers, and lifelong learners.",
    "Master the fundamentals with these free resources that explain concepts clearly and simply.",
  ],
  "business": [
    "Actionable and beginner-friendly, these strategies work for solopreneurs and growing teams alike.",
    "Backed by real case studies, these tactics help you grow without burning out.",
  ],
  "tech": [
    "Tested across multiple devices, these picks save you time, money, and tech headaches.",
    "From setup to advanced features, this guide helps you get the most out of your tools.",
  ],
};

// CTA templates per type
export const CTA_TEMPLATES: Record<CTAType, string[]> = {
  "click": [
    "Click to learn more and get the full guide!",
    "Click through for the step-by-step tutorial.",
    "Tap to read the full post now.",
  ],
  "save": [
    "Save this pin for later so you don't lose it!",
    "Pin this to your favorite board to revisit anytime.",
    "Save this idea — you'll thank yourself later!",
  ],
  "follow": [
    "Follow for more ideas like this every week!",
    "Follow our board for daily inspiration.",
    "Follow along so you never miss a new pin!",
  ],
  "comment": [
    "Comment below with your favorite tip!",
    "Tell us in the comments — would you try this?",
    "Comment your thoughts and share with a friend!",
  ],
};

// Long-tail keyword modifier suggestions
export const LONG_TAIL_MODIFIERS: string[] = [
  "for beginners",
  "step by step",
  "easy ideas",
  "diy tutorial",
  "for small spaces",
  "on a budget",
  "for busy people",
  "for home",
  "for work",
  "quick and easy",
  "for kids",
  "for adults",
  "for women",
  "for men",
  "best of 2024",
];

// Board name templates per category
export const BOARD_NAME_TEMPLATES: Record<PinCategory, string[]> = {
  "diy": ["DIY Projects", "Craft Ideas", "Weekend DIY", "Easy Crafts"],
  "food": ["Recipes to Try", "Quick Dinners", "Easy Recipes", "Meal Prep Ideas"],
  "fashion": ["Outfit Inspo", "Style Ideas", "Wardrobe Staples", "Fashion Looks"],
  "home-decor": ["Home Decor Ideas", "Room Inspiration", "Cozy Home", "Decor Tips"],
  "beauty": ["Beauty Tips", "Skincare Routine", "Makeup Inspo", "Glow Up"],
  "travel": ["Travel Bucket List", "Wanderlust", "Travel Tips", "Places to Visit"],
  "fitness": ["Workout Plans", "Fitness Motivation", "Healthy Living", "Exercise Ideas"],
  "education": ["Learning Resources", "Study Tips", "Skill Building", "Education Ideas"],
  "business": ["Business Tips", "Marketing Ideas", "Entrepreneur Life", "Growth Strategies"],
  "tech": ["Tech Tips", "Gadget Reviews", "Productivity Tools", "Tech Inspiration"],
};

// Hashtag pool per category
export const CATEGORY_HASHTAGS: Record<PinCategory, string[]> = {
  "diy": ["diy", "crafts", "diyproject", "handmade", "craftideas"],
  "food": ["recipe", "food", "easyrecipe", "dinner", "mealprep"],
  "fashion": ["fashion", "style", "outfit", "ootd", "fashioninspo"],
  "home-decor": ["homedecor", "interiordesign", "decor", "homedesign", "cozyhome"],
  "beauty": ["beauty", "skincare", "makeup", "beautytips", "glowingskin"],
  "travel": ["travel", "wanderlust", "travelgram", "vacation", "traveltips"],
  "fitness": ["fitness", "workout", "health", "fitlife", "exercise"],
  "education": ["education", "learning", "study", "students", "studytips"],
  "business": ["business", "marketing", "entrepreneur", "smallbusiness", "growth"],
  "tech": ["tech", "technology", "gadgets", "productivity", "tools"],
};

// ---- Normalize / parse ----

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse comma-separated keywords. */
export function parseKeywords(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[,\n;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Pick element at modulo index (deterministic). */
export function pickAt<T>(arr: T[], idx: number): T {
  if (arr.length === 0) throw new Error("empty array");
  return arr[((idx % arr.length) + arr.length) % arr.length];
}

// ---- Generators ----

/** Generate a pin title (max 100 chars). */
export function generatePinTitle(topic: string, keywords: string[], idx: number): string {
  const t = normalizeTopic(topic);
  if (!t && keywords.length === 0) return "Untitled Pin";
  const base = t || keywords[0] || "Pin";
  // Title-case the base
  const titled = base.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const mainKw = keywords[0];
  const secondKw = keywords[1];
  let title: string;
  if (mainKw && secondKw) {
    title = `${titled}: ${mainKw.charAt(0).toUpperCase() + mainKw.slice(1)} ${pickAt(["Ideas", "Tips", "Guide", "Inspiration"], idx)}`;
  } else if (mainKw) {
    title = `${titled} — ${mainKw.charAt(0).toUpperCase() + mainKw.slice(1)} ${pickAt(["Ideas", "Tips", "Guide", "Inspiration"], idx)}`;
  } else {
    title = `${titled} ${pickAt(["Ideas", "Tips", "Guide", "Inspiration", "101"], idx)}`;
  }
  return Array.from(title).slice(0, MAX_TITLE_CHARS).join("");
}

/** Generate a category-specific opener. */
export function generateOpener(category: PinCategory, idx: number): string {
  return pickAt(CATEGORY_OPENERS[category], idx);
}

/** Generate the body using keywords + topic. */
export function generateBody(
  topic: string,
  category: PinCategory,
  keywords: string[],
  length: DescriptionLength,
  idx: number,
): string {
  const t = normalizeTopic(topic);
  const base = pickAt(CATEGORY_BODIES[category], idx);
  if (keywords.length === 0) return base;
  // Weave in the main keyword(s) naturally
  const mainKw = keywords[0];
  const lower = t ? t.charAt(0).toLowerCase() + t.slice(1) : mainKw;
  let intro: string;
  if (t) {
    intro = `If you're looking for ${lower}, this ${CATEGORY_LABELS[category].toLowerCase().split(" & ")[0]} pin covers ${mainKw}`;
    if (keywords.length > 1) {
      intro += `, ${keywords[1]}`;
    }
    intro += `, and more.`;
  } else {
    intro = `This ${CATEGORY_LABELS[category].toLowerCase().split(" & ")[0]} pin covers ${mainKw}`;
    if (keywords.length > 1) {
      intro += ` and ${keywords[1]}`;
    }
    intro += ".";
  }
  // For medium/long, add extra keyword callouts
  let extra = "";
  if (length === "medium" || length === "long") {
    const ks = keywords.slice(2, 5);
    if (ks.length > 0) {
      extra = ` You'll also find tips on ${ks.join(", ")}.`;
    }
  }
  if (length === "long") {
    extra += ` Pin this guide so you can come back to it whenever you need fresh ${mainKw} inspiration.`;
  }
  return `${intro} ${base}${extra}`;
}

/** Generate a CTA. */
export function generateCTA(type: CTAType, idx: number): string {
  return pickAt(CTA_TEMPLATES[type], idx);
}

/** Suggest 3-5 hashtags based on category + keywords. */
export function generateHashtags(
  category: PinCategory,
  keywords: string[],
  idx: number,
): string[] {
  const out: string[] = [];
  const catTags = CATEGORY_HASHTAGS[category];
  out.push(pickAt(catTags, idx));
  out.push(pickAt(catTags, idx + 1));
  for (const k of keywords.slice(0, 2)) {
    const slug = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (slug && !out.includes(slug)) out.push(slug);
  }
  out.push(pickAt(catTags, idx + 2));
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const h of out) {
    if (!seen.has(h)) { seen.add(h); unique.push(h); }
  }
  return unique.slice(0, 5);
}

/** Suggest long-tail keywords from main keywords. */
export function suggestLongTailKeywords(keywords: string[]): string[] {
  if (keywords.length === 0) return [];
  const out: string[] = [];
  for (const k of keywords.slice(0, 3)) {
    for (const mod of LONG_TAIL_MODIFIERS.slice(0, 3)) {
      out.push(`${k} ${mod}`);
    }
  }
  return out.slice(0, 8);
}

/** Generate a board name based on category + keywords. */
export function generateBoardName(category: PinCategory, keywords: string[], idx: number): string {
  const template = pickAt(BOARD_NAME_TEMPLATES[category], idx);
  if (keywords.length === 0) return template;
  // Append main keyword if room
  const main = keywords[0].split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const candidate = `${template} | ${main}`;
  return candidate.length > 50 ? template : candidate;
}

/** Compute keyword density for each target keyword. */
export function computeKeywordDensities(
  description: string,
  keywords: string[],
): KeywordDensityInfo[] {
  const words = description.toLowerCase().split(/\s+/).filter(Boolean);
  const totalWords = words.length || 1;
  return keywords.map((kw) => {
    const kwWords = kw.toLowerCase().split(/\s+/).filter(Boolean);
    const kwLen = kwWords.length || 1;
    // Count occurrences (multi-word phrases counted as substring matches)
    const lower = description.toLowerCase();
    let count = 0;
    if (kwLen === 1) {
      count = words.filter((w) => w === kwWords[0]).length;
    } else {
      const phrase = kwWords.join(" ");
      let idx = lower.indexOf(phrase);
      while (idx !== -1) { count++; idx = lower.indexOf(phrase, idx + 1); }
    }
    // Density = (kw occurrences × kw word length) / total words × 100
    const density = (count * kwLen / totalWords) * 100;
    return {
      keyword: kw,
      count,
      density: Math.round(density * 10) / 10,
      optimal: density >= 1 && density <= 3,
    };
  });
}

/** Check if main keyword appears in first 100 chars. */
export function checkMainKeywordInFirst100(description: string, mainKeyword: string): boolean {
  if (!mainKeyword) return true;
  const first100 = description.slice(0, 100).toLowerCase();
  return first100.includes(mainKeyword.toLowerCase());
}

/** Score SEO (0-100) based on keyword placement, density, length. */
export function scoreSeo(desc: GeneratedPin): number {
  let score = 30; // base
  // Keyword placement
  if (desc.mainKeywordInFirst100) score += 20;
  // Keyword density (each optimal keyword adds 5)
  const optimalCount = desc.keywordDensities.filter((d) => d.optimal).length;
  score += Math.min(20, optimalCount * 5);
  // Description length within range
  if (desc.withinLimit) score += 10;
  // Long description gets bonus
  const range = LENGTH_RANGES.long;
  if (desc.charCount >= range.min && desc.charCount <= range.max) score += 10;
  // Pin title present
  if (desc.pinTitle && desc.pinTitle !== "Untitled Pin") score += 5;
  // Hashtags (small bonus)
  if (desc.hashtagCount > 0) score += 5;
  return Math.min(100, score);
}

/** Assemble a full pin. */
export function generatePin(input: PinterestInput, variation: number): GeneratedPin {
  const { pinTopic, pinCategory, targetKeywords, includeCTA, includeHashtags, descriptionLength, ctaType } = input;
  const idx = variation - 1;
  const keywords = parseKeywords(targetKeywords);
  const opener = generateOpener(pinCategory, idx);
  const body = generateBody(pinTopic, pinCategory, keywords, descriptionLength, idx);
  const cta = includeCTA ? generateCTA(ctaType, idx) : "";
  const hashtags = includeHashtags ? generateHashtags(pinCategory, keywords, idx) : [];
  const boardName = generateBoardName(pinCategory, keywords, idx);
  const pinTitle = generatePinTitle(pinTopic, keywords, idx);
  const longTailKeywords = suggestLongTailKeywords(keywords);

  // Compose description (without title; title is separate)
  const parts: string[] = [opener, body];
  if (cta) parts.push(cta);
  if (hashtags.length > 0) {
    parts.push(hashtags.map((h) => `#${h}`).join(" "));
  }
  let fullDescription = parts.join(" ");
  // Clamp to 500 chars
  const withinLimit = Array.from(fullDescription).length <= MAX_CHARS;
  if (!withinLimit) {
    fullDescription = Array.from(fullDescription).slice(0, MAX_CHARS).join("");
  }
  const charCount = Array.from(fullDescription).length;
  const wordCount = fullDescription.split(/\s+/).filter(Boolean).length;
  const keywordDensities = computeKeywordDensities(fullDescription, keywords);
  const mainKeyword = keywords[0] ?? "";
  const mainKeywordInFirst100 = checkMainKeywordInFirst100(fullDescription, mainKeyword);

  const partial: Omit<GeneratedPin, "seoScore"> = {
    variation,
    pinTitle,
    opener,
    body,
    cta,
    hashtags,
    boardName,
    fullDescription,
    keywords,
    longTailKeywords,
    keywordDensities,
    charCount,
    wordCount,
    keywordCount: keywords.length,
    hashtagCount: hashtags.length,
    withinLimit,
    mainKeywordInFirst100,
  };
  const seoScore = scoreSeo(partial as GeneratedPin);
  return { ...partial, seoScore };
}

/** Generate 3 variations. */
export function generateVariations(input: PinterestInput): GeneratedPin[] {
  if (!normalizeTopic(input.pinTopic) && !parseKeywords(input.targetKeywords).length) {
    return [];
  }
  return [1, 2, 3].map((v) => generatePin(input, v));
}

// ---- Stats ----

/** Compute summary stats across variations. */
export function computeSummaryStats(variations: GeneratedPin[]): SummaryStats {
  if (variations.length === 0) {
    return {
      totalVariations: 0,
      avgChars: 0,
      avgWords: 0,
      avgKeywords: 0,
      avgHashtags: 0,
      withinLimitCount: 0,
      avgSeoScore: 0,
    };
  }
  const n = variations.length;
  const sum = variations.reduce(
    (acc, v) => ({
      chars: acc.chars + v.charCount,
      words: acc.words + v.wordCount,
      keywords: acc.keywords + v.keywordCount,
      hashtags: acc.hashtags + v.hashtagCount,
      seo: acc.seo + v.seoScore,
    }),
    { chars: 0, words: 0, keywords: 0, hashtags: 0, seo: 0 },
  );
  return {
    totalVariations: n,
    avgChars: Math.round(sum.chars / n),
    avgWords: Math.round(sum.words / n),
    avgKeywords: Math.round(sum.keywords / n),
    avgHashtags: Math.round(sum.hashtags / n),
    withinLimitCount: variations.filter((v) => v.withinLimit).length,
    avgSeoScore: Math.round(sum.seo / n),
  };
}

// ---- Renderers ----

/** Render a single pin as plain text. */
export function renderText(pin: GeneratedPin): string {
  const lines = [
    `Variation ${pin.variation}`,
    `Pin Title: ${pin.pinTitle}`,
    `Board Name: ${pin.boardName}`,
    `Opener: ${pin.opener}`,
    `Body: ${pin.body}`,
  ];
  if (pin.cta) lines.push(`CTA: ${pin.cta}`);
  if (pin.hashtags.length > 0) lines.push(`Hashtags: ${pin.hashtags.map((h) => `#${h}`).join(" ")}`);
  if (pin.longTailKeywords.length > 0) {
    lines.push(`Long-tail Keywords:\n${pin.longTailKeywords.map((k) => `  - ${k}`).join("\n")}`);
  }
  if (pin.keywordDensities.length > 0) {
    lines.push(`Keyword Densities:`);
    for (const kd of pin.keywordDensities) {
      const flag = kd.optimal ? "✓" : "✗";
      lines.push(`  ${flag} ${kd.keyword}: ${kd.density}% (${kd.count} occurrences)`);
    }
  }
  lines.push(`Main keyword in first 100 chars: ${pin.mainKeywordInFirst100 ? "yes" : "no"}`);
  lines.push("");
  lines.push("Full Description:");
  lines.push(pin.fullDescription);
  lines.push(`(chars: ${pin.charCount}, words: ${pin.wordCount}, keywords: ${pin.keywordCount}, hashtags: ${pin.hashtagCount})`);
  lines.push(`SEO Score: ${pin.seoScore}/100`);
  return lines.join("\n");
}

/** Render multiple pins as plain text. */
export function renderTextAll(variations: GeneratedPin[]): string {
  return variations.map(renderText).join("\n\n---\n\n");
}

/** Render a single pin as CSV (component, value). */
export function renderCsv(pin: GeneratedPin): string {
  const lines = ["component,value"];
  lines.push(`variation,${pin.variation}`);
  lines.push(`pin_title,${escapeCsv(pin.pinTitle)}`);
  lines.push(`board_name,${escapeCsv(pin.boardName)}`);
  lines.push(`opener,${escapeCsv(pin.opener)}`);
  lines.push(`body,${escapeCsv(pin.body)}`);
  lines.push(`cta,${escapeCsv(pin.cta)}`);
  lines.push(`hashtags,${escapeCsv(pin.hashtags.map((h) => `#${h}`).join(" "))}`);
  lines.push(`long_tail_keywords,${escapeCsv(pin.longTailKeywords.join("; "))}`);
  lines.push(`keyword_densities,${escapeCsv(pin.keywordDensities.map((k) => `${k.keyword}:${k.density}%`).join("; "))}`);
  lines.push(`full_description,${escapeCsv(pin.fullDescription)}`);
  lines.push(`char_count,${pin.charCount}`);
  lines.push(`word_count,${pin.wordCount}`);
  lines.push(`keyword_count,${pin.keywordCount}`);
  lines.push(`hashtag_count,${pin.hashtagCount}`);
  lines.push(`main_keyword_first_100,${pin.mainKeywordInFirst100}`);
  lines.push(`within_limit,${pin.withinLimit}`);
  lines.push(`seo_score,${pin.seoScore}`);
  return lines.join("\n");
}

/** Render multiple pins as CSV. */
export function renderCsvAll(variations: GeneratedPin[]): string {
  if (variations.length === 0) return "component,value\n";
  return variations.map((v, i) => {
    const csv = renderCsv(v);
    return i === 0 ? csv : csv.split("\n").slice(1).join("\n");
  }).join("\n");
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

const HISTORY_KEY = "unqtools:pinterest-pin-description-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  pinTopic: string;
  pinCategory: PinCategory;
  descriptionLength: DescriptionLength;
  keywordCount: number;
  variationCount: number;
  seoScore: number;
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

export function buildShareUrl(input: PinterestInput): string {
  const params = new URLSearchParams();
  if (input.pinTopic) params.set("topic", input.pinTopic);
  params.set("category", input.pinCategory);
  if (input.targetKeywords) params.set("keywords", input.targetKeywords);
  params.set("length", input.descriptionLength);
  params.set("cta", String(input.includeCTA));
  params.set("hashtags", String(input.includeHashtags));
  params.set("ctaType", input.ctaType);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): PinterestInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: PinterestInput = {
    pinTopic: "",
    pinCategory: "diy",
    targetKeywords: "",
    includeCTA: true,
    includeHashtags: false,
    descriptionLength: "medium",
    ctaType: "save",
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const category = params.get("category");
  const length = params.get("length");
  const ctaType = params.get("ctaType");
  return {
    pinTopic: params.get("topic") ?? "",
    pinCategory: category && PIN_CATEGORIES.includes(category as PinCategory)
      ? (category as PinCategory)
      : defaults.pinCategory,
    targetKeywords: params.get("keywords") ?? "",
    includeCTA: parseBool(params.get("cta"), defaults.includeCTA),
    includeHashtags: parseBool(params.get("hashtags"), defaults.includeHashtags),
    descriptionLength: length && DESCRIPTION_LENGTHS.includes(length as DescriptionLength)
      ? (length as DescriptionLength)
      : defaults.descriptionLength,
    ctaType: ctaType && CTA_TYPES.includes(ctaType as CTAType)
      ? (ctaType as CTAType)
      : defaults.ctaType,
  };
}

function parseBool(s: string | null, def: boolean): boolean {
  if (s === null) return def;
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return def;
}
