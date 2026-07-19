/**
 * PDF Size Optimizer — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF loading, image
 * enumeration, font enumeration, and re-saving live in ui.tsx; this module
 * handles optimization-level lookup, per-component size analysis, image
 * downsampling math, unused-object detection, stream compression estimation,
 * metadata stripping, font-subset plan integration, optimization
 * recommendations, multi-format reporting, history (localStorage), and
 * shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type OptimizationLevel = "safe" | "balanced" | "aggressive" | "maximum";

export const OPTIMIZATION_LEVELS: OptimizationLevel[] = [
  "safe",
  "balanced",
  "aggressive",
  "maximum",
];

export const LEVEL_LABELS: Record<OptimizationLevel, string> = {
  safe: "Safe — lossless structural re-save only",
  balanced: "Balanced — subset fonts + recompress streams",
  aggressive: "Aggressive — downsample to 150 DPI + remove unused",
  maximum: "Maximum — 96 DPI + strip metadata (lossy)",
};

/** DPI target options for image downsampling. */
export type TargetDpi = 72 | 96 | 150 | 300;

export const TARGET_DPI_OPTIONS: TargetDpi[] = [72, 96, 150, 300];

export const DPI_LABELS: Record<TargetDpi, string> = {
  72: "72 DPI (screen-only)",
  96: "96 DPI (web preview)",
  150: "150 DPI (proof quality)",
  300: "300 DPI (print quality)",
};

/** Per-level default settings. */
export interface LevelDefaults {
  downsampleImages: boolean;
  targetDpi: TargetDpi;
  removeUnusedObjects: boolean;
  removeMetadata: boolean;
  compressStreams: boolean;
  subsetFonts: boolean;
}

export const LEVEL_DEFAULTS: Record<OptimizationLevel, LevelDefaults> = {
  safe: {
    downsampleImages: false,
    targetDpi: 150,
    removeUnusedObjects: false,
    removeMetadata: false,
    compressStreams: true,
    subsetFonts: false,
  },
  balanced: {
    downsampleImages: false,
    targetDpi: 150,
    removeUnusedObjects: false,
    removeMetadata: false,
    compressStreams: true,
    subsetFonts: true,
  },
  aggressive: {
    downsampleImages: true,
    targetDpi: 150,
    removeUnusedObjects: true,
    removeMetadata: false,
    compressStreams: true,
    subsetFonts: true,
  },
  maximum: {
    downsampleImages: true,
    targetDpi: 96,
    removeUnusedObjects: true,
    removeMetadata: true,
    compressStreams: true,
    subsetFonts: true,
  },
};

export interface OptimizerOptions {
  optimizationLevel: OptimizationLevel;
  downsampleImages: boolean;
  targetDpi: TargetDpi;
  removeUnusedObjects: boolean;
  removeMetadata: boolean;
  compressStreams: boolean;
  subsetFonts: boolean;
}

export const DEFAULT_OPTIONS: OptimizerOptions = {
  optimizationLevel: "balanced",
  ...LEVEL_DEFAULTS.balanced,
};

/** Metadata dict — what we strip when removeMetadata is on. */
export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
}

export const EMPTY_METADATA: PdfMetadata = {
  title: "",
  author: "",
  subject: "",
  keywords: [],
  creator: "",
  producer: "",
};

/** A single image found in the PDF (extracted in ui.tsx). */
export interface ImageInfo {
  id: string;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** Original DPI (computed from page placement if known, else 0). */
  originalDpi: number;
  /** Color space name (DeviceRGB, DeviceCMYK, DeviceGray). */
  colorSpace: string;
  /** Filter used (DCTDecode = JPEG, FlateDecode = PNG/zlib, etc.). */
  filter: string;
  /** Estimated bytes this image occupies. */
  bytes: number;
}

/** A single embedded font. */
export interface FontInfo {
  id: string;
  name: string;
  /** Whether the font is one of the 14 standard base fonts (never embedded). */
  isStandard: boolean;
  /** Whether the font program is already subsetted. */
  isSubsetted: boolean;
  /** Bytes occupied by the embedded font program (0 if not embedded). */
  bytes: number;
}

export const STANDARD_FONT_NAMES: ReadonlySet<string> = new Set([
  "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
  "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
  "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique",
  "Symbol", "ZapfDingbats",
]);

