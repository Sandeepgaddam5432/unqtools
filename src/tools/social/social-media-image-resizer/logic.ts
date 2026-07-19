/**
 * Social Media Image Resizer — pure logic.
 *
 * Resize images for Instagram, Twitter, Facebook, LinkedIn, YouTube, TikTok
 * with platform/format size presets. Pure functions only — no DOM, no
 * Canvas, no network. The actual image resizing happens in ui.tsx using the
 * Canvas API; this module provides the math, presets, and report generation.
 *
 * Includes a small pure-JS ZIP archive builder (STORE method) for batch
 * downloads.
 */

// ---- Types ----

export type Platform =
  | "instagram"
  | "twitter"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok";

export type Format =
  // Instagram
  | "ig-square"
  | "ig-portrait"
  | "ig-story"
  | "ig-landscape"
  // Twitter
  | "tw-post"
  | "tw-header"
  | "tw-avatar"
  // Facebook
  | "fb-cover"
  | "fb-post"
  | "fb-avatar"
  // LinkedIn
  | "li-cover"
  | "li-post"
  | "li-avatar"
  // YouTube
  | "yt-thumbnail"
  | "yt-channel-art"
  | "yt-avatar"
  // TikTok
  | "tt-video"
  | "tt-avatar";

export type OutputFormat = "jpeg" | "png" | "webp";

export type QualityPreset = "50" | "75" | "90" | "100";

export type CropMode = "fill" | "fit";

export type Orientation = "portrait" | "landscape" | "square";

export interface SizePreset {
  format: Format;
  platform: Platform;
  label: string;
  width: number;
  height: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  fileSize: number;
  format: string;
  orientation: Orientation;
  aspectRatio: string;
  aspectRatioValue: number;
}

export interface ResizeResult {
  format: Format;
  platform: Platform;
  label: string;
  width: number;
  height: number;
  outputFormat: OutputFormat;
  quality: QualityPreset;
  cropMode: CropMode;
  estimatedSize: number;
}

export interface ResizeStats {
  total: number;
  totalEstimatedSize: number;
  byPlatform: Record<Platform, number>;
}

export interface AspectRatio {
  ratio: number;
  simplified: string;
}

// ---- Constants ----

export const PLATFORMS: Platform[] = [
  "instagram",
  "twitter",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  twitter: "Twitter / X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export const OUTPUT_FORMATS: OutputFormat[] = ["jpeg", "png", "webp"];

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
};

export const QUALITY_PRESETS: QualityPreset[] = ["50", "75", "90", "100"];

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  "50": "50% (smallest)",
  "75": "75% (balanced)",
  "90": "90% (high)",
  "100": "100% (lossless)",
};

export const QUALITY_VALUES: Record<QualityPreset, number> = {
  "50": 0.5,
  "75": 0.75,
  "90": 0.9,
  "100": 1.0,
};

export const CROP_MODES: CropMode[] = ["fill", "fit"];

export const CROP_MODE_LABELS: Record<CropMode, string> = {
  fill: "Fill (cover crop — trims excess)",
  fit: "Fit (contain with padding)",
};

// ---- Size presets (18 platform/format combinations) ----

export const SIZE_PRESETS: SizePreset[] = [
  // Instagram (4)
  { format: "ig-square", platform: "instagram", label: "Instagram Square", width: 1080, height: 1080 },
  { format: "ig-portrait", platform: "instagram", label: "Instagram Portrait", width: 1080, height: 1350 },
  { format: "ig-story", platform: "instagram", label: "Instagram Story", width: 1080, height: 1920 },
  { format: "ig-landscape", platform: "instagram", label: "Instagram Landscape", width: 1080, height: 566 },
  // Twitter (3)
  { format: "tw-post", platform: "twitter", label: "Twitter Post", width: 1200, height: 675 },
  { format: "tw-header", platform: "twitter", label: "Twitter Header", width: 1500, height: 500 },
  { format: "tw-avatar", platform: "twitter", label: "Twitter Avatar", width: 400, height: 400 },
  // Facebook (3)
  { format: "fb-cover", platform: "facebook", label: "Facebook Cover", width: 1640, height: 856 },
  { format: "fb-post", platform: "facebook", label: "Facebook Post", width: 1200, height: 630 },
  { format: "fb-avatar", platform: "facebook", label: "Facebook Avatar", width: 180, height: 180 },
  // LinkedIn (3)
  { format: "li-cover", platform: "linkedin", label: "LinkedIn Cover", width: 1584, height: 396 },
  { format: "li-post", platform: "linkedin", label: "LinkedIn Post", width: 1200, height: 627 },
  { format: "li-avatar", platform: "linkedin", label: "LinkedIn Avatar", width: 400, height: 400 },
  // YouTube (3)
  { format: "yt-thumbnail", platform: "youtube", label: "YouTube Thumbnail", width: 1280, height: 720 },
  { format: "yt-channel-art", platform: "youtube", label: "YouTube Channel Art", width: 2560, height: 1440 },
  { format: "yt-avatar", platform: "youtube", label: "YouTube Avatar", width: 800, height: 800 },
  // TikTok (2)
  { format: "tt-video", platform: "tiktok", label: "TikTok Video", width: 1080, height: 1920 },
  { format: "tt-avatar", platform: "tiktok", label: "TikTok Avatar", width: 200, height: 200 },
];

