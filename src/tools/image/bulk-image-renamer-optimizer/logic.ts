/**
 * Bulk Image Renamer + Optimizer — pure logic.
 *
 * Pure helpers (token substitution, conflict detection, perceptual hash,
 * audit CSV, ZIP building, target-size tuning) are unit-tested in
 * `logic.test.ts`. Canvas/DOM operations (processImage, stripExif,
 * computePerceptualHashFromBitmap, getExifData wrapper) are exported here
 * per the tool-module contract but exercised only at runtime via the UI
 * and the Web Worker — vitest's "node" environment has no Canvas.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";
export type CaseMode = "none" | "lower" | "upper" | "kebab" | "snake";
export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export interface RenameRule {
  /** Token template, e.g. "{index}-{original}". Empty means "{original}". */
  pattern: string;
  prefix: string;
  suffix: string;
  /** Counter token {counter} start value. */
  counterStart: number;
  /** Counter increment per index. */
  counterStep: number;
  /** Zero-pad width for {counter}. */
  counterPad: number;
  /** Find string (or regex pattern) for find-replace. */
  find: string;
  /** Replacement for find-replace. */
  replace: string;
  /** Treat `find` as a regex (otherwise literal string). */
  useRegex: boolean;
  caseMode: CaseMode;
  /** Replace spaces with dashes. */
  removeSpaces: boolean;
  /** Strip non-alphanumeric chars (keep dash/underscore/dot). */
  removeSpecialChars: boolean;
}

export interface WatermarkOptions {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  /** 0-1 opacity. */
  opacity: number;
  /** Hex color e.g. #ffffff. */
  color: string;
  /** Font size in px relative to a 1000px reference width. */
  fontSize: number;
}

export interface OptimizeOptions {
  format: OutputFormat;
  /** 0-1 quality (ignored for PNG). */
  quality: number;
  /** Optional max dimension; image downscaled preserving aspect ratio. */
  maxDimension?: number;
  /** If set, quality is auto-tuned to hit this byte target. */
  targetBytes?: number;
  /** Strip EXIF (always true for Canvas re-encode; flag kept for clarity). */
  stripExif: boolean;
  /** Use progressive JPEG encoding (only applies to JPEG output). */
  progressive: boolean;
  watermark: WatermarkOptions;
}

export interface TokenContext {
  width?: number;
  height?: number;
  /** ISO date string from EXIF DateTimeOriginal. */
  exifDate?: string;
  /** ISO date string from file.lastModified. */
  fileDate?: string;
  /** Original basename (no extension) — usually populated by the caller. */
  original?: string;
}

export interface RenameOptimizeConfig {
  rule: RenameRule;
  optimize: OptimizeOptions;
  /** Preserve source folder structure in the output ZIP. */
  preserveFolderStructure: boolean;
  /** Optional base folder prepended to every output path in the ZIP. */
  outputFolder: string;
}

export interface ExifData {
  date?: string;
  width?: number;
  height?: number;
  make?: string;
  model?: string;
  orientation?: number;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  gps?: { latitude?: number; longitude?: number };
  raw?: Record<string, unknown>;
}

export interface ProcessedFile {
  originalName: string;
  newName: string;
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  newSize: number;
}

export interface PreviewRow {
  index: number;
  originalName: string;
  originalSize: number;
  newName: string;
  newSize: number;
  width?: number;
  height?: number;
  conflict: boolean;
  autoSuffixed: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCEPTED_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
] as const;

