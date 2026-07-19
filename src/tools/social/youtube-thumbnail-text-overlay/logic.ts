/**
 * YouTube Thumbnail Text Overlay — pure logic.
 *
 * Generate text overlay suggestions for YouTube thumbnails — text,
 * position, font size, color, font. Pure functions only — no DOM,
 * no network.
 */

export type VideoCategory =
  | "tech"
  | "education"
  | "gaming"
  | "vlog"
  | "tutorial"
  | "review"
  | "music"
  | "comedy";

export type ThumbnailStyle =
  | "face-cam"
  | "screenshot"
  | "illustration"
  | "text-only";

export type TextLength = "short" | "medium" | "long";

export interface OverlayInput {
  videoTitle: string;
  videoCategory: VideoCategory;
  thumbnailStyle: ThumbnailStyle;
  textLength: TextLength;
  includeNumbers: boolean;
  includeEmoji: boolean;
}

export interface Position {
  id: string;
  label: string;
  description: string;
  reasoning: string;
}

export interface ColorCombo {
  id: string;
  label: string;
  textColor: string;
  bgColor: string;
  contrast: "high" | "medium";
  hex: { text: string; bg: string };
}

export interface FontRecommendation {
  id: string;
  name: string;
  weight: string;
  availability: string;
}

export interface OverlayVariation {
  variation: number;
  text: string;
  position: Position;
  fontSize: number;
  color: ColorCombo;
  font: FontRecommendation;
  categoryTemplate: string;
  emoji: string;
  ctrScore: number;
  wordCount: number;
  charCount: number;
  hasNumbers: boolean;
}

export interface SummaryStats {
  totalVariations: number;
  avgTextLength: number;
  avgFontSize: number;
  avgCtrScore: number;
  positionsUsed: string[];
  colorCombosUsed: string[];
  abTestPair: [number, number] | null;
}

export const VIDEO_CATEGORIES: VideoCategory[] = [
  "tech",
  "education",
  "gaming",
  "vlog",
  "tutorial",
  "review",
  "music",
  "comedy",
];

export const THUMBNAIL_STYLES: ThumbnailStyle[] = [
  "face-cam",
  "screenshot",
  "illustration",
  "text-only",
];

export const TEXT_LENGTHS: TextLength[] = ["short", "medium", "long"];

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  "tech": "Tech",
  "education": "Education",
  "gaming": "Gaming",
  "vlog": "Vlog",
  "tutorial": "Tutorial",
  "review": "Review",
  "music": "Music",
  "comedy": "Comedy",
};

export const STYLE_LABELS: Record<ThumbnailStyle, string> = {
  "face-cam": "Face-Cam",
  "screenshot": "Screenshot",
  "illustration": "Illustration",
  "text-only": "Text-Only",
};

export const LENGTH_LABELS: Record<TextLength, string> = {
  "short": "Short (1-3 words)",
  "medium": "Medium (4-7 words)",
  "long": "Long (8+ words)",
};

export const LENGTH_BOUNDS: Record<TextLength, { min: number; max: number }> = {
  "short": { min: 1, max: 3 },
  "medium": { min: 4, max: 7 },
  "long": { min: 8, max: 12 },
};

// Category-based power-word templates
export const CATEGORY_TEMPLATES: Record<VideoCategory, string[]> = {
  "tech": ["NEW", "INSANE", "NEXT-GEN", "FUTURE"],
  "education": ["GUIDE", "LEARN", "MASTER", "STEP-BY-STEP"],
  "gaming": ["INSANE", "EPIC", "INSANE CLUTCH", "NEW RECORD"],
  "vlog": ["DAY IN", "REAL TALK", "MY STORY", "BEHIND THE SCENES"],
  "tutorial": ["HOW TO", "EASY", "5 MIN", "BEGINNERS"],
  "review": ["HONEST", "WORTH IT?", "TRUTH", "BRUTAL"],
  "music": ["NEW TRACK", "OFFICIAL", "PREMIERE", "BEAT DROP"],
  "comedy": ["FUNNY", "TRY NOT TO LAUGH", "FAIL", "PRANK"],
};

