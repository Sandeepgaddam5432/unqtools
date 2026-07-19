/**
 * PDF Thumbnail Generator — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF loading and
 * page-dimension extraction lives in ui.tsx; this module handles thumbnail
 * sizing, output-format conversion, sprite-sheet layout, ZIP building,
 * multi-format metadata rendering, history (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type ThumbnailSize = "small-128" | "medium-256" | "large-512" | "xlarge-1024" | "original";
export type OutputFormat = "png" | "jpeg" | "webp";
export type BundleOutput = "zip" | "individual" | "single-image-sprite";
export type Orientation = "portrait" | "landscape" | "square";

export const THUMBNAIL_SIZES: ThumbnailSize[] = [
  "small-128",
  "medium-256",
  "large-512",
  "xlarge-1024",
  "original",
];

export const SIZE_LABELS: Record<ThumbnailSize, string> = {
  "small-128": "Small (128px max)",
  "medium-256": "Medium (256px max)",
  "large-512": "Large (512px max)",
  "xlarge-1024": "X-Large (1024px max)",
  "original": "Original (full page size)",
};

export const SIZE_MAX_PX: Record<ThumbnailSize, number> = {
  "small-128": 128,
  "medium-256": 256,
  "large-512": 512,
  "xlarge-1024": 1024,
  "original": 0, // 0 = use original page dimensions
};

export const OUTPUT_FORMATS: OutputFormat[] = ["png", "jpeg", "webp"];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  png: "PNG (lossless, transparency)",
  jpeg: "JPEG (small, no transparency)",
  webp: "WebP (modern, efficient)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export const BUNDLE_OUTPUTS: BundleOutput[] = ["zip", "individual", "single-image-sprite"];

export const BUNDLE_LABELS: Record<BundleOutput, string> = {
  zip: "ZIP archive (all thumbnails in one .zip)",
  individual: "Individual files (download each separately)",
  "single-image-sprite": "Single-image sprite sheet (grid of all thumbnails)",
};

/** Standard page sizes in PDF points (1 pt = 1/72 inch). */
export const PAGE_SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  "A4": { width: 595.28, height: 841.89 },
  "A3": { width: 841.89, height: 1190.55 },
  "Letter": { width: 612, height: 792 },
  "Legal": { width: 612, height: 1008 },
  "Tabloid": { width: 792, height: 1224 },
};

export interface ThumbnailOptions {
  thumbnailSize: ThumbnailSize;
  outputFormat: OutputFormat;
  pageRange: string;
  /** Optional hex color (e.g. #FFFFFF) for transparent regions. Defaults to #FFFFFF (white). */
  backgroundColor: string;
  bundleOutput: BundleOutput;
}

export const DEFAULT_OPTIONS: ThumbnailOptions = {
  thumbnailSize: "medium-256",
  outputFormat: "png",
  pageRange: "all",
  backgroundColor: "#FFFFFF",
  bundleOutput: "zip",
};