export const SUPPORTED_OUTPUT_FORMATS: OutputFormat[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Memory cap (~256 MB) for in-flight processed blobs. */
export const MEMORY_CAP_BYTES = 256 * 1024 * 1024;

/** Default rename+optimize config used by the UI and tests. */
export const DEFAULT_CONFIG: RenameOptimizeConfig = {
  rule: {
    pattern: "{index}-{original}",
    prefix: "",
    suffix: "",
    counterStart: 1,
    counterStep: 1,
    counterPad: 3,
    find: "",
    replace: "",
    useRegex: false,
    caseMode: "none",
    removeSpaces: false,
    removeSpecialChars: false,
  },
  optimize: {
    format: "image/jpeg",
    quality: 0.8,
    maxDimension: undefined,
    targetBytes: undefined,
    stripExif: true,
    progressive: false,
    watermark: {
      enabled: false,
      text: "© Your Name",
      position: "bottom-right",
      opacity: 0.5,
      color: "#ffffff",
      fontSize: 24,
    },
  },
  preserveFolderStructure: false,
  outputFolder: "",
};

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/** Split filename into { base, ext } where ext includes the leading dot. */
export function splitExt(filename: string): { base: string; ext: string } {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const leaf = slash >= 0 ? filename.slice(slash + 1) : filename;
  const dot = leaf.lastIndexOf(".");
  if (dot <= 0) return { base: leaf, ext: "" };
  return { base: leaf.slice(0, dot), ext: leaf.slice(dot) };
}

/** Detect output MIME from file extension or input MIME. */
export function detectInputFormat(
  filename: string,
  mime: string,
): OutputFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || mime === "image/jpeg")
    return "image/jpeg";
  if (lower.endsWith(".png") || mime === "image/png") return "image/png";
  if (lower.endsWith(".webp") || mime === "image/webp") return "image/webp";
  return null;
}

/** Build the file extension (with dot) for an output format. */
export function buildOutputExtension(format: OutputFormat): string {
  return format === "image/jpeg" ? ".jpg" : format === "image/png" ? ".png" : ".webp";
}

// ---------------------------------------------------------------------------
// Token substitution + rename pattern
// ---------------------------------------------------------------------------

/** Apply a case transform to a name (does not touch the extension dot). */
export function applyCaseTransform(name: string, mode: CaseMode): string {
  switch (mode) {
    case "none":
      return name;
    case "lower":
      return name.toLowerCase();
    case "upper":
      return name.toUpperCase();
    case "kebab":
      return name
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    case "snake":
      return name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase();
  }
}

/** Apply find-replace (literal or regex). Returns ToolResult to surface regex errors. */
export function applyFindReplace(
  name: string,
  find: string,
  replace: string,
  useRegex: boolean,
): ToolResult<string> {
  if (!find) return { ok: true, output: name };
  if (useRegex) {
    try {
      // wrap in try/catch because invalid regex throws
      const re = new RegExp(find, "g");
      return { ok: true, output: name.replace(re, replace) };
    } catch (e) {
      return { ok: false, error: `Invalid regex "${find}": ${(e as Error).message}` };
    }
  }
  // literal global replace
  return { ok: true, output: name.split(find).join(replace) };
}

/** Replace spaces with dashes. */
export function removeSpaces(name: string): string {
  return name.replace(/\s+/g, "-");
}

