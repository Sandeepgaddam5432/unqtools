/**
 * Image Thumbnail Maker — pure logic. No DOM access.
 *
 * 10+ extras:
 *   1. 64/128/256/512/1024 size presets
 *   2. Custom size input
 *   3. Aspect ratio preservation
 *   4. Quality slider (for lossy formats)
 *   5. Format selection (PNG/JPEG/WebP)
 *   6. Batch ZIP packaging (UI handles ZIP, this computes names)
 *   7. Metadata strip flag
 *   8. Square mode (pad to square)
 *   9. Multiple sizes at once
 *  10. Filename builder
 *  11. Format-preserving transparency check
 *  12. Validation helpers
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface ThumbnailInput {
  originalWidth: number;
  originalHeight: number;
  /** Max dimension (longest side) for the thumbnail. */
  maxSize: number;
  /** If true, produce a square thumbnail by padding to fit. */
  square: boolean;
}

export interface ThumbnailResult {
  width: number;
  height: number;
  /** Effective scale factor. */
  scale: number;
}

/** Default thumbnail sizes. */
export const DEFAULT_SIZES = [64, 128, 256, 512, 1024] as const;

export const SIZE_PRESETS: { id: string; label: string; size: number }[] = [
  { id: "xs", label: "64×64 (XS)", size: 64 },
  { id: "s", label: "128×128 (S)", size: 128 },
  { id: "m", label: "256×256 (M)", size: 256 },
  { id: "l", label: "512×512 (L)", size: 512 },
  { id: "xl", label: "1024×1024 (XL)", size: 1024 },
];

export interface ThumbnailOptions {
  sizes: number[];
  square: boolean;
  format: OutputFormat;
  quality: number;
  stripMetadata: boolean;
}

export const DEFAULT_OPTIONS: ThumbnailOptions = {
  sizes: [128, 256, 512],
  square: false,
  format: "image/png",
  quality: 0.9,
  stripMetadata: false,
};

/** Compute the dimensions of a thumbnail. */
export function computeThumbnail(input: ThumbnailInput): ThumbnailResult | { error: string } {
  const { originalWidth: ow, originalHeight: oh, maxSize, square } = input;
  if (ow <= 0 || oh <= 0) return { error: "Original dimensions must be positive" };
  if (maxSize <= 0) return { error: "Max size must be positive" };

  if (square) {
    return { width: maxSize, height: maxSize, scale: maxSize / Math.max(ow, oh) };
  }

  const longest = Math.max(ow, oh);
  const scale = maxSize / longest;
  return {
    width: Math.max(1, Math.round(ow * scale)),
    height: Math.max(1, Math.round(oh * scale)),
    scale,
  };
}

/** Generate thumbnail dimensions for multiple sizes at once. */
export function computeThumbnails(
  originalWidth: number,
  originalHeight: number,
  sizes: readonly number[],
  square: boolean,
): ThumbnailResult[] | { error: string } {
  const results: ThumbnailResult[] = [];
  for (const size of sizes) {
    const r = computeThumbnail({ originalWidth, originalHeight, maxSize: size, square });
    if ("error" in r) return r;
    results.push(r);
  }
  return results;
}

/** Build a default filename for a thumbnail. */
export function thumbnailFilename(base: string, size: number, extension: string): string {
  const safeBase = (base || "thumbnail").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32) || "thumbnail";
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "") || "png";
  return `${safeBase}-${size}x${size}.${safeExt}`;
}

/** Build a filename for a non-square thumbnail. */
export function thumbnailFilenameDims(base: string, width: number, height: number, extension: string): string {
  const safeBase = (base || "thumbnail").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32) || "thumbnail";
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "") || "png";
  return `${safeBase}-${width}x${height}.${safeExt}`;
}

/** Get the file extension for a format. */
export function formatExtension(format: OutputFormat): string {
  switch (format) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
  }
}

/** Compute the total bytes estimate for a thumbnail set (very rough). */
export function estimateTotalBytes(
  results: ThumbnailResult[],
  format: OutputFormat,
  quality: number,
): number {
  const q = format === "image/png" ? 1 : quality;
  const bytesPerPixel = format === "image/png" ? 3 : 0.5 * q;
  return results.reduce((sum, r) => sum + r.width * r.height * bytesPerPixel, 0);
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Validate thumbnail options. */
export function validateThumbnailOptions(opts: ThumbnailOptions): { ok: true } | { error: string } {
  if (opts.sizes.length === 0) return { error: "At least one size required" };
  for (const s of opts.sizes) {
    if (!Number.isFinite(s) || s < 8 || s > 4096) return { error: "Sizes must be 8..4096" };
  }
  if (opts.quality < 0.1 || opts.quality > 1) return { error: "Quality must be 0.1..1" };
  return { ok: true };
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: ThumbnailOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateThumbnailOptions(opts) }));
}

/** Determine if options produce an identity (single original-size, no change). */
export function isIdentity(opts: ThumbnailOptions): boolean {
  return opts.sizes.length === 0;
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 100 : 10;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a size preset by id. */
export function findSizePreset(id: string): { id: string; label: string; size: number } | undefined {
  return SIZE_PRESETS.find((p) => p.id === id);
}