// ---- List / filter presets ----

/** List all 18 size presets. */
export function listPresets(): SizePreset[] {
  return SIZE_PRESETS.slice();
}

/** List presets for a single platform. */
export function listPresetsByPlatform(platform: Platform): SizePreset[] {
  return SIZE_PRESETS.filter((p) => p.platform === platform);
}

/** Get a preset by its format id. */
export function getPreset(format: Format): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.format === format);
}

// ---- Canvas / crop math ----

/** Compute canvas dimensions from a preset. */
export function computeCanvasDimensions(preset: SizePreset): { width: number; height: number } {
  return { width: preset.width, height: preset.height };
}

/**
 * Compute the source-crop and dest-draw rectangles for resizing
 * srcW × srcH into a targetW × targetH canvas using the given crop mode.
 *
 * - fill (cover): crop the source to match the target aspect ratio,
 *   then draw it at full target size.
 * - fit (contain): draw the whole source inside the target with padding,
 *   centered.
 */
export function computeCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  mode: CropMode,
): CropRect {
  if (srcW <= 0 || srcH <= 0 || targetW <= 0 || targetH <= 0) {
    return { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0, dw: 0, dh: 0 };
  }

  if (mode === "fill") {
    // Cover crop: source sub-rect matching target aspect, centered.
    const srcAspect = srcW / srcH;
    const tgtAspect = targetW / targetH;
    let sw: number;
    let sh: number;
    let sx: number;
    let sy: number;
    if (srcAspect > tgtAspect) {
      // Source is wider than target — crop width.
      sh = srcH;
      sw = srcH * tgtAspect;
      sx = (srcW - sw) / 2;
      sy = 0;
    } else {
      // Source is taller than target — crop height.
      sw = srcW;
      sh = srcW / tgtAspect;
      sx = 0;
      sy = (srcH - sh) / 2;
    }
    return {
      sx, sy, sw, sh,
      dx: 0, dy: 0, dw: targetW, dh: targetH,
    };
  }

  // fit (contain): draw whole source, scaled to fit, centered.
  const scale = Math.min(targetW / srcW, targetH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (targetW - dw) / 2;
  const dy = (targetH - dh) / 2;
  return {
    sx: 0, sy: 0, sw: srcW, sh: srcH,
    dx, dy, dw, dh,
  };
}

// ---- Output format / quality ----

/** Get the MIME type for an output format. */
export function getMimeType(format: OutputFormat): string {
  switch (format) {
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

/** Get the file extension for an output format. */
export function getExtension(format: OutputFormat): string {
  switch (format) {
    case "jpeg": return "jpg";
    case "png": return "png";
    case "webp": return "webp";
    default: return "bin";
  }
}

/** Get the numeric quality value (0..1) for a preset. */
export function getQualityValue(preset: QualityPreset): number {
  return QUALITY_VALUES[preset];
}

// ---- Image metadata ----

/** Detect orientation from width and height. */
export function detectOrientation(width: number, height: number): Orientation {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

/** Compute the simplified aspect ratio string (e.g. "16:9"). */
export function computeAspectRatio(width: number, height: number): AspectRatio {
  if (width <= 0 || height <= 0) return { ratio: 0, simplified: "0:0" };
  const ratio = width / height;
  const g = gcd(Math.round(width), Math.round(height));
  const sw = Math.round(width) / g;
  const sh = Math.round(height) / g;
  // Cap the ratio string at small integers; otherwise fall back to "W:H" raw.
  if (sw > 100 || sh > 100) {
    // Try common ratios
    return { ratio, simplified: simplifyCommon(width, height) };
  }
  return { ratio, simplified: `${sw}:${sh}` };
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function simplifyCommon(width: number, height: number): string {
  const ratio = width / height;
  const common: Array<[number, string]> = [
    [1, "1:1"],
    [4 / 3, "4:3"],
    [3 / 2, "3:2"],
    [16 / 9, "16:9"],
    [21 / 9, "21:9"],
    [9 / 16, "9:16"],
    [2 / 3, "2:3"],
    [3 / 4, "3:4"],
  ];
  let best = `${Math.round(width)}:${Math.round(height)}`;
  let bestDiff = Infinity;
  for (const [r, label] of common) {
    const diff = Math.abs(ratio - r);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  if (bestDiff > 0.05) {
    return `${Math.round(width)}:${Math.round(height)}`;
  }
  return best;
}

/** Build an ImageMetadata object from already-known values (pure). */
export function computeMetadata(
  width: number,
  height: number,
  fileSize: number,
  format: string,
): ImageMetadata {
  const ar = computeAspectRatio(width, height);
  return {
    width,
    height,
    fileSize,
    format,
    orientation: detectOrientation(width, height),
    aspectRatio: ar.simplified,
    aspectRatioValue: ar.ratio,
  };
}

// ---- File-size estimation ----

/**
 * Estimate the output file size (in bytes) for a resized image.
 * Uses: width × height × channels × bitsPerChannel / 8 × compressionFactor.
 * PNG uses lossless compression (~50% of raw for photos, ~10% for graphics).
 * JPEG/WebP use lossy compression scaled by quality.
 */
export function estimateFileSize(
  width: number,
  height: number,
  format: OutputFormat,
  quality: QualityPreset,
): number {
  if (width <= 0 || height <= 0) return 0;
  const pixels = width * height;
  const rawBytes = pixels * 3; // 3 channels (RGB) × 1 byte each
  let factor: number;
  switch (format) {
    case "png":
      // PNG lossless — assume ~45% of raw (photos) — varies a lot.
      factor = 0.45;
      break;
    case "jpeg":
      // JPEG lossy — quality roughly maps to compression factor.
      factor = quality === "100" ? 0.35 : quality === "90" ? 0.18 : quality === "75" ? 0.10 : 0.06;
      break;
    case "webp":
      // WebP is ~25-30% smaller than JPEG at equivalent quality.
      factor = quality === "100" ? 0.28 : quality === "90" ? 0.13 : quality === "75" ? 0.075 : 0.045;
      break;
    default:
      factor = 0.5;
  }
  return Math.max(1, Math.round(rawBytes * factor));
}

// ---- Quality scoring ----

/**
 * Score image quality on a 0–100 scale based on resolution and format.
 * - Resolution: 1080p (1920×1080 = ~2Mpx) = 100, smaller = lower.
 * - Format: png = 100, webp@100 = 95, jpeg@100 = 90, jpeg@50 = 50.
 */
export function scoreQuality(
  width: number,
  height: number,
  format: OutputFormat,
  quality: QualityPreset,
): number {
  if (width <= 0 || height <= 0) return 0;
  const pixels = width * height;
  // 2 megapixels = full score (1080p-ish)
  const resolutionScore = Math.min(100, Math.round((pixels / 2_000_000) * 100));
  let formatScore: number;
  switch (format) {
    case "png": formatScore = 100; break;
    case "webp":
      formatScore = quality === "100" ? 95 : quality === "90" ? 85 : quality === "75" ? 75 : 60;
      break;
    case "jpeg":
      formatScore = quality === "100" ? 90 : quality === "90" ? 80 : quality === "75" ? 70 : 50;
      break;
    default: formatScore = 70;
  }
  return Math.round((resolutionScore * 0.6) + (formatScore * 0.4));
}

// ---- Stats / reports ----

/** Compute summary stats for a list of resize results. */
export function computeStats(results: ResizeResult[]): ResizeStats {
  const byPlatform: Record<Platform, number> = {
    instagram: 0,
    twitter: 0,
    facebook: 0,
    linkedin: 0,
    youtube: 0,
    tiktok: 0,
  };
  let totalEstimatedSize = 0;
  for (const r of results) {
    byPlatform[r.platform] += 1;
    totalEstimatedSize += r.estimatedSize;
  }
  return {
    total: results.length,
    totalEstimatedSize,
    byPlatform,
  };
}

/** Render a text report (one line per result). */
export function renderText(results: ResizeResult[]): string {
  if (results.length === 0) return "";
  const lines: string[] = ["Social Media Image Resizer — Output Report", ""];
  for (const r of results) {
    lines.push(
      `${r.label} (${r.platform}): ${r.width}×${r.height} ${r.outputFormat.toUpperCase()} ` +
      `q=${r.quality} ${r.cropMode} — ~${formatBytes(r.estimatedSize)}`,
    );
  }
  const stats = computeStats(results);
  lines.push("");
  lines.push(`Total outputs: ${stats.total}`);
  lines.push(`Total estimated size: ${formatBytes(stats.totalEstimatedSize)}`);
  for (const p of PLATFORMS) {
    if (stats.byPlatform[p] > 0) {
      lines.push(`  ${PLATFORM_LABELS[p]}: ${stats.byPlatform[p]}`);
    }
  }
  return lines.join("\n");
}

/** Render a CSV report. */
export function renderCsv(results: ResizeResult[]): string {
  const lines = ["platform,format,width,height,output_format,quality,crop_mode,estimated_size_bytes"];
  for (const r of results) {
    lines.push([
      r.platform,
      r.format,
      String(r.width),
      String(r.height),
      r.outputFormat,
      r.quality,
      r.cropMode,
      String(r.estimatedSize),
    ].join(","));
  }
  return lines.join("\n");
}

/** Format a byte count as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---- Pure-JS ZIP archive builder (STORE method, no deps) ----

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a ZIP archive (STORE method — no compression) from binary entries.
 * Returns a Uint8Array. Each entry contributes a local file header, file
 * data, and a central directory entry, plus an End of Central Directory
 * record at the end.
 *
 * Limitation: 4 GB max per file and total (no ZIP64). Filename ≤ 65535 bytes.
 */
export function buildZip(files: ZipFile[]): Uint8Array {
  if (files.length === 0) {
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    return eocd;
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    if (size > 0xffffffff) {
      throw new Error(`File "${file.name}" exceeds 4 GB (ZIP64 not supported).`);
    }
    if (nameBytes.length > 65535) {
      throw new Error(`Filename "${file.name.slice(0, 40)}..." is too long.`);
    }

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Convenience wrapper: build a ZIP and return as a Blob. */
export function createZipBlob(files: ZipFile[]): Blob {
  const bytes = buildZip(files);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
}

// ---- History (localStorage, max 20) ----

const HISTORY_KEY = "unqtools:sm-image-resizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  platforms: Platform[];
  formats: Format[];
  outputFormat: OutputFormat;
  quality: QualityPreset;
  cropMode: CropMode;
  totalOutputs: number;
  totalEstimatedSize: number;
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

export function buildShareUrl(
  formats: Format[],
  outputFormat: OutputFormat,
  quality: QualityPreset,
  cropMode: CropMode,
): string {
  const params = new URLSearchParams();
  if (formats.length > 0) params.set("fmts", formats.join(","));
  params.set("of", outputFormat);
  params.set("q", quality);
  params.set("crop", cropMode);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): {
  formats: Format[];
  outputFormat: OutputFormat;
  quality: QualityPreset;
  cropMode: CropMode;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { formats: [], outputFormat: "jpeg", quality: "90", cropMode: "fill" };
  }
  const params = new URLSearchParams(clean);
  const validFormats = SIZE_PRESETS.map((p) => p.format) as readonly string[];
  const fmtsStr = params.get("fmts") ?? "";
  const formats: Format[] = fmtsStr
    ? fmtsStr.split(",").filter((f) => validFormats.includes(f)) as Format[]
    : [];
  const ofStr = params.get("of") ?? "jpeg";
  const outputFormat: OutputFormat =
    (OUTPUT_FORMATS as readonly string[]).includes(ofStr) ? (ofStr as OutputFormat) : "jpeg";
  const qStr = params.get("q") ?? "90";
  const quality: QualityPreset =
    (QUALITY_PRESETS as readonly string[]).includes(qStr) ? (qStr as QualityPreset) : "90";
  const cropStr = params.get("crop") ?? "fill";
  const cropMode: CropMode = cropStr === "fit" ? "fit" : "fill";
  return { formats, outputFormat, quality, cropMode };
}