/** Strip non-alphanumeric chars (keep a-z, 0-9, dash, underscore, dot). */
export function removeSpecialChars(name: string, keepExt: boolean): string {
  if (keepExt) {
    const { base, ext } = splitExt(name);
    return `${base.replace(/[^a-zA-Z0-9_-]/g, "")}${ext}`;
  }
  return name.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Pad a number with leading zeros to a given width. */
export function padNumber(n: number, width: number): string {
  const s = String(Math.trunc(n));
  return width > 0 ? s.padStart(width, "0") : s;
}

/**
 * Substitute tokens inside a pattern string.
 * Supported tokens:
 *   {index}        — 1-based position (index + 1)
 *   {counter}      — counterStart + index * counterStep, zero-padded to counterPad
 *   {original}     — ctx.original (already case/find-replace-transformed)
 *   {date}         — ctx.fileDate (YYYY-MM-DD), falls back to "undated"
 *   {exif:date}    — ctx.exifDate (YYYY-MM-DD), falls back to {date}
 *   {width}        — ctx.width
 *   {height}       — ctx.height
 *   {width}x{height} — e.g. "1920x1080" (composed from the two tokens)
 */
export function applyTokens(
  pattern: string,
  index: number,
  ctx: TokenContext,
  rule: RenameRule,
): string {
  const counter = rule.counterStart + index * rule.counterStep;
  const fileDate = ctx.fileDate ? ctx.fileDate.slice(0, 10) : "undated";
  const exifDate = ctx.exifDate ? ctx.exifDate.slice(0, 10) : fileDate;
  const width = ctx.width != null ? String(ctx.width) : "0";
  const height = ctx.height != null ? String(ctx.height) : "0";

  return pattern
    .replace(/\{index\}/g, String(index + 1))
    .replace(/\{counter\}/g, padNumber(counter, rule.counterPad))
    .replace(/\{original\}/g, ctx.original ?? "")
    .replace(/\{exif:date\}/g, exifDate)
    .replace(/\{date\}/g, fileDate)
    .replace(/\{width\}/g, width)
    .replace(/\{height\}/g, height);
}

/**
 * Apply the full rename rule to an original filename.
 *
 * Order of operations:
 *   1. Split into base + ext.
 *   2. find-replace on base.
 *   3. case transform on base.
 *   4. removeSpaces / removeSpecialChars on base.
 *   5. Token-substitute the pattern (default "{original}").
 *   6. Prepend prefix, append suffix.
 *   7. Append the (possibly format-changed) extension.
 */
export function applyRenamePattern(
  originalName: string,
  index: number,
  rule: RenameRule,
  ctx: TokenContext = {},
  outputFormat?: OutputFormat,
): ToolResult<string> {
  const { base, ext } = splitExt(originalName);

  // 1-2. find-replace
  const fr = applyFindReplace(base, rule.find, rule.replace, rule.useRegex);
  if (!fr.ok) return fr;
  let working = fr.output;

  // 3. case
  working = applyCaseTransform(working, rule.caseMode);

  // 4. spaces / special chars
  if (rule.removeSpaces) working = removeSpaces(working);
  if (rule.removeSpecialChars) working = working.replace(/[^a-zA-Z0-9_-]/g, "");

  // 5. tokens
  const pattern = rule.pattern && rule.pattern.length > 0 ? rule.pattern : "{original}";
  const ctxWithOriginal: TokenContext = { ...ctx, original: working };
  let expanded = applyTokens(pattern, index, ctxWithOriginal, rule);

  // 6. prefix + suffix
  expanded = `${rule.prefix}${expanded}${rule.suffix}`;

  // 7. extension
  const outExt = outputFormat ? buildOutputExtension(outputFormat) : ext;
  return { ok: true, output: `${expanded}${outExt}` };
}

// ---------------------------------------------------------------------------
// Conflict detection + resolution
// ---------------------------------------------------------------------------

/**
 * Detect duplicate output names. Returns a Map<name, indices[]>.
 * Only names that appear more than once are included.
 */
export function detectConflicts(names: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i < names.length; i++) {
    const n = names[i]!;
    const arr = map.get(n);
    if (arr) arr.push(i);
    else map.set(n, [i]);
  }
  // prune unique names
  for (const [k, v] of map) {
    if (v.length < 2) map.delete(k);
  }
  return map;
}

/**
 * Resolve duplicate names by appending an incrementing suffix to all but
 * the first occurrence. e.g. ["a.jpg","a.jpg","a.jpg"] → ["a.jpg","a-1.jpg","a-2.jpg"].
 * If "a-1.jpg" already exists, picks the next free slot.
 */