// Position options
export const POSITIONS: Position[] = [
  {
    id: "top-left",
    label: "Top-Left",
    description: "Upper-left corner, 32px from top and left",
    reasoning: "Best for face-cam thumbnails where the face occupies the right side. The eye reads top-left first (Western reading order).",
  },
  {
    id: "top-right",
    label: "Top-Right",
    description: "Upper-right corner, 32px from top and right",
    reasoning: "Useful when the subject is on the left. Common in tutorial thumbnails where the screen content sits left.",
  },
  {
    id: "bottom-center",
    label: "Bottom-Center",
    description: "Centered horizontally, 40px from bottom",
    reasoning: "Most common position. Keeps text away from the YouTube timestamp badge (bottom-right) and title overlay.",
  },
  {
    id: "center",
    label: "Center",
    description: "Dead center of the thumbnail",
    reasoning: "Only for text-only thumbnails with no other focal element. Maximum visual dominance.",
  },
  {
    id: "left-center",
    label: "Left-Center",
    description: "Vertical center, 48px from left edge",
    reasoning: "Good for screenshot thumbnails where the screenshot occupies the right half. Leaves the action visible.",
  },
];

// Color combos — high contrast for click-through
export const COLOR_COMBOS: ColorCombo[] = [
  { id: "yellow-black", label: "Yellow on Black", textColor: "yellow", bgColor: "black", contrast: "high", hex: { text: "#FFD700", bg: "#000000" } },
  { id: "white-red", label: "White on Red", textColor: "white", bgColor: "red", contrast: "high", hex: { text: "#FFFFFF", bg: "#E63946" } },
  { id: "black-yellow", label: "Black on Yellow", textColor: "black", bgColor: "yellow", contrast: "high", hex: { text: "#000000", bg: "#FFD700" } },
  { id: "red-white", label: "Red on White", textColor: "red", bgColor: "white", contrast: "high", hex: { text: "#E63946", bg: "#FFFFFF" } },
  { id: "white-black", label: "White on Black", textColor: "white", bgColor: "black", contrast: "high", hex: { text: "#FFFFFF", bg: "#000000" } },
  { id: "yellow-red", label: "Yellow on Red", textColor: "yellow", bgColor: "red", contrast: "high", hex: { text: "#FFD700", bg: "#E63946" } },
  { id: "black-white", label: "Black on White", textColor: "black", bgColor: "white", contrast: "high", hex: { text: "#000000", bg: "#FFFFFF" } },
  { id: "blue-yellow", label: "Blue on Yellow", textColor: "blue", bgColor: "yellow", contrast: "high", hex: { text: "#1D4ED8", bg: "#FFD700" } },
  { id: "red-yellow", label: "Red on Yellow", textColor: "red", bgColor: "yellow", contrast: "high", hex: { text: "#E63946", bg: "#FFD700" } },
  { id: "white-blue", label: "White on Blue", textColor: "white", bgColor: "blue", contrast: "high", hex: { text: "#FFFFFF", bg: "#1D4ED8" } },
  { id: "green-black", label: "Green on Black", textColor: "green", bgColor: "black", contrast: "medium", hex: { text: "#22C55E", bg: "#000000" } },
];

// Display fonts — bold, thumbnail-friendly
export const FONTS: FontRecommendation[] = [
  { id: "impact", name: "Impact", weight: "Bold (default)", availability: "Universal — pre-installed on Windows, macOS, and most Linux distros. Safe to use without web font." },
  { id: "bebas-neue", name: "Bebas Neue", weight: "Bold (condensed)", availability: "Google Font. Modern, widely used by YouTubers. Loads via web font." },
  { id: "anton", name: "Anton", weight: "Heavy", availability: "Google Font. Heavy and tall — excellent for max impact at small sizes." },
  { id: "oswald", name: "Oswald", weight: "Bold (condensed)", availability: "Google Font. Condensed sans-serif — packs more letters per line." },
  { id: "montserrat-black", name: "Montserrat Black", weight: "900 (black)", availability: "Google Font. Premium look — pairs well with lifestyle and education content." },
];