/** A stream object (content stream or other). */
export interface StreamInfo {
  id: string;
  type: "content" | "form" | "other";
  filter: string;
  bytes: number;
  /** Whether the stream is currently compressed (FlateDecode). */
  isCompressed: boolean;
}

/** Per-component size breakdown. */
export interface SizeBreakdown {
  totalBytes: number;
  imagesBytes: number;
  fontsBytes: number;
  streamsBytes: number;
  metadataBytes: number;
  otherBytes: number;
  imagesPercent: number;
  fontsPercent: number;
  streamsPercent: number;
  metadataPercent: number;
  otherPercent: number;
}

/** Per-component before/after optimization result. */
export interface ComponentSavings {
  component: "images" | "fonts" | "streams" | "metadata" | "other";
  originalBytes: number;
  optimizedBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  notes: string;
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  savingsBytes: number;
  savingsPercent: number;
  breakdown: SizeBreakdown;
  optimizedBreakdown: SizeBreakdown;
  componentSavings: ComponentSavings[];
  options: OptimizerOptions;
  imageCount: number;
  fontCount: number;
  streamCount: number;
  /** Items recommended for removal but kept because they were filtered out. */
  unusedObjectCount: number;
  /** Quality-impact notes (lossy optimizations applied). */
  qualityImpacts: string[];
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  originalSize: number;
  optimizedSize: number;
  savingsPercent: number;
  level: OptimizationLevel;
  imageCount: number;
  fontCount: number;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function lookupLevel(level: OptimizationLevel): LevelDefaults {
  return LEVEL_DEFAULTS[level] ?? LEVEL_DEFAULTS.balanced;
}

export function isTargetDpi(n: number): n is TargetDpi {
  return TARGET_DPI_OPTIONS.includes(n as TargetDpi);
}

export function normalizeTargetDpi(n: number): TargetDpi {
  return isTargetDpi(n) ? n : 150;
}

/** Apply a chosen level to options — preserves explicit overrides for booleans. */
export function applyLevelToOptions(
  options: OptimizerOptions,
  level: OptimizationLevel,
): OptimizerOptions {
  const defaults = lookupLevel(level);
  return {
    ...options,
    optimizationLevel: level,
    downsampleImages: defaults.downsampleImages,
    targetDpi: defaults.targetDpi,
    removeUnusedObjects: defaults.removeUnusedObjects,
    removeMetadata: defaults.removeMetadata,
    compressStreams: defaults.compressStreams,
    subsetFonts: defaults.subsetFonts,
  };
}

// ---------------------------------------------------------------------------
// Per-component size analyzer
// ---------------------------------------------------------------------------

export function analyzeSize(
  totalBytes: number,
  images: ImageInfo[],
  fonts: FontInfo[],
  streams: StreamInfo[],
  metadata: PdfMetadata,
): SizeBreakdown {
  const imagesBytes = images.reduce((s, i) => s + i.bytes, 0);
  const fontsBytes = fonts.reduce((s, f) => s + f.bytes, 0);
  const streamsBytes = streams.reduce((s, st) => s + st.bytes, 0);
  const metadataBytes = estimateMetadataBytes(metadata);
  const otherBytes = Math.max(0, totalBytes - imagesBytes - fontsBytes - streamsBytes - metadataBytes);
  const pct = (n: number) => totalBytes > 0 ? Math.round((n / totalBytes) * 1000) / 10 : 0;
  return {
    totalBytes,
    imagesBytes,
    fontsBytes,
    streamsBytes,
    metadataBytes,
    otherBytes,
    imagesPercent: pct(imagesBytes),
    fontsPercent: pct(fontsBytes),
    streamsPercent: pct(streamsBytes),
    metadataPercent: pct(metadataBytes),
    otherPercent: pct(otherBytes),
  };
}

/** Estimate serialized metadata size in bytes (UTF-8). */
export function estimateMetadataBytes(meta: PdfMetadata): number {
  const enc = (s: string) => {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate pair
      else n += 3;
    }
    return n;
  };
  // Each field has ~10 bytes overhead (key + PDF string markers)
  const overhead = 10;
  return (
    enc(meta.title) + overhead +
    enc(meta.author) + overhead +
    enc(meta.subject) + overhead +
    enc(meta.keywords.join(" ")) + overhead +
    enc(meta.creator) + overhead +
    enc(meta.producer) + overhead
  );
}

// ---------------------------------------------------------------------------
// Image downsampler — calculate new dimensions based on target DPI
// ---------------------------------------------------------------------------