export function resolveConflicts(
  names: string[],
  conflicts: Map<string, number[]> = detectConflicts(names),
): string[] {
  const out = names.slice();
  const taken = new Set(names);
  for (const [, indices] of conflicts) {
    // first occurrence keeps the original name
    for (let k = 1; k < indices.length; k++) {
      const idx = indices[k]!;
      const original = out[idx]!;
      const { base, ext } = splitExt(original);
      let n = 1;
      let candidate = `${base}-${n}${ext}`;
      while (taken.has(candidate)) {
        n++;
        candidate = `${base}-${n}${ext}`;
      }
      taken.add(candidate);
      out[idx] = candidate;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Optimize helpers (pure)
// ---------------------------------------------------------------------------

/** Compute new dimensions preserving aspect ratio if maxDimension is set. */
export function computeResizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension?: number,
): { width: number; height: number } {
  if (!maxDimension || maxDimension <= 0) {
    return { width: originalWidth, height: originalHeight };
  }
  const longest = Math.max(originalWidth, originalHeight);
  if (longest <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

/** Compute the effective width/height/quality/format for a given image + options. */
export function computeOptimizeOptions(
  dims: { width: number; height: number },
  opts: OptimizeOptions,
): { width: number; height: number; quality: number; format: OutputFormat } {
  const { width, height } = computeResizedDimensions(
    dims.width,
    dims.height,
    opts.maxDimension,
  );
  return {
    width,
    height,
    quality: opts.format === "image/png" ? 1 : opts.quality,
    format: opts.format,
  };
}

/**
 * Target-size quality tuner: binary-search the quality parameter to hit a
 * target byte size. Caller provides a `compressAtQuality` function that
 * does the actual canvas encode.
 *
 * Returns the best-quality result that fits under targetBytes, or the
 * smallest result if none fit.
 */
export async function tuneForTargetSize(
  targetBytes: number,
  compressAtQuality: (q: number) => Promise<{ blob: Blob; quality: number }>,
  opts: { maxIterations?: number; minQuality?: number; maxQuality?: number } = {},
): Promise<{ blob: Blob; quality: number }> {
  const { maxIterations = 8, minQuality = 0.1, maxQuality = 1.0 } = opts;
  let lo = minQuality;
  let hi = maxQuality;
  let best: { blob: Blob; quality: number } | null = null;
  let bestUnder: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const result = await compressAtQuality(mid);
    if (!best || result.blob.size < best.blob.size) best = result;
    if (result.blob.size <= targetBytes) {
      bestUnder = result;
      lo = mid; // try higher quality
    } else {
      hi = mid; // try lower quality
    }
    if (hi - lo < 0.025) break;
  }

  return bestUnder ?? best!;
}

// ---------------------------------------------------------------------------
// Canvas-backed operations (DOM required, not unit-tested in node env)
// ---------------------------------------------------------------------------

/**
 * Compress / resize / convert a single image file via Canvas re-encode.
 * Also applies the configured watermark if enabled.
 *
 * Returns ToolResult so callers can surface a friendly error message.
 */
export async function processImage(
  file: File,
  opts: OptimizeOptions,
): Promise<ToolResult<{ blob: Blob; width: number; height: number }>> {
  try {
    // HEIC input needs heic2any (lazy-loaded to keep the main bundle small)
    let bitmapSource: Blob = file;
    const lower = file.name.toLowerCase();
    if (
      lower.endsWith(".heic") ||
      lower.endsWith(".heif") ||
      file.type === "image/heic" ||
      file.type === "image/heif"
    ) {
      try {
        const mod = await import("heic2any");
        const converted = await mod.default({
          blob: file,
          toType: "image/png",
          quality: 0.8,
        });
        bitmapSource = Array.isArray(converted) ? converted[0]! : converted;
      } catch (e) {
        return {
          ok: false,
          error: `HEIC decode failed: ${(e as Error).message}. heic2any may be unavailable.`,
        };
      }
    }

    const bitmap = await createImageBitmap(bitmapSource);
    const { width, height } = computeResizedDimensions(
      bitmap.width,
      bitmap.height,
      opts.maxDimension,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { ok: false, error: "Canvas 2D context unavailable" };
    }

    // JPEG has no alpha channel — fill white first
    if (opts.format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // Watermark
    if (opts.watermark.enabled && opts.watermark.text) {
      drawWatermark(ctx, width, height, opts.watermark);
    }

    let blob: Blob;
    if (opts.targetBytes && opts.targetBytes > 0 && opts.format !== "image/png") {
      const tuned = await tuneForTargetSize(opts.targetBytes, async (q) => {
        const b = await canvasToBlob(canvas, opts.format, q);
        return { blob: b, quality: q };
      });
      blob = tuned.blob;
    } else {
      blob = await canvasToBlob(
        canvas,
        opts.format,
        opts.format === "image/png" ? undefined : opts.quality,
      );
    }

    return { ok: true, output: { blob, width, height } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      format,
      quality,
    );
  });
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wm: WatermarkOptions,
): void {
  const scale = width / 1000;
  const fontSize = Math.max(8, wm.fontSize * scale);
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.fillStyle = wm.color;
  ctx.font = `${fontSize}px sans-serif`;
  const padding = Math.max(8, fontSize * 0.6);
  const metrics = ctx.measureText(wm.text);
  const textWidth = metrics.width;
  let x = padding;
  let y = padding + fontSize;
  switch (wm.position) {
    case "top-left":
      x = padding;
      y = padding + fontSize;
      break;
    case "top-right":
      x = width - textWidth - padding;
      y = padding + fontSize;
      break;
    case "bottom-left":
      x = padding;
      y = height - padding;
      break;
    case "bottom-right":
      x = width - textWidth - padding;
      y = height - padding;
      break;
    case "center":
      x = (width - textWidth) / 2;
      y = (height + fontSize) / 2;
      break;
  }
  ctx.fillText(wm.text, x, y);
  ctx.restore();
}

/**
 * Strip EXIF by re-encoding the image via Canvas (Canvas drops metadata by
 * default). For blobs that are not images, returns the original blob.
 */
export async function stripExif(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/")) return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    if (blob.type === "image/jpeg" || blob.type === "image/jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const out = await canvasToBlob(
      canvas,
      blob.type === "image/png" ? "image/png" : "image/jpeg",
      0.92,
    );
    return out;
  } catch {
    return blob;
  }
}

/**
 * Parse EXIF data from a file using exifr. Returns a normalized ExifData.
 * ExifData.date is the EXIF DateTimeOriginal if present (ISO format),
 * otherwise undefined (caller should fall back to file.lastModified).
 */
export async function getExifData(file: File): Promise<ToolResult<ExifData>> {
  try {
    const exifr = await import("exifr");
    const parsed = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
    });
    if (!parsed) {
      return { ok: true, output: {} };
    }
    const out: ExifData = {
      raw: parsed as Record<string, unknown>,
    };
    if (parsed.DateTimeOriginal) {
      out.date = formatDate(parsed.DateTimeOriginal);
    } else if (parsed.CreateDate) {
      out.date = formatDate(parsed.CreateDate);
    }
    if (parsed.ImageWidth) out.width = parsed.ImageWidth;
    if (parsed.ImageHeight) out.height = parsed.ImageHeight;
    if (parsed.Make) out.make = String(parsed.Make);
    if (parsed.Model) out.model = String(parsed.Model);
    if (parsed.Orientation) out.orientation = parsed.Orientation;
    if (parsed.ISO) out.iso = parsed.ISO;
    if (parsed.FNumber) out.fNumber = parsed.FNumber;
    if (parsed.ExposureTime) out.exposureTime = parsed.ExposureTime;
    if (parsed.latitude != null || parsed.longitude != null) {
      out.gps = {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      };
    }
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, error: `EXIF parse failed: ${(e as Error).message}` };
  }
}

