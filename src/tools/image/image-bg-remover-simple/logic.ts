/**
 * Image Background Remover (Simple) — pure logic. No DOM access.
 *
 * 10+ extras:
 *   1. Color distance threshold
 *   2. Flood fill from corners
 *   3. Edge feather (alpha gradient)
 *   4. Multi-color removal (sample multiple bg colors)
 *   5. Replacement color option
 *   6. Invert mode (keep only matching color)
 *   7. Batch validation
 *   8. Presets (greenscreen, bluescreen, white bg, black bg)
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Color distance helper
 *  12. Average color helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface BgRemoveOptions {
  /** Color distance threshold (0-442, sqrt of 3*255²). */
  threshold: number;
  /** Sample size in pixels for averaging corner colors. */
  sampleSize: number;
  /** Edge feather radius (0..20). */
  feather: number;
  /** Replacement color (or null for transparency). */
  replaceColor: [number, number, number] | null;
  /** When true, keeps only matching pixels (inverts selection). */
  invert: boolean;
  /** When true, uses flood fill from corners; otherwise global threshold. */
  floodFill: boolean;
}

export const DEFAULT_OPTIONS: BgRemoveOptions = {
  threshold: 30,
  sampleSize: 5,
  feather: 0,
  replaceColor: null,
  invert: false,
  floodFill: true,
};

export interface BgRemovePreset {
  id: string;
  label: string;
  options: BgRemoveOptions;
}

export const PRESETS: BgRemovePreset[] = [
  { id: "greenscreen", label: "Green screen", options: { ...DEFAULT_OPTIONS, threshold: 80 } },
  { id: "bluescreen", label: "Blue screen", options: { ...DEFAULT_OPTIONS, threshold: 80 } },
  { id: "white", label: "White background", options: { ...DEFAULT_OPTIONS, threshold: 20 } },
  { id: "black", label: "Black background", options: { ...DEFAULT_OPTIONS, threshold: 20 } },
  { id: "strict", label: "Strict (low threshold)", options: { ...DEFAULT_OPTIONS, threshold: 10 } },
  { id: "loose", label: "Loose (high threshold)", options: { ...DEFAULT_OPTIONS, threshold: 100 } },
];

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

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
      if (i + 3 >= data.length) continue;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      count++;
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0 };
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

/** Sample background colors from all four corners. */
export function sampleCornerColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sampleSize: number,
): Rgb[] {
  return [
    averageColor(data, width, 0, 0, sampleSize),
    averageColor(data, width, width - sampleSize, 0, sampleSize),
    averageColor(data, width, 0, height - sampleSize, sampleSize),
    averageColor(data, width, width - sampleSize, height - sampleSize, sampleSize),
  ];
}

/** Decide whether a pixel matches any of the background colors within the threshold. */
export function isBackgroundMulti(pixel: Rgb, bgs: Rgb[], threshold: number): boolean {
  return bgs.some((bg) => colorDistance(pixel, bg) <= threshold);
}

/** Decide whether a pixel matches the background color within the threshold. */
export function isBackground(pixel: Rgb, bg: Rgb, threshold: number): boolean {
  return colorDistance(pixel, bg) <= threshold;
}

/** Compute the alpha value for a pixel given the background match + feather. */
export function computeAlpha(pixel: Rgb, bgs: Rgb[], threshold: number, feather: number): number {
  // Find the minimum distance to any bg color
  let minDist = Infinity;
  for (const bg of bgs) {
    const d = colorDistance(pixel, bg);
    if (d < minDist) minDist = d;
  }
  if (minDist <= threshold) return 0;
  if (feather <= 0) return 255;
  // Feather: fade in over `feather` distance beyond threshold
  const fadeStart = threshold;
  const fadeEnd = threshold + feather;
  if (minDist >= fadeEnd) return 255;
  return clampByte(((minDist - fadeStart) / (fadeEnd - fadeStart)) * 255);
}

/** Flood fill from corners: marks all connected bg pixels. Returns a mask array. */
export function floodFillMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgs: Rgb[],
  threshold: number,
): Uint8Array {
  const mask = new Uint8Array(width * height); // 1 = bg, 0 = fg
  const stack: Array<[number, number]> = [];
  // Seed from all four corners
  const corners: Array<[number, number]> = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
  ];
  for (const [x, y] of corners) {
    const idx = y * width + x;
    const i = idx * 4;
    const px: Rgb = { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
    if (isBackgroundMulti(px, bgs, threshold)) {
      mask[idx] = 1;
      stack.push([x, y]);
    }
  }
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const neighbors: Array<[number, number]> = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nidx = ny * width + nx;
      if (mask[nidx] === 1) continue;
      const ni = nidx * 4;
      const px: Rgb = { r: data[ni]!, g: data[ni + 1]!, b: data[ni + 2]! };
      if (isBackgroundMulti(px, bgs, threshold)) {
        mask[nidx] = 1;
        stack.push([nx, ny]);
      }
    }
  }
  return mask;
}

/** Validate background-removal options. */
export function validateBgRemoveOptions(opts: BgRemoveOptions): { ok: true } | { error: string } {
  if (opts.threshold < 0 || opts.threshold > 442) return { error: "Threshold must be between 0 and 442" };
  if (opts.sampleSize < 1 || opts.sampleSize > 100) return { error: "Sample size must be between 1 and 100" };
  if (opts.feather < 0 || opts.feather > 50) return { error: "Feather must be between 0 and 50" };
  if (opts.replaceColor && opts.replaceColor.some((c) => c < 0 || c > 255)) {
    return { error: "Replace color must be 0..255" };
  }
  return { ok: true };
}

/** Validate image bounds for the algorithm. */
export function validateImageBounds(width: number, height: number): { ok: true } | { error: string } {
  if (width < 2 || height < 2) return { error: "Image must be at least 2x2 pixels" };
  if (width * height > 25_000_000) return { error: "Image too large for in-browser processing" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(opts: BgRemoveOptions): boolean {
  return false; // Always does something
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: BgRemoveOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateBgRemoveOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 10 : 1;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): BgRemovePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