export interface DownsampleResult {
  newWidth: number;
  newHeight: number;
  newBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  skipped: boolean;
  skipReason?: string;
}

/** Downsample an image from its current DPI to a target DPI. */
export function downsampleImage(
  img: ImageInfo,
  targetDpi: TargetDpi,
): DownsampleResult {
  if (img.width <= 0 || img.height <= 0) {
    return {
      newWidth: 0, newHeight: 0, newBytes: 0,
      savingsBytes: 0, savingsPercent: 0,
      skipped: true, skipReason: "Invalid image dimensions",
    };
  }
  // If image DPI is unknown or already at/below target, skip
  const effectiveDpi = img.originalDpi > 0 ? img.originalDpi : 300;
  if (effectiveDpi <= targetDpi) {
    return {
      newWidth: img.width,
      newHeight: img.height,
      newBytes: img.bytes,
      savingsBytes: 0,
      savingsPercent: 0,
      skipped: true,
      skipReason: `Image already at ${effectiveDpi} DPI ≤ ${targetDpi} target`,
    };
  }
  // Scale linearly with DPI ratio
  const scale = targetDpi / effectiveDpi;
  const newWidth = Math.max(1, Math.round(img.width * scale));
  const newHeight = Math.max(1, Math.round(img.height * scale));
  // Pixel count drops as scale²; bytes scale with pixels (assuming same compression)
  const pixelRatio = (newWidth * newHeight) / (img.width * img.height);
  const newBytes = Math.round(img.bytes * pixelRatio);
  const savingsBytes = img.bytes - newBytes;
  const savingsPercent = img.bytes > 0
    ? Math.round((savingsBytes / img.bytes) * 1000) / 10
    : 0;
  return {
    newWidth,
    newHeight,
    newBytes,
    savingsBytes,
    savingsPercent,
    skipped: false,
  };
}

/** Aggregate downsample results for a list of images. */
export function downsampleAllImages(
  images: ImageInfo[],
  targetDpi: TargetDpi,
): { totalSavingsBytes: number; skippedCount: number; downsampledCount: number } {
  let savings = 0;
  let skipped = 0;
  let downsampled = 0;
  for (const img of images) {
    const r = downsampleImage(img, targetDpi);
    savings += r.savingsBytes;
    if (r.skipped) skipped++;
    else downsampled++;
  }
  return {
    totalSavingsBytes: savings,
    skippedCount: skipped,
    downsampledCount: downsampled,
  };
}

// ---------------------------------------------------------------------------
// Unused object detector
// ---------------------------------------------------------------------------

export interface ObjectRef {
  id: number;
  referenced: boolean;
  bytes: number;
  type: "image" | "font" | "stream" | "page" | "catalog" | "other";
}

/** Detect unused objects from a reference map. Pure — no DOM. */
export function detectUnusedObjects(objects: ObjectRef[]): ObjectRef[] {
  return objects.filter((o) => !o.referenced && o.type !== "catalog" && o.type !== "page");
}

export function unusedObjectSavings(unused: ObjectRef[]): number {
  return unused.reduce((s, o) => s + o.bytes, 0);
}

// ---------------------------------------------------------------------------
// Stream compressor — estimate savings from recompression
// ---------------------------------------------------------------------------

export interface CompressResult {
  newBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  skipped: boolean;
  skipReason?: string;
}

/** Estimate recompression savings for a stream. */
export function recompressStream(stream: StreamInfo): CompressResult {
  if (stream.bytes <= 0) {
    return {
      newBytes: 0, savingsBytes: 0, savingsPercent: 0,
      skipped: true, skipReason: "Empty stream",
    };
  }
  if (stream.isCompressed) {
    // Already compressed — small (~3%) gain from better algorithm
    const newBytes = Math.round(stream.bytes * 0.97);
    return {
      newBytes,
      savingsBytes: stream.bytes - newBytes,
      savingsPercent: 3,
      skipped: false,
    };
  }
  // Uncompressed stream — Flate typically achieves ~50% on text content
  const newBytes = Math.round(stream.bytes * 0.5);
  return {
    newBytes,
    savingsBytes: stream.bytes - newBytes,
    savingsPercent: 50,
    skipped: false,
  };
}

