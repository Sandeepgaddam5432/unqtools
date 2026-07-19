/**
 * PDF Font Extractor — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF font enumeration
 * and font-program extraction lives in ui.tsx; this module handles font-type
 * detection, name normalization, subset detection, standard-font detection,
 * usage ranking, ZIP packaging, multi-format rendering, history
 * (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type FontType =
  | "TrueType"
  | "Type1"
  | "OpenType"
  | "CIDFontType0"
  | "CIDFontType2"
  | "Type3"
  | "Unknown";

export const ALL_FONT_TYPES: FontType[] = [
  "TrueType",
  "Type1",
  "OpenType",
  "CIDFontType0",
  "CIDFontType2",
  "Type3",
  "Unknown",
];

export type ExtractionMode = "list-only" | "extract-font-files" | "analyze-usage" | "full";

export const EXTRACTION_MODES: ExtractionMode[] = [
  "list-only",
  "extract-font-files",
  "analyze-usage",
  "full",
];

export const MODE_LABELS: Record<ExtractionMode, string> = {
  "list-only": "List only (enumerate fonts)",
  "extract-font-files": "Extract font files (download ZIP)",
  "analyze-usage": "Analyze usage (per page + char count)",
  "full": "Full (list + extract + analyze)",
};

export type FontFormatFilter = "all" | "truetype" | "type1" | "opentype" | "cid";

export const FORMAT_FILTERS: FontFormatFilter[] = [
  "all",
  "truetype",
  "type1",
  "opentype",
  "cid",
];

export const FORMAT_FILTER_LABELS: Record<FontFormatFilter, string> = {
  all: "All font types",
  truetype: "TrueType only",
  type1: "Type1 only",
  opentype: "OpenType only",
  cid: "CID fonts only",
};

export type OutputFormat = "zip-of-fonts" | "json-metadata" | "csv-list";

export const OUTPUT_FORMATS: OutputFormat[] = [
  "zip-of-fonts",
  "json-metadata",
  "csv-list",
];

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  "zip-of-fonts": "ZIP of font files (binary)",
  "json-metadata": "JSON metadata (.json)",
  "csv-list": "CSV font list (.csv)",
};

export const OUTPUT_EXTENSIONS: Record<OutputFormat, string> = {
  "zip-of-fonts": "zip",
  "json-metadata": "json",
  "csv-list": "csv",
};

export const OUTPUT_MIME: Record<OutputFormat, string> = {
  "zip-of-fonts": "application/zip",
  "json-metadata": "application/json",
  "csv-list": "text/csv",
};

export interface FontInfo {
  /** Index in the document's font list (0-based). */
  index: number;
  /** Raw BaseFont name as stored in the PDF (may include subset prefix like "ABCDEF+Helvetica"). */
  rawName: string;
  /** Normalized name (subset prefix stripped). */
  name: string;
  /** Subset prefix (e.g. "ABCDEF") or empty string. */
  subsetPrefix: string;
  /** True if the font is a subset. */
  isSubset: boolean;
  /** Detected font type. */
  type: FontType;
  /** True if the font program is embedded. */
  embedded: boolean;
  /** True if the font is a standard PDF font (Helvetica, Times, Courier, Symbol, ZapfDingbats). */
  isStandard: boolean;
  /** Embedded font file bytes (null if not embedded). */
  fontFileBytes: Uint8Array | null;
  /** Suggested file extension for the font program (.ttf, .otf, .pfb, .cff). */
  fontFileExtension: string;
  /** 1-based page numbers where this font is used. */
  pagesUsed: number[];
  /** Approximate total character count drawn with this font. */
  charCount: number;
}

export interface FontOptions {
  extractionMode: ExtractionMode;
  fontFormatFilter: FontFormatFilter;
  includeSubsets: boolean;
  outputFormat: OutputFormat;
}

export const DEFAULT_OPTIONS: FontOptions = {
  extractionMode: "list-only",
  fontFormatFilter: "all",
  includeSubsets: true,
  outputFormat: "json-metadata",
};

