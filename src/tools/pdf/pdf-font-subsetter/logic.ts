/**
 * PDF Font Subsetter — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF font enumeration,
 * character scanning, and font-program renaming lives in ui.tsx; this module
 * handles the subset plan, size estimation, name prefixing, glyph-count
 * heuristics, multi-format rendering, history (localStorage), and shareable
 * URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type SubsetMode = "all-fonts" | "custom-fonts" | "automatic";

export const SUBSET_MODES: SubsetMode[] = ["all-fonts", "custom-fonts", "automatic"];

export const MODE_LABELS: Record<SubsetMode, string> = {
  "all-fonts": "Subset all embedded fonts (except standard 14)",
  "custom-fonts": "Subset only fonts named below",
  "automatic": "Automatic — subset only fonts that benefit",
};

/**
 * When `automatic` mode is chosen, a font is only subsetted if the subset
 * ratio (used glyphs / total glyphs) is below this threshold.
 */
export const AUTO_SUBSET_RATIO_THRESHOLD = 0.8;

/** Below this size (bytes), subsetting is skipped — savings are negligible. */
export const MIN_FONT_SIZE_TO_SUBSET = 1024;

export interface SubsetOptions {
  subsetMode: SubsetMode;
  /** One font name per line, used only when subsetMode === "custom-fonts". */
  customFontList: string;
  /** Keep original (non-subsetted) font programs alongside subsets. */
  preserveOriginals: boolean;
  /** Estimate aggressive glyph pruning for composite fonts. */
  aggressiveMode: boolean;
  /** Target file size in KB; 0 = no target, just optimize. */
  targetSize: number;
}

export const DEFAULT_OPTIONS: SubsetOptions = {
  subsetMode: "all-fonts",
  customFontList: "",
  preserveOriginals: false,
  aggressiveMode: false,
  targetSize: 0,
};

/** The 14 standard PDF base fonts — these are never embedded, never subsetted. */
export const STANDARD_FONTS: ReadonlySet<string> = new Set([
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Symbol",
  "ZapfDingbats",
]);

/** Unicode block ranges used by the character-coverage report. */
export interface UnicodeBlock {
  name: string;
  start: number;
  end: number;
}

export const UNICODE_BLOCKS: UnicodeBlock[] = [
  { name: "Basic Latin", start: 0x0000, end: 0x007F },
  { name: "Latin-1 Supplement", start: 0x0080, end: 0x00FF },
  { name: "Latin Extended-A", start: 0x0100, end: 0x017F },
  { name: "Latin Extended-B", start: 0x0180, end: 0x024F },
  { name: "Greek and Coptic", start: 0x0370, end: 0x03FF },
  { name: "Cyrillic", start: 0x0400, end: 0x04FF },
  { name: "Arabic", start: 0x0600, end: 0x06FF },
  { name: "General Punctuation", start: 0x2000, end: 0x206F },
  { name: "Currency Symbols", start: 0x20A0, end: 0x20CF },
  { name: "Letterlike Symbols", start: 0x2100, end: 0x214F },
  { name: "Mathematical Operators", start: 0x2200, end: 0x22FF },
  { name: "Box Drawing", start: 0x2500, end: 0x257F },
  { name: "Geometric Shapes", start: 0x25A0, end: 0x25FF },
  { name: "Miscellaneous Symbols", start: 0x2600, end: 0x26FF },
  { name: "CJK Unified Ideographs", start: 0x4E00, end: 0x9FFF },
  { name: "Private Use Area", start: 0xE000, end: 0xF8FF },
];

/** Per-font data produced by the scanner in ui.tsx. */
export interface FontUsageData {
  /** Index in the document's font list (0-based). */
  index: number;
  /** Raw BaseFont name as stored in the PDF (may already include a subset prefix). */
  rawName: string;
  /** Normalized name (subset prefix stripped). */
  name: string;
  /** Existing subset prefix (e.g. "ABCDEF") or empty string. */
  existingPrefix: string;
  /** True if the font is already a subset. */
  isAlreadySubset: boolean;
  /** True if the font program is embedded. */
  embedded: boolean;
  /** True if the font is one of the 14 standard PDF fonts. */
  isStandard: boolean;
  /** Embedded font program size in bytes (0 if not embedded). */
  fontFileSize: number;
  /** Total distinct characters drawn with this font across all pages. */
  distinctCharsUsed: number;
  /** Set of code points used by this font (sorted ascending). */
  usedCodePoints: number[];
  /** Total glyph count heuristic (depends on font type). */
  estimatedTotalGlyphs: number;
  /** Font type as a string (TrueType, Type1, OpenType, CIDFontType0, CIDFontType2, Type3, Unknown). */
  fontType: string;
  /** 1-based page numbers where this font is used. */
  pagesUsed: number[];
}