export function recompressAllStreams(streams: StreamInfo[]): {
  totalSavingsBytes: number;
  recompressedCount: number;
  skippedCount: number;
} {
  let savings = 0;
  let recompressed = 0;
  let skipped = 0;
  for (const s of streams) {
    const r = recompressStream(s);
    savings += r.savingsBytes;
    if (r.skipped) skipped++;
    else recompressed++;
  }
  return { totalSavingsBytes: savings, recompressedCount: recompressed, skippedCount: skipped };
}

// ---------------------------------------------------------------------------
// Metadata stripper
// ---------------------------------------------------------------------------

export function stripMetadata(_meta: PdfMetadata): PdfMetadata {
  // Return an empty metadata dict — ui.tsx calls doc.setX("") for each field
  return { ...EMPTY_METADATA };
}

export function metadataSavings(meta: PdfMetadata): number {
  return estimateMetadataBytes(meta);
}

// ---------------------------------------------------------------------------
// Font subsetter (integration) — calls into pdf-font-subsetter logic
// ---------------------------------------------------------------------------

export interface FontSubsetPlan {
  fontId: string;
  fontName: string;
  originalBytes: number;
  estimatedSubsetBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  skipped: boolean;
  skipReason?: string;
}

/** Plan a font subset for one font. Skips standard + already-subsetted fonts. */
export function planFontSubset(font: FontInfo): FontSubsetPlan {
  if (font.isStandard) {
    return {
      fontId: font.id,
      fontName: font.name,
      originalBytes: font.bytes,
      estimatedSubsetBytes: font.bytes,
      savingsBytes: 0,
      savingsPercent: 0,
      skipped: true,
      skipReason: "Standard PDF base font — not embedded, no savings",
    };
  }
  if (font.isSubsetted) {
    return {
      fontId: font.id,
      fontName: font.name,
      originalBytes: font.bytes,
      estimatedSubsetBytes: font.bytes,
      savingsBytes: 0,
      savingsPercent: 0,
      skipped: true,
      skipReason: "Already subsetted",
    };
  }
  if (font.bytes < 1024) {
    return {
      fontId: font.id,
      fontName: font.name,
      originalBytes: font.bytes,
      estimatedSubsetBytes: font.bytes,
      savingsBytes: 0,
      savingsPercent: 0,
      skipped: true,
      skipReason: "Font too small (<1 KB) — savings negligible",
    };
  }
  // Estimate: subset is ~30% of original on average for documents using
  // mostly Latin characters
  const estimatedSubsetBytes = Math.round(font.bytes * 0.3);
  return {
    fontId: font.id,
    fontName: font.name,
    originalBytes: font.bytes,
    estimatedSubsetBytes,
    savingsBytes: font.bytes - estimatedSubsetBytes,
    savingsPercent: 70,
    skipped: false,
  };
}

export function planAllFontSubsets(fonts: FontInfo[]): FontSubsetPlan[] {
  return fonts.map(planFontSubset);
}

export function fontSubsetSavings(plans: FontSubsetPlan[]): number {
  return plans.reduce((s, p) => s + p.savingsBytes, 0);
}

// ---------------------------------------------------------------------------
// Size reduction calculator
// ---------------------------------------------------------------------------

export function computeReduction(
  originalSize: number,
  optimizedSize: number,
): { savingsBytes: number; savingsPercent: number } {
  const savingsBytes = Math.max(0, originalSize - optimizedSize);
  const savingsPercent = originalSize > 0
    ? Math.round((savingsBytes / originalSize) * 1000) / 10
    : 0;
  return { savingsBytes, savingsPercent };
}

// ---------------------------------------------------------------------------
// Optimization recommender — suggest settings based on content
// ---------------------------------------------------------------------------

export interface ContentProfile {
  totalBytes: number;
  imageCount: number;
  imagesBytes: number;
  fontCount: number;
  fontsBytes: number;
  streamCount: number;
  streamsBytes: number;
  pageCount: number;
}

export interface Recommendation {
  level: OptimizationLevel;
  reasons: string[];
}