export interface FontSummaryStats {
  totalFonts: number;
  byType: Record<FontType, number>;
  embeddedCount: number;
  notEmbeddedCount: number;
  subsettedCount: number;
  standardCount: number;
  duplicatedCount: number;
  totalPagesWithFonts: number;
  totalChars: number;
  avgCharsPerFont: number;
}

export interface FontDuplicate {
  name: string;
  count: number;
  indices: number[];
  totalBytes: number;
}

export interface UsageRankingEntry {
  index: number;
  name: string;
  charCount: number;
  pagesUsed: number;
}

export interface SubsettingRecommendation {
  index: number;
  name: string;
  reason: string;
  estimatedSizeReductionBytes: number;
}

export interface CompatibilityEntry {
  index: number;
  name: string;
  type: FontType;
  compatible: boolean;
  note: string;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  totalFonts: number;
  embeddedCount: number;
  subsettedCount: number;
  extractionMode: ExtractionMode;
}

// ---------------------------------------------------------------------------
// Standard PDF fonts (14 base fonts that every PDF reader must support)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Font-type detection
// ---------------------------------------------------------------------------

/**
 * Detect the font type from a PDF Subtype string.
 * Returns "OpenType" if `isOpenTypeFile` is true (overriding the base subtype
 * because OpenType fonts are stored as /FontFile3 with /Subtype /OpenType).
 */
export function detectFontType(subtype: string, isOpenTypeFile = false): FontType {
  if (isOpenTypeFile) return "OpenType";
  const s = (subtype ?? "").trim();
  switch (s) {
    case "TrueType": return "TrueType";
    case "Type1": return "Type1";
    case "Type3": return "Type3";
    case "CIDFontType0": return "CIDFontType0";
    case "CIDFontType2": return "CIDFontType2";
    case "OpenType": return "OpenType";
    default: return "Unknown";
  }
}

/** True if a FontType is a CID font (CIDFontType0 or CIDFontType2). */
export function isCidFont(type: FontType): boolean {
  return type === "CIDFontType0" || type === "CIDFontType2";
}

// ---------------------------------------------------------------------------
// Font name normalization & subset detection
// ---------------------------------------------------------------------------

/** Detect and return the subset prefix (6 uppercase letters/digits) or empty string. */
export function extractSubsetPrefix(rawName: string): string {
  const m = /^([A-Z]{6}\+)\s*/.exec(rawName ?? "");
  return m ? m[1].slice(0, 6) : "";
}

/** True if the raw name starts with a 6-char subset prefix followed by '+'. */
export function isSubsetFont(rawName: string): boolean {
  return extractSubsetPrefix(rawName).length > 0;
}

/** Normalize a font name by stripping any subset prefix and trimming whitespace. */
export function normalizeFontName(rawName: string): string {
  const name = (rawName ?? "").trim();
  const m = /^[A-Z]{6}\+(.*)$/.exec(name);
  return m ? m[1] : name;
}

/** Format a font name back into a display string. */
export function formatFontName(font: Pick<FontInfo, "name" | "isSubset" | "subsetPrefix">): string {
  return font.isSubset && font.subsetPrefix ? `${font.subsetPrefix}+${font.name}` : font.name;
}

// ---------------------------------------------------------------------------
// Embed detection
// ---------------------------------------------------------------------------

/** True if a font is embedded (has font program bytes or is a standard font). */
export function isEmbedded(font: FontInfo): boolean {
  return font.embedded || (font.isStandard && STANDARD_FONTS.has(font.name));
}

// ---------------------------------------------------------------------------
// Standard font detection
// ---------------------------------------------------------------------------

/** True if the (normalized) font name is one of the 14 standard PDF fonts. */
export function isStandardFont(name: string): boolean {
  return STANDARD_FONTS.has((name ?? "").trim());
}