function formatDate(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// SEO slugify
// ---------------------------------------------------------------------------

/** Slugify a text into an SEO-friendly filename-safe slug. */
export function slugifyForSeo(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "") // strip non-alphanumeric (keep space/dash/underscore)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Perceptual hash (average hash, aHash)
// See: https://en.wikipedia.org/wiki/Perceptual_hashing
// ---------------------------------------------------------------------------

/**
 * Compute an average-hash (aHash) from grayscale pixel data.
 *
 * Algorithm:
 *   1. Downsample the input grayscale to 8x8 (box average).
 *   2. Compute the mean of the 64 values.
 *   3. Each bit = 1 if pixel > mean else 0.
 *   4. Pack the 64 bits into a 16-char hex string.
 *
 * Pure — no DOM. The Canvas wrapper below extracts grayscale from a bitmap.
 *
 * @param grayscale Uint8Array of length width*height, values 0-255.
 */
export function computePerceptualHash(
  grayscale: Uint8Array,
  width: number,
  height: number,
): string {
  if (width <= 0 || height <= 0 || grayscale.length < width * height) {
    return "0000000000000000";
  }

  // Downsample to 8x8 via box average.
  const cellW = width / 8;
  const cellH = height / 8;
  const down: number[] = new Array(64);
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let sum = 0;
      let count = 0;
      const x0 = Math.floor(bx * cellW);
      const x1 = Math.floor((bx + 1) * cellW);
      const y0 = Math.floor(by * cellH);
      const y1 = Math.floor((by + 1) * cellH);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += grayscale[y * width + x]!;
          count++;
        }
      }
      down[by * 8 + bx] = count > 0 ? sum / count : 0;
    }
  }

  const mean = down.reduce((s, v) => s + v, 0) / 64;

  // Build 64-bit BigInt from MSB to LSB.
  // Use BigInt() calls (not 1n / 0n literals) so this compiles under ES2017.
  let bits = BigInt(0);
  const one = BigInt(1);
  for (let i = 0; i < 64; i++) {
    if (down[i]! > mean) bits |= one << BigInt(63 - i);
  }

  return bits.toString(16).padStart(16, "0");
}