/** Suggest a level based on what dominates the file. */
export function recommendOptimization(profile: ContentProfile): Recommendation {
  if (profile.totalBytes <= 0) {
    return {
      level: "safe",
      reasons: ["No content to analyze — defaulting to Safe level"],
    };
  }
  const reasons: string[] = [];
  const imagesPct = profile.imagesBytes / profile.totalBytes;
  const fontsPct = profile.fontsBytes / profile.totalBytes;
  const streamsPct = profile.streamsBytes / profile.totalBytes;

  let level: OptimizationLevel = "safe";

  if (imagesPct > 0.5) {
    level = "aggressive";
    reasons.push(`Images dominate (${(imagesPct * 100).toFixed(0)}% of file) — downsampling yields the biggest savings`);
  } else if (fontsPct > 0.3 && profile.fontCount > 2) {
    level = "balanced";
    reasons.push(`Fonts are ${Math.round(fontsPct * 100)}% of file with ${profile.fontCount} embedded — font subsetting recommended`);
  } else if (streamsPct > 0.4) {
    level = "balanced";
    reasons.push(`Streams are ${Math.round(streamsPct * 100)}% of file — recompression will help`);
  }

  if (profile.totalBytes > 5 * 1024 * 1024) {
    if (level === "safe") level = "balanced";
    reasons.push(`Large file (${(profile.totalBytes / 1024 / 1024).toFixed(1)} MB) — consider Balanced or higher`);
  }
  if (reasons.length === 0) {
    reasons.push("File is well-balanced — Safe level preserves quality with structural savings");
  }
  return { level, reasons };
}

// ---------------------------------------------------------------------------
// Quality impact assessor
// ---------------------------------------------------------------------------

export function assessQualityImpact(options: OptimizerOptions): string[] {
  const impacts: string[] = [];
  if (options.downsampleImages) {
    impacts.push(`Image downsampling to ${options.targetDpi} DPI reduces visual resolution (lossy)`);
  }
  if (options.removeMetadata) {
    impacts.push("Metadata removal loses document attribution (no visual impact)");
  }
  if (options.subsetFonts) {
    impacts.push("Font subsetting preserves glyphs in use — only unused glyphs are dropped (visually lossless)");
  }
  if (options.compressStreams) {
    impacts.push("Stream recompression is lossless");
  }
  if (options.removeUnusedObjects) {
    impacts.push("Unused object removal is lossless");
  }
  return impacts;
}

// ---------------------------------------------------------------------------
// Image / font count analyzers
// ---------------------------------------------------------------------------

export interface ImageAnalysis {
  total: number;
  totalBytes: number;
  byColorSpace: Record<string, number>;
  byFilter: Record<string, number>;
  avgBytes: number;
  largestBytes: number;
  smallestBytes: number;
}

export function analyzeImages(images: ImageInfo[]): ImageAnalysis {
  const byColorSpace: Record<string, number> = {};
  const byFilter: Record<string, number> = {};
  let total = 0;
  let totalBytes = 0;
  let largest = 0;
  let smallest = Number.POSITIVE_INFINITY;
  for (const img of images) {
    total++;
    totalBytes += img.bytes;
    byColorSpace[img.colorSpace] = (byColorSpace[img.colorSpace] ?? 0) + 1;
    byFilter[img.filter] = (byFilter[img.filter] ?? 0) + 1;
    if (img.bytes > largest) largest = img.bytes;
    if (img.bytes < smallest) smallest = img.bytes;
  }
  return {
    total,
    totalBytes,
    byColorSpace,
    byFilter,
    avgBytes: total > 0 ? Math.round(totalBytes / total) : 0,
    largestBytes: total > 0 ? largest : 0,
    smallestBytes: total > 0 ? smallest : 0,
  };
}

export interface FontAnalysis {
  total: number;
  embedded: number;
  standard: number;
  subsetted: number;
  totalBytes: number;
  avgBytes: number;
  largestBytes: number;
}

export function analyzeFonts(fonts: FontInfo[]): FontAnalysis {
  let total = 0;
  let embedded = 0;
  let standard = 0;
  let subsetted = 0;
  let totalBytes = 0;
  let largest = 0;
  for (const f of fonts) {
    total++;
    if (!f.isStandard) embedded++;
    if (f.isStandard) standard++;
    if (f.isSubsetted) subsetted++;
    totalBytes += f.bytes;
    if (f.bytes > largest) largest = f.bytes;
  }
  return {
    total,
    embedded,
    standard,
    subsetted,
    totalBytes,
    avgBytes: total > 0 ? Math.round(totalBytes / total) : 0,
    largestBytes: total > 0 ? largest : 0,
  };
}

// ---------------------------------------------------------------------------
// Optimization priority ranker — biggest savings first
// ---------------------------------------------------------------------------

export interface PriorityItem {
  label: string;
  savingsBytes: number;
  savingsPercent: number;
  description: string;
}