/** Per-page info extracted from the PDF in ui.tsx. */
export interface PageDim {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

/** A computed thumbnail spec. */
export interface ThumbnailSpec {
  pageNumber: number;
  originalWidth: number;
  originalHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  orientation: Orientation;
  aspectRatio: number;
  filename: string;
  /** MIME type for the output. */
  mime: string;
  /** Bytes of the rendered thumbnail (placeholder in current implementation). */
  bytes?: Uint8Array;
  /** Estimated bytes when bytes are not available. */
  estimatedBytes: number;
}

/** Sprite sheet layout. */
export interface SpriteLayout {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  gap: number;
  background: string;
  entries: SpriteEntry[];
}

export interface SpriteEntry {
  pageNumber: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filename: string;
}

export interface SummaryStats {
  totalPages: number;
  totalThumbnails: number;
  /** Sum of estimated bytes across all thumbnails. */
  totalBytes: number;
  byFormat: Record<OutputFormat, number>;
  byOrientation: Record<Orientation, number>;
  smallestWidth: number;
  smallestHeight: number;
  largestWidth: number;
  largestHeight: number;
  sheetSize: number;
  pageCount: number;
}

export interface ThumbnailReport {
  pages: ThumbnailSpec[];
  spriteLayout: SpriteLayout;
  stats: SummaryStats;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  thumbnailsGenerated: number;
  thumbnailSize: ThumbnailSize;
  outputFormat: OutputFormat;
  bundleOutput: BundleOutput;
}

// ---------------------------------------------------------------------------
// Page-range normalization (reuses shared parser)
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

export interface ResolvedRange {
  ok: boolean;
  indices?: number[];
  error?: string;
}

/** Resolve a page range against an actual page count. */
export function resolvePageRange(spec: string, pageCount: number): ResolvedRange {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") {
    if (pageCount < 1) return { ok: false, error: "The document has no pages." };
    const indices: number[] = [];
    for (let i = 0; i < pageCount; i++) indices.push(i);
    return { ok: true, indices };
  }
  const res = parsePageRanges(normalized, pageCount);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, indices: res.output };
}

// ---------------------------------------------------------------------------
// Background color parsing (hex)
// ---------------------------------------------------------------------------

export interface RGB { r: number; g: number; b: number; }