// Stopwords for keyword extraction
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
  "to", "of", "in", "on", "for", "with", "by", "from", "at", "as",
  "i", "you", "we", "they", "he", "she", "it", "this", "that",
  "these", "those", "my", "your", "our", "their", "his", "her", "its",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "should", "could", "can", "may", "might", "must",
  "if", "then", "so", "than", "too", "very", "just", "only", "also",
  "about", "into", "out", "up", "down", "over", "under", "again",
  "how", "what", "when", "where", "why", "who", "which",
  "in", "on", "at", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after",
]);

/** Normalize whitespace in a string. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Uppercase a string for thumbnail display (typically uppercase). */
export function toThumbnailCase(s: string): string {
  return (s || "").toUpperCase();
}

/** Extract numbers and amounts from a title ($1M, 30 days, 50K, 100%, etc.). */
export function extractNumbers(title: string): string[] {
  if (!title) return [];
  // Match: $1M, $1.5M, 30 days, 50K, 100%, 1,000+, 5x, $500K, $1B
  const matches = title.match(/\$?\d+(?:[.,]\d+)?\s*(?:[KMB]|percent|%|x|days?|hours?|minutes?|weeks?|months?|years?|times?)?/gi);
  if (!matches) return [];
  return matches.map((m) => m.trim()).filter((m) => m.length > 0);
}

