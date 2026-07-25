/**
 * Image Background Remover (Simple) — pure logic. No DOM access.
 */
export interface BgRemoveOptions {
  /** Color distance threshold (0-442, sqrt of 3*255²). */
  threshold: number;
  /** Sample size in pixels for averaging corner colors. */
  sampleSize: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Euclidean distance between two RGB colors (0-442). */
export function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Average color of a square region in pixel data. */
export function averageColor(
  data: Uint8ClampedArray,
  width: number,
  startX: number,
  startY: number,
  size: number,
): Rgb {
  let r = 0, g = 0, b = 0, count = 0;
  const maxX = Math.min(width, startX + size);
  for (let y = startY; y < startY + size; y++) {
    for (let x = startX; x < maxX; x++) {
      const i = (y * width + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      count++;
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0 };
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

/** Decide whether a pixel matches the background color within the threshold. */
export function isBackground(pixel: Rgb, bg: Rgb, threshold: number): boolean {
  return colorDistance(pixel, bg) <= threshold;
}

/** Validate background-removal options. */
export function validateBgRemoveOptions(opts: BgRemoveOptions): { ok: true } | { error: string } {
  if (opts.threshold < 0 || opts.threshold > 442) return { error: "Threshold must be between 0 and 442" };
  if (opts.sampleSize < 1 || opts.sampleSize > 100) return { error: "Sample size must be between 1 and 100" };
  return { ok: true };
}

/** Validate image bounds for the algorithm. */
export function validateImageBounds(width: number, height: number): { ok: true } | { error: string } {
  if (width < 2 || height < 2) return { error: "Image must be at least 2x2 pixels" };
  if (width * height > 25_000_000) return { error: "Image too large for in-browser processing" };
  return { ok: true };
}