/** Plan for a single font after the subset decision. */
export interface SubsetPlanEntry {
  index: number;
  name: string;
  rawName: string;
  /** True if this font will be subsetted. */
  willSubset: boolean;
  /** Reason the font will or won't be subsetted. */
  reason: string;
  /** New BaseFont name (with prefix) that will replace the old one. */
  newBaseFontName: string;
  /** Subset prefix that will be applied (6 uppercase letters + "+"). */
  subsetPrefix: string;
  /** Estimated size of the font program after subsetting (bytes). */
  estimatedSubsetSize: number;
  /** Estimated bytes saved by subsetting this font. */
  estimatedBytesSaved: number;
  /** Subset ratio (usedGlyphs / totalGlyphs), 0–1. */
  subsetRatio: number;
  /** Number of distinct glyphs kept. */
  usedGlyphCount: number;
  /** Total glyphs in the original font. */
  totalGlyphCount: number;
  /** True if the font was already subsetted before this run. */
  alreadySubsetted: boolean;
}

export interface SubsetPlan {
  entries: SubsetPlanEntry[];
  totalFonts: number;
  fontsToSubset: number;
  fontsSkipped: number;
  estimatedTotalBytesSaved: number;
  estimatedOriginalTotalBytes: number;
  estimatedSubsetTotalBytes: number;
  /** Estimated percentage reduction in font bytes (0–100). */
  estimatedReductionPct: number;
}

export interface SubsetResult {
  bytes: Uint8Array;
  originalSize: number;
  subsetSize: number;
  reductionPercent: number;
  fontsSubsetsApplied: number;
  fontsSkipped: number;
  plan: SubsetPlan;
}

export interface CharacterCoverageEntry {
  index: number;
  name: string;
  /** Per Unicode block: count of used code points in that block. */
  blocks: { name: string; count: number }[];
  /** Code points not falling into any known block. */
  otherCount: number;
  totalChars: number;
}

export interface SubsetRecommendation {
  index: number;
  name: string;
  reason: string;
  estimatedBytesSaved: number;
  priority: "high" | "medium" | "low";
}

export interface SummaryStats {
  totalFonts: number;
  fontsToSubset: number;
  fontsSkipped: number;
  alreadySubsetted: number;
  standardFonts: number;
  notEmbedded: number;
  totalCharsUsed: number;
  totalGlyphsKept: number;
  totalGlyphsOriginal: number;
  estimatedBytesSaved: number;
  estimatedReductionPct: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  originalSize: number;
  subsetSize: number;
  reductionPercent: number;
  fontsSubset: number;
  mode: SubsetMode;
}

// ---------------------------------------------------------------------------
// Font name handling
// ---------------------------------------------------------------------------

/** Extract the existing subset prefix (6 uppercase letters/digits) from a name. */
export function extractSubsetPrefix(rawName: string): string {
  const m = /^([A-Z]{6}\+)\s*/.exec(rawName ?? "");
  return m ? m[1].slice(0, 6) : "";
}

/** True if the raw name starts with a 6-char subset prefix followed by '+'. */
export function isSubsetFont(rawName: string): boolean {
  return extractSubsetPrefix(rawName).length > 0;
}

/** Strip any existing subset prefix and trim whitespace. */
export function normalizeFontName(rawName: string): string {
  const name = (rawName ?? "").trim();
  const m = /^[A-Z]{6}\+(.*)$/.exec(name);
  return m ? m[1] : name;
}

/** True if the (normalized) font name is one of the 14 standard PDF fonts. */
export function isStandardFont(name: string): boolean {
  return STANDARD_FONTS.has((name ?? "").trim());
}