/** Extract keywords from title (excluding stopwords, numbers). */
export function extractKeywords(title: string): string[] {
  if (!title) return [];
  // Strip punctuation but keep numbers
  const cleaned = title.replace(/[^a-zA-Z0-9\s$]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const freq = new Map<string, number>();
  for (const w of words) {
    const lower = w.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    if (lower.length < 2) continue;
    // Skip pure numbers (those are captured by extractNumbers)
    if (/^\d+$/.test(lower)) continue;
    out.push(w);
    freq.set(lower, (freq.get(lower) ?? 0) + 1);
  }
  // Dedupe preserving order, sort by frequency
  const seen = new Set<string>();
  const deduped = out.filter((w) => {
    const lower = w.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
  return deduped.sort((a, b) => (freq.get(b.toLowerCase()) ?? 0) - (freq.get(a.toLowerCase()) ?? 0));
}

/** Shorten text to a target word count. */
export function shortenText(text: string, maxWords: number): string {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

/** Generate thumbnail text from title + inputs. */
export function generateThumbnailText(input: OverlayInput, variation: number): string {
  const title = normalizeText(input.videoTitle);
  if (!title) return "";

  const bounds = LENGTH_BOUNDS[input.textLength];
  const keywords = extractKeywords(title);
  const numbers = input.includeNumbers ? extractNumbers(title) : [];

  let text = "";

  if (variation === 1) {
    // Variation 1: numbers + top keyword(s)
    const topKeyword = keywords[0] ?? "";
    const topNumber = numbers[0] ?? "";
    if (topNumber && topKeyword) {
      text = `${topNumber} ${topKeyword}`;
    } else if (topNumber) {
      text = topNumber;
    } else if (topKeyword) {
      text = topKeyword;
    } else {
      text = shortenText(title, bounds.max);
    }
  } else if (variation === 2) {
    // Variation 2: category template + keyword
    const templates = CATEGORY_TEMPLATES[input.videoCategory];
    const tpl = templates[0] ?? "";
    const topKeyword = keywords[0] ?? "";
    if (tpl && topKeyword) {
      text = `${tpl} ${topKeyword}`;
    } else if (tpl) {
      text = tpl;
    } else {
      text = shortenText(title, bounds.max);
    }
  } else {
    // Variation 3: shortened title (first N words)
    text = shortenText(title, bounds.max);
  }

  // Trim to bounds max words
  text = shortenText(text, bounds.max);

  // Append emoji if requested
  if (input.includeEmoji) {
    const emoji = pickEmoji(input.videoCategory);
    if (emoji && !text.endsWith(emoji)) {
      text = `${text} ${emoji}`;
    }
  }

  return toThumbnailCase(text).trim();
}

/** Pick an emoji based on category. */
export function pickEmoji(category: VideoCategory): string {
  const map: Record<VideoCategory, string> = {
    "tech": "🚀",
    "education": "📚",
    "gaming": "🎮",
    "vlog": "📹",
    "tutorial": "💡",
    "review": "⭐",
    "music": "🎵",
    "comedy": "😂",
  };
  return map[category];
}

/** Recommend a position based on thumbnail style. */
export function recommendPosition(style: ThumbnailStyle, variation: number): Position {
  // Rotate positions across variations for diversity
  const idx = (variation - 1) % 3; // variation 1 → 0, 2 → 1, 3 → 2
  if (style === "face-cam") {
    // Face usually on the right → text top-left
    const opts = [POSITIONS[0], POSITIONS[2], POSITIONS[4]]; // top-left, bottom-center, left-center
    return opts[idx];
  }
  if (style === "screenshot") {
    // Screenshot occupies right side → text left-center or top-left
    const opts = [POSITIONS[4], POSITIONS[0], POSITIONS[2]]; // left-center, top-left, bottom-center
    return opts[idx];
  }
  if (style === "illustration") {
    // Illustration has focal point — usually bottom-center
    const opts = [POSITIONS[2], POSITIONS[0], POSITIONS[1]]; // bottom-center, top-left, top-right
    return opts[idx];
  }
  // text-only → center
  const opts = [POSITIONS[3], POSITIONS[2], POSITIONS[0]]; // center, bottom-center, top-left
  return opts[idx];
}

/** Calculate font size based on text length and position. */
export function calculateFontSize(text: string, position: Position): number {
  if (!text) return 48;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  // Base sizes per position (assuming 1280x720 thumbnail)
  const baseByPosition: Record<string, number> = {
    "top-left": 64,
    "top-right": 64,
    "bottom-center": 72,
    "center": 88,
    "left-center": 68,
  };
  let size = baseByPosition[position.id] ?? 64;
  // Reduce size for longer text
  if (wordCount > 5) size -= 12;
  else if (wordCount > 3) size -= 6;
  // Reduce for long char count
  if (charCount > 20) size -= 8;
  else if (charCount > 12) size -= 4;
  // Clamp
  return Math.max(36, Math.min(120, size));
}

/** Recommend a color combo based on category and variation. */
export function recommendColor(category: VideoCategory, variation: number): ColorCombo {
  // Each category has a primary + secondary combo, then cycle
  const byCategory: Record<VideoCategory, number[]> = {
    "tech": [0, 7, 4],     // yellow-black, blue-yellow, white-black
    "education": [4, 1, 6], // white-black, white-red, black-white
    "gaming": [1, 5, 0],   // white-red, yellow-red, yellow-black
    "vlog": [4, 6, 3],     // white-black, black-white, red-white
    "tutorial": [2, 0, 6], // black-yellow, yellow-black, black-white
    "review": [3, 5, 1],   // red-white, yellow-red, white-red
    "music": [9, 4, 0],    // white-blue, white-black, yellow-black
    "comedy": [0, 2, 8],   // yellow-black, black-yellow, red-yellow
  };
  const indices = byCategory[category];
  const idx = indices[(variation - 1) % indices.length];
  return COLOR_COMBOS[idx] ?? COLOR_COMBOS[0];
}

/** Recommend a font based on category and variation. */
export function recommendFont(category: VideoCategory, variation: number): FontRecommendation {
  const byCategory: Record<VideoCategory, number[]> = {
    "tech": [0, 1, 3],     // Impact, Bebas Neue, Oswald
    "education": [4, 1, 3], // Montserrat Black, Bebas Neue, Oswald
    "gaming": [2, 0, 1],   // Anton, Impact, Bebas Neue
    "vlog": [1, 4, 0],     // Bebas Neue, Montserrat Black, Impact
    "tutorial": [3, 1, 0], // Oswald, Bebas Neue, Impact
    "review": [0, 2, 4],   // Impact, Anton, Montserrat Black
    "music": [1, 2, 0],    // Bebas Neue, Anton, Impact
    "comedy": [2, 0, 1],   // Anton, Impact, Bebas Neue
  };
  const indices = byCategory[category];
  return FONTS[indices[(variation - 1) % indices.length]] ?? FONTS[0];
}

/** Get category template for variation. */
export function getCategoryTemplate(category: VideoCategory, variation: number): string {
  const templates = CATEGORY_TEMPLATES[category];
  return templates[(variation - 1) % templates.length];
}

/** Predict CTR score (0-100) based on patterns. */
export function predictCtrScore(
  text: string,
  hasNumbers: boolean,
  hasEmoji: boolean,
  category: VideoCategory,
  color: ColorCombo,
): number {
  if (!text) return 0;
  let score = 40; // baseline
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Short text performs better on thumbnails
  if (wordCount <= 3) score += 20;
  else if (wordCount <= 5) score += 12;
  else if (wordCount <= 7) score += 4;
  else score -= 8;

  // Numbers boost CTR significantly
  if (hasNumbers) score += 15;

  // Emoji presence — small boost for most categories, large for comedy/gaming
  if (hasEmoji) {
    if (category === "comedy" || category === "gaming") score += 10;
    else score += 4;
  }

  // Category template power words
  const templates = CATEGORY_TEMPLATES[category];
  const upper = text.toUpperCase();
  if (templates.some((t) => upper.includes(t))) score += 8;

  // High-contrast color
  if (color.contrast === "high") score += 8;

  // Specific high-CTR combos
  if (color.id === "yellow-black" || color.id === "white-red") score += 4;

  // Question/exclamation
  if (/[!?]$/.test(text)) score += 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Generate a single overlay variation. */
export function generateVariation(input: OverlayInput, variation: number): OverlayVariation {
  const text = generateThumbnailText(input, variation);
  const position = recommendPosition(input.thumbnailStyle, variation);
  const fontSize = calculateFontSize(text, position);
  const color = recommendColor(input.videoCategory, variation);
  const font = recommendFont(input.videoCategory, variation);
  const categoryTemplate = getCategoryTemplate(input.videoCategory, variation);
  const emoji = input.includeEmoji ? pickEmoji(input.videoCategory) : "";
  const numbers = input.includeNumbers ? extractNumbers(input.videoTitle) : [];
  const hasNumbers = numbers.length > 0 && text.toUpperCase().includes(numbers[0].toUpperCase());
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  const ctrScore = predictCtrScore(text, hasNumbers, input.includeEmoji, input.videoCategory, color);

  return {
    variation,
    text,
    position,
    fontSize,
    color,
    font,
    categoryTemplate,
    emoji,
    ctrScore,
    wordCount,
    charCount,
    hasNumbers,
  };
}

/** Generate 3 variations. */
export function generateVariations(input: OverlayInput): OverlayVariation[] {
  if (!normalizeText(input.videoTitle)) return [];
  return [1, 2, 3].map((v) => generateVariation(input, v));
}

/** Suggest which two variations to A/B test (top 2 CTR scores). */
export function suggestAbTest(variations: OverlayVariation[]): [number, number] | null {
  if (variations.length < 2) return null;
  const sorted = [...variations].sort((a, b) => b.ctrScore - a.ctrScore);
  return [sorted[0].variation, sorted[1].variation];
}

/** Compute summary stats. */
export function computeStats(variations: OverlayVariation[]): SummaryStats {
  if (variations.length === 0) {
    return {
      totalVariations: 0,
      avgTextLength: 0,
      avgFontSize: 0,
      avgCtrScore: 0,
      positionsUsed: [],
      colorCombosUsed: [],
      abTestPair: null,
    };
  }
  const totalWords = variations.reduce((s, v) => s + v.wordCount, 0);
  const totalFont = variations.reduce((s, v) => s + v.fontSize, 0);
  const totalCtr = variations.reduce((s, v) => s + v.ctrScore, 0);
  const positionsUsed = [...new Set(variations.map((v) => v.position.id))];
  const colorCombosUsed = [...new Set(variations.map((v) => v.color.id))];
  return {
    totalVariations: variations.length,
    avgTextLength: Math.round((totalWords / variations.length) * 10) / 10,
    avgFontSize: Math.round(totalFont / variations.length),
    avgCtrScore: Math.round(totalCtr / variations.length),
    positionsUsed,
    colorCombosUsed,
    abTestPair: suggestAbTest(variations),
  };
}

/** Render variations as a plain text report. */
export function renderText(variations: OverlayVariation[]): string {
  if (variations.length === 0) return "";
  const blocks: string[] = [];
  variations.forEach((v) => {
    blocks.push(`=== Variation ${v.variation} ===`);
    blocks.push(`Text: ${v.text}`);
    blocks.push(`Words: ${v.wordCount} | Chars: ${v.charCount} | Has numbers: ${v.hasNumbers ? "yes" : "no"}`);
    blocks.push(`Position: ${v.position.label} (${v.position.description})`);
    blocks.push(`Reasoning: ${v.position.reasoning}`);
    blocks.push(`Font size: ${v.fontSize}px`);
    blocks.push(`Font: ${v.font.name} — ${v.font.weight}`);
    blocks.push(`Font availability: ${v.font.availability}`);
    blocks.push(`Color: ${v.color.label} (text ${v.color.hex.text} on bg ${v.color.hex.bg}, ${v.color.contrast} contrast)`);
    blocks.push(`Category template: ${v.categoryTemplate}`);
    if (v.emoji) blocks.push(`Emoji: ${v.emoji}`);
    blocks.push(`CTR prediction: ${v.ctrScore}/100`);
    blocks.push("");
  });
  const ab = suggestAbTest(variations);
  if (ab) {
    blocks.push(`=== A/B Test Suggestion ===`);
    blocks.push(`Test variation ${ab[0]} vs variation ${ab[1]} (top CTR scores).`);
    blocks.push("");
  }
  return blocks.join("\n").trim() + "\n";
}

/** Render variations as CSV. */
export function renderCsv(variations: OverlayVariation[]): string {
  const lines = ["variation,text,position,font_size,font,color_combo,text_hex,bg_hex,contrast,category_template,emoji,word_count,char_count,has_numbers,ctr_score"];
  for (const v of variations) {
    lines.push([
      String(v.variation),
      escapeCsv(v.text),
      v.position.id,
      String(v.fontSize),
      escapeCsv(v.font.name),
      v.color.id,
      v.color.hex.text,
      v.color.hex.bg,
      v.color.contrast,
      escapeCsv(v.categoryTemplate),
      escapeCsv(v.emoji),
      String(v.wordCount),
      String(v.charCount),
      v.hasNumbers ? "yes" : "no",
      String(v.ctrScore),
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

const HISTORY_KEY = "unqtools:youtube-thumbnail-text-overlay:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  videoTitle: string;
  videoCategory: VideoCategory;
  thumbnailStyle: ThumbnailStyle;
  textLength: TextLength;
  variationCount: number;
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

export function buildShareUrl(input: OverlayInput): string {
  const params = new URLSearchParams();
  if (input.videoTitle) params.set("title", input.videoTitle);
  if (input.videoCategory) params.set("cat", input.videoCategory);
  if (input.thumbnailStyle) params.set("style", input.thumbnailStyle);
  if (input.textLength) params.set("len", input.textLength);
  if (input.includeNumbers) params.set("nums", "1");
  if (input.includeEmoji) params.set("emoji", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): OverlayInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: OverlayInput = {
    videoTitle: "",
    videoCategory: "tech",
    thumbnailStyle: "face-cam",
    textLength: "short",
    includeNumbers: true,
    includeEmoji: false,
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const cat = params.get("cat") as VideoCategory | null;
  const style = params.get("style") as ThumbnailStyle | null;
  const len = params.get("len") as TextLength | null;
  return {
    videoTitle: params.get("title") ?? "",
    videoCategory: cat && VIDEO_CATEGORIES.includes(cat) ? cat : "tech",
    thumbnailStyle: style && THUMBNAIL_STYLES.includes(style) ? style : "face-cam",
    textLength: len && TEXT_LENGTHS.includes(len) ? len : "short",
    includeNumbers: params.get("nums") !== "0",
    includeEmoji: params.get("emoji") === "1",
  };
}