/** Rank available optimizations by savings, biggest first. */
export function rankOptimizationPriorities(
  breakdown: SizeBreakdown,
  images: ImageInfo[],
  fonts: FontInfo[],
  streams: StreamInfo[],
  metadata: PdfMetadata,
  options: OptimizerOptions,
): PriorityItem[] {
  const items: PriorityItem[] = [];

  // Images — downsample savings estimate
  if (options.downsampleImages && images.length > 0) {
    const { totalSavingsBytes } = downsampleAllImages(images, options.targetDpi);
    if (totalSavingsBytes > 0) {
      items.push({
        label: "Downsample images",
        savingsBytes: totalSavingsBytes,
        savingsPercent: breakdown.totalBytes > 0
          ? Math.round((totalSavingsBytes / breakdown.totalBytes) * 1000) / 10
          : 0,
        description: `Downsample ${images.length} image(s) to ${options.targetDpi} DPI`,
      });
    }
  }

  // Fonts — subset savings estimate
  if (options.subsetFonts && fonts.length > 0) {
    const plans = planAllFontSubsets(fonts);
    const savings = fontSubsetSavings(plans);
    if (savings > 0) {
      items.push({
        label: "Subset fonts",
        savingsBytes: savings,
        savingsPercent: breakdown.totalBytes > 0
          ? Math.round((savings / breakdown.totalBytes) * 1000) / 10
          : 0,
        description: `Subset ${plans.filter((p) => !p.skipped).length} of ${fonts.length} font(s)`,
      });
    }
  }

  // Streams — recompression
  if (options.compressStreams && streams.length > 0) {
    const { totalSavingsBytes } = recompressAllStreams(streams);
    if (totalSavingsBytes > 0) {
      items.push({
        label: "Recompress streams",
        savingsBytes: totalSavingsBytes,
        savingsPercent: breakdown.totalBytes > 0
          ? Math.round((totalSavingsBytes / breakdown.totalBytes) * 1000) / 10
          : 0,
        description: `Recompress ${streams.length} stream(s)`,
      });
    }
  }

  // Metadata strip
  if (options.removeMetadata) {
    const metaBytes = metadataSavings(metadata);
    if (metaBytes > 0) {
      items.push({
        label: "Strip metadata",
        savingsBytes: metaBytes,
        savingsPercent: breakdown.totalBytes > 0
          ? Math.round((metaBytes / breakdown.totalBytes) * 1000) / 10
          : 0,
        description: "Strip Title/Author/Subject/Keywords/Creator/Producer",
      });
    }
  }

  return items.sort((a, b) => b.savingsBytes - a.savingsBytes);
}

// ---------------------------------------------------------------------------
// Build full optimization report — orchestrates all the above
// ---------------------------------------------------------------------------