/**
 * Generate a random 6-letter subset prefix using the PDF spec alphabet
 * (uppercase A–Z only, per Adobe convention).
 */
export function generateSubsetPrefix(seed = 0): string {
  const A = 65;
  const chars: string[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < 6; i++) {
    if (seed === 0) {
      // Use Math.random for variety when no seed provided.
      s = Math.floor(Math.random() * 26);
      chars.push(String.fromCharCode(A + s));
    } else {
      // Deterministic LCG for testability.
      s = (s * 1664525 + 1013904223) >>> 0;
      chars.push(String.fromCharCode(A + (s % 26)));
    }
  }
  return chars.join("");
}

/** Apply the standard PDF subset prefix to a font name → "ABCDEF+Helvetica". */
export function prefixFontName(name: string, prefix: string): string {
  const clean = normalizeFontName(name);
  const p = (prefix ?? "").toUpperCase().replace(/[^A-Z]/g, "").padEnd(6, "A").slice(0, 6);
  return `${p}+${clean}`;
}

// ---------------------------------------------------------------------------
// Custom font list parsing
// ---------------------------------------------------------------------------

/** Parse the custom font list (one name per line, comma or newline separated). */
export function parseCustomFontList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => normalizeFontName(s))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Glyph counting heuristics
// ---------------------------------------------------------------------------

/** Estimated total glyph count by font type (heuristic — real count requires TTF parsing). */
export function estimateTotalGlyphs(fontType: string, fontFileSize: number, distinctCharsUsed: number): number {
  const t = (fontType ?? "").trim();
  // CID fonts typically have many thousands of glyphs.
  if (t === "CIDFontType0" || t === "CIDFontType2") {
    return Math.max(distinctCharsUsed, Math.floor(fontFileSize / 150));
  }
  // TrueType / OpenType: ~250 bytes per glyph on average.
  if (t === "TrueType" || t === "OpenType") {
    return Math.max(256, Math.floor(fontFileSize / 250));
  }
  // Type1: ~200 bytes per glyph.
  if (t === "Type1") {
    return Math.max(224, Math.floor(fontFileSize / 200));
  }
  // Type3 / Unknown: fall back to distinct chars used.
  if (t === "Type3") {
    return Math.max(distinctCharsUsed, 1);
  }
  return Math.max(distinctCharsUsed, 1);
}

/**
 * Estimate how many glyphs the subset will keep.
 * We always keep the .notdef glyph (1) plus all distinct chars used.
 * Aggressive mode prunes unused composite glyphs (estimated 10% reduction).
 */
export function countUsedGlyphs(distinctCharsUsed: number, aggressiveMode: boolean): number {
  if (distinctCharsUsed <= 0) return 1; // .notdef only
  const base = distinctCharsUsed + 1; // +1 for .notdef
  if (aggressiveMode) {
    return Math.max(1, Math.round(base * 0.9));
  }
  return base;
}

/**
 * Estimate the size of the subset font program (bytes) based on the original
 * size and the subset ratio. Subsetting typically scales the font linearly
 * with the ratio of glyphs kept, plus a 2 KB overhead for table headers.
 */
export function estimateSubsetSize(originalSize: number, usedGlyphs: number, totalGlyphs: number): number {
  if (originalSize <= 0) return 0;
  if (totalGlyphs <= 0) return originalSize;
  const ratio = Math.min(1, usedGlyphs / totalGlyphs);
  const overhead = 2048;
  return Math.min(originalSize, Math.max(overhead, Math.round(originalSize * ratio + overhead)));
}

/** Calculate the subset ratio (usedGlyphs / totalGlyphs), clamped to [0, 1]. */
export function calcSubsetRatio(usedGlyphs: number, totalGlyphs: number): number {
  if (totalGlyphs <= 0) return 1;
  return Math.max(0, Math.min(1, usedGlyphs / totalGlyphs));
}

