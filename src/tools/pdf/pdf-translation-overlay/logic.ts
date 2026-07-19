/**
 * PDF Translation Overlay — pure logic.
 *
 * Pure helpers for parsing translation entries, computing overlay positions,
 * color parsing, font lookup, text-width estimation, overlay collision
 * detection, RTL/text-direction handling, basic language detection, history,
 * and shareable URLs.
 *
 * No DOM, no pdf-lib. The actual PDF drawing lives in ui.tsx.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OverlayPosition =
  | "above-original"
  | "below-original"
  | "beside-original"
  | "replace-original";

export type FontFamily = "Helvetica" | "Times-Roman" | "Courier";

export type TextDirection = "ltr" | "rtl";

export type LanguageCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ar"
  | "he"
  | "ru"
  | "zh"
  | "ja"
  | "ko"
  | "unknown";

/** One translation entry parsed from the textarea. */
export interface TranslationEntry {
  /** 1-based page number this entry targets. */
  page: number;
  /** 0-based page index. */
  pageIndex: number;
  /** X coordinate of the original text (PDF user space, bottom-left origin). */
  x: number;
  /** Y coordinate of the original text baseline (PDF user space). */
  y: number;
  /** Translated text to overlay. */
  text: string;
  /** Per-entry font size (overrides default when > 0). */
  fontSize: number;
  /** Original page token, e.g. "1" or "all". */
  pageToken: string;
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputedOverlay {
  entry: TranslationEntry;
  /** Position where the translated text baseline will be drawn. */
  x: number;
  y: number;
  width: number;
  height: number;
  direction: TextDirection;
  language: LanguageCode;
}

export interface OverlayOptions {
  position: OverlayPosition;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  fontFamily: FontFamily;
  pageRange: string;
}

export interface SummaryStats {
  totalEntries: number;
  appliedOverlays: number;
  skippedOutOfRange: number;
  rtlCount: number;
  ltrCount: number;
  byLanguage: Record<string, number>;
  byPosition: Record<OverlayPosition, number>;
  collisionsDetected: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  overlayCount: number;
  position: OverlayPosition;
  fontFamily: FontFamily;
}

// ---------------------------------------------------------------------------
// Constants & presets
// ---------------------------------------------------------------------------

export const OVERLAY_POSITIONS: OverlayPosition[] = [
  "above-original",
  "below-original",
  "beside-original",
  "replace-original",
];

export const POSITION_LABELS: Record<OverlayPosition, string> = {
  "above-original": "Above original text",
  "below-original": "Below original text",
  "beside-original": "Beside original text (to the right)",
  "replace-original": "Replace original (cover then draw)",
};

export const FONT_FAMILIES: FontFamily[] = ["Helvetica", "Times-Roman", "Courier"];

export const FONT_LABELS: Record<FontFamily, string> = {
  Helvetica: "Helvetica (sans-serif)",
  "Times-Roman": "Times Roman (serif)",
  Courier: "Courier (monospace)",
};

/**
 * Approximate average character-width factor (as a fraction of font size) for
 * each standard PDF font. Used by the text-width estimator when no real font
 * metrics are available (e.g. in pure-logic tests).
 */
export const FONT_WIDTH_FACTORS: Record<FontFamily, number> = {
  Helvetica: 0.5,
  "Times-Roman": 0.48,
  Courier: 0.6,
};

export const MIN_FONT_SIZE = 4;
export const MAX_FONT_SIZE = 72;
export const DEFAULT_FONT_SIZE = 10;
export const DEFAULT_FONT_FAMILY: FontFamily = "Helvetica";
export const DEFAULT_TEXT_COLOR = "#FF0000";
export const DEFAULT_POSITION: OverlayPosition = "below-original";
export const BACKGROUND_PADDING = 2;
export const COLLISION_TOLERANCE = 1;

// Language → Unicode script ranges (basic detection)
interface LangRange {
  code: LanguageCode;
  name: string;
  test: (s: string) => boolean;
}

const LANG_RANGES: LangRange[] = [
  { code: "ar", name: "Arabic", test: (s) => /[\u0600-\u06FF\u0750-\u077F]/.test(s) },
  { code: "he", name: "Hebrew", test: (s) => /[\u0590-\u05FF]/.test(s) },
  { code: "ru", name: "Cyrillic", test: (s) => /[\u0400-\u04FF]/.test(s) },
  { code: "zh", name: "Chinese", test: (s) => /[\u4E00-\u9FFF]/.test(s) },
  { code: "ja", name: "Japanese", test: (s) => /[\u3040-\u30FF\u31F0-\u31FF]/.test(s) },
  { code: "ko", name: "Korean", test: (s) => /[\uAC00-\uD7AF\u1100-\u11FF]/.test(s) },
];

// Common words for Latin-script language detection
const LATIN_LANG_WORDS: { code: LanguageCode; words: string[] }[] = [
  { code: "es", words: ["el", "la", "los", "las", "de", "que", "en", "un", "una", "y", "por", "con"] },
  { code: "fr", words: ["le", "la", "les", "de", "et", "en", "un", "une", "que", "pour", "avec", "dans"] },
  { code: "de", words: ["der", "die", "das", "und", "in", "den", "von", "mit", "zu", "auf", "für", "ist"] },
  { code: "it", words: ["il", "la", "le", "di", "che", "in", "un", "una", "per", "con", "sono", "non"] },
  { code: "pt", words: ["o", "a", "os", "as", "de", "que", "em", "um", "uma", "para", "com", "não"] },
  { code: "en", words: ["the", "of", "and", "to", "in", "is", "it", "you", "that", "for", "with", "as"] },
];

const RTL_LANGUAGES: LanguageCode[] = ["ar", "he"];

// ---------------------------------------------------------------------------
// Page-range normalization (re-uses pattern from _shared/page-ranges.ts)
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all" || trimmed === "*") return "all";
  return trimmed.replace(/\s+/g, "");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

/**
 * Expand a page-range spec ("all", "1-3, 5, 8-") to 0-based page indices.
 * Returns null on parse error.
 */
export function expandPageRange(spec: string, pageCount: number): number[] | null {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") {
    return pageCount > 0 ? Array.from({ length: pageCount }, (_, i) => i) : [];
  }
  const out: number[] = [];
  for (const part of normalized.split(",")) {
    if (!part) continue;
    const range = part.match(/^(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] === "" ? 1 : Number(range[1]);
      const end = range[2] === "" ? pageCount : Number(range[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      if (start < 1 || end > pageCount || start > end) return null;
      for (let i = start; i <= end; i++) out.push(i - 1);
      continue;
    }
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n < 1 || n > pageCount) return null;
      out.push(n - 1);
      continue;
    }
    return null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Translation parser
// ---------------------------------------------------------------------------

/**
 * Parse the translations textarea.
 *
 * Each line is `page|x|y|translated_text|font_size` (pipe-separated).
 * Commas may be used as the separator instead of pipes (auto-detected).
 * The `font_size` field is optional (defaults to 0 — meaning "use global").
 * Lines starting with `#` are skipped. Empty lines are skipped.
 *
 * If `font_size` is omitted, the line becomes `page|x|y|text`.
 */
export function parseTranslations(
  input: string,
  pageCount: number,
): TranslationEntry[] {
  const out: TranslationEntry[] = [];
  if (!input) return out;
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.includes("|") ? "|" : ",";
    const parts = splitOnSep(line, sep);
    if (parts.length < 4) continue;
    const pageTok = parts[0].trim();
    const page = Number(pageTok);
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const text = parts[3].trim();
    if (!Number.isFinite(page) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!text) continue;
    let fontSize = 0;
    if (parts.length >= 5) {
      const fs = Number(parts[4]);
      if (Number.isFinite(fs)) fontSize = fs;
    }
    const pageIndex = Math.max(0, Math.min(pageCount - 1, Math.floor(page) - 1));
    out.push({
      page: Math.floor(page),
      pageIndex,
      x,
      y,
      text,
      fontSize,
      pageToken: pageTok,
    });
  }
  return out;
}

/** Split on separator, but respect double-quoted fields. */
function splitOnSep(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === sep && !inQuote) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Validate a list of translation entries — returns the first error message or null. */
export function validateEntries(
  entries: TranslationEntry[],
  pageCount: number,
): string | null {
  if (entries.length === 0) return "Enter at least one translation entry (page|x|y|text).";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.text) return `Entry ${i + 1}: translated text is empty.`;
    if (e.page < 1 || e.pageIndex >= pageCount) {
      return `Entry ${i + 1}: page ${e.page} is out of range (document has ${pageCount} page${pageCount === 1 ? "" : "s"}).`;
    }
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
      return `Entry ${i + 1}: x and y must be numbers.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Geometry — position calculator
// ---------------------------------------------------------------------------

/**
 * Calculate where to draw the overlay text, given the original text position
 * and the chosen overlay position preset.
 *
 * pdf-lib uses bottom-left origin (y grows up). `origX`/`origY` is the
 * original text's baseline position. The returned `x`/`y` is the baseline
 * position for the overlay text.
 */
export function calculateOverlayPosition(
  position: OverlayPosition,
  origX: number,
  origY: number,
  origFontSize: number,
  overlayFontSize: number,
): { x: number; y: number } {
  const gap = Math.max(2, origFontSize * 0.4);
  switch (position) {
    case "above-original":
      // Overlay sits above the original text.
      return { x: origX, y: origY + origFontSize + gap };
    case "below-original":
      // Overlay sits below the original text baseline.
      return { x: origX, y: origY - overlayFontSize - gap };
    case "beside-original": {
      // Overlay sits to the right of the original text. Approximate original
      // text width via the font-size width factor.
      const origWidth = origFontSize * 0.5 * 6; // ~6 chars heuristic
      return { x: origX + origWidth + gap, y: origY };
    }
    case "replace-original":
      // Overlay sits exactly on top of the original (user is expected to draw
      // a background rect first to cover the original).
      return { x: origX, y: origY };
  }
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, "");
  let full: string;
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    full = clean.split("").map((c) => c + c).join("");
  } else if (/^[0-9a-f]{6}$/i.test(clean)) {
    full = clean;
  } else {
    return null;
  }
  const n = parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to2 = (v: number) => {
    const h = Math.round(clamp(v, 0, 1) * 255).toString(16);
    return h.length === 1 ? "0" + h : h;
  };
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

// ---------------------------------------------------------------------------
// Font lookup
// ---------------------------------------------------------------------------

export function normalizeFontFamily(name: string): FontFamily {
  const n = (name ?? "").trim().toLowerCase();
  if (n === "times-roman" || n === "times" || n === "times roman" || n === "serif") {
    return "Times-Roman";
  }
  if (n === "courier" || n === "mono" || n === "monospace") {
    return "Courier";
  }
  return "Helvetica";
}

export function validateFontSize(size: number): { ok: boolean; value: number; error?: string } {
  if (!Number.isFinite(size)) {
    return { ok: false, value: DEFAULT_FONT_SIZE, error: "Font size must be a number." };
  }
  if (size < MIN_FONT_SIZE) {
    return { ok: false, value: MIN_FONT_SIZE, error: `Font size must be at least ${MIN_FONT_SIZE} pt.` };
  }
  if (size > MAX_FONT_SIZE) {
    return { ok: false, value: MAX_FONT_SIZE, error: `Font size must be at most ${MAX_FONT_SIZE} pt.` };
  }
  return { ok: true, value: size };
}

// ---------------------------------------------------------------------------
// Text-width estimator (approximate, no font metrics)
// ---------------------------------------------------------------------------

/**
 * Estimate the width (in PDF user-space units) of a string at a given font
 * size, using the average character-width factor for the chosen font family.
 *
 * NOTE: this is an approximation for layout/collision purposes. The real
 * on-page width is computed by `font.widthOfTextAtSize(...)` in ui.tsx.
 */
export function estimateTextWidth(
  text: string,
  fontSize: number,
  fontFamily: FontFamily = "Helvetica",
): number {
  if (!text) return 0;
  const factor = FONT_WIDTH_FACTORS[fontFamily] ?? 0.5;
  // Count characters that contribute width (exclude zero-width joins).
  const chars = Array.from(text).filter((c) => c.charCodeAt(0) !== 0x200d).length;
  return chars * fontSize * factor;
}

/** Estimate the height of a font (ascent + descent) ≈ fontSize * 1.2. */
export function estimateTextHeight(fontSize: number): number {
  return fontSize * 1.2;
}

// ---------------------------------------------------------------------------
// Background highlight generator
// ---------------------------------------------------------------------------

/**
 * Compute the background rectangle behind an overlay text.
 * Returns null when the background color is empty/invalid.
 */
export function computeBackgroundRect(
  overlayX: number,
  overlayY: number,
  text: string,
  fontSize: number,
  fontFamily: FontFamily,
  padding = BACKGROUND_PADDING,
): OverlayRect | null {
  if (!text) return null;
  const width = estimateTextWidth(text, fontSize, fontFamily) + padding * 2;
  const height = estimateTextHeight(fontSize) + padding;
  // pdf-lib Y is the baseline; the rect's bottom-left should sit
  // slightly below the baseline (descent).
  const rectY = overlayY - fontSize * 0.25 - padding;
  return {
    x: overlayX - padding,
    y: rectY,
    width,
    height,
  };
}

// ---------------------------------------------------------------------------
// Overlay collision detector
// ---------------------------------------------------------------------------

/**
 * Detect whether two overlay rectangles overlap (with an optional tolerance).
 */
export function rectsOverlap(
  a: OverlayRect,
  b: OverlayRect,
  tolerance = COLLISION_TOLERANCE,
): boolean {
  return (
    a.x - tolerance < b.x + b.width &&
    a.x + a.width + tolerance > b.x &&
    a.y - tolerance < b.y + b.height &&
    a.y + a.height + tolerance > b.y
  );
}

/**
 * Detect all pairs of overlapping overlay rectangles.
 * Returns a list of [i, j] index pairs that overlap.
 */
export function detectCollisions(rects: OverlayRect[]): Array<[number, number]> {
  const collisions: Array<[number, number]> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        collisions.push([i, j]);
      }
    }
  }
  return collisions;
}

// ---------------------------------------------------------------------------
// Text-direction (LTR/RTL) detection
// ---------------------------------------------------------------------------

/** Detect the text direction of a string by scanning for RTL characters. */
export function detectTextDirection(text: string): TextDirection {
  if (!text) return "ltr";
  // Scan the first 50 chars and count RTL vs LTR strong-directional chars.
  const sample = Array.from(text).slice(0, 50);
  let rtl = 0;
  let ltr = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0590 && code <= 0x08ff) rtl++; // Hebrew, Arabic, Syriac, etc.
    else if (code >= 0x0041 && code <= 0x005a) ltr++; // A-Z
    else if (code >= 0x0061 && code <= 0x007a) ltr++; // a-z
  }
  return rtl > ltr ? "rtl" : "ltr";
}

/** Detect the language of a string by Unicode script + Latin word matching. */
export function detectLanguage(text: string): LanguageCode {
  if (!text) return "unknown";
  // First check non-Latin scripts.
  for (const r of LANG_RANGES) {
    if (r.test(text)) return r.code;
  }
  // Latin-script: count common words.
  const lower = text.toLowerCase();
  const tokens = lower.split(/[^\p{L}]+/u).filter(Boolean);
  if (tokens.length === 0) return "unknown";
  let best: LanguageCode = "unknown";
  let bestScore = 0;
  for (const lang of LATIN_LANG_WORDS) {
    let score = 0;
    for (const tok of tokens) {
      if (lang.words.includes(tok)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = lang.code;
    }
  }
  return best;
}

/** Is the given language right-to-left? */
export function isRtlLanguage(lang: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(lang);
}

// ---------------------------------------------------------------------------
// RTL text handler
// ---------------------------------------------------------------------------

/**
 * Reverse a string for RTL rendering (basic — does NOT handle complex
 * shaping or BiDi reordering). Used as a fallback when no BiDi library
 * is available; pdf-lib's standard fonts handle RTL text left-to-right
 * by default, so we reverse manually for visual correctness with simple
 * text strings.
 */
export function reverseForRtl(text: string): string {
  if (!text) return "";
  return Array.from(text).reverse().join("");
}

/**
 * Apply RTL handling: if the text is detected as RTL, reverse it for visual
 * rendering with pdf-lib's standard fonts. Returns the (possibly reversed)
 * text and the adjusted x-offset to right-align the text at the original x.
 */
export function applyRtlHandling(
  text: string,
  x: number,
  fontSize: number,
  fontFamily: FontFamily,
): { text: string; x: number; direction: TextDirection } {
  const direction = detectTextDirection(text);
  if (direction === "rtl") {
    const reversed = reverseForRtl(text);
    const width = estimateTextWidth(text, fontSize, fontFamily);
    // Right-align the reversed text so its trailing edge sits at the
    // original x position (visual leading edge for RTL).
    return { text: reversed, x: x - width, direction };
  }
  return { text, x, direction };
}

// ---------------------------------------------------------------------------
// Compute overlays — combining position + direction + background
// ---------------------------------------------------------------------------

/**
 * Compute the full overlay spec for each translation entry.
 * Filters out entries whose page index is not in the eligible page set.
 */
export function computeOverlays(
  entries: TranslationEntry[],
  eligiblePageIndices: Set<number>,
  options: OverlayOptions,
): ComputedOverlay[] {
  const out: ComputedOverlay[] = [];
  for (const entry of entries) {
    if (!eligiblePageIndices.has(entry.pageIndex)) continue;
    const fs = entry.fontSize > 0 ? validateFontSize(entry.fontSize).value : options.fontSize;
    const { x, y } = calculateOverlayPosition(
      options.position,
      entry.x,
      entry.y,
      fs, // approximate original font size as overlay font size when unknown
      fs,
    );
    const direction = detectTextDirection(entry.text);
    const language = detectLanguage(entry.text);
    const width = estimateTextWidth(entry.text, fs, options.fontFamily);
    const height = estimateTextHeight(fs);
    out.push({ entry, x, y, width, height, direction, language });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeStats(
  entries: TranslationEntry[],
  overlays: ComputedOverlay[],
  options: OverlayOptions,
  collisions: Array<[number, number]>,
): SummaryStats {
  const byLanguage: Record<string, number> = {};
  const byPosition: Record<OverlayPosition, number> = {
    "above-original": 0,
    "below-original": 0,
    "beside-original": 0,
    "replace-original": 0,
  };
  let rtlCount = 0;
  let ltrCount = 0;
  for (const o of overlays) {
    byLanguage[o.language] = (byLanguage[o.language] ?? 0) + 1;
    byPosition[options.position] = (byPosition[options.position] ?? 0) + 1;
    if (o.direction === "rtl") rtlCount++;
    else ltrCount++;
  }
  const appliedOverlays = overlays.length;
  const skippedOutOfRange = entries.length - appliedOverlays;
  return {
    totalEntries: entries.length,
    appliedOverlays,
    skippedOutOfRange,
    rtlCount,
    ltrCount,
    byLanguage,
    byPosition,
    collisionsDetected: collisions.length,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export function renderTextReport(
  entries: TranslationEntry[],
  overlays: ComputedOverlay[],
  stats: SummaryStats,
  options: OverlayOptions,
): string {
  const lines: string[] = [];
  lines.push("PDF Translation Overlay Report");
  lines.push("==============================");
  lines.push(`Position: ${options.position}`);
  lines.push(`Font: ${options.fontFamily} @ ${options.fontSize}pt`);
  lines.push(`Text color: ${options.textColor}`);
  lines.push(`Background: ${options.backgroundColor || "(transparent)"}`);
  lines.push(`Page range: ${options.pageRange}`);
  lines.push(`Total entries: ${stats.totalEntries}`);
  lines.push(`Applied overlays: ${stats.appliedOverlays}`);
  lines.push(`Skipped (out of range): ${stats.skippedOutOfRange}`);
  lines.push(`RTL: ${stats.rtlCount} • LTR: ${stats.ltrCount}`);
  lines.push(`Collisions detected: ${stats.collisionsDetected}`);
  const langList = Object.entries(stats.byLanguage)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  lines.push(`Languages: ${langList || "(none)"}`);
  lines.push("");
  lines.push("Overlays:");
  overlays.forEach((o, i) => {
    lines.push(
      `  ${i + 1}. p${o.entry.page} (${o.entry.x},${o.entry.y}) → (${o.x.toFixed(1)},${o.y.toFixed(1)}) [${o.direction}/${o.language}] ${o.entry.text.slice(0, 40)}`,
    );
  });
  return lines.join("\n");
}

export function renderCsv(entries: TranslationEntry[], overlays: ComputedOverlay[]): string {
  const lines = ["page,x_orig,y_orig,x_overlay,y_overlay,direction,language,text"];
  for (const o of overlays) {
    const row = [
      o.entry.page,
      o.entry.x,
      o.entry.y,
      o.x.toFixed(1),
      o.y.toFixed(1),
      o.direction,
      o.language,
      escapeCsv(o.entry.text),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-translation-overlay:history";
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
      // ignore quota errors
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(options: OverlayOptions, translations: string): string {
  const params = new URLSearchParams();
  if (translations) params.set("tx", translations);
  if (options.position !== DEFAULT_POSITION) params.set("pos", options.position);
  if (options.fontSize !== DEFAULT_FONT_SIZE) params.set("fs", String(options.fontSize));
  if (options.fontFamily !== DEFAULT_FONT_FAMILY) params.set("font", options.fontFamily);
  if (options.textColor && options.textColor !== DEFAULT_TEXT_COLOR) params.set("color", options.textColor);
  if (options.backgroundColor) params.set("bg", options.backgroundColor);
  if (options.pageRange && options.pageRange !== "all") params.set("range", options.pageRange);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OverlayOptions> & { translations?: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<OverlayOptions> & { translations?: string } = {};
  const tx = params.get("tx");
  if (tx) out.translations = tx;
  const pos = params.get("pos") as OverlayPosition | null;
  if (pos && OVERLAY_POSITIONS.includes(pos)) out.position = pos;
  const fs = Number(params.get("fs"));
  if (Number.isFinite(fs)) out.fontSize = validateFontSize(fs).value;
  const font = params.get("font") as FontFamily | null;
  if (font && FONT_FAMILIES.includes(font)) out.fontFamily = font;
  const color = params.get("color");
  if (color) out.textColor = color;
  const bg = params.get("bg");
  if (bg) out.backgroundColor = bg;
  const range = params.get("range");
  if (range) out.pageRange = range;
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(
  opts: OverlayOptions,
  pageCount: number,
): ToolResult<OverlayOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!OVERLAY_POSITIONS.includes(opts.position)) {
    return { ok: false, error: `Unknown overlay position: ${opts.position}` };
  }
  if (!FONT_FAMILIES.includes(opts.fontFamily)) {
    return { ok: false, error: `Unknown font family: ${opts.fontFamily}` };
  }
  const fsCheck = validateFontSize(opts.fontSize);
  if (!fsCheck.ok) {
    return { ok: false, error: fsCheck.error ?? "Invalid font size." };
  }
  if (opts.textColor && !parseHexColor(opts.textColor)) {
    return { ok: false, error: `Invalid text color "${opts.textColor}". Use #RRGGBB or #RGB.` };
  }
  if (opts.backgroundColor && !parseHexColor(opts.backgroundColor)) {
    return { ok: false, error: `Invalid background color "${opts.backgroundColor}". Use #RRGGBB or #RGB.` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s*]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return {
    ok: true,
    output: { ...opts, pageRange: normalized, fontSize: fsCheck.value },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