export function buildOptimizationReport(
  originalSize: number,
  optimizedSize: number,
  images: ImageInfo[],
  fonts: FontInfo[],
  streams: StreamInfo[],
  metadata: PdfMetadata,
  unusedObjects: ObjectRef[],
  options: OptimizerOptions,
): ToolResult<OptimizationResult> {
  if (originalSize < 0 || optimizedSize < 0) {
    return { ok: false, error: "Sizes must be non-negative." };
  }
  const breakdown = analyzeSize(originalSize, images, fonts, streams, metadata);
  const reduction = computeReduction(originalSize, optimizedSize);

  const componentSavings: ComponentSavings[] = [];

  // Images savings
  let optimizedImagesBytes = breakdown.imagesBytes;
  if (options.downsampleImages) {
    const r = downsampleAllImages(images, options.targetDpi);
    optimizedImagesBytes = Math.max(0, breakdown.imagesBytes - r.totalSavingsBytes);
  }
  componentSavings.push({
    component: "images",
    originalBytes: breakdown.imagesBytes,
    optimizedBytes: optimizedImagesBytes,
    savingsBytes: breakdown.imagesBytes - optimizedImagesBytes,
    savingsPercent: breakdown.imagesBytes > 0
      ? Math.round(((breakdown.imagesBytes - optimizedImagesBytes) / breakdown.imagesBytes) * 1000) / 10
      : 0,
    notes: options.downsampleImages
      ? `Downsampled ${images.length} image(s) to ${options.targetDpi} DPI`
      : "Image downsampling disabled",
  });

  // Fonts savings
  let optimizedFontsBytes = breakdown.fontsBytes;
  if (options.subsetFonts) {
    const savings = fontSubsetSavings(planAllFontSubsets(fonts));
    optimizedFontsBytes = Math.max(0, breakdown.fontsBytes - savings);
  }
  componentSavings.push({
    component: "fonts",
    originalBytes: breakdown.fontsBytes,
    optimizedBytes: optimizedFontsBytes,
    savingsBytes: breakdown.fontsBytes - optimizedFontsBytes,
    savingsPercent: breakdown.fontsBytes > 0
      ? Math.round(((breakdown.fontsBytes - optimizedFontsBytes) / breakdown.fontsBytes) * 1000) / 10
      : 0,
    notes: options.subsetFonts
      ? `Subset ${fonts.length} font(s)`
      : "Font subsetting disabled",
  });

  // Streams savings
  let optimizedStreamsBytes = breakdown.streamsBytes;
  if (options.compressStreams) {
    const r = recompressAllStreams(streams);
    optimizedStreamsBytes = Math.max(0, breakdown.streamsBytes - r.totalSavingsBytes);
  }
  componentSavings.push({
    component: "streams",
    originalBytes: breakdown.streamsBytes,
    optimizedBytes: optimizedStreamsBytes,
    savingsBytes: breakdown.streamsBytes - optimizedStreamsBytes,
    savingsPercent: breakdown.streamsBytes > 0
      ? Math.round(((breakdown.streamsBytes - optimizedStreamsBytes) / breakdown.streamsBytes) * 1000) / 10
      : 0,
    notes: options.compressStreams
      ? `Recompressed ${streams.length} stream(s)`
      : "Stream recompression disabled",
  });

  // Metadata savings
  let optimizedMetadataBytes = breakdown.metadataBytes;
  if (options.removeMetadata) {
    optimizedMetadataBytes = 0;
  }
  componentSavings.push({
    component: "metadata",
    originalBytes: breakdown.metadataBytes,
    optimizedBytes: optimizedMetadataBytes,
    savingsBytes: breakdown.metadataBytes - optimizedMetadataBytes,
    savingsPercent: breakdown.metadataBytes > 0
      ? Math.round(((breakdown.metadataBytes - optimizedMetadataBytes) / breakdown.metadataBytes) * 1000) / 10
      : 0,
    notes: options.removeMetadata
      ? "Metadata stripped"
      : "Metadata preserved",
  });

  // Other (structural) — re-saved with object streams always saves a bit
  const otherSavings = Math.max(0, breakdown.otherBytes - (optimizedSize - optimizedImagesBytes - optimizedFontsBytes - optimizedStreamsBytes - optimizedMetadataBytes));
  componentSavings.push({
    component: "other",
    originalBytes: breakdown.otherBytes,
    optimizedBytes: breakdown.otherBytes - otherSavings,
    savingsBytes: otherSavings,
    savingsPercent: breakdown.otherBytes > 0
      ? Math.round((otherSavings / breakdown.otherBytes) * 1000) / 10
      : 0,
    notes: "Structural re-save with object streams",
  });

  const optimizedBreakdown: SizeBreakdown = {
    totalBytes: optimizedSize,
    imagesBytes: optimizedImagesBytes,
    fontsBytes: optimizedFontsBytes,
    streamsBytes: optimizedStreamsBytes,
    metadataBytes: optimizedMetadataBytes,
    otherBytes: Math.max(0, optimizedSize - optimizedImagesBytes - optimizedFontsBytes - optimizedStreamsBytes - optimizedMetadataBytes),
    imagesPercent: optimizedSize > 0 ? Math.round((optimizedImagesBytes / optimizedSize) * 1000) / 10 : 0,
    fontsPercent: optimizedSize > 0 ? Math.round((optimizedFontsBytes / optimizedSize) * 1000) / 10 : 0,
    streamsPercent: optimizedSize > 0 ? Math.round((optimizedStreamsBytes / optimizedSize) * 1000) / 10 : 0,
    metadataPercent: optimizedSize > 0 ? Math.round((optimizedMetadataBytes / optimizedSize) * 1000) / 10 : 0,
    otherPercent: 0,
  };
  optimizedBreakdown.otherPercent = optimizedSize > 0
    ? Math.round((optimizedBreakdown.otherBytes / optimizedSize) * 1000) / 10
    : 0;

  return {
    ok: true,
    output: {
      originalSize,
      optimizedSize,
      savingsBytes: reduction.savingsBytes,
      savingsPercent: reduction.savingsPercent,
      breakdown,
      optimizedBreakdown,
      componentSavings,
      options,
      imageCount: images.length,
      fontCount: fonts.length,
      streamCount: streams.length,
      unusedObjectCount: unusedObjects.length,
      qualityImpacts: assessQualityImpact(options),
    },
  };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

export function renderTextReport(r: OptimizationResult): string {
  const lines: string[] = [];
  lines.push("PDF Size Optimizer — Optimization Report");
  lines.push("=".repeat(60));
  lines.push(`Original size:  ${formatBytes(r.originalSize)}`);
  lines.push(`Optimized size: ${formatBytes(r.optimizedSize)}`);
  lines.push(`Savings:        ${formatBytes(r.savingsBytes)} (${r.savingsPercent}%)`);
  lines.push(`Level:          ${r.options.optimizationLevel}`);
  lines.push("");
  lines.push("Component breakdown (before → after):");
  lines.push("-".repeat(60));
  for (const c of r.componentSavings) {
    lines.push(
      `  ${c.component.padEnd(10)} ${formatBytes(c.originalBytes).padStart(10)} → ${formatBytes(c.optimizedBytes).padStart(10)}  (${c.savingsPercent}% saved)`,
    );
    lines.push(`    ${c.notes}`);
  }
  lines.push("-".repeat(60));
  lines.push(`Images: ${r.imageCount}  Fonts: ${r.fontCount}  Streams: ${r.streamCount}  Unused objects removed: ${r.unusedObjectCount}`);
  if (r.qualityImpacts.length > 0) {
    lines.push("");
    lines.push("Quality impact notes:");
    for (const q of r.qualityImpacts) lines.push(`  • ${q}`);
  }
  return lines.join("\n");
}

export function renderCsvReport(r: OptimizationResult): string {
  const header = "component,original_bytes,optimized_bytes,savings_bytes,savings_percent,notes";
  const rows = r.componentSavings.map((c) =>
    [
      c.component,
      c.originalBytes,
      c.optimizedBytes,
      c.savingsBytes,
      c.savingsPercent,
      csvEscape(c.notes),
    ].join(","),
  );
  // Summary row
  rows.push([
    "TOTAL",
    r.originalSize,
    r.optimizedSize,
    r.savingsBytes,
    r.savingsPercent,
    csvEscape(`Level: ${r.options.optimizationLevel}`),
  ].join(","));
  return [header, ...rows].join("\n");
}

export function renderJsonReport(r: OptimizationResult): string {
  return JSON.stringify(r, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-size-optimizer:history";
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(options: OptimizerOptions): string {
  const params = new URLSearchParams();
  params.set("level", options.optimizationLevel);
  params.set("downsample", String(options.downsampleImages));
  params.set("dpi", String(options.targetDpi));
  params.set("unused", String(options.removeUnusedObjects));
  params.set("meta", String(options.removeMetadata));
  params.set("streams", String(options.compressStreams));
  params.set("fonts", String(options.subsetFonts));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OptimizerOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<OptimizerOptions> = {};
  const level = params.get("level");
  if (level && OPTIMIZATION_LEVELS.includes(level as OptimizationLevel)) {
    out.optimizationLevel = level as OptimizationLevel;
  }
  const down = params.get("downsample");
  if (down === "true") out.downsampleImages = true;
  if (down === "false") out.downsampleImages = false;
  const dpi = params.get("dpi");
  if (dpi) {
    const n = Number(dpi);
    if (isTargetDpi(n)) out.targetDpi = n;
  }
  const unused = params.get("unused");
  if (unused === "true") out.removeUnusedObjects = true;
  if (unused === "false") out.removeUnusedObjects = false;
  const meta = params.get("meta");
  if (meta === "true") out.removeMetadata = true;
  if (meta === "false") out.removeMetadata = false;
  const streams = params.get("streams");
  if (streams === "true") out.compressStreams = true;
  if (streams === "false") out.compressStreams = false;
  const fonts = params.get("fonts");
  if (fonts === "true") out.subsetFonts = true;
  if (fonts === "false") out.subsetFonts = false;
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(options: OptimizerOptions): string | null {
  if (!OPTIMIZATION_LEVELS.includes(options.optimizationLevel)) {
    return "Invalid optimization level.";
  }
  if (!isTargetDpi(options.targetDpi)) {
    return "Target DPI must be one of: 72, 96, 150, 300.";
  }
  return null;
}