/** Calculate the percentage reduction between two sizes, 0–100. */
export function calcSizeReduction(original: number, reduced: number): number {
  if (original <= 0) return 0;
  const pct = ((original - reduced) / original) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/** Estimate the bytes saved by subsetting a single font. */
export function estimateBytesSaved(originalSize: number, subsetSize: number): number {
  return Math.max(0, originalSize - subsetSize);
}

/**
 * Estimate the per-glyph byte cost (compression ratio) for a font.
 * Used by the aggressive-mode glyph compression estimator.
 */
export function estimateGlyphCompression(fontFileSize: number, totalGlyphs: number): number {
  if (totalGlyphs <= 0) return 0;
  return fontFileSize / totalGlyphs;
}

// ---------------------------------------------------------------------------
// Subset plan builder
// ---------------------------------------------------------------------------

/**
 * Decide whether a font should be subsetted given the chosen mode.
 * Returns {willSubset, reason}.
 */
export function decideSubsetting(
  font: FontUsageData,
  mode: SubsetMode,
  customFontNames: string[],
): { willSubset: boolean; reason: string } {
  if (!font.embedded) {
    return { willSubset: false, reason: "Font is not embedded — nothing to subset." };
  }
  if (font.isStandard) {
    return { willSubset: false, reason: "Standard PDF font (one of the 14 base fonts) — never subsetted." };
  }
  if (font.fontFileSize < MIN_FONT_SIZE_TO_SUBSET) {
    return { willSubset: false, reason: `Font program is tiny (${font.fontFileSize} B) — subsetting not worth it.` };
  }
  if (mode === "all-fonts") {
    return { willSubset: true, reason: "All-fonts mode: subsetting all eligible embedded fonts." };
  }
  if (mode === "custom-fonts") {
    const match = customFontNames.some((n) => n.toLowerCase() === font.name.toLowerCase());
    if (match) {
      return { willSubset: true, reason: `Font "${font.name}" matches the custom list.` };
    }
    return { willSubset: false, reason: `Font "${font.name}" not in the custom list — skipped.` };
  }
  // automatic
  const total = font.estimatedTotalGlyphs > 0 ? font.estimatedTotalGlyphs : 1;
  const used = font.distinctCharsUsed + 1; // +1 for .notdef
  const ratio = used / total;
  if (ratio < AUTO_SUBSET_RATIO_THRESHOLD) {
    return { willSubset: true, reason: `Automatic mode: only ${Math.round(ratio * 100)}% of glyphs used — subsetting will save space.` };
  }
  return { willSubset: false, reason: `Automatic mode: ${Math.round(ratio * 100)}% of glyphs used — subsetting not worth it.` };
}

/** Build a complete subset plan from scanned font usage data. */
export function buildSubsetPlan(fonts: FontUsageData[], options: SubsetOptions): SubsetPlan {
  const customNames = parseCustomFontList(options.customFontList);
  const entries: SubsetPlanEntry[] = [];
  let fontsToSubset = 0;
  let fontsSkipped = 0;
  let totalSaved = 0;
  let originalTotal = 0;
  let subsetTotal = 0;

  for (const f of fonts) {
    const decision = decideSubsetting(f, options.subsetMode, customNames);
    const totalGlyphs = f.estimatedTotalGlyphs;
    const usedGlyphs = decision.willSubset
      ? countUsedGlyphs(f.distinctCharsUsed, options.aggressiveMode)
      : totalGlyphs;
    const ratio = calcSubsetRatio(usedGlyphs, totalGlyphs);
    const subsetSize = decision.willSubset
      ? estimateSubsetSize(f.fontFileSize, usedGlyphs, totalGlyphs)
      : f.fontFileSize;
    const saved = decision.willSubset ? estimateBytesSaved(f.fontFileSize, subsetSize) : 0;
    const prefix = decision.willSubset ? generateSubsetPrefix(f.index + 1) : "";
    const newBaseFontName = decision.willSubset
      ? prefixFontName(f.name, prefix)
      : f.rawName;

    entries.push({
      index: f.index,
      name: f.name,
      rawName: f.rawName,
      willSubset: decision.willSubset,
      reason: decision.reason,
      newBaseFontName,
      subsetPrefix: prefix,
      estimatedSubsetSize: subsetSize,
      estimatedBytesSaved: saved,
      subsetRatio: ratio,
      usedGlyphCount: usedGlyphs,
      totalGlyphCount: totalGlyphs,
      alreadySubsetted: f.isAlreadySubset,
    });

    originalTotal += f.fontFileSize;
    if (decision.willSubset) {
      fontsToSubset += 1;
      subsetTotal += subsetSize;
      totalSaved += saved;
    } else {
      fontsSkipped += 1;
      subsetTotal += f.fontFileSize;
    }
  }

  const reductionPct = calcSizeReduction(originalTotal, subsetTotal);

  return {
    entries,
    totalFonts: fonts.length,
    fontsToSubset,
    fontsSkipped,
    estimatedTotalBytesSaved: totalSaved,
    estimatedOriginalTotalBytes: originalTotal,
    estimatedSubsetTotalBytes: subsetTotal,
    estimatedReductionPct: reductionPct,
  };
}

// ---------------------------------------------------------------------------
// Aggressive mode applier
// ---------------------------------------------------------------------------

/**
 * Estimate additional savings from aggressive glyph pruning for composite (CID)
 * fonts. Aggressive mode removes unused glyphs within composite fonts (e.g.
 * CJK fonts that only use a fraction of their glyph palette).
 */
export function applyAggressiveMode(plan: SubsetPlan, fonts: FontUsageData[]): {
  extraBytesSaved: number;
  affectedFonts: number;
  updatedEntries: SubsetPlanEntry[];
} {
  let extra = 0;
  let affected = 0;
  const updated: SubsetPlanEntry[] = [];
  for (const entry of plan.entries) {
    const font = fonts.find((f) => f.index === entry.index);
    if (!font) {
      updated.push(entry);
      continue;
    }
    if (!entry.willSubset) {
      updated.push(entry);
      continue;
    }
    const isComposite = font.fontType === "CIDFontType0" || font.fontType === "CIDFontType2";
    if (!isComposite) {
      updated.push(entry);
      continue;
    }
    // Aggressive mode prunes an additional ~10% of the kept glyphs.
    const prunedSize = Math.round(entry.estimatedSubsetSize * 0.9);
    const prunedSaved = entry.estimatedBytesSaved + (entry.estimatedSubsetSize - prunedSize);
    extra += entry.estimatedSubsetSize - prunedSize;
    affected += 1;
    updated.push({
      ...entry,
      estimatedSubsetSize: prunedSize,
      estimatedBytesSaved: prunedSaved,
    });
  }
  return { extraBytesSaved: extra, affectedFonts: affected, updatedEntries: updated };
}

// ---------------------------------------------------------------------------
// Character coverage report
// ---------------------------------------------------------------------------

/** Build a per-font character coverage report by Unicode block. */
export function buildCharacterCoverage(fonts: FontUsageData[]): CharacterCoverageEntry[] {
  const out: CharacterCoverageEntry[] = [];
  for (const f of fonts) {
    const blockCounts = UNICODE_BLOCKS.map((b) => ({
      name: b.name,
      count: f.usedCodePoints.filter((cp) => cp >= b.start && cp <= b.end).length,
    }));
    const knownSum = blockCounts.reduce((acc, b) => acc + b.count, 0);
    const otherCount = Math.max(0, f.usedCodePoints.length - knownSum);
    out.push({
      index: f.index,
      name: f.name,
      blocks: blockCounts.filter((b) => b.count > 0),
      otherCount,
      totalChars: f.usedCodePoints.length,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Standard font handler
// ---------------------------------------------------------------------------

/**
 * Filter the font list to only those that are eligible for subsetting.
 * Standard fonts and non-embedded fonts are excluded.
 */
export function filterSubsettable(fonts: FontUsageData[]): FontUsageData[] {
  return fonts.filter((f) => f.embedded && !f.isStandard && f.fontFileSize >= MIN_FONT_SIZE_TO_SUBSET);
}

// ---------------------------------------------------------------------------
// Embedding verifier
// ---------------------------------------------------------------------------

export interface EmbeddingVerification {
  index: number;
  name: string;
  embedded: boolean;
  hasFontFile: boolean;
  message: string;
}

/**
 * Verify that each font's embedding state is consistent. Used after subsetting
 * to ensure the subsetted font program is properly embedded (i.e. the
 * FontDescriptor still references a FontFile/FontFile2/FontFile3 stream).
 */
export function verifyEmbedding(fonts: FontUsageData[]): EmbeddingVerification[] {
  return fonts.map((f) => {
    const hasFontFile = f.fontFileSize > 0;
    const embedded = f.embedded && hasFontFile;
    let message: string;
    if (f.isStandard) {
      message = "Standard PDF font — no embedding required.";
    } else if (!f.embedded) {
      message = "Font is referenced but not embedded — may not render correctly on all readers.";
    } else if (!hasFontFile) {
      message = "Font claims to be embedded but no font program bytes were found.";
    } else {
      message = "Font is properly embedded with a font program stream.";
    }
    return { index: f.index, name: f.name, embedded, hasFontFile, message };
  });
}

// ---------------------------------------------------------------------------
// Subsetting recommender
// ---------------------------------------------------------------------------

/**
 * Recommend which fonts would benefit most from subsetting. Ranked by
 * estimated bytes saved, only including fonts with significant savings.
 */
export function recommendSubsetting(fonts: FontUsageData[]): SubsetRecommendation[] {
  const out: SubsetRecommendation[] = [];
  for (const f of fonts) {
    if (!f.embedded || f.isStandard) continue;
    if (f.fontFileSize < MIN_FONT_SIZE_TO_SUBSET) continue;
    if (f.isAlreadySubset) continue;
    const total = f.estimatedTotalGlyphs > 0 ? f.estimatedTotalGlyphs : 1;
    const used = f.distinctCharsUsed + 1;
    const ratio = used / total;
    if (ratio >= AUTO_SUBSET_RATIO_THRESHOLD) continue;
    const subsetSize = estimateSubsetSize(f.fontFileSize, used, total);
    const saved = estimateBytesSaved(f.fontFileSize, subsetSize);
    if (saved < 1024) continue;
    const priority: SubsetRecommendation["priority"] = saved > 100_000 ? "high" : saved > 10_000 ? "medium" : "low";
    out.push({
      index: f.index,
      name: f.name,
      reason: `Subsetting "${f.name}" (~${f.fontFileSize} B embedded, ${Math.round(ratio * 100)}% glyphs used) could save ~${saved} B.`,
      estimatedBytesSaved: saved,
      priority,
    });
  }
  return out.sort((a, b) => b.estimatedBytesSaved - a.estimatedBytesSaved);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(plan: SubsetPlan, fonts: FontUsageData[]): SummaryStats {
  let alreadySubsetted = 0;
  let standardFonts = 0;
  let notEmbedded = 0;
  let totalCharsUsed = 0;
  let totalGlyphsKept = 0;
  let totalGlyphsOriginal = 0;
  for (const f of fonts) {
    if (f.isAlreadySubset) alreadySubsetted += 1;
    if (f.isStandard) standardFonts += 1;
    if (!f.embedded) notEmbedded += 1;
    totalCharsUsed += f.distinctCharsUsed;
    totalGlyphsOriginal += f.estimatedTotalGlyphs;
  }
  for (const e of plan.entries) {
    totalGlyphsKept += e.usedGlyphCount;
  }
  return {
    totalFonts: plan.totalFonts,
    fontsToSubset: plan.fontsToSubset,
    fontsSkipped: plan.fontsSkipped,
    alreadySubsetted,
    standardFonts,
    notEmbedded,
    totalCharsUsed,
    totalGlyphsKept,
    totalGlyphsOriginal,
    estimatedBytesSaved: plan.estimatedTotalBytesSaved,
    estimatedReductionPct: plan.estimatedReductionPct,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the subset plan as a human-readable text report. */
export function renderTextReport(plan: SubsetPlan, stats: SummaryStats): string {
  const lines: string[] = [];
  lines.push("PDF Font Subsetting Report");
  lines.push("===========================");
  lines.push(`Total fonts: ${stats.totalFonts}`);
  lines.push(`To subset: ${stats.fontsToSubset} • Skipped: ${stats.fontsSkipped}`);
  lines.push(`Already subsetted: ${stats.alreadySubsetted} • Standard: ${stats.standardFonts} • Not embedded: ${stats.notEmbedded}`);
  lines.push(`Total chars used: ${stats.totalCharsUsed}`);
  lines.push(`Glyphs kept: ${stats.totalGlyphsKept} / ${stats.totalGlyphsOriginal} original`);
  lines.push(`Estimated bytes saved: ${plan.estimatedTotalBytesSaved} (${stats.estimatedReductionPct}% reduction)`);
  lines.push("");
  for (const e of plan.entries) {
    lines.push(`--- Font #${e.index + 1}: ${e.rawName} ---`);
    lines.push(`  Name: ${e.name}${e.alreadySubsetted ? " (already subsetted)" : ""}`);
    lines.push(`  Will subset: ${e.willSubset ? "yes" : "no"} — ${e.reason}`);
    if (e.willSubset) {
      lines.push(`  New BaseFont name: ${e.newBaseFontName}`);
      lines.push(`  Subset prefix: ${e.subsetPrefix}`);
      lines.push(`  Glyphs kept: ${e.usedGlyphCount} / ${e.totalGlyphCount} (ratio ${(e.subsetRatio * 100).toFixed(1)}%)`);
      lines.push(`  Estimated size: ${e.estimatedSubsetSize} B (saved ${e.estimatedBytesSaved} B)`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the subset plan as CSV: name, original_size, subset_size, chars_used, glyphs_used, savings, will_subset. */
export function renderCsvReport(plan: SubsetPlan): string {
  const lines: string[] = [
    "index,name,original_size,subset_size,chars_used,glyphs_used,total_glyphs,savings_bytes,will_subset,already_subsetted",
  ];
  for (const e of plan.entries) {
    const original = e.totalGlyphCount > 0
      ? Math.round((e.estimatedSubsetSize / Math.max(1, e.subsetRatio)) - 2048)
      : e.estimatedSubsetSize + e.estimatedBytesSaved;
    lines.push([
      e.index,
      escapeCsv(e.name),
      original,
      e.estimatedSubsetSize,
      Math.max(0, e.usedGlyphCount - 1),
      e.usedGlyphCount,
      e.totalGlyphCount,
      e.estimatedBytesSaved,
      e.willSubset,
      e.alreadySubsetted,
    ].join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-font-subsetter:history";
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

const VALID_MODES = new Set<SubsetMode>(SUBSET_MODES);

export function buildShareUrl(opts: SubsetOptions): string {
  const params = new URLSearchParams();
  if (opts.subsetMode !== DEFAULT_OPTIONS.subsetMode) params.set("mode", opts.subsetMode);
  if (opts.customFontList) params.set("fonts", opts.customFontList);
  if (opts.preserveOriginals !== DEFAULT_OPTIONS.preserveOriginals) params.set("keep", opts.preserveOriginals ? "1" : "0");
  if (opts.aggressiveMode !== DEFAULT_OPTIONS.aggressiveMode) params.set("agg", opts.aggressiveMode ? "1" : "0");
  if (opts.targetSize !== DEFAULT_OPTIONS.targetSize) params.set("target", String(opts.targetSize));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<SubsetOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<SubsetOptions> = {};
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as SubsetMode)) out.subsetMode = mode as SubsetMode;
  const fonts = params.get("fonts");
  if (fonts) out.customFontList = fonts;
  const keep = params.get("keep");
  if (keep !== null) out.preserveOriginals = keep !== "0";
  const agg = params.get("agg");
  if (agg !== null) out.aggressiveMode = agg !== "0";
  const target = params.get("target");
  if (target !== null) {
    const n = parseInt(target, 10);
    if (Number.isFinite(n) && n >= 0) out.targetSize = n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: SubsetOptions): ToolResult<SubsetOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_MODES.has(opts.subsetMode)) {
    return { ok: false, error: `Unknown subset mode: ${opts.subsetMode}` };
  }
  if (opts.subsetMode === "custom-fonts") {
    const names = parseCustomFontList(opts.customFontList);
    if (names.length === 0) {
      return { ok: false, error: "Custom-fonts mode selected but no font names were provided. List at least one font name (one per line)." };
    }
  }
  if (!Number.isFinite(opts.targetSize) || opts.targetSize < 0) {
    return { ok: false, error: "Target size must be a non-negative number (use 0 to disable)." };
  }
  return { ok: true, output: { ...opts } };
}