/** Return the standard font name if matched, otherwise null. */
export function getStandardFontName(name: string): string | null {
  const n = (name ?? "").trim();
  return STANDARD_FONTS.has(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Filename generator
// ---------------------------------------------------------------------------

/** Sanitize a font name into a safe filename component. */
export function sanitizeFontName(name: string): string {
  return (name ?? "")
    .replace(/[^A-Za-z0-9._+-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "font";
}

/** Build a download filename for a font, e.g. "Helvetica.ttf" or "ABCDEF+Helvetica.otf". */
export function getFontFilename(font: FontInfo): string {
  const base = font.isSubset && font.subsetPrefix
    ? `${font.subsetPrefix}+${sanitizeFontName(font.name)}`
    : sanitizeFontName(font.name);
  const ext = font.fontFileExtension || "bin";
  return `${base}.${ext}`;
}

/** Suggest a file extension based on font type and embedded stream subtype. */
export function suggestFontExtension(type: FontType, fontFileSubtype = ""): string {
  if (fontFileSubtype === "OpenType") return "otf";
  if (fontFileSubtype === "CFFFont") return "cff";
  switch (type) {
    case "TrueType": return "ttf";
    case "Type1": return "pfb";
    case "OpenType": return "otf";
    case "CIDFontType0": return "otf";
    case "CIDFontType2": return "ttf";
    case "Type3": return "bin";
    default: return "bin";
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Filter fonts by the user's font-format selection. */
export function filterFontsByFormat(fonts: FontInfo[], filter: FontFormatFilter): FontInfo[] {
  if (filter === "all") return fonts;
  if (filter === "cid") return fonts.filter((f) => isCidFont(f.type));
  if (filter === "truetype") return fonts.filter((f) => f.type === "TrueType" || f.type === "CIDFontType2");
  if (filter === "type1") return fonts.filter((f) => f.type === "Type1");
  if (filter === "opentype") return fonts.filter((f) => f.type === "OpenType" || f.type === "CIDFontType0");
  return fonts;
}

/** Filter out subsetted fonts when the user doesn't want them. */
export function filterFontsBySubset(fonts: FontInfo[], includeSubsets: boolean): FontInfo[] {
  if (includeSubsets) return fonts;
  return fonts.filter((f) => !f.isSubset);
}

/** Apply both format and subset filters. */
export function applyFontFilters(fonts: FontInfo[], opts: FontOptions): FontInfo[] {
  return filterFontsBySubset(filterFontsByFormat(fonts, opts.fontFormatFilter), opts.includeSubsets);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(fonts: FontInfo[]): FontSummaryStats {
  const byType = {} as Record<FontType, number>;
  for (const t of ALL_FONT_TYPES) byType[t] = 0;
  let embeddedCount = 0;
  let subsettedCount = 0;
  let standardCount = 0;
  let totalChars = 0;
  const pagesSet = new Set<number>();
  for (const f of fonts) {
    byType[f.type] += 1;
    if (f.embedded) embeddedCount += 1;
    if (f.isSubset) subsettedCount += 1;
    if (f.isStandard) standardCount += 1;
    totalChars += f.charCount;
    for (const p of f.pagesUsed) pagesSet.add(p);
  }
  // Duplicate detection: count distinct (name, embedded) pairs that appear >1
  const dupMap = new Map<string, number>();
  for (const f of fonts) {
    const key = `${f.name}|${f.embedded ? "emb" : "ref"}`;
    dupMap.set(key, (dupMap.get(key) ?? 0) + 1);
  }
  const duplicatedCount = Array.from(dupMap.values()).filter((c) => c > 1).reduce((acc, c) => acc + c, 0);
  return {
    totalFonts: fonts.length,
    byType,
    embeddedCount,
    notEmbeddedCount: fonts.length - embeddedCount,
    subsettedCount,
    standardCount,
    duplicatedCount,
    totalPagesWithFonts: pagesSet.size,
    totalChars,
    avgCharsPerFont: fonts.length > 0 ? Math.round(totalChars / fonts.length) : 0,
  };
}

// ---------------------------------------------------------------------------
// Font duplication detector
// ---------------------------------------------------------------------------

/** Detect fonts that appear multiple times (same name + embedded state). */
export function detectFontDuplicates(fonts: FontInfo[]): FontDuplicate[] {
  const groups = new Map<string, FontInfo[]>();
  for (const f of fonts) {
    const key = `${f.name}|${f.embedded ? "emb" : "ref"}`;
    const arr = groups.get(key);
    if (arr) arr.push(f);
    else groups.set(key, [f]);
  }
  const out: FontDuplicate[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const name = key.split("|")[0];
    const totalBytes = group.reduce((acc, f) => acc + (f.fontFileBytes?.length ?? 0), 0);
    out.push({
      name,
      count: group.length,
      indices: group.map((f) => f.index),
      totalBytes,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Usage ranking
// ---------------------------------------------------------------------------

/** Rank fonts by usage (default: character count, descending). */
export function rankFontsByUsage(fonts: FontInfo[], by: "chars" | "pages" = "chars"): UsageRankingEntry[] {
  const entries = fonts.map((f) => ({
    index: f.index,
    name: f.name,
    charCount: f.charCount,
    pagesUsed: f.pagesUsed.length,
  }));
  return entries.sort((a, b) => {
    if (by === "chars") return b.charCount - a.charCount || b.pagesUsed - a.pagesUsed;
    return b.pagesUsed - a.pagesUsed || b.charCount - a.charCount;
  });
}

// ---------------------------------------------------------------------------
// Subsetting recommender
// ---------------------------------------------------------------------------

/**
 * Recommend subsetting for embedded, non-subsetted fonts where it would save space.
 * We assume subsetting reduces size by ~70% on average.
 */
export function recommendSubsetting(fonts: FontInfo[]): SubsettingRecommendation[] {
  const out: SubsettingRecommendation[] = [];
  for (const f of fonts) {
    if (!f.embedded) continue;
    if (f.isSubset) continue;
    if (f.isStandard) continue;
    const size = f.fontFileBytes?.length ?? 0;
    if (size < 1024) continue; // skip tiny files
    out.push({
      index: f.index,
      name: f.name,
      reason: `Subsetting "${f.name}" (~${size} bytes embedded) could save ~${Math.round(size * 0.7)} bytes if the document uses only a fraction of its glyphs.`,
      estimatedSizeReductionBytes: Math.round(size * 0.7),
    });
  }
  return out.sort((a, b) => b.estimatedSizeReductionBytes - a.estimatedSizeReductionBytes);
}

// ---------------------------------------------------------------------------
// Compatibility checker
// ---------------------------------------------------------------------------

const WIDELY_SUPPORTED_TYPES: ReadonlySet<FontType> = new Set<FontType>(["TrueType", "Type1", "OpenType"]);

/** Check which fonts are widely supported across PDF readers. */
export function checkFontCompatibility(fonts: FontInfo[]): CompatibilityEntry[] {
  return fonts.map((f) => {
    let compatible = false;
    let note = "";
    if (f.isStandard) {
      compatible = true;
      note = "Standard PDF font (always supported).";
    } else if (WIDELY_SUPPORTED_TYPES.has(f.type)) {
      compatible = true;
      note = `${f.type} fonts are widely supported by modern PDF readers.`;
    } else if (isCidFont(f.type)) {
      compatible = true;
      note = `${f.type} CID font — supported by modern readers, may fail on very old ones.`;
    } else if (f.type === "Type3") {
      compatible = false;
      note = "Type3 (bitmap) fonts may render inconsistently across readers.";
    } else {
      compatible = false;
      note = `Unknown font type (${f.type}) — compatibility uncertain.`;
    }
    if (!f.embedded && !f.isStandard) {
      compatible = false;
      note += " Not embedded — relies on the reader having the font installed.";
    }
    return { index: f.index, name: f.name, type: f.type, compatible, note };
  });
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a font list as a human-readable text report. */
export function renderTextList(fonts: FontInfo[], summary: FontSummaryStats): string {
  const lines: string[] = [];
  lines.push("PDF Font Report");
  lines.push("===============");
  lines.push(`Total fonts: ${summary.totalFonts}`);
  lines.push(`Embedded: ${summary.embeddedCount} • Not embedded: ${summary.notEmbeddedCount}`);
  lines.push(`Subsetted: ${summary.subsettedCount} • Standard: ${summary.standardCount} • Duplicated entries: ${summary.duplicatedCount}`);
  lines.push(`Pages using fonts: ${summary.totalPagesWithFonts} • Total chars: ${summary.totalChars}`);
  lines.push("");
  lines.push("By type:");
  for (const t of ALL_FONT_TYPES) {
    if (summary.byType[t] > 0) lines.push(`  ${t}: ${summary.byType[t]}`);
  }
  lines.push("");
  for (const f of fonts) {
    lines.push(`--- Font #${f.index + 1}: ${f.rawName} ---`);
    lines.push(`  Name: ${f.name}${f.isSubset ? ` (subset, prefix ${f.subsetPrefix})` : ""}`);
    lines.push(`  Type: ${f.type}`);
    lines.push(`  Embedded: ${f.embedded} • Standard: ${f.isStandard}`);
    if (f.fontFileBytes) {
      lines.push(`  Font program: ${f.fontFileBytes.length} bytes (${f.fontFileExtension || "bin"})`);
    }
    lines.push(`  Pages used: ${f.pagesUsed.length === 0 ? "(none)" : f.pagesUsed.join(", ")}`);
    lines.push(`  Approx chars: ${f.charCount}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render fonts as JSON metadata (full info). */
export function renderJsonMetadata(fonts: FontInfo[], summary: FontSummaryStats): string {
  const data = {
    summary: {
      totalFonts: summary.totalFonts,
      byType: summary.byType,
      embeddedCount: summary.embeddedCount,
      notEmbeddedCount: summary.notEmbeddedCount,
      subsettedCount: summary.subsettedCount,
      standardCount: summary.standardCount,
      duplicatedCount: summary.duplicatedCount,
      totalPagesWithFonts: summary.totalPagesWithFonts,
      totalChars: summary.totalChars,
      avgCharsPerFont: summary.avgCharsPerFont,
    },
    fonts: fonts.map((f) => ({
      index: f.index,
      rawName: f.rawName,
      name: f.name,
      subsetPrefix: f.subsetPrefix,
      isSubset: f.isSubset,
      type: f.type,
      embedded: f.embedded,
      isStandard: f.isStandard,
      fontFileBytes: f.fontFileBytes ? f.fontFileBytes.length : 0,
      fontFileExtension: f.fontFileExtension,
      pagesUsed: f.pagesUsed,
      charCount: f.charCount,
    })),
  };
  return JSON.stringify(data, null, 2);
}

/** Render fonts as CSV: name, type, embedded, subset, pages_used, char_count. */
export function renderCsvList(fonts: FontInfo[]): string {
  const lines: string[] = [
    "index,raw_name,name,type,embedded,subset,is_standard,pages_used,char_count,font_file_bytes",
  ];
  for (const f of fonts) {
    lines.push([
      f.index,
      escapeCsv(f.rawName),
      escapeCsv(f.name),
      f.type,
      f.embedded,
      f.isSubset,
      f.isStandard,
      `"${f.pagesUsed.join(",")}"`,
      f.charCount,
      f.fontFileBytes ? f.fontFileBytes.length : 0,
    ].join(","));
  }
  return lines.join("\n");
}

/** Dispatch to the renderer matching the chosen output format. */
export function renderOutput(fonts: FontInfo[], summary: FontSummaryStats, format: OutputFormat): string {
  switch (format) {
    case "json-metadata": return renderJsonMetadata(fonts, summary);
    case "csv-list": return renderCsvList(fonts);
    case "zip-of-fonts": return "(ZIP of font files — use the Download button.)";
    default: return renderTextList(fonts, summary);
  }
}

/** Build the download filename for an output format and original PDF name. */
export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}-fonts.${OUTPUT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// Minimal ZIP builder (store mode, no compression)
// ---------------------------------------------------------------------------

/** CRC-32 table (polynomial 0xEDB88320). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}

function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

/** Build a minimal valid ZIP archive (store mode, no compression). */
export function buildZip(files: ZipFile[]): Uint8Array {
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    pushU32(out, 0x04034b50);
    pushU16(out, 20);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU32(out, crc);
    pushU32(out, size);
    pushU32(out, size);
    pushU16(out, nameBytes.length);
    pushU16(out, 0);
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20);
    pushU16(centralDir, 20);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, crc);
    pushU32(centralDir, size);
    pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, 0);
    pushU32(centralDir, offset);
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  pushU32(out, 0x06054b50);
  pushU16(out, 0);
  pushU16(out, 0);
  pushU16(out, files.length);
  pushU16(out, files.length);
  pushU32(out, cdSize);
  pushU32(out, cdStart);
  pushU16(out, 0);
  return new Uint8Array(out);
}

/**
 * Build a ZIP package of embedded font files. Includes only fonts that have
 * embedded font program bytes. Each font is named using getFontFilename.
 * If a filename would collide, an index suffix is appended.
 */
export function buildFontPackage(fonts: FontInfo[]): Uint8Array {
  const files: ZipFile[] = [];
  const usedNames = new Set<string>();
  for (const f of fonts) {
    if (!f.fontFileBytes || f.fontFileBytes.length === 0) continue;
    let name = getFontFilename(f);
    // Resolve collisions
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let i = 1;
      while (usedNames.has(`${base}_${i}${ext}`)) i++;
      name = `${base}_${i}${ext}`;
    }
    usedNames.add(name);
    files.push({ name, bytes: f.fontFileBytes });
  }
  // Add a small README
  const readme = `PDF Font Extractor — extracted ${files.length} embedded font(s).\n` +
    `Generated by UnQTools PDF Font Extractor.\n`;
  files.push({ name: "README.txt", bytes: utf8Encode(readme) });
  return buildZip(files);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-font-extractor:history";
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

const VALID_MODES = new Set<ExtractionMode>(EXTRACTION_MODES);
const VALID_FILTERS = new Set<FontFormatFilter>(FORMAT_FILTERS);
const VALID_OUTPUTS = new Set<OutputFormat>(OUTPUT_FORMATS);

export function buildShareUrl(opts: FontOptions): string {
  const params = new URLSearchParams();
  if (opts.extractionMode !== DEFAULT_OPTIONS.extractionMode) params.set("mode", opts.extractionMode);
  if (opts.fontFormatFilter !== DEFAULT_OPTIONS.fontFormatFilter) params.set("filter", opts.fontFormatFilter);
  if (opts.includeSubsets !== DEFAULT_OPTIONS.includeSubsets) params.set("subsets", opts.includeSubsets ? "1" : "0");
  if (opts.outputFormat !== DEFAULT_OPTIONS.outputFormat) params.set("out", opts.outputFormat);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<FontOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<FontOptions> = {};
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as ExtractionMode)) out.extractionMode = mode as ExtractionMode;
  const filter = params.get("filter");
  if (filter && VALID_FILTERS.has(filter as FontFormatFilter)) out.fontFormatFilter = filter as FontFormatFilter;
  const subsets = params.get("subsets");
  if (subsets !== null) out.includeSubsets = subsets !== "0";
  const outFmt = params.get("out");
  if (outFmt && VALID_OUTPUTS.has(outFmt as OutputFormat)) out.outputFormat = outFmt as OutputFormat;
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: FontOptions): ToolResult<FontOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_MODES.has(opts.extractionMode)) {
    return { ok: false, error: `Unknown extraction mode: ${opts.extractionMode}` };
  }
  if (!VALID_FILTERS.has(opts.fontFormatFilter)) {
    return { ok: false, error: `Unknown font format filter: ${opts.fontFormatFilter}` };
  }
  if (!VALID_OUTPUTS.has(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  return { ok: true, output: { ...opts } };
}

// Suppress unused-export warning for escapeHtml (kept for future HTML report extension)
void escapeHtml;