/**
 * Extract grayscale from an ImageBitmap (downsampled to 16x16 for speed) and
 * compute the perceptual hash. DOM-dependent (not unit-tested in node).
 */
export async function computePerceptualHashFromBitmap(
  bitmap: ImageBitmap,
): Promise<string> {
  const sample = 16;
  const canvas = document.createElement("canvas");
  canvas.width = sample;
  canvas.height = sample;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "0000000000000000";
  ctx.drawImage(bitmap, 0, 0, sample, sample);
  const { data } = ctx.getImageData(0, 0, sample, sample);
  const gray = new Uint8Array(sample * sample);
  for (let i = 0; i < sample * sample; i++) {
    // ITU-R BT.601 luma
    gray[i] = Math.round(
      0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!,
    );
  }
  return computePerceptualHash(gray, sample, sample);
}

/** Compute the Hamming distance between two 16-char hex hash strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let ai: bigint;
  let bi: bigint;
  try {
    ai = BigInt("0x" + a);
    bi = BigInt("0x" + b);
  } catch {
    return 64;
  }
  let x = ai ^ bi;
  let count = 0;
  const one = BigInt(1);
  while (x) {
    count += Number(x & one);
    x >>= one;
  }
  return count;
}

/**
 * Group file ids by perceptual similarity. Returns Map<fileId, similarFileIds[]>.
 * Files whose Hamming distance is <= threshold (default 5) are considered
 * duplicates of each other.
 */
export function findPerceptualDuplicates(
  hashes: Map<string, string>,
  threshold = 5,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const ids = Array.from(hashes.keys());
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i]!;
    const ha = hashes.get(a)!;
    const similars: string[] = [];
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j]!;
      const hb = hashes.get(b)!;
      // Skip pairs where exactly one hash is the zero/failed sentinel.
      // Two identical zero hashes ARE considered duplicates (distance 0).
      const aZero = ha === "0000000000000000";
      const bZero = hb === "0000000000000000";
      if (aZero !== bZero) continue;
      if (hammingDistance(ha, hb) <= threshold) {
        similars.push(b);
      }
    }
    if (similars.length > 0) out.set(a, similars);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Audit export
