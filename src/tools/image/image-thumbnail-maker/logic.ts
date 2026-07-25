/**
 * Image Thumbnail Maker — pure logic. No DOM access.
 */
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
export const DEFAULT_SIZES = [64, 128, 256, 512] as const;

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