export function normalizeHex(hex: string): string {
  let s = (hex ?? "").trim();
  if (!s) return "#FFFFFF";
  if (!s.startsWith("#")) s = "#" + s;
  // Expand #RGB → #RRGGBB
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  if (!/^#[0-9a-f]{6}$/i.test(s)) return "#FFFFFF"; // fallback
  return s.toUpperCase();
}

export function parseBackgroundColor(hex: string): RGB {
  const s = normalizeHex(hex);
  return {
    r: parseInt(s.slice(1, 3), 16),
    g: parseInt(s.slice(3, 5), 16),
    b: parseInt(s.slice(5, 7), 16),
  };
}

export function rgbToHex(c: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Page orientation & aspect ratio
// ---------------------------------------------------------------------------

export function detectOrientation(width: number, height: number): Orientation {
  if (width <= 0 || height <= 0) return "square";
  const diff = Math.abs(width - height);
  if (diff < 1) return "square";
  return width > height ? "landscape" : "portrait";
}

export function calculateAspectRatio(width: number, height: number): number {
  if (height <= 0) return 0;
  return width / height;
}

// ---------------------------------------------------------------------------
// Thumbnail dimension calculator (preserve aspect ratio)
// ---------------------------------------------------------------------------

/** Compute thumbnail dimensions that fit within maxSize while preserving aspect ratio. */
export function calculateThumbnailDimensions(
  originalWidth: number,
  originalHeight: number,
  maxSize: number,
): { width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0 };
  }
  if (maxSize <= 0) {
    // "original" — use page dimensions rounded
    return {
      width: Math.round(originalWidth),
      height: Math.round(originalHeight),
    };
  }
  const aspect = originalWidth / originalHeight;
  // Fit the LONGEST side within maxSize
  let tw: number;
  let th: number;
  if (aspect >= 1) {
    // Landscape or square: width is the longest side
    tw = maxSize;
    th = Math.round(maxSize / aspect);
  } else {
    // Portrait: height is the longest side
    th = maxSize;
    tw = Math.round(maxSize * aspect);
  }
  return { width: Math.max(1, Math.round(tw)), height: Math.max(1, Math.round(th)) };
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function lookupThumbnailSize(size: ThumbnailSize): number {
  return SIZE_MAX_PX[size] ?? 0;
}

export function lookupOutputFormat(format: OutputFormat): { extension: string; mime: string } {
  return {
    extension: FORMAT_EXTENSIONS[format],
    mime: FORMAT_MIME[format],
  };
}

export function lookupBundleOutput(bundle: BundleOutput): BundleOutput {
  return BUNDLE_OUTPUTS.includes(bundle) ? bundle : "zip";
}

// ---------------------------------------------------------------------------
// Filename generator
// ---------------------------------------------------------------------------

/** Generate `page-001.png`, `page-002.jpg`, etc. — zero-padded to max(3, digits in pageCount). */
export function generateThumbnailFilename(
  pageNumber: number,
  format: OutputFormat,
  pageCount: number = 0,
): string {
  const digits = Math.max(3, String(Math.max(1, pageCount)).length);
  const padded = String(pageNumber).padStart(digits, "0");
  return `page-${padded}.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// Page dimension extractor (pure — just maps over raw page list)
// ---------------------------------------------------------------------------

export interface RawPage { pageNumber: number; width: number; height: number; rotation: number; }

export function extractPageDimensions(raw: RawPage[]): PageDim[] {
  return raw.map((p) => ({
    pageNumber: p.pageNumber,
    width: Math.max(0, p.width),
    height: Math.max(0, p.height),
    rotation: ((p.rotation ?? 0) % 360 + 360) % 360,
  }));
}

/**
 * Apply page rotation to dimensions.
 * A 90° or 270° rotation swaps width/height.
 */
export function applyRotation(dim: PageDim): PageDim {
  const r = dim.rotation;
  if (r === 90 || r === 270) {
    return { ...dim, width: dim.height, height: dim.width };
  }
  return dim;
}

// ---------------------------------------------------------------------------
// Thumbnail builder — produces specs for the requested page range
// ---------------------------------------------------------------------------

export function buildThumbnails(
  pageDims: PageDim[],
  options: ThumbnailOptions,
): ToolResult<ThumbnailSpec[]> {
  if (pageDims.length === 0) {
    return { ok: false, error: "The PDF has no pages." };
  }
  const resolved = resolvePageRange(options.pageRange, pageDims.length);
  if (!resolved.ok || !resolved.indices || resolved.indices.length === 0) {
    return { ok: false, error: resolved.error ?? "No pages matched the page range." };
  }
  const maxSize = lookupThumbnailSize(options.thumbnailSize);
  const { mime } = lookupOutputFormat(options.outputFormat);
  const pageCount = pageDims.length;
  const out: ThumbnailSpec[] = [];
  for (const idx of resolved.indices) {
    const page = pageDims[idx];
    if (!page) continue;
    const rotated = applyRotation(page);
    const { width: tw, height: th } = calculateThumbnailDimensions(
      rotated.width,
      rotated.height,
      maxSize,
    );
    out.push({
      pageNumber: page.pageNumber,
      originalWidth: rotated.width,
      originalHeight: rotated.height,
      thumbnailWidth: tw,
      thumbnailHeight: th,
      orientation: detectOrientation(rotated.width, rotated.height),
      aspectRatio: calculateAspectRatio(rotated.width, rotated.height),
      filename: generateThumbnailFilename(page.pageNumber, options.outputFormat, pageCount),
      mime,
      estimatedBytes: estimateThumbnailBytes(tw, th, options.outputFormat),
    });
  }
  return { ok: true, output: out };
}

// ---------------------------------------------------------------------------
// Estimated byte size of a thumbnail (rough heuristic for UI display)
// ---------------------------------------------------------------------------

export function estimateThumbnailBytes(
  width: number,
  height: number,
  format: OutputFormat,
): number {
  if (width <= 0 || height <= 0) return 0;
  const pixels = width * height;
  // Rough bytes-per-pixel heuristic by format
  const bpp = format === "png" ? 1.5 : format === "jpeg" ? 0.3 : 0.6;
  // Add a small overhead for headers
  return Math.round(pixels * bpp) + 1024;
}

// ---------------------------------------------------------------------------
// Thumbnail quality scorer (0–100)
// ---------------------------------------------------------------------------

export interface QualityScore {
  score: number;
  reasons: string[];
}

export function scoreThumbnailQuality(spec: ThumbnailSpec, format: OutputFormat): QualityScore {
  let score = 100;
  const reasons: string[] = [];
  const maxDim = Math.max(spec.thumbnailWidth, spec.thumbnailHeight);
  if (maxDim < 64) {
    score -= 40;
    reasons.push("Very low resolution (under 64px) — pixelated when enlarged");
  } else if (maxDim < 128) {
    score -= 20;
    reasons.push("Low resolution (under 128px) — fine detail lost");
  } else if (maxDim < 256) {
    score -= 5;
    reasons.push("Medium resolution — suitable for small previews");
  } else if (maxDim >= 512) {
    reasons.push("High resolution — suitable for large previews");
  }
  if (format === "jpeg") {
    score -= 5;
    reasons.push("JPEG format adds compression artifacts on text");
  } else if (format === "webp") {
    reasons.push("WebP format offers good quality at small size");
  } else if (format === "png") {
    reasons.push("PNG format preserves text crispness (lossless)");
  }
  if (spec.aspectRatio > 3 || spec.aspectRatio < 0.33) {
    score -= 10;
    reasons.push("Extreme aspect ratio — preview may look stretched");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// ---------------------------------------------------------------------------
// Sprite sheet grid calculator + assembler
// ---------------------------------------------------------------------------

export interface GridOptions {
  /** Max number of columns (0 = auto-calculate square-ish grid). */
  maxCols: number;
  /** Max number of rows (0 = unlimited). */
  maxRows: number;
  /** Pixel gap between cells. */
  gap: number;
}

export const DEFAULT_GRID: GridOptions = { maxCols: 0, maxRows: 0, gap: 4 };

/** Compute rows × cols for a sprite sheet. */
export function calculateSpriteGrid(
  count: number,
  opts: GridOptions = DEFAULT_GRID,
): { rows: number; cols: number } {
  if (count <= 0) return { rows: 0, cols: 0 };
  let cols: number;
  let rows: number;
  if (opts.maxCols > 0) {
    cols = Math.min(opts.maxCols, count);
    rows = Math.ceil(count / cols);
  } else {
    // Square-ish grid: ceil(sqrt(n)) columns
    cols = Math.ceil(Math.sqrt(count));
    rows = Math.ceil(count / cols);
  }
  if (opts.maxRows > 0 && rows > opts.maxRows) {
    rows = opts.maxRows;
    cols = Math.ceil(count / rows);
  }
  return { rows: Math.max(1, rows), cols: Math.max(1, cols) };
}

/** Assemble a sprite sheet layout from thumbnail specs. */
export function assembleSpriteSheet(
  specs: ThumbnailSpec[],
  options: ThumbnailOptions,
  gridOpts: GridOptions = DEFAULT_GRID,
): SpriteLayout {
  const { rows, cols } = calculateSpriteGrid(specs.length, gridOpts);
  // All thumbnails sized the same — use the LARGEST thumb dims as the cell
  let cellW = 0;
  let cellH = 0;
  for (const s of specs) {
    if (s.thumbnailWidth > cellW) cellW = s.thumbnailWidth;
    if (s.thumbnailHeight > cellH) cellH = s.thumbnailHeight;
  }
  if (cellW < 1) cellW = 1;
  if (cellH < 1) cellH = 1;
  const gap = Math.max(0, gridOpts.gap);
  const sheetWidth = cols * cellW + (cols + 1) * gap;
  const sheetHeight = rows * cellH + (rows + 1) * gap;
  const entries: SpriteEntry[] = [];
  for (let i = 0; i < specs.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    entries.push({
      pageNumber: specs[i].pageNumber,
      row,
      col,
      x: gap + col * (cellW + gap),
      y: gap + row * (cellH + gap),
      width: specs[i].thumbnailWidth,
      height: specs[i].thumbnailHeight,
      filename: specs[i].filename,
    });
  }
  return {
    rows,
    cols,
    cellWidth: cellW,
    cellHeight: cellH,
    sheetWidth,
    sheetHeight,
    gap,
    background: normalizeHex(options.backgroundColor),
    entries,
  };
}

/** Generate sprite sheet metadata (positions per thumbnail) for embedding in apps. */
export function generateSpriteMetadata(layout: SpriteLayout, format: OutputFormat): string {
  return JSON.stringify({
    format,
    width: layout.sheetWidth,
    height: layout.sheetHeight,
    cellWidth: layout.cellWidth,
    cellHeight: layout.cellHeight,
    rows: layout.rows,
    cols: layout.cols,
    gap: layout.gap,
    background: layout.background,
    thumbnails: layout.entries.map((e) => ({
      page: e.pageNumber,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      file: e.filename,
    })),
  }, null, 2);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(
  specs: ThumbnailSpec[],
  layout: SpriteLayout,
  format: OutputFormat,
): SummaryStats {
  const byFormat: Record<OutputFormat, number> = { png: 0, jpeg: 0, webp: 0 };
  byFormat[format] = specs.length;
  const byOrientation: Record<Orientation, number> = { portrait: 0, landscape: 0, square: 0 };
  let totalBytes = 0;
  let smallestWidth = Infinity;
  let smallestHeight = Infinity;
  let largestWidth = 0;
  let largestHeight = 0;
  for (const s of specs) {
    byOrientation[s.orientation] += 1;
    totalBytes += s.estimatedBytes;
    if (s.thumbnailWidth < smallestWidth) smallestWidth = s.thumbnailWidth;
    if (s.thumbnailHeight < smallestHeight) smallestHeight = s.thumbnailHeight;
    if (s.thumbnailWidth > largestWidth) largestWidth = s.thumbnailWidth;
    if (s.thumbnailHeight > largestHeight) largestHeight = s.thumbnailHeight;
  }
  if (!Number.isFinite(smallestWidth)) smallestWidth = 0;
  if (!Number.isFinite(smallestHeight)) smallestHeight = 0;
  return {
    totalPages: specs.length,
    totalThumbnails: specs.length,
    totalBytes,
    byFormat,
    byOrientation,
    smallestWidth,
    smallestHeight,
    largestWidth,
    largestHeight,
    sheetSize: layout.sheetWidth * layout.sheetHeight,
    pageCount: specs.length,
  };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

export function renderTextReport(specs: ThumbnailSpec[], layout: SpriteLayout, stats: SummaryStats): string {
  const lines: string[] = [];
  lines.push("PDF Thumbnail Generator — Report");
  lines.push("==================================");
  lines.push("");
  lines.push(`Total thumbnails: ${stats.totalThumbnails}`);
  lines.push(`Orientation: ${stats.byOrientation.portrait} portrait, ${stats.byOrientation.landscape} landscape, ${stats.byOrientation.square} square`);
  lines.push(`Smallest: ${stats.smallestWidth}×${stats.smallestHeight}px`);
  lines.push(`Largest: ${stats.largestWidth}×${stats.largestHeight}px`);
  lines.push(`Total estimated size: ${stats.totalBytes.toLocaleString()} bytes`);
  lines.push(`Sprite sheet: ${layout.sheetWidth}×${layout.sheetHeight}px (${layout.rows}×${layout.cols} grid, ${layout.gap}px gap)`);
  lines.push("");
  lines.push("Per-page dimensions:");
  for (const s of specs) {
    lines.push(
      `  Page ${String(s.pageNumber).padStart(3, " ")}: ${s.originalWidth}×${s.originalHeight}pt → ${s.thumbnailWidth}×${s.thumbnailHeight}px [${s.orientation}] ${s.filename}`,
    );
  }
  return lines.join("\n");
}

export function renderCsvReport(specs: ThumbnailSpec[]): string {
  const lines = ["page,width,height,aspect_ratio,orientation,thumbnail_width,thumbnail_height,thumbnail_filename,estimated_bytes"];
  for (const s of specs) {
    lines.push([
      String(s.pageNumber),
      String(s.originalWidth),
      String(s.originalHeight),
      s.aspectRatio.toFixed(4),
      s.orientation,
      String(s.thumbnailWidth),
      String(s.thumbnailHeight),
      escapeCsv(s.filename),
      String(s.estimatedBytes),
    ].join(","));
  }
  return lines.join("\n");
}

export function renderJsonReport(
  specs: ThumbnailSpec[],
  layout: SpriteLayout,
  stats: SummaryStats,
  format: OutputFormat,
): string {
  return JSON.stringify({
    format,
    stats,
    spriteLayout: layout,
    thumbnails: specs.map((s) => ({
      page: s.pageNumber,
      originalWidth: s.originalWidth,
      originalHeight: s.originalHeight,
      thumbnailWidth: s.thumbnailWidth,
      thumbnailHeight: s.thumbnailHeight,
      orientation: s.orientation,
      aspectRatio: Number(s.aspectRatio.toFixed(4)),
      filename: s.filename,
      mime: s.mime,
      estimatedBytes: s.estimatedBytes,
    })),
  }, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// CRC-32 + minimal ZIP file builder (store mode — same as pdf-to-word-converter)
// ---------------------------------------------------------------------------

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

/** Build a minimal valid ZIP archive (store mode). Returns the archive bytes. */
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

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-thumbnail-generator:history";
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

export function buildShareUrl(options: ThumbnailOptions): string {
  const params = new URLSearchParams();
  params.set("size", options.thumbnailSize);
  params.set("format", options.outputFormat);
  if (options.pageRange) params.set("range", options.pageRange);
  if (options.backgroundColor) params.set("bg", options.backgroundColor);
  params.set("bundle", options.bundleOutput);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ThumbnailOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ThumbnailOptions> = {};
  const size = params.get("size");
  if (size && THUMBNAIL_SIZES.includes(size as ThumbnailSize)) {
    out.thumbnailSize = size as ThumbnailSize;
  }
  const format = params.get("format");
  if (format && OUTPUT_FORMATS.includes(format as OutputFormat)) {
    out.outputFormat = format as OutputFormat;
  }
  const range = params.get("range");
  if (range) out.pageRange = range;
  const bg = params.get("bg");
  if (bg) out.backgroundColor = bg;
  const bundle = params.get("bundle");
  if (bundle && BUNDLE_OUTPUTS.includes(bundle as BundleOutput)) {
    out.bundleOutput = bundle as BundleOutput;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(options: ThumbnailOptions): string | null {
  if (!THUMBNAIL_SIZES.includes(options.thumbnailSize)) {
    return "Invalid thumbnail size.";
  }
  if (!OUTPUT_FORMATS.includes(options.outputFormat)) {
    return "Invalid output format.";
  }
  if (!BUNDLE_OUTPUTS.includes(options.bundleOutput)) {
    return "Invalid bundle output mode.";
  }
  // Background color is normalized internally — always valid
  return null;
}

// ---------------------------------------------------------------------------
// Top-level report builder
// ---------------------------------------------------------------------------

export function buildReport(
  pageDims: PageDim[],
  options: ThumbnailOptions,
): ToolResult<ThumbnailReport> {
  const err = validateOptions(options);
  if (err) return { ok: false, error: err };
  const thumbsRes = buildThumbnails(pageDims, options);
  if (!thumbsRes.ok) return { ok: false, error: thumbsRes.error };
  const specs = thumbsRes.output;
  const layout = assembleSpriteSheet(specs, options);
  const stats = computeSummaryStats(specs, layout, options.outputFormat);
  return { ok: true, output: { pages: specs, spriteLayout: layout, stats } };
}