// ---------------------------------------------------------------------------

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Generate a CSV audit trail of old→new names + sizes. */
export function generateAuditCsv(rows: PreviewRow[]): string {
  const header = [
    "index",
    "original_name",
    "original_size_bytes",
    "new_name",
    "new_size_bytes",
    "width",
    "height",
    "conflict",
    "auto_suffixed",
    "error",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.index,
        csvEscape(r.originalName),
        r.originalSize,
        csvEscape(r.newName),
        r.newSize,
        r.width ?? "",
        r.height ?? "",
        r.conflict ? "yes" : "no",
        r.autoSuffixed ? "yes" : "no",
        r.error ? csvEscape(r.error) : "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Generate a JSON audit trail of old→new names + sizes. */
export function generateAuditJson(rows: PreviewRow[]): string {
  return JSON.stringify(rows, null, 2);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Compute savings in bytes and percent. */
export function estimateSizeSavings(
  beforeBytes: number,
  afterBytes: number,
): { savings: number; percent: number } {
  const savings = Math.max(0, beforeBytes - afterBytes);
  const percent = beforeBytes > 0 ? (savings / beforeBytes) * 100 : 0;
  return { savings, percent };
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return `-${formatBytes(-bytes)}`;
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// URL preset encode / decode
// ---------------------------------------------------------------------------

/** Encode a config into a URL hash for sharing. */
export function encodeConfigToUrl(
  config: RenameOptimizeConfig,
  baseUrl: string,
): string {
  const json = JSON.stringify(config);
  // base64url encode (UTF-8 safe)
  const b64 = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf-8").toString("base64");
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${baseUrl}#p=${b64url}`;
}

/** Decode a config from a URL hash. Returns ToolResult to surface parse errors. */
export function decodeConfigFromUrl(url: string): ToolResult<RenameOptimizeConfig> {
  try {
    const hashIdx = url.indexOf("#p=");
    if (hashIdx < 0) return { ok: false, error: "No preset found in URL" };
    const b64url = url.slice(hashIdx + 3);
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf-8");
    const config = JSON.parse(json) as RenameOptimizeConfig;
    return { ok: true, output: config };
  } catch (e) {
    return { ok: false, error: `Could not decode preset: ${(e as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// ZIP building (stored format, supports folder structure via name slashes)
// Spec: PKWARE APPNOTE 6.3.10.
// ---------------------------------------------------------------------------

export async function buildStoredZip(
  entries: { name: string; blob: Blob }[],
): Promise<Blob> {
  if (entries.length === 0) return new Blob([], { type: "application/zip" });

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  // CRC32 lookup table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]!) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const dataBytes = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name)
    const lfh = new DataView(new ArrayBuffer(30 + nameBytes.length));
    lfh.setUint32(0, 0x04034b50, true);
    lfh.setUint16(4, 20, true);
    lfh.setUint16(6, 0, true);
    lfh.setUint16(8, 0, true); // stored
    lfh.setUint16(10, 0, true);
    lfh.setUint16(12, 0, true);
    lfh.setUint32(14, crc, true);
    lfh.setUint32(18, size, true);
    lfh.setUint32(22, size, true);
    lfh.setUint16(26, nameBytes.length, true);
    lfh.setUint16(28, 0, true);
    new Uint8Array(lfh.buffer).set(nameBytes, 30);

    chunks.push(new Uint8Array(lfh.buffer));
    chunks.push(dataBytes);

    // Central directory header (46 bytes + name)
    const cdh = new DataView(new ArrayBuffer(46 + nameBytes.length));
    cdh.setUint32(0, 0x02014b50, true);
    cdh.setUint16(4, 20, true);
    cdh.setUint16(6, 20, true);
    cdh.setUint16(8, 0, true);
    cdh.setUint16(10, 0, true);
    cdh.setUint16(12, 0, true);
    cdh.setUint16(14, 0, true);
    cdh.setUint32(16, crc, true);
    cdh.setUint32(20, size, true);
    cdh.setUint32(24, size, true);
    cdh.setUint16(28, nameBytes.length, true);
    cdh.setUint16(30, 0, true);
    cdh.setUint16(32, 0, true);
    cdh.setUint16(34, 0, true);
    cdh.setUint16(36, 0, true);
    cdh.setUint32(38, 0, true);
    cdh.setUint32(42, offset, true);
    new Uint8Array(cdh.buffer).set(nameBytes, 46);
    central.push(new Uint8Array(cdh.buffer));

    offset += lfh.buffer.byteLength + dataBytes.length;
  }

  // End of central directory
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const centralOffset = offset;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralOffset, true);
  eocd.setUint16(20, 0, true);

  const totalSize = chunks.reduce((s, c) => s + c.length, 0) + centralSize + 22;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  for (const c of central) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(new Uint8Array(eocd.buffer), pos);

  return new Blob([out], { type: "application/zip" });
}

// ---------------------------------------------------------------------------
// Folder structure helpers
// ---------------------------------------------------------------------------

/**
 * Build the output path inside the ZIP for a given file. Honors
 * `preserveFolderStructure` (keep source path) and `outputFolder` (prepend).
 */
export function buildOutputPath(
  originalPath: string,
  newName: string,
  config: RenameOptimizeConfig,
): string {
  let dir = "";
  if (config.preserveFolderStructure) {
    const slash = originalPath.lastIndexOf("/");
    if (slash >= 0) dir = originalPath.slice(0, slash + 1);
  }
  const base = config.outputFolder
    ? `${config.outputFolder.replace(/\/+$/, "")}/`
    : "";
  return `${base}${dir}${newName}`;
}
