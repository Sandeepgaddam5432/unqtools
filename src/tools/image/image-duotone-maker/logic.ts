/**
 * Image Duotone Maker — pure logic. No DOM / canvas access.
 *
 * Maps each pixel's luminance (0..1) to a position on a gradient between
 * two endpoint colors (shadow → highlight).
 */
export interface DuotoneOptions {
  /** Shadow color [r,g,b]. */
  shadow: [number, number, number];
  /** Highlight color [r,g,b]. */
  highlight: [number, number, number];
  /** Contrast boost 0..2 (1 = linear, >1 = punchier). */
  contrast: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate duotone options. */
export function validateDuotone(opts: DuotoneOptions): DuotoneOptions | { error: string } {
  if (opts.shadow.some((c) => c < 0 || c > 255)) return { error: "Shadow color must be 0..255" };
  if (opts.highlight.some((c) => c < 0 || c > 255)) return { error: "Highlight color must be 0..255" };
  if (opts.contrast < 0 || opts.contrast > 2) return { error: "Contrast must be 0..2" };
  return { shadow: opts.shadow, highlight: opts.highlight, contrast: opts.contrast };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Apply contrast adjustment to a normalized value (0..1). */
export function applyContrast(t: number, contrast: number): number {
  // power curve around 0.5 midpoint
  const c = clamp(contrast, 0, 2);
  if (c === 1) return t;
  return clamp(Math.pow(t, 1 / c), 0, 1);
}

/** Linear interpolation between two colors. */
export function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const u = clamp(t, 0, 1);
  return [
    clampByte(a[0] + (b[0] - a[0]) * u),
    clampByte(a[1] + (b[1] - a[1]) * u),
    clampByte(a[2] + (b[2] - a[2]) * u),
  ];
}

/** Map a single RGB pixel to its duotone value. */
export function duotonePixel(
  r: number,
  g: number,
  b: number,
  opts: DuotoneOptions,
): [number, number, number] {
  const t = applyContrast(luma(r, g, b) / 255, opts.contrast);
  return lerpColor(opts.shadow, opts.highlight, t);
}
